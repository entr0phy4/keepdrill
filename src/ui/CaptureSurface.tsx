import { useEffect, useRef } from 'react'
import { useCapture } from '../capture/use-capture'

// A single native <textarea> capture surface (D-04, D-05, D-10). No
// per-character coloring, no whitespace glyphs, no caret overlay — that is the
// Phase 2 trainer. Committed-character semantics (beforeinput/input, IME,
// selective paste-block) are Plan 01-03.

export function CaptureSurface() {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const { count } = useCapture(ref)

  // Focus AFTER useCapture's useLayoutEffect has attached the listeners
  // (PITFALLS #2 — no first-keystroke loss). A plain effect runs after layout effects.
  useEffect(() => {
    ref.current?.focus()
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
        aria-describedby="capture-count"
      />
      <span id="capture-count" className="text-muted">
        {count} keystroke event{count === 1 ? '' : 's'} recorded
      </span>
    </section>
  )
}
