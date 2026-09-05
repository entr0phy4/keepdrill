import { type RefObject, useLayoutEffect, useSyncExternalStore } from 'react'
import { attachCapture, detachCapture, getEvents, setPasteBlockedHandler } from './capture'

// Attach the keydown/keyup listeners in useLayoutEffect — BEFORE the surface is
// focused (PITFALLS #2, first-keystroke loss). Detach on unmount.
//
// attachCapture/detachCapture own the actual wiring of every listener type —
// keydown, keyup, beforeinput, input, compositionstart, compositionend on the
// target, plus blur/focus on window and visibilitychange on document (RESEARCH
// Open Question 2, RESOLVED) — so capture.test.ts can exercise all of it
// without React. This hook's job is mount/unmount timing plus forwarding the
// optional paste-blocked subscription; nothing here double-binds those
// listeners.
//
// `count` is surfaced via useSyncExternalStore with a throttled subscribe so it
// never drives a per-keystroke re-render (PITFALLS #2 / Performance Traps). The
// hot path (capture.ts) knows nothing about React.

const THROTTLE_MS = 250

function subscribe(onChange: () => void): () => void {
  const id = setInterval(onChange, THROTTLE_MS)
  return () => clearInterval(id)
}

function getSnapshot(): number {
  return getEvents().length
}

export function useCapture(
  target: RefObject<HTMLElement | null>,
  onPasteBlocked?: () => void,
): { count: number } {
  useLayoutEffect(() => {
    const el = target.current
    if (!el) return
    attachCapture(el)
    setPasteBlockedHandler(onPasteBlocked ?? null)
    return () => {
      setPasteBlockedHandler(null)
      detachCapture()
    }
  }, [target, onPasteBlocked])

  const count = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return { count }
}
