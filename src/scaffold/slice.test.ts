import { describe, expect, it } from 'vitest'
import type { PlanUnit } from '../parse/types'
import { joinUnitSlices, sliceUnit } from './slice'

// U+1F600 is one Unicode code point and two UTF-16 code units.
const EMOJI = '😀'

function unit(start: number, end: number, id?: string): PlanUnit {
  return {
    id: id ?? `${start}-${end}`,
    kind: 'function',
    start,
    end,
    dependsOn: [],
  }
}

describe('sliceUnit — code-point ranges (D-19 / SCAF-03 encoding)', () => {
  it("extracts the emoji in 'a😀b' as the code point at [1, 2)", () => {
    const text = `a${EMOJI}b`
    expect(sliceUnit(text, 1, 2)).toBe(EMOJI)
  })

  it('documents why UTF-16 String.slice cannot extract that emoji from the same numbers', () => {
    const text = `a${EMOJI}b`
    expect(text.slice(1, 2)).not.toBe(EMOJI)
    expect(sliceUnit(text, 1, 2)).toBe(EMOJI)
  })

  it('returns the whole string for a full-cover range and empty for a zero-width range', () => {
    expect(sliceUnit('abc', 0, 3)).toBe('abc')
    expect(sliceUnit('abc', 1, 1)).toBe('')
  })
})

describe('joinUnitSlices — curriculum-order typedTarget (SCAF-03 encoding)', () => {
  it("joins leaves-first units of 'aa\\nbb\\n' as 'bb\\naa\\n', not the source text", () => {
    const text = 'aa\nbb\n'
    const curriculum = [unit(3, 6, 'b'), unit(0, 3, 'a')]
    const joined = joinUnitSlices(text, curriculum)
    expect(joined).toBe('bb\naa\n')
    expect(joined).not.toBe(text)
  })

  it('returns empty string when the units array is empty', () => {
    expect(joinUnitSlices('aa\nbb\n', [])).toBe('')
  })
})
