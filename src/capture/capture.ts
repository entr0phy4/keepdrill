import type { CaptureMarker, CommittedChar, KeystrokeEvent, MarkerKind } from './types'
import { recordMeasuredResolutionUs } from '../platform/isolation'

// The ONLY platform-coupled hot path (D-13). 01-RESEARCH.md Pattern 1, verbatim
// shape. The handler constructs one KeystrokeEvent and pushes it — nothing else:
// no setState, no metric math, no DOM read, no other clock or timer call (D-07,
// PITFALLS #2).

const buffer: KeystrokeEvent[] = []
const charLog: CommittedChar[] = []
const markers: CaptureMarker[] = []
const downCodes = new Set<string>()
let seq = 0
let composing = false

// Firefox-delete-inputType fallback ground truth (Pitfall 9 addendum): the
// last-seen textarea value, used by onInput to backfill a deletion record if
// beforeinput was skipped for that change.
let lastValue = ''

// beforeinput and input for one key often carry different timeStamps. Pair
// them with a flag instead, or Backspace is recorded twice and the cursor
// steps back two characters. Cleared from onInput and via setTimeout(0) —
// NOT queueMicrotask: browsers can flush microtasks between beforeinput and
// input, which would reopen the double-record path on the same key.
let editFromBeforeInput = false
let editFromBeforeInputClearTimer: ReturnType<typeof setTimeout> | null = null

// Timer-resolution measurement tap (A10): fed from real (non-repeat) keydowns
// via a microtask so the hot-path push above stays a single synchronous op —
// the delta math never runs inline in the handler.
let lastRealKeydownTMs: number | null = null

// Single active subscriber — one CaptureSurface is focused at a time.
let pasteBlockedHandler: (() => void) | null = null

let boundTarget: HTMLElement | null = null
let windowListenersBound = false

const onKeyDown = (e: KeyboardEvent) => onKey(e, 'keydown')
const onKeyUp = (e: KeyboardEvent) => onKey(e, 'keyup')

function onKey(e: KeyboardEvent, type: 'keydown' | 'keyup'): void {
  if (!e.isTrusted) return // reject synthetic / extension input (T-01-04)

  // OS key-repeat: event.repeat, plus a per-code down-set fallback for
  // environments that never set .repeat (RDP, some WebViews) — D-06.
  const isRepeat = e.repeat || (type === 'keydown' && downCodes.has(e.code))
  if (type === 'keydown') downCodes.add(e.code)
  else downCodes.delete(e.code)

  const tMs = e.timeStamp

  // WR-02: freeze each element at push time, not just the array returned by
  // getEvents() — Object.freeze on the outer array (getEvents) only blocks
  // push/pop/index-reassignment, not property mutation on the elements it
  // contains, since buffer.slice() copies references, not the objects
  // themselves. Freezing here guarantees every consumer (regardless of how
  // they got the reference) gets an immutable event.
  buffer.push(
    Object.freeze({
      seq: seq++,
      type,
      key: e.key,
      code: e.code,
      ctrl: e.ctrlKey,
      alt: e.altKey,
      shift: e.shiftKey,
      meta: e.metaKey,
      tMs,
      isRepeat,
    }),
  )
  // nothing else in the hot path — the resolution sample is scheduled, not
  // computed inline.
  if (type === 'keydown' && !isRepeat) scheduleResolutionSample(tMs)
}

/** Delta math deferred to a microtask so onKey's push stays the only
 *  synchronous work in the hot path (A10). */
function scheduleResolutionSample(tMs: number): void {
  queueMicrotask(() => {
    if (lastRealKeydownTMs !== null) {
      recordMeasuredResolutionUs((tMs - lastRealKeydownTMs) * 1000)
    }
    lastRealKeydownTMs = tMs
  })
}

/** beforeinput -> data mapped per 01-RESEARCH.md's inputType table. */
function charRecordFor(e: InputEvent): { inputType: string; data: string | null } {
  const inputType = e.inputType
  if (inputType === 'insertLineBreak') return { inputType, data: '\n' }
  if (inputType.startsWith('delete')) return { inputType, data: null }
  // insertText, insertReplacementText, historyUndo/Redo, etc. — data as reported.
  return { inputType, data: e.data }
}

function markBeforeInput(): void {
  editFromBeforeInput = true
  if (editFromBeforeInputClearTimer !== null) clearTimeout(editFromBeforeInputClearTimer)
  // Macrotask backup for beforeinput with no following input (preventDefault,
  // abandoned edit). Survives a microtask checkpoint between the two events.
  editFromBeforeInputClearTimer = setTimeout(() => {
    editFromBeforeInput = false
    editFromBeforeInputClearTimer = null
  }, 0)
}

function onBeforeInput(e: Event): void {
  if (!(e instanceof InputEvent)) return
  if (!e.isTrusted) return // T-01-04

  markBeforeInput()

  if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') {
    e.preventDefault() // safe on beforeinput, unlike keydown (D-04)
    pasteBlockedHandler?.()
    return // never recorded as a committed char, never a keystroke event
  }

  if (composing) return // per-char attribution suspended during IME composition

  const { inputType, data } = charRecordFor(e)
  charLog.push(Object.freeze({ seq: seq++, inputType, data, tMs: e.timeStamp }))
}

/** `input` fires after the DOM changed — textarea.value is the authoritative
 *  result (Firefox skips beforeinput for some delete inputTypes). */
function onInput(e: Event): void {
  if (!(e instanceof InputEvent)) return
  if (!e.isTrusted) return

  const el = e.target as HTMLTextAreaElement
  const value = el.value
  const alreadyRecorded = editFromBeforeInput
  editFromBeforeInput = false
  if (editFromBeforeInputClearTimer !== null) {
    clearTimeout(editFromBeforeInputClearTimer)
    editFromBeforeInputClearTimer = null
  }

  if (!alreadyRecorded && value.length < lastValue.length) {
    // beforeinput was skipped for this deletion — value diff is ground truth.
    charLog.push(
      Object.freeze({
        seq: seq++,
        inputType: e.inputType || 'deleteContentBackward',
        data: null,
        tMs: e.timeStamp,
      }),
    )
  }
  lastValue = value
}

function onCompositionStart(e: Event): void {
  if (!e.isTrusted) return
  composing = true
}

function onCompositionEnd(e: Event): void {
  if (!e.isTrusted) return
  composing = false
  const data = e instanceof CompositionEvent ? e.data : null
  charLog.push(Object.freeze({ seq: seq++, inputType: 'insertFromComposition', data, tMs: e.timeStamp }))
}

function pushMarker(kind: MarkerKind, tMs: number): void {
  markers.push(Object.freeze({ seq: seq++, kind, tMs }))
}

/** Alt-tab mid-hold must not wedge a key — clear the down-set (PITFALLS #3, A7).
 *  WR-06: also reset `composing` — if a blur interrupts an active IME
 *  composition and the platform/IME never fires `compositionend` (behavior
 *  varies), `composing` would otherwise stay `true` forever, silently
 *  dropping every subsequent beforeinput from charLog (onBeforeInput's
 *  `if (composing) return` guard). */
function onWindowBlur(e: FocusEvent): void {
  downCodes.clear()
  composing = false
  pushMarker('blur', e.timeStamp)
}

function onWindowFocus(e: FocusEvent): void {
  pushMarker('focus', e.timeStamp)
}

function onVisibilityChange(e: Event): void {
  if (document.hidden) {
    downCodes.clear()
    composing = false // WR-06 — same abandoned-composition risk as blur
    pushMarker('hidden', e.timeStamp)
  } else {
    pushMarker('visible', e.timeStamp)
  }
}

/** Idempotent: re-binding detaches the previous binding first so a React remount
 *  cannot double-bind (CAPT-02 idempotency edge). Wires keydown/keyup/beforeinput/
 *  input/compositionstart/compositionend on `target`, plus blur/focus on `window`
 *  and visibilitychange on `document` (RESEARCH Open Question 2, RESOLVED). */
export function attachCapture(target: HTMLElement): void {
  if (boundTarget) detachCapture()
  boundTarget = target
  target.addEventListener('keydown', onKeyDown)
  target.addEventListener('keyup', onKeyUp)
  target.addEventListener('beforeinput', onBeforeInput)
  target.addEventListener('input', onInput)
  target.addEventListener('compositionstart', onCompositionStart)
  target.addEventListener('compositionend', onCompositionEnd)

  window.addEventListener('blur', onWindowBlur)
  window.addEventListener('focus', onWindowFocus)
  document.addEventListener('visibilitychange', onVisibilityChange)
  windowListenersBound = true
}

export function detachCapture(): void {
  if (boundTarget) {
    boundTarget.removeEventListener('keydown', onKeyDown)
    boundTarget.removeEventListener('keyup', onKeyUp)
    boundTarget.removeEventListener('beforeinput', onBeforeInput)
    boundTarget.removeEventListener('input', onInput)
    boundTarget.removeEventListener('compositionstart', onCompositionStart)
    boundTarget.removeEventListener('compositionend', onCompositionEnd)
    boundTarget = null
  }
  if (windowListenersBound) {
    window.removeEventListener('blur', onWindowBlur)
    window.removeEventListener('focus', onWindowFocus)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    windowListenersBound = false
  }
}

/** Registers the sole paste-blocked subscriber (CaptureSurface, via useCapture). */
export function setPasteBlockedHandler(handler: (() => void) | null): void {
  pasteBlockedHandler = handler
}

/** Append-only buffer, exposed read-only (D-13). Returns a frozen snapshot so
 *  callers cannot mutate capture state; the hot path is the push, not this
 *  read. Each element is also frozen at push time (WR-02) so mutating a
 *  property of a returned event throws (or is a silent no-op outside strict
 *  mode) rather than corrupting the live buffer through a shared reference. */
export function getEvents(): readonly KeystrokeEvent[] {
  return Object.freeze(buffer.slice())
}

/** Committed-character log — a sibling of getEvents(), reconciled by `seq`,
 *  never merged (Pitfall 9). */
export function getCharLog(): readonly CommittedChar[] {
  return Object.freeze(charLog.slice())
}

/** Lifecycle markers (blur/focus/hidden/visible) so Phase 2/3 can bound active
 *  time (A7). */
export function getMarkers(): readonly CaptureMarker[] {
  return Object.freeze(markers.slice())
}

/** Test / restart support — clears all three logs, the down-set, composing
 *  state, resolution-sample state, and the seq counter. */
export function resetCapture(): void {
  buffer.length = 0
  charLog.length = 0
  markers.length = 0
  downCodes.clear()
  composing = false
  lastValue = ''
  editFromBeforeInput = false
  if (editFromBeforeInputClearTimer !== null) {
    clearTimeout(editFromBeforeInputClearTimer)
    editFromBeforeInputClearTimer = null
  }
  lastRealKeydownTMs = null
  seq = 0
}
