import { describe, it, expect } from 'vitest'
import {
  MIN_GAP_MS,
  MAX_GAP_MS,
  CHAR_MIN_SAMPLES,
  DIGRAPH_MIN_SAMPLES,
  median,
  gatedMedian,
} from './latency-stats'

// Golden-case table (Case/it.each convention matching metrics.test.ts /
// symbol-density.test.ts) exercising the shared filter→gate→median helper
// extracted from slowestFive (D-06, D-09). computeSessionMetrics cases n=7/8/9
// stay in metrics.test.ts as the extract's regression net.

interface MedianCase {
  n: number
  name: string
  samples: readonly number[]
  expected: number
}

const medianCases: MedianCase[] = [
  { n: 1, name: 'empty list returns 0 and does not throw', samples: [], expected: 0 },
  {
    n: 2,
    name: 'even-length list uses the arithmetic mean of the two middle values with no rounding',
    samples: [100, 200],
    expected: 150,
  },
  {
    n: 3,
    name: 'odd-length list uses the middle value',
    samples: [26, 500, 999],
    expected: 500,
  },
]

interface GatedCase {
  n: number
  name: string
  samples: readonly number[]
  minSamples: number
  expected: { medianMs: number; sampleCount: number } | null
}

const gatedCases: GatedCase[] = [
  {
    n: 1,
    name: '4 in-window samples with minSamples=5 returns null (POST-filter gate)',
    samples: [100, 200, 300, 400],
    minSamples: 5,
    expected: null,
  },
  {
    n: 2,
    name: '5 in-window samples with minSamples=5 returns non-null with sampleCount === 5',
    samples: [100, 200, 300, 400, 500],
    minSamples: 5,
    expected: { medianMs: 300, sampleCount: 5 },
  },
  {
    n: 3,
    name: 'exclusive window discards gaps of exactly 25 and exactly 1000, keeps 26 and 999',
    samples: [25, 26, 500, 999, 1000],
    minSamples: 3,
    expected: { medianMs: 500, sampleCount: 3 },
  },
  {
    n: 4,
    name: 'empty samples with minSamples=1 returns null and does not throw',
    samples: [],
    minSamples: 1,
    expected: null,
  },
  {
    n: 5,
    name: 'even-length filtered list [100, 200] median is 150 (mean of the two middle values)',
    samples: [100, 200],
    minSamples: 2,
    expected: { medianMs: 150, sampleCount: 2 },
  },
]

describe('named sample-gate constants (D-06)', () => {
  it('exports the exclusive gap window and both sample gates as one-line tunes', () => {
    expect(MIN_GAP_MS).toBe(25)
    expect(MAX_GAP_MS).toBe(1000)
    expect(CHAR_MIN_SAMPLES).toBe(3)
    expect(DIGRAPH_MIN_SAMPLES).toBe(5)
  })
})

describe('median() — golden cases', () => {
  it.each(medianCases)('case $n: $name', ({ samples, expected }) => {
    expect(median(samples)).toBe(expected)
  })
})

describe('gatedMedian() — golden cases (D-06, D-09, exclusive window)', () => {
  it.each(gatedCases)('case $n: $name', ({ samples, minSamples, expected }) => {
    expect(gatedMedian(samples, minSamples)).toEqual(expected)
  })
})
