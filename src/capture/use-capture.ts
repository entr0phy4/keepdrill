import { type RefObject, useLayoutEffect, useSyncExternalStore } from 'react'
import { attachCapture, detachCapture, getEvents } from './capture'

// Attach the keydown/keyup listeners in useLayoutEffect — BEFORE the surface is
// focused (PITFALLS #2, first-keystroke loss). Detach on unmount.
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

export function useCapture(target: RefObject<HTMLElement | null>): { count: number } {
  useLayoutEffect(() => {
    const el = target.current
    if (!el) return
    attachCapture(el)
    return () => {
      detachCapture()
    }
  }, [target])

  const count = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return { count }
}
