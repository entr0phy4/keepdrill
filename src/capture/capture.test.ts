import { beforeEach, describe, it, expect } from 'vitest'
import {
  attachCapture,
  detachCapture,
  getCharLog,
  getEvents,
  getMarkers,
  resetCapture,
  setPasteBlockedHandler,
} from './capture'

// happy-dom. Capture-correctness proofs for the walking skeleton — these lock the
// CAPT-01 / CAPT-02 / CAPT-03 edge behaviors. Plan 01-03 adds beforeinput /
// composition / blur handling on top.

function trustedKeyEvent(type: string, init: Partial<KeyboardEventInit> = {}, tMs?: number): KeyboardEvent {
  // happy-dom leaves isTrusted undefined on scripted events; real browser key
  // events are isTrusted = true. Force it so the capture guard is exercised as
  // it would be in production.
  const evt = new KeyboardEvent(type, { key: 'a', code: 'KeyA', bubbles: true, ...init })
  Object.defineProperty(evt, 'isTrusted', { value: true, configurable: true })
  if (tMs !== undefined) Object.defineProperty(evt, 'timeStamp', { value: tMs, configurable: true })
  return evt
}

function press(el: HTMLElement, type: 'keydown' | 'keyup', init: Partial<KeyboardEventInit> = {}, tMs?: number) {
  el.dispatchEvent(trustedKeyEvent(type, init, tMs))
}

function trustedInputEvent(type: string, init: InputEventInit = {}): InputEvent {
  const evt = new InputEvent(type, { bubbles: true, cancelable: true, ...init })
  Object.defineProperty(evt, 'isTrusted', { value: true, configurable: true })
  return evt
}

function beforeInput(el: HTMLElement, init: InputEventInit = {}): InputEvent {
  const evt = trustedInputEvent('beforeinput', init)
  el.dispatchEvent(evt)
  return evt
}

function inputEvt(el: HTMLElement, init: InputEventInit = {}): InputEvent {
  const evt = trustedInputEvent('input', init)
  el.dispatchEvent(evt)
  return evt
}

function trustedCompositionEvent(type: string, data: string): CompositionEvent {
  const evt = new CompositionEvent(type, { data, bubbles: true })
  Object.defineProperty(evt, 'isTrusted', { value: true, configurable: true })
  // happy-dom's CompositionEvent does not implement `.data` from the init dict
  // (RESEARCH A8) — set it directly so the test exercises the real-browser
  // contract (a genuine CompositionEvent always carries `.data`).
  Object.defineProperty(evt, 'data', { value: data, configurable: true })
  return evt
}

let target: HTMLElement

beforeEach(() => {
  resetCapture()
  detachCapture()
  target = document.createElement('textarea')
  document.body.appendChild(target)
})

describe('capture — tracer proof', () => {
  it('records a keydown then keyup as two distinct events', () => {
    attachCapture(target)
    press(target, 'keydown')
    press(target, 'keyup')

    const events = getEvents()
    expect(events).toHaveLength(2)
    expect(events[0]?.type).toBe('keydown')
    expect(events[1]?.type).toBe('keyup')
    expect(events[0]?.seq).toBe(0)
    expect(events[1]?.seq).toBe(1)
    expect(events[1]!.seq).toBeGreaterThan(events[0]!.seq)
    expect(typeof events[0]?.tMs).toBe('number')
  })

  it('captures the D-12 shape (key, code, modifiers, tMs, isRepeat)', () => {
    attachCapture(target)
    press(target, 'keydown', { key: 'A', code: 'KeyA', shiftKey: true })

    const e = getEvents()[0]
    expect(e).toMatchObject({
      type: 'keydown',
      key: 'A',
      code: 'KeyA',
      ctrl: false,
      alt: false,
      shift: true,
      meta: false,
      isRepeat: false,
    })
    expect(typeof e?.tMs).toBe('number')
  })

  it('returns an empty readonly array when idle', () => {
    attachCapture(target)
    const events = getEvents()
    expect(events).toEqual([])
    expect(Object.isFrozen(events)).toBe(true)
  })

  it('ignores untrusted (synthetic) events', () => {
    attachCapture(target)
    const evt = new KeyboardEvent('keydown', { key: 'a', code: 'KeyA' })
    Object.defineProperty(evt, 'isTrusted', { value: false })
    target.dispatchEvent(evt)
    expect(getEvents()).toHaveLength(0)
  })
})

describe('capture — key-repeat filter (CAPT-02, D-06)', () => {
  it('marks a keydown carrying repeat: true as isRepeat === true', () => {
    attachCapture(target)
    press(target, 'keydown', { code: 'KeyJ', repeat: true })
    expect(getEvents()[0]?.isRepeat).toBe(true)
  })

  it('marks a second keydown for an already-down code as isRepeat (per-code down-set fallback)', () => {
    attachCapture(target)
    press(target, 'keydown', { code: 'KeyK' }) // first press, no repeat flag
    press(target, 'keydown', { code: 'KeyK' }) // held — browser omitted .repeat

    const events = getEvents()
    expect(events[0]?.isRepeat).toBe(false)
    expect(events[1]?.isRepeat).toBe(true)
  })

  it('clears the down-state on keyup so the next real press is not misflagged', () => {
    attachCapture(target)
    press(target, 'keydown', { code: 'KeyL' })
    press(target, 'keyup', { code: 'KeyL' })
    press(target, 'keydown', { code: 'KeyL' })

    const downs = getEvents().filter((e) => e.type === 'keydown')
    expect(downs[0]?.isRepeat).toBe(false)
    expect(downs[1]?.isRepeat).toBe(false)
  })
})

describe('capture — idempotency (CAPT-02)', () => {
  it('attachCapture called twice does not double-bind: one keydown -> one event', () => {
    attachCapture(target)
    attachCapture(target)
    press(target, 'keydown')
    expect(getEvents()).toHaveLength(1)
  })
})

describe('capture — ordering + first keystroke (CAPT-03, PITFALLS #2)', () => {
  it('the first keydown after attachCapture is present with a numeric tMs', () => {
    attachCapture(target)
    press(target, 'keydown', { code: 'KeyF' })

    const first = getEvents()[0]
    expect(first?.type).toBe('keydown')
    expect(first?.code).toBe('KeyF')
    expect(Number.isFinite(first?.tMs)).toBe(true)
  })

  it('two events with an equal timeStamp keep insertion order and strictly increasing seq', () => {
    attachCapture(target)
    press(target, 'keydown', { code: 'KeyA' }, 1234.5)
    press(target, 'keyup', { code: 'KeyA' }, 1234.5)

    const events = getEvents()
    expect(events[0]?.tMs).toBe(1234.5)
    expect(events[1]?.tMs).toBe(1234.5)
    expect(events[0]?.type).toBe('keydown')
    expect(events[1]?.type).toBe('keyup')
    expect(events[1]!.seq).toBe(events[0]!.seq + 1)
  })
})

describe('capture — read-only exposure (D-13)', () => {
  it('getEvents() result cannot be mutated by callers', () => {
    attachCapture(target)
    press(target, 'keydown')

    const snapshot = getEvents()
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(() => {
      ;(snapshot as unknown as unknown[]).push({})
    }).toThrow()
    // The live buffer is unaffected by anything a caller does to a snapshot.
    expect(getEvents()).toHaveLength(1)
  })

  it('getCharLog() result cannot be mutated by callers', () => {
    attachCapture(target)
    beforeInput(target, { inputType: 'insertText', data: 'a' })

    const snapshot = getCharLog()
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(() => {
      ;(snapshot as unknown as unknown[]).push({})
    }).toThrow()
    expect(getCharLog()).toHaveLength(1)
  })

  it('WR-02: mutating a property on a returned event does not corrupt the live buffer', () => {
    attachCapture(target)
    press(target, 'keydown', { code: 'KeyA' })

    const event = getEvents()[0]!
    expect(Object.isFrozen(event)).toBe(true)
    expect(() => {
      ;(event as { tMs: number }).tMs = 0
    }).toThrow()
    // Even if the throw above were swallowed (sloppy mode), the live buffer
    // must be unaffected — re-read it fresh and confirm it is untouched.
    expect(getEvents()[0]?.tMs).toBe(event.tMs)
  })

  it('WR-02: mutating a property on a returned char-log entry does not corrupt the live buffer', () => {
    attachCapture(target)
    beforeInput(target, { inputType: 'insertText', data: 'a' })

    const entry = getCharLog()[0]!
    expect(Object.isFrozen(entry)).toBe(true)
    expect(() => {
      ;(entry as { data: string | null }).data = 'z'
    }).toThrow()
    expect(getCharLog()[0]?.data).toBe('a')
  })
})

describe('capture — logical keystroke count excludes repeats (CAPT-02)', () => {
  it('a held key is recorded three times but a logical-keystroke count sees one', () => {
    attachCapture(target)
    press(target, 'keydown', { code: 'KeyJ' })
    press(target, 'keydown', { code: 'KeyJ', repeat: true })
    press(target, 'keydown', { code: 'KeyJ', repeat: true })

    const events = getEvents()
    expect(events).toHaveLength(3)
    const logicalCount = events.filter((e) => e.type === 'keydown' && !e.isRepeat).length
    expect(logicalCount).toBe(1)
  })
})

describe('capture — blur / visibilitychange clear the down-set (PITFALLS #3, A7)', () => {
  it('window blur clears downCodes and records a blur marker, so the same code is not misflagged after alt-tab', () => {
    attachCapture(target)
    press(target, 'keydown', { code: 'KeyX' })
    window.dispatchEvent(new Event('blur'))
    press(target, 'keydown', { code: 'KeyX' })

    const downs = getEvents().filter((e) => e.code === 'KeyX' && e.type === 'keydown')
    expect(downs[0]?.isRepeat).toBe(false)
    expect(downs[1]?.isRepeat).toBe(false)
    expect(getMarkers().some((m) => m.kind === 'blur')).toBe(true)
  })

  it('visibilitychange -> hidden clears downCodes and records a hidden marker', () => {
    attachCapture(target)
    press(target, 'keydown', { code: 'KeyY' })
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    press(target, 'keydown', { code: 'KeyY' })

    const downs = getEvents().filter((e) => e.code === 'KeyY' && e.type === 'keydown')
    expect(downs[1]?.isRepeat).toBe(false)
    expect(getMarkers().some((m) => m.kind === 'hidden')).toBe(true)
  })

  it('window focus and visibilitychange -> visible record their markers', () => {
    attachCapture(target)
    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))

    const kinds = getMarkers().map((m) => m.kind)
    expect(kinds).toContain('focus')
    expect(kinds).toContain('visible')
  })
})

describe('capture — committed-character stream (CAPT-04, Pitfall 9)', () => {
  it('an insertText beforeinput records one CommittedChar and leaves the timing log untouched', () => {
    attachCapture(target)
    const before = getEvents().length

    beforeInput(target, { inputType: 'insertText', data: 'a' })

    const chars = getCharLog()
    expect(chars).toHaveLength(1)
    expect(chars[0]).toMatchObject({ seq: expect.any(Number), inputType: 'insertText', data: 'a' })
    expect(getEvents()).toHaveLength(before)
  })

  it('insertLineBreak is recorded with data "\\n" per the inputType mapping table', () => {
    attachCapture(target)
    beforeInput(target, { inputType: 'insertLineBreak', data: null })
    expect(getCharLog()[0]).toMatchObject({ inputType: 'insertLineBreak', data: '\n' })
  })

  it('deleteContentBackward is recorded as a deletion with null data', () => {
    attachCapture(target)
    beforeInput(target, { inputType: 'deleteContentBackward' })
    expect(getCharLog()[0]).toMatchObject({ inputType: 'deleteContentBackward', data: null })
  })

  it('onInput backfills a deletion from the value diff when beforeinput was skipped (Firefox delete edge)', () => {
    attachCapture(target)
    const textarea = target as HTMLTextAreaElement
    textarea.value = 'ab'
    inputEvt(target)
    textarea.value = 'a'
    inputEvt(target)

    const chars = getCharLog()
    expect(chars).toHaveLength(1)
    expect(chars[0]).toMatchObject({ inputType: 'deleteContentBackward', data: null })
  })

  it('a backspace beforeinput plus input with a different timeStamp records one deletion', () => {
    attachCapture(target)
    const textarea = target as HTMLTextAreaElement
    textarea.value = 'ab'
    inputEvt(target)

    textarea.value = 'a'
    const before = trustedInputEvent('beforeinput', { inputType: 'deleteContentBackward' })
    Object.defineProperty(before, 'timeStamp', { value: 10, configurable: true })
    target.dispatchEvent(before)
    const input = trustedInputEvent('input', { inputType: 'deleteContentBackward' })
    Object.defineProperty(input, 'timeStamp', { value: 10.4, configurable: true })
    target.dispatchEvent(input)

    const deletes = getCharLog().filter((entry) => entry.inputType.startsWith('delete'))
    expect(deletes).toHaveLength(1)
  })
})

describe('capture — paste/drop blocked in the capture surface (CAPT-04, T-01-08, D-04)', () => {
  it('insertFromPaste is prevented, not recorded as a CommittedChar, and fires the paste-blocked subscriber', () => {
    attachCapture(target)
    let fired = false
    setPasteBlockedHandler(() => {
      fired = true
    })

    const evt = beforeInput(target, { inputType: 'insertFromPaste' })

    expect(evt.defaultPrevented).toBe(true)
    expect(getCharLog()).toHaveLength(0)
    expect(fired).toBe(true)

    setPasteBlockedHandler(null)
  })

  it('insertFromDrop is prevented and not recorded', () => {
    attachCapture(target)
    const evt = beforeInput(target, { inputType: 'insertFromDrop' })
    expect(evt.defaultPrevented).toBe(true)
    expect(getCharLog()).toHaveLength(0)
  })
})

describe('capture — IME composition suspends per-char attribution (Pitfall 9)', () => {
  it('beforeinput pushes during composition are suspended; compositionend records exactly one CommittedChar', () => {
    attachCapture(target)

    target.dispatchEvent(trustedCompositionEvent('compositionstart', ''))
    beforeInput(target, { inputType: 'insertText', data: 'に' })
    beforeInput(target, { inputType: 'insertText', data: 'ん' })
    target.dispatchEvent(trustedCompositionEvent('compositionend', 'ni'))

    const chars = getCharLog()
    expect(chars).toHaveLength(1)
    expect(chars[0]).toMatchObject({ inputType: 'insertFromComposition', data: 'ni' })
  })
})

describe('capture — WR-06: blur/hidden mid-composition does not wedge composing state', () => {
  it('window blur during an active IME composition resets composing, so a later beforeinput is not silently dropped', () => {
    attachCapture(target)
    target.dispatchEvent(trustedCompositionEvent('compositionstart', ''))
    // The IME never fires compositionend (abandoned by the blur) — this is
    // the exact scenario WR-06 covers.
    window.dispatchEvent(new Event('blur'))

    beforeInput(target, { inputType: 'insertText', data: 'a' })

    const chars = getCharLog()
    expect(chars).toHaveLength(1)
    expect(chars[0]).toMatchObject({ inputType: 'insertText', data: 'a' })
  })

  it('visibilitychange -> hidden during an active IME composition resets composing', () => {
    attachCapture(target)
    target.dispatchEvent(trustedCompositionEvent('compositionstart', ''))
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })

    beforeInput(target, { inputType: 'insertText', data: 'a' })

    expect(getCharLog()).toHaveLength(1)
    expect(getCharLog()[0]).toMatchObject({ inputType: 'insertText', data: 'a' })
  })
})

describe('capture — empty state (CAPT-03)', () => {
  it('idle: getEvents(), getCharLog(), getMarkers() are all empty', () => {
    attachCapture(target)
    expect(getEvents()).toEqual([])
    expect(getCharLog()).toEqual([])
    expect(getMarkers()).toEqual([])
  })
})
