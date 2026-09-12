import { describe, it, expect } from 'vitest'
import { classifySymbolDensity, computeSymbolAdjustedWpm, SYMBOL_WEIGHT } from './symbol-density'

// Golden-case table (Case/it.each convention matching metrics.test.ts)
// exercising classifySymbolDensity's D-01 three-way classifier and D-02's
// Unicode-safe (Array.from) iteration, plus computeSymbolAdjustedWpm's D-05
// exact linear weighting formula.

interface DensityCase {
  n: number
  name: string
  target: string
  expected: number
}

const densityCases: DensityCase[] = [
  { n: 1, name: 'every codepoint alnum -> 0 density', target: 'abc123', expected: 0 },
  { n: 2, name: 'every codepoint symbol -> 1 density', target: '{}[]', expected: 1 },
  {
    n: 3,
    name: "underscore counts as symbol, not alnum (D-01's explicit rule)",
    target: 'a_b',
    expected: 1 / 3,
  },
  {
    n: 4,
    name: 'whitespace excluded from symbol count but counted in denominator',
    target: 'a b',
    expected: 0,
  },
  { n: 5, name: 'zero-length-target guard never divides by zero', target: '', expected: 0 },
  {
    n: 6,
    name: 'a supplementary-plane codepoint is one Array.from element, classified as symbol (D-02)',
    target: '🎉{',
    expected: 1,
  },
]

describe('classifySymbolDensity() — golden cases (D-01/D-02)', () => {
  it.each(densityCases)('case $n: $name', ({ target, expected }) => {
    expect(classifySymbolDensity(target)).toBeCloseTo(expected, 10)
  })
})

describe('computeSymbolAdjustedWpm() — D-05 exact linear weighting formula', () => {
  it('zero density leaves wpm unchanged', () => {
    expect(computeSymbolAdjustedWpm(100, 0)).toBe(100)
  })

  it('100% density doubles wpm given SYMBOL_WEIGHT=2', () => {
    expect(computeSymbolAdjustedWpm(100, 1)).toBe(200)
  })

  it('50% density linearly interpolates to 150', () => {
    expect(computeSymbolAdjustedWpm(100, 0.5)).toBeCloseTo(150, 10)
  })

  it('never exceeds wpm * SYMBOL_WEIGHT for any density in [0, 1] (RESEARCH.md Pitfall 1 bound)', () => {
    const wpm = 137
    for (let d = 0; d <= 1; d += 0.05) {
      expect(computeSymbolAdjustedWpm(wpm, d)).toBeLessThanOrEqual(wpm * SYMBOL_WEIGHT + 1e-9)
    }
  })
})
