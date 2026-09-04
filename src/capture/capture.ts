import type { KeystrokeEvent } from './types'

// The ONLY platform-coupled hot path (D-13). 01-RESEARCH.md Pattern 1, verbatim
// shape. The handler constructs one KeystrokeEvent and pushes it — nothing else:
// no setState, no metric math, no DOM read, no other clock or timer call (D-07,
// PITFALLS #2).

const buffer: KeystrokeEvent[] = []
const downCodes = new Set<string>()
let seq = 0

let boundTarget: HTMLElement | null = null

const onKeyDown = (e: KeyboardEvent) => onKey(e, 'keydown')
const onKeyUp = (e: KeyboardEvent) => onKey(e, 'keyup')

function onKey(e: KeyboardEvent, type: 'keydown' | 'keyup'): void {
  if (!e.isTrusted) return // reject synthetic / extension input (T-01-04)

  // OS key-repeat: event.repeat, plus a per-code down-set fallback for
  // environments that never set .repeat (RDP, some WebViews) — D-06.
  const isRepeat = e.repeat || (type === 'keydown' && downCodes.has(e.code))
  if (type === 'keydown') downCodes.add(e.code)
  else downCodes.delete(e.code)

  buffer.push({
    seq: seq++,
    type,
    key: e.key,
    code: e.code,
    ctrl: e.ctrlKey,
    alt: e.altKey,
    shift: e.shiftKey,
    meta: e.metaKey,
    tMs: e.timeStamp,
    isRepeat,
  })
  // nothing else
}

/** Idempotent: re-binding detaches the previous binding first so a React remount
 *  cannot double-bind (CAPT-02 idempotency edge). */
export function attachCapture(target: HTMLElement): void {
  if (boundTarget) detachCapture()
  boundTarget = target
  target.addEventListener('keydown', onKeyDown)
  target.addEventListener('keyup', onKeyUp)
}

export function detachCapture(): void {
  if (!boundTarget) return
  boundTarget.removeEventListener('keydown', onKeyDown)
  boundTarget.removeEventListener('keyup', onKeyUp)
  boundTarget = null
}

/** Append-only buffer, exposed read-only (D-13). Returns a frozen snapshot so
 *  callers cannot mutate capture state; the hot path is the push, not this read. */
export function getEvents(): readonly KeystrokeEvent[] {
  return Object.freeze(buffer.slice())
}

/** Test / restart support — clears buffer, down-set and the seq counter. */
export function resetCapture(): void {
  buffer.length = 0
  downCodes.clear()
  seq = 0
}
