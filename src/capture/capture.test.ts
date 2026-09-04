import { beforeEach, describe, it, expect } from 'vitest'
import { attachCapture, detachCapture, getEvents, resetCapture } from './capture'

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
})
