import { beforeEach, describe, it, expect } from 'vitest'
import { attachCapture, detachCapture, getEvents, resetCapture } from './capture'

// happy-dom. Minimal capture proof for the tracer (Plan 01-03 extends this).

function trustedKeyEvent(type: string, init: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  // happy-dom leaves isTrusted undefined on scripted events; real browser key
  // events are isTrusted = true. Force it so the capture guard is exercised as
  // it would be in production.
  const evt = new KeyboardEvent(type, { key: 'a', code: 'KeyA', bubbles: true, ...init })
  Object.defineProperty(evt, 'isTrusted', { value: true, configurable: true })
  return evt
}

function press(el: HTMLElement, type: 'keydown' | 'keyup', init: Partial<KeyboardEventInit> = {}) {
  el.dispatchEvent(trustedKeyEvent(type, init))
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
    // A raw Event with isTrusted false must be rejected (T-01-04).
    const evt = new KeyboardEvent('keydown', { key: 'a', code: 'KeyA' })
    Object.defineProperty(evt, 'isTrusted', { value: false })
    target.dispatchEvent(evt)
    expect(getEvents()).toHaveLength(0)
  })
})
