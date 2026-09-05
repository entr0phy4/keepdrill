import { useCallback, useEffect, useRef, useState } from 'react'
import { useCapture } from '../capture/use-capture'

// A single native <textarea> capture surface (D-04, D-05, D-10). No
// per-character coloring, no whitespace glyphs, no caret overlay — that is the
// Phase 2 trainer. Committed-character semantics (beforeinput/input, IME) live
// in capture.ts; this component only surfaces the paste-blocked inline flag
// (CAPT-04, 01-UI-SPEC.md Copywriting Contract).

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

export function CaptureSurface() {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const [pasteBlocked, setPasteBlocked] = useState(false)
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handlePasteBlocked = useCallback(() => {
    if (fadeTimeoutRef.current !== null) clearTimeout(fadeTimeoutRef.current)
    setPasteBlocked(true)
    fadeTimeoutRef.current = setTimeout(() => {
      setPasteBlocked(false)
      fadeTimeoutRef.current = null
    }, PASTE_BLOCKED_FADE_MS)
  }, [])

  const { count } = useCapture(ref, handlePasteBlocked)

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

  const reclaimFocus = () => ref.current?.focus()

  return (
    <section
      style={{ display: 'grid', gap: 'var(--space-sm)' }}
      onClick={reclaimFocus}
    >
      <label htmlFor="capture-surface" className="text-label">
        Type here
      </label>
      <textarea
        id="capture-surface"
        ref={ref}
        rows={8}
        spellCheck={false}
        autoComplete="off"
        aria-describedby="capture-count capture-paste-blocked"
      />
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
