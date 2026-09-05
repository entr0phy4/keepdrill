import { describe, it, expect } from 'vitest'
import { computeSessionMetrics } from './metrics'
import type { SlowestKeyEntry } from './metrics'
import type { CommittedChar, CaptureMarker } from '../capture/types'

// Golden-case table (Case/it.each convention matching state.test.ts /
// active-time.test.ts) exercising computeSessionMetrics directly, covering
// D-01/D-02's exact formulas and Pitfalls 1/2/3/6, plus D-03/D-04's slowest-5
// aggregation and Pitfalls 4/5/7.

function char(seq: number, inputType: string, data: string | null, tMs: number): CommittedChar {
  return Object.freeze({ seq, inputType, data, tMs })
}

function marker(kind: CaptureMarker['kind'], tMs: number): CaptureMarker {
  return { seq: 0, kind, tMs }
}

interface Case {
  n: number
  name: string
  target: string
  charLog: CommittedChar[]
  markers: CaptureMarker[]
  now: number
  expected: { wpm: number; accuracy: number; slowest5?: SlowestKeyEntry[] }
}

const cases: Case[] = [
  {
    n: 1,
    name: 'zero-elapsed-time guard (Pitfall 2): wpm is exactly 0, not Infinity/NaN',
    target: 'a',
    charLog: [char(0, 'insertText', 'a', 50)],
    markers: [],
    now: 50,
    expected: { wpm: 0, accuracy: 1, slowest5: [] },
  },
  {
    n: 2,
    name: "D-02's corrected-position denominator + Pitfall 3 (delete records excluded from the denominator)",
    target: 'a',
    charLog: [
      char(0, 'insertText', 'x', 0),
      char(1, 'deleteContentBackward', null, 10),
      char(2, 'insertText', 'a', 20),
    ],
    markers: [],
    now: 20,
    expected: { wpm: 600, accuracy: 0.5, slowest5: [] }, // 1 correct char / 5 / (20/60000) = 600
  },
  {
    n: 3,
    name: 'clock-domain fidelity (Pitfall 1 / RESEARCH Pattern 4): now is used literally, no wall-clock substitution',
    target: 'a',
    charLog: [char(0, 'insertText', 'a', 0)],
    markers: [],
    now: 500,
    expected: { wpm: 24, accuracy: 1, slowest5: [] }, // elapsedMs=500 -> 1/5/(500/60000)=24
  },
  {
    n: 4,
    name: 'active-time/marker integration: a blur/focus pair subtracts its interval from the wpm time basis',
    target: 'a',
    charLog: [char(0, 'insertText', 'a', 0)],
    markers: [marker('blur', 100), marker('focus', 200)],
    now: 500,
    expected: { wpm: 30, accuracy: 1, slowest5: [] }, // elapsedMs=400 -> 1/5/(400/60000)=30
  },
  {
    n: 5,
    name: 'multi-codepoint (IME) commit encoding: both code points scored correctly in one record',
    target: 'ab',
    charLog: [char(0, 'insertFromComposition', 'ab', 10)],
    markers: [],
    now: 10,
    expected: { wpm: 0, accuracy: 1, slowest5: [] }, // elapsedMs=0 -> wpm guard
  },
  {
    n: 6,
    name: 'zero-attempt safety default: both guards trigger together on an empty log',
    target: 'a',
    charLog: [],
    markers: [],
    now: 0,
    expected: { wpm: 0, accuracy: 1, slowest5: [] },
  },
  {
    n: 7,
    name: "D-04 boundary: exactly 2 post-filter samples excluded ('b'), exactly 3 post-filter samples included ('a')",
    target: 'aaaabb',
    charLog: [
      char(0, 'insertText', 'a', 0),
      char(1, 'insertText', 'a', 100), // gap 100 -> a:[100]
      char(2, 'insertText', 'a', 200), // gap 100 -> a:[100,100]
      char(3, 'insertText', 'a', 300), // gap 100 -> a:[100,100,100] (3 samples, included)
      char(4, 'insertText', 'b', 400), // gap 100 -> b:[100]
      char(5, 'insertText', 'b', 500), // gap 100 -> b:[100,100] (2 samples, excluded)
    ],
    markers: [],
    now: 500,
    expected: { wpm: 6 / 5 / (500 / 60000), accuracy: 1, slowest5: [{ char: 'a', medianMs: 100 }] },
  },
  {
    n: 8,
    name: "METR-03 outlier-filter exclusivity: exactly-25ms and exactly-1000ms gaps discarded, 26ms/999ms/500ms survive",
    target: 'cccccc',
    charLog: [
      char(0, 'insertText', 'c', 0),
      char(1, 'insertText', 'c', 25), // gap 25 -> discarded (boundary)
      char(2, 'insertText', 'c', 51), // gap 26 -> kept
      char(3, 'insertText', 'c', 1050), // gap 999 -> kept
      char(4, 'insertText', 'c', 2050), // gap 1000 -> discarded (boundary)
      char(5, 'insertText', 'c', 2550), // gap 500 -> kept
    ],
    markers: [],
    now: 2550,
    expected: { wpm: 6 / 5 / (2550 / 60000), accuracy: 1, slowest5: [{ char: 'c', medianMs: 500 }] }, // filtered=[26,999,500], median=500
  },
  {
    n: 9,
    name: 'more-than-5-eligible-characters: result is ranked descending by median and capped at 5 entries',
    target: 'pppp' + 'qqqq' + 'rrrr' + 'ssss' + 'tttt' + 'uuuu',
    charLog: [
      char(0, 'insertText', 'p', 0),
      char(1, 'insertText', 'p', 100),
      char(2, 'insertText', 'p', 200),
      char(3, 'insertText', 'p', 300),
      char(4, 'insertText', 'q', 500),
      char(5, 'insertText', 'q', 700),
      char(6, 'insertText', 'q', 900),
      char(7, 'insertText', 'q', 1100),
      char(8, 'insertText', 'r', 1400),
      char(9, 'insertText', 'r', 1700),
      char(10, 'insertText', 'r', 2000),
      char(11, 'insertText', 'r', 2300),
      char(12, 'insertText', 's', 2700),
      char(13, 'insertText', 's', 3100),
      char(14, 'insertText', 's', 3500),
      char(15, 'insertText', 's', 3900),
      char(16, 'insertText', 't', 4400),
      char(17, 'insertText', 't', 4900),
      char(18, 'insertText', 't', 5400),
      char(19, 'insertText', 't', 5900),
      char(20, 'insertText', 'u', 6500),
      char(21, 'insertText', 'u', 7100),
      char(22, 'insertText', 'u', 7700),
      char(23, 'insertText', 'u', 8300),
    ],
    markers: [],
    now: 8300,
    expected: {
      wpm: 24 / 5 / (8300 / 60000),
      accuracy: 1,
      slowest5: [
        { char: 'u', medianMs: 600 },
        { char: 't', medianMs: 500 },
        { char: 's', medianMs: 400 },
        { char: 'r', medianMs: 300 },
        { char: 'q', medianMs: 200 },
      ],
    },
  },
  {
    n: 10,
    name: "Pitfall 7: a multi-codepoint IME record's gap attaches only to the LAST codepoint ('b'), never to 'a'",
    target: 'xabbbb',
    charLog: [
      char(0, 'insertText', 'x', 0),
      char(1, 'insertFromComposition', 'ab', 50), // gap 50 from rec0 -> attributed ONLY to 'b' (last codepoint); 'a' gets none
      char(2, 'insertText', 'b', 250), // gap 200 -> b:[50,200]
      char(3, 'insertText', 'b', 450), // gap 200 -> b:[50,200,200]
      char(4, 'insertText', 'b', 650), // gap 200 -> b:[50,200,200,200] (4 samples)
    ],
    markers: [],
    now: 650,
    expected: { wpm: 6 / 5 / (650 / 60000), accuracy: 1, slowest5: [{ char: 'b', medianMs: 200 }] },
  },
  {
    n: 11,
    name: "D-03: '{' and '[' are tracked as distinct entries even though they may share a physical key",
    target: '{{{{[[[[',
    charLog: [
      char(0, 'insertText', '{', 0),
      char(1, 'insertText', '{', 40), // gap 40 -> {:[40]
      char(2, 'insertText', '{', 80), // gap 40 -> {:[40,40]
      char(3, 'insertText', '{', 120), // gap 40 -> {:[40,40,40] (3 samples, median 40)
      char(4, 'insertText', '[', 180), // gap 60 -> [:[60]
      char(5, 'insertText', '[', 240), // gap 60 -> [:[60,60]
      char(6, 'insertText', '[', 300), // gap 60 -> [:[60,60,60]
      char(7, 'insertText', '[', 360), // gap 60 -> [:[60,60,60,60] (4 samples, median 60)
    ],
    markers: [],
    now: 360,
    expected: {
      wpm: 8 / 5 / (360 / 60000),
      accuracy: 1,
      slowest5: [
        { char: '[', medianMs: 60 },
        { char: '{', medianMs: 40 },
      ],
    },
  },
]

describe('computeSessionMetrics() — golden cases (D-01/D-02/D-03/D-04, Pitfalls 1/2/3/4/6/7)', () => {
  it.each(cases)('case $n: $name', ({ target, charLog, markers, now, expected }) => {
    const result = computeSessionMetrics(target, charLog, markers, now)
    expect(result.wpm).toBeCloseTo(expected.wpm, 6)
    expect(result.accuracy).toBe(expected.accuracy)
    if (expected.slowest5 !== undefined) {
      expect(result.slowest5).toEqual(expected.slowest5)
    }
  })

  it('every MetricsResult carries the current schema version', () => {
    const result = computeSessionMetrics('a', [char(0, 'insertText', 'a', 0)], [], 500)
    expect(result.schemaVersion).toBe(1)
  })

  it('never returns more than 5 slowest5 entries even with more qualifying characters', () => {
    const nineCase = cases[8]
    if (!nineCase) throw new Error('case 9 missing')
    const result = computeSessionMetrics(nineCase.target, nineCase.charLog, nineCase.markers, nineCase.now)
    expect(result.slowest5.length).toBeLessThanOrEqual(5)
  })
})
