import { describe, it, expect } from 'vitest'
import { computeSessionMetrics } from './metrics'
import type { CommittedChar, CaptureMarker } from '../capture/types'

// Golden-case table (Case/it.each convention matching state.test.ts /
// active-time.test.ts) exercising computeSessionMetrics directly, covering
// D-01/D-02's exact formulas and Pitfalls 1/2/3/6.

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
  expected: { wpm: number; accuracy: number }
}

const cases: Case[] = [
  {
    n: 1,
    name: 'zero-elapsed-time guard (Pitfall 2): wpm is exactly 0, not Infinity/NaN',
    target: 'a',
    charLog: [char(0, 'insertText', 'a', 50)],
    markers: [],
    now: 50,
    expected: { wpm: 0, accuracy: 1 },
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
    expected: { wpm: 600, accuracy: 0.5 }, // 1 correct char / 5 / (20/60000) = 600
  },
  {
    n: 3,
    name: 'clock-domain fidelity (Pitfall 1 / RESEARCH Pattern 4): now is used literally, no wall-clock substitution',
    target: 'a',
    charLog: [char(0, 'insertText', 'a', 0)],
    markers: [],
    now: 500,
    expected: { wpm: 24, accuracy: 1 }, // elapsedMs=500 -> 1/5/(500/60000)=24
  },
  {
    n: 4,
    name: 'active-time/marker integration: a blur/focus pair subtracts its interval from the wpm time basis',
    target: 'a',
    charLog: [char(0, 'insertText', 'a', 0)],
    markers: [marker('blur', 100), marker('focus', 200)],
    now: 500,
    expected: { wpm: 30, accuracy: 1 }, // elapsedMs=400 -> 1/5/(400/60000)=30
  },
  {
    n: 5,
    name: 'multi-codepoint (IME) commit encoding: both code points scored correctly in one record',
    target: 'ab',
    charLog: [char(0, 'insertFromComposition', 'ab', 10)],
    markers: [],
    now: 10,
    expected: { wpm: 0, accuracy: 1 }, // elapsedMs=0 -> wpm guard
  },
  {
    n: 6,
    name: 'zero-attempt safety default: both guards trigger together on an empty log',
    target: 'a',
    charLog: [],
    markers: [],
    now: 0,
    expected: { wpm: 0, accuracy: 1 },
  },
]

describe('computeSessionMetrics() — golden cases (D-01/D-02, Pitfalls 1/2/3/6)', () => {
  it.each(cases)('case $n: $name', ({ target, charLog, markers, now, expected }) => {
    const result = computeSessionMetrics(target, charLog, markers, now)
    expect(result.wpm).toBe(expected.wpm)
    expect(result.accuracy).toBe(expected.accuracy)
  })

  it('every MetricsResult carries the current schema version', () => {
    const result = computeSessionMetrics('a', [char(0, 'insertText', 'a', 0)], [], 500)
    expect(result.schemaVersion).toBe(1)
  })
})
