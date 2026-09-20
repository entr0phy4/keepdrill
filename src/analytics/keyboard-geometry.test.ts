import { describe, it, expect } from 'vitest'
import { US_ANSI_KEYS, isSampleable } from './keyboard-geometry'

// US-ANSI alphanumeric-block geometry (D-10, D-13). Canonical W3C
// KeyboardEvent.code strings only — no F-row / arrows / numpad / Intl*.

const byCode = (code: string) => US_ANSI_KEYS.find((k) => k.code === code)

describe('isSampleable', () => {
  it('returns true for writing-system keys like KeyA', () => {
    expect(isSampleable('KeyA')).toBe(true)
  })

  it('returns false for drawn-but-unsampleable modifiers like ShiftLeft', () => {
    expect(isSampleable('ShiftLeft')).toBe(false)
  })

  it('returns false for function-row codes that are not in the table', () => {
    expect(isSampleable('F1')).toBe(false)
  })
})

describe('US_ANSI_KEYS', () => {
  it('contains Digit9, BracketLeft, and Space', () => {
    const codes = US_ANSI_KEYS.map((k) => k.code)
    expect(codes).toEqual(expect.arrayContaining(['Digit9', 'BracketLeft', 'Space']))
  })

  it('does not contain function-row, arrow, numpad, or Intl codes', () => {
    const codes = US_ANSI_KEYS.map((k) => k.code)
    expect(codes.some((c) => /^F\d+$/.test(c))).toBe(false)
    expect(codes.some((c) => c.startsWith('Arrow'))).toBe(false)
    expect(codes.some((c) => c.startsWith('Numpad'))).toBe(false)
    expect(codes.some((c) => c.startsWith('Intl'))).toBe(false)
  })

  it('gives Backspace, Tab, CapsLock, and Enter span 2', () => {
    expect(byCode('Backspace')?.span).toBe(2)
    expect(byCode('Tab')?.span).toBe(2)
    expect(byCode('CapsLock')?.span).toBe(2)
    expect(byCode('Enter')?.span).toBe(2)
  })

  it('gives ShiftLeft and ShiftRight span 3', () => {
    expect(byCode('ShiftLeft')?.span).toBe(3)
    expect(byCode('ShiftRight')?.span).toBe(3)
  })

  it('gives Space span 7', () => {
    expect(byCode('Space')?.span).toBe(7)
  })
})
