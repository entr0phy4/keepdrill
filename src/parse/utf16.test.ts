import { describe, expect, it } from 'vitest'
import { utf16ToCodePoint } from './utf16'

// U+1F600 is one Unicode code point and two UTF-16 code units.
const EMOJI = '😀'

describe('utf16ToCodePoint — U+1F600 (FILE-01 / PLAN-01)', () => {
  it("maps 'a😀b' UTF-16 indices onto code-point offsets", () => {
    const text = `a${EMOJI}b`
    expect(utf16ToCodePoint(text, 0)).toBe(0)
    expect(utf16ToCodePoint(text, 1)).toBe(1)
    // emoji occupies UTF-16 indices 1 and 2; index 3 is 'b' → code point 2
    expect(utf16ToCodePoint(text, 3)).toBe(2)
    expect(utf16ToCodePoint(text, 4)).toBe(3)
  })

  it('counts an emoji outside a later range as one code point, not two', () => {
    // Leading comment with supplementary-plane char, then a function.
    const text = `// ${EMOJI}\nfunction f() {}`
    const functionUtf16 = text.indexOf('function')
    expect(functionUtf16).toBeGreaterThan(0)
    expect(utf16ToCodePoint(text, functionUtf16)).toBe(
      Array.from(text.slice(0, functionUtf16)).length,
    )
    expect(utf16ToCodePoint(text, functionUtf16)).toBe(functionUtf16 - 1)
  })

  it('counts an emoji inside a range as the character that shifts a later index', () => {
    const text = `f(${EMOJI})`
    const closeUtf16 = text.indexOf(')')
    expect(utf16ToCodePoint(text, closeUtf16)).toBe(3)
    expect(text.length).toBe(5)
    expect(Array.from(text).length).toBe(4)
  })
})
