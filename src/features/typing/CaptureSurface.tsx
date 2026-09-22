import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { useCapture } from '@/capture/use-capture'
import { getCharLog } from '@/capture/capture'
import { computeTrainerState, glyphFor } from '@/trainer/state'
import { lineIndexAt, tokenKinds } from './highlight'
import { prefersReducedMotion } from '@/shared/hooks'
import { useCharLogTick } from './hooks/use-char-log-tick'

// The transparent-textarea-over-rendered-layer overlay (D-01/D-02): the native
// <textarea> stays the sole input/focus/caret host (beforeinput/input, IME,
// paste-block all still live in capture.ts, unchanged); this component's own
// rendered-layer <div> shows live per-character correctness coloring plus a
// custom in-flow caret derived from trainer/state.ts's `cursor` (D-10) — never
// from textarea.selectionStart directly.

const PASTE_BLOCKED_COPY =
  'Pasting into the typing area is disabled - type the exercise to record real keystrokes.'
const PASTE_BLOCKED_FADE_MS = 4000

export function CaptureSurface({
  text,
  plain = false,
  language = 'plaintext',
  onRestartRequested,
  onComplete,
}: {
  text: string
  /** Full source, no trainer chrome. Whitespace stays as in the file. */
  plain?: boolean
  language?: string
  onRestartRequested?: () => void
  onComplete?: (completedAt: number) => void
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const caretRef = useRef<HTMLSpanElement | null>(null)
  const placedRef = useRef<string | null>(null)
  const [pasteBlocked, setPasteBlocked] = useState(false)
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // D-07: guards onComplete so it fires at most once per distinct
  // `completedAt` value, even across re-renders/rAF ticks after completion.
  const firedCompletedAtRef = useRef<number | null>(null)
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
    // T-02-09 / WR-2: reject non-trusted (script-dispatched) keydown events
    // before evaluating Escape/Tab, matching the same guard shape already
    // used by every handler in src/capture/capture.ts (T-01-04 convention) —
    // a synthetic Escape must never be able to trigger Restart.
    if (!e.isTrusted) return
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

  const { perCharStatus, cursor, completedAt } = computeTrainerState(text, getCharLog())

  // D-07: fires onComplete exactly once per distinct completedAt transition
  // (null -> non-null, or one non-null value to a different one — though the
  // latter never happens per state.ts's "never overwritten" comment). The
  // ref guard makes repeated calls to computeSessionMetrics safe even if this
  // effect re-runs on an unrelated re-render.
  useEffect(() => {
    if (completedAt !== null && firedCompletedAtRef.current !== completedAt) {
      firedCompletedAtRef.current = completedAt
      onComplete?.(completedAt)
    }
  }, [completedAt, onComplete])

  // D-10 / T-02-08: force the native selection back to the logical cursor
  // whenever it drifts (arrow keys / Home / End / click) — the rendered
  // caret is the only source of truth for cursor position, never
  // textarea.selectionStart. Recreated each render (same pattern as
  // handleKeyDown/reclaimFocus) so it always closes over this render's
  // `cursor`. Called from two sites: the post-commit useLayoutEffect below
  // (cursor-driven re-renders) AND the textarea's onSelect handler (native
  // "select" events fired by ArrowLeft/Right/Home/End/click, which don't
  // change `cursor` and so schedule no re-render on their own — this is
  // the actual fix for 02-VERIFICATION.md gap #1 / 02-REVIEW.md WR-1).
  // Set for the turn that owns a beforeinput. selectionchange fires in that
  // same turn, while `cursor` is still the pre-edit value. Snapping the
  // textarea selection back then makes Chrome delete a second character.
  const suppressResyncRef = useRef(false)
  const noteEdit = () => {
    suppressResyncRef.current = true
    queueMicrotask(() => {
      suppressResyncRef.current = false
    })
  }

  const resyncCaret = useCallback(() => {
    if (suppressResyncRef.current) return
    const el = ref.current
    if (!el) return
    if (el.selectionStart !== cursor || el.selectionEnd !== cursor) {
      el.selectionStart = cursor
      el.selectionEnd = cursor
    }
  }, [cursor])

  useLayoutEffect(() => {
    resyncCaret()
  }, [resyncCaret])

  const reclaimFocus = () => ref.current?.focus()

  // Code-point array, not raw string indexing — matches computeTrainerState's
  // (state.ts) code-point-indexed `perCharStatus`. `textChars.length` and
  // `textChars[i]` are UTF-16-code-unit semantics if taken directly from
  // `text`, which would desync from `cursor`/`perCharStatus` for any
  // supplementary-plane character (surrogate pair) in the exercise.
  const textChars = Array.from(text)
  const kinds = useMemo(
    () => (plain ? tokenKinds(text, language) : []),
    [plain, text, language],
  )
  const line = lineIndexAt(textChars, cursor)
  const [filePad, setFilePad] = useState(0)

  useLayoutEffect(() => {
    placedRef.current = null
  }, [text])

  useLayoutEffect(() => {
    if (!plain) return
    const stack = scrollerRef.current
    if (!stack) return
    const scroller = stack.closest('.file-source-body')
    if (!(scroller instanceof HTMLElement)) return
    const apply = () => {
      const next = Math.max(0, Math.round(scroller.clientHeight / 2))
      const host = scroller.closest('.file-source')
      if (host instanceof HTMLElement) host.style.setProperty('--file-pad', `${next}px`)
      setFilePad((prev) => (prev === next ? prev : next))
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [plain])

  useLayoutEffect(() => {
    if (!plain) return
    const stack = scrollerRef.current
    const caret = caretRef.current
    if (!stack || !caret) return
    const scroller = stack.closest('.file-source-body')
    if (!(scroller instanceof HTMLElement)) return
    const mark = `${line}:${filePad}`
    if (placedRef.current === mark) return
    placedRef.current = mark
    const caretRect = caret.getBoundingClientRect()
    const box = scroller.getBoundingClientRect()
    const delta = caretRect.top + caretRect.height / 2 - (box.top + box.height / 2)
    scroller.scrollTo({
      top: scroller.scrollTop + delta,
      behavior: prefersReducedMotion() ? 'instant' : 'smooth',
    })
  }, [plain, line, text, filePad])

  const caretMark = (key: string) => (
    <span
      key={key}
      ref={caretRef}
      className="trainer-caret"
      data-active={isActive}
      aria-hidden="true"
    />
  )

  const charMark = (i: number) => {
    const targetChar = textChars[i] ?? ''
    const isWhitespaceGlyph = !plain && (targetChar === ' ' || targetChar === '\n')
    const token = plain ? kinds[i] : undefined
    return (
      <span
        key={i}
        data-status={perCharStatus[i] ?? 'pending'}
        data-token={token && token !== 'plain' ? token : undefined}
        data-caret-target={plain && i === cursor ? '' : undefined}
        data-nl={plain && targetChar === '\n' ? '' : undefined}
      >
        {isWhitespaceGlyph ? <span className="ws-glyph">{glyphFor(targetChar)}</span> : targetChar}
      </span>
    )
  }

  const nodes: ReactNode[] = []
  if (plain) {
    let lineNodes: ReactNode[] = []
    let lineIdx = 0
    const flushLine = () => {
      const idx = lineIdx
      nodes.push(
        <span
          key={`line-${idx}`}
          className="file-line"
          data-current-line={idx === line ? '' : undefined}
        >
          {lineNodes}
        </span>,
      )
      lineNodes = []
      lineIdx += 1
    }
    for (let i = 0; i < textChars.length; i++) {
      if (i === cursor) lineNodes.push(caretMark(`caret-${i}`))
      lineNodes.push(charMark(i))
      if (textChars[i] === '\n') flushLine()
    }
    if (cursor >= textChars.length) lineNodes.push(caretMark('caret-end'))
    if (lineNodes.length > 0 || textChars.length === 0) flushLine()
  } else {
    for (let i = 0; i < textChars.length; i++) {
      if (i === cursor) nodes.push(caretMark(`caret-${i}`))
      nodes.push(charMark(i))
    }
    if (cursor >= textChars.length) nodes.push(caretMark('caret-end'))
  }

  const stack = (
    <div ref={scrollerRef} className="trainer-stack" onClick={reclaimFocus}>
      <textarea
        id="capture-surface"
        ref={ref}
        className="trainer-textarea"
        rows={plain ? 1 : 8}
        spellCheck={false}
        autoComplete="off"
        aria-label={plain ? 'Type the file' : undefined}
        aria-describedby={plain ? undefined : 'capture-count capture-paste-blocked'}
        onKeyDown={handleKeyDown}
        onBeforeInput={noteEdit}
        onSelect={resyncCaret}
        onFocus={() => setIsActive(true)}
        onBlur={() => setIsActive(false)}
      />
      <div className="trainer-rendered-layer" aria-hidden="true">
        {nodes}
      </div>
    </div>
  )

  if (plain) return stack

  return (
    <section className="grid gap-2" onClick={reclaimFocus}>
      <label htmlFor="capture-surface" className="text-label">
        Type here
      </label>
      {stack}
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
