import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { useCapture } from '../capture/use-capture'
import { getCharLog } from '../capture/capture'
import { computeTrainerState, glyphFor } from '../trainer/state'

// The transparent-textarea-over-rendered-layer overlay (D-01/D-02): the native
// <textarea> stays the sole input/focus/caret host (beforeinput/input, IME,
// paste-block all still live in capture.ts, unchanged); this component's own
// rendered-layer <div> shows live per-character correctness coloring plus a
// custom in-flow caret derived from trainer/state.ts's `cursor` (D-10) — never
// from textarea.selectionStart directly.

const PASTE_BLOCKED_COPY =
  'Pasting into the typing area is disabled - type the exercise to record real keystrokes.'
const PASTE_BLOCKED_FADE_MS = 4000

/** No `index.css` access in this plan's scope (Interaction Contract's fade is
 *  a global `@media (prefers-reduced-motion: no-preference)` concern) — honor
 *  the same rule locally via `matchMedia` so the opacity transition is skipped
 *  entirely for users who asked for reduced motion. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

// D-13: a per-frame (not per-250ms) re-render trigger for "live" trainer
// feedback — mirrors use-capture.ts's throttled-subscribe shape exactly, just
// on requestAnimationFrame instead of setInterval. getSnapshot only reads
// getCharLog().length; React bails out via useSyncExternalStore when the
// snapshot is unchanged, so this never touches capture.ts's hot path.
function subscribeCharLogTick(onChange: () => void): () => void {
  let raf = requestAnimationFrame(function tick() {
    onChange()
    raf = requestAnimationFrame(tick)
  })
  return () => cancelAnimationFrame(raf)
}

function getCharLogTickSnapshot(): number {
  return getCharLog().length
}

function useCharLogTick(): number {
  return useSyncExternalStore(subscribeCharLogTick, getCharLogTickSnapshot, getCharLogTickSnapshot)
}

export function CaptureSurface({
  text,
  onRestartRequested,
}: {
  text: string
  onRestartRequested?: () => void
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const [pasteBlocked, setPasteBlocked] = useState(false)
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // D-07 amended / D-09: focus+visibility-driven caret blink gate. Starts
  // `true` because the textarea is focused on mount (see the focus effect
  // below) — the caret should render as active/blinking from first paint,
  // not flash to inactive before the focus effect runs.
  const [isActive, setIsActive] = useState(true)

  const handlePasteBlocked = useCallback(() => {
    if (fadeTimeoutRef.current !== null) clearTimeout(fadeTimeoutRef.current)
    setPasteBlocked(true)
    fadeTimeoutRef.current = setTimeout(() => {
      setPasteBlocked(false)
      fadeTimeoutRef.current = null
    }, PASTE_BLOCKED_FADE_MS)
  }, [])

  const { count } = useCapture(ref, handlePasteBlocked)
  // Triggers a re-render every animation frame the char log changes — the
  // returned number itself is unused; computeTrainerState below re-reads
  // getCharLog() fresh on every render regardless.
  useCharLogTick()

  // Focus AFTER useCapture's useLayoutEffect has attached the listeners
  // (PITFALLS #2 — no first-keystroke loss). A plain effect runs after layout effects.
  useEffect(() => {
    ref.current?.focus()
  }, [])

  // Clear the fade timeout on unmount so it never fires against an unmounted
  // component.
  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current !== null) clearTimeout(fadeTimeoutRef.current)
    }
  }, [])

  // D-09 backstop: the caret renders solid (not blinking) while the tab is
  // hidden, independent of textarea focus/blur — a hidden tab cannot receive
  // a native blur event on some platforms, so visibilitychange is tracked
  // separately from onFocus/onBlur below.
  useEffect(() => {
    const onVisibilityChange = () => {
      setIsActive(!document.hidden)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    // Escape checked first (D-07 amended, UI-SPEC's Keyboard-only Restart
    // access amendment): the keyboard-only path to Restart, since Tab order
    // can never reach the Restart button while Tab is fully absorbed below.
    if (e.key === 'Escape') {
      e.preventDefault()
      onRestartRequested?.()
      return
    }
    // D-07 amended: Tab is fully absorbed — no character insertion, no
    // cursor movement, no new capture.ts synthetic-record export at all.
    // Supersedes 02-RESEARCH.md's pre-amendment synthetic-character-capture
    // design (and 02-PATTERNS.md's matching pre-amendment pattern).
    if (e.key === 'Tab') {
      e.preventDefault()
    }
  }

  const { perCharStatus, cursor } = computeTrainerState(text, getCharLog())

  // D-10: force the native selection back to the logical cursor whenever it
  // drifts (arrow keys / click) — the rendered caret is the only source of
  // truth for cursor position, never textarea.selectionStart.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.selectionStart !== cursor || el.selectionEnd !== cursor) {
      el.selectionStart = cursor
      el.selectionEnd = cursor
    }
  }, [cursor])

  const reclaimFocus = () => ref.current?.focus()

  const nodes: ReactNode[] = []
  for (let i = 0; i < text.length; i++) {
    if (i === cursor) {
      nodes.push(<span key={`caret-${i}`} className="trainer-caret" data-active={isActive} aria-hidden="true" />)
    }
    const targetChar = text[i] ?? ''
    const isWhitespaceGlyph = targetChar === ' ' || targetChar === '\n'
    nodes.push(
      <span key={i} data-status={perCharStatus[i] ?? 'pending'}>
        {isWhitespaceGlyph ? <span className="ws-glyph">{glyphFor(targetChar)}</span> : targetChar}
      </span>,
    )
  }
  if (cursor >= text.length) {
    nodes.push(<span key="caret-end" className="trainer-caret" data-active={isActive} aria-hidden="true" />)
  }

  return (
    <section
      style={{ display: 'grid', gap: 'var(--space-sm)' }}
      onClick={reclaimFocus}
    >
      <label htmlFor="capture-surface" className="text-label">
        Type here
      </label>
      <div className="trainer-stack">
        <textarea
          id="capture-surface"
          ref={ref}
          className="trainer-textarea"
          rows={8}
          spellCheck={false}
          autoComplete="off"
          aria-describedby="capture-count capture-paste-blocked"
          onKeyDown={handleKeyDown}
          onFocus={() => setIsActive(true)}
          onBlur={() => setIsActive(false)}
        />
        <div className="trainer-rendered-layer" aria-hidden="true">
          {nodes}
        </div>
      </div>
      <span id="capture-count" className="text-muted">
        {count} keystroke event{count === 1 ? '' : 's'} recorded
      </span>
      {/* Reserves its row so appearing/fading causes no layout shift. */}
      <p
        id="capture-paste-blocked"
        role="status"
        aria-hidden={!pasteBlocked}
        className="text-muted"
        style={{
          margin: 0,
          minHeight: '1.4em',
          opacity: pasteBlocked ? 1 : 0,
          transition: prefersReducedMotion() ? 'none' : 'opacity var(--motion-duration) ease',
        }}
      >
        {PASTE_BLOCKED_COPY}
      </p>
    </section>
  )
}
