import { describe, it, expect } from 'vitest'
import { computeTrainerState, glyphFor } from './state'
import type { CommittedChar } from '../capture/types'

// Golden-case-table pattern (normalize.test.ts convention). Task 1 covers the
// tracer's own <behavior> cases (D-03/D-04/D-05); Task 2 extends this table
// with whitespace-glyph-adjacent and additional edge cases.

function char(seq: number, inputType: string, data: string | null, tMs: number): CommittedChar {
  return Object.freeze({ seq, inputType, data, tMs })
}

interface Case {
  n: number
  name: string
  target: string
  charLog: CommittedChar[]
  expected: Partial<{
    perCharStatus: ReadonlyArray<string>
    cursor: number
    correctedCount: number
    uncorrectedCount: number
    completedAt: number | null
  }>
}

const cases: Case[] = [
  {
    n: 1,
    name: 'no keystrokes yet -> all pending, cursor 0',
    target: 'ab',
    charLog: [],
    expected: {
      perCharStatus: ['pending', 'pending'],
      cursor: 0,
      correctedCount: 0,
      uncorrectedCount: 0,
      completedAt: null,
    },
  },
  {
    n: 2,
    name: 'single correct commit advances cursor and marks correct',
    target: 'ab',
    charLog: [char(0, 'insertText', 'a', 10)],
    expected: { perCharStatus: ['correct', 'pending'], cursor: 1 },
  },
  {
    n: 3,
    name: 'wrong character still advances the cursor (free-correction, D-04)',
    target: 'a',
    charLog: [char(0, 'insertText', 'x', 10)],
    expected: { perCharStatus: ['incorrect'], cursor: 1, uncorrectedCount: 1 },
  },
  {
    n: 4,
    name: 'a delete-type record after a wrong commit moves cursor back and re-opens pending (D-05)',
    target: 'a',
    charLog: [char(0, 'insertText', 'x', 10), char(1, 'deleteContentBackward', null, 20)],
    expected: { perCharStatus: ['pending'], cursor: 0, uncorrectedCount: 0 },
  },
  {
    n: 5,
    name: 'retyping correctly after backspace is corrected (was ever wrong AND now correct, D-04)',
    target: 'a',
    charLog: [
      char(0, 'insertText', 'x', 10),
      char(1, 'deleteContentBackward', null, 20),
      char(2, 'insertText', 'a', 30),
    ],
    expected: { perCharStatus: ['correct'], cursor: 1, correctedCount: 1, uncorrectedCount: 0 },
  },
  {
    n: 6,
    name: 'cursor reaching target.length sets completedAt to the closing record tMs',
    target: 'ab',
    charLog: [char(0, 'insertText', 'a', 10), char(1, 'insertText', 'b', 42)],
    expected: { perCharStatus: ['correct', 'correct'], cursor: 2, completedAt: 42 },
  },
  {
    n: 7,
    name: 'an IME-composed 2-codepoint commit scores both positions in one record',
    target: 'ab',
    charLog: [char(0, 'insertFromComposition', 'ab', 10)],
    expected: { perCharStatus: ['correct', 'correct'], cursor: 2, completedAt: 10 },
  },
  {
    n: 8,
    name: 'a second delete-type record when cursor is already 0 is a no-op (no throw, no negative index)',
    target: 'a',
    charLog: [char(0, 'deleteContentBackward', null, 10), char(1, 'deleteContentBackward', null, 20)],
    expected: { perCharStatus: ['pending'], cursor: 0, uncorrectedCount: 0 },
  },
  {
    n: 9,
    name: 'once completedAt is set, a further insert record past target.length does not overwrite it',
    target: 'a',
    charLog: [char(0, 'insertText', 'a', 10), char(1, 'insertText', 'x', 20)],
    expected: { perCharStatus: ['correct'], cursor: 1, completedAt: 10 },
  },
  {
    n: 10,
    name: 'a supplementary-plane character (surrogate pair) in target is one code point, not two UTF-16 units — exercise completes',
    // 🎉 (U+1F389) is 2 UTF-16 code units but 1 code point; target has 2 code points total.
    target: '🎉a',
    charLog: [char(0, 'insertText', '🎉', 10), char(1, 'insertText', 'a', 20)],
    expected: { perCharStatus: ['correct', 'correct'], cursor: 2, completedAt: 20 },
  },
]

describe('computeTrainerState() — golden cases (TYPE-01/02/03)', () => {
  it.each(cases)('case $n: $name', ({ target, charLog, expected }) => {
    const result = computeTrainerState(target, charLog)
    if (expected.perCharStatus !== undefined) expect(result.perCharStatus).toEqual(expected.perCharStatus)
    if (expected.cursor !== undefined) expect(result.cursor).toBe(expected.cursor)
    if (expected.correctedCount !== undefined) expect(result.correctedCount).toBe(expected.correctedCount)
    if (expected.uncorrectedCount !== undefined) expect(result.uncorrectedCount).toBe(expected.uncorrectedCount)
    if (expected.completedAt !== undefined) expect(result.completedAt).toBe(expected.completedAt)
  })
})

interface GlyphCase {
  n: number
  name: string
  input: string
  expected: string
}

const glyphCases: GlyphCase[] = [
  { n: 1, name: 'space -> middle dot (U+00B7)', input: ' ', expected: '·' },
  { n: 2, name: 'newline -> downwards arrow (U+21B5)', input: '\n', expected: '↵' },
  { n: 3, name: 'any other character is unchanged', input: 'a', expected: 'a' },
]

describe('glyphFor() — 3 golden cases (TYPE-04, D-06 amended)', () => {
  it.each(glyphCases)('case $n: $name', ({ input, expected }) => {
    expect(glyphFor(input)).toBe(expected)
  })
})

describe('computeTrainerState() — contract edges', () => {
  it("computeTrainerState('a', []) returns the exact initial-state shape", () => {
    expect(computeTrainerState('a', [])).toEqual({
      perCharStatus: ['pending'],
      cursor: 0,
      correctedCount: 0,
      uncorrectedCount: 0,
      completedAt: null,
    })
  })
})
