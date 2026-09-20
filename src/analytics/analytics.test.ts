import { describe, it, expect } from 'vitest'
import { computeDigraphLatency, computeLanguageProfile } from './analytics'
import { METRICS_SCHEMA_VERSION } from '../metrics/metrics'
import type { MetricsResult } from '../metrics/metrics'
import type { CommittedChar } from '../capture/types'
import type { AnalyticsSession } from './types'

function char(seq: number, inputType: string, data: string | null, tMs: number): CommittedChar {
  return Object.freeze({ seq, inputType, data, tMs })
}

const baseSnapshot: MetricsResult = {
  schemaVersion: METRICS_SCHEMA_VERSION,
  wpm: 40,
  accuracy: 0.9,
  slowest5: [],
  symbolAdjustedWpm: 50,
}

function makeSession(overrides: Partial<AnalyticsSession> = {}): AnalyticsSession {
  return {
    completedAtTMs: 5_000,
    exercise: { text: 'ab', language: 'plaintext', sourceType: 'paste' },
    events: [],
    charLog: [],
    markers: [],
    metricsSnapshot: baseSnapshot,
    ...overrides,
  }
}

/** Alternating c1/c2 inserts. `count` samples of pair c1+c2 (and count-1 of c2+c1). */
function pairLog(c1: string, c2: string, count: number, gap = 100): CommittedChar[] {
  const log: CommittedChar[] = []
  let t = 0
  let seq = 0
  for (let i = 0; i < count; i++) {
    log.push(char(seq++, 'insertText', c1, t))
    t += gap
    log.push(char(seq++, 'insertText', c2, t))
    t += gap
  }
  return log
}

describe('computeDigraphLatency', () => {
  it('omits a pair with 4 in-window samples and includes it at 5 with sampleCount 5', () => {
    const four = computeDigraphLatency([makeSession({ charLog: pairLog('a', 'b', 4) })])
    expect(four.find((e) => e.pair === 'ab')).toBeUndefined()

    const five = computeDigraphLatency([makeSession({ charLog: pairLog('a', 'b', 5) })])
    const ab = five.find((e) => e.pair === 'ab')
    expect(ab).toEqual({ pair: 'ab', medianMs: 100, sampleCount: 5 })
  })

  it('sorts eligible pairs by medianMs descending and caps the result at 10', () => {
    const pairs = ['ab', 'cd', 'ef', 'gh', 'ij', 'kl', 'mn', 'op', 'qr', 'st', 'uv']
    const sessions = pairs.map((p, i) => {
      const gap = 110 + i * 10
      const [c1, c2] = Array.from(p)
      return makeSession({ charLog: pairLog(c1!, c2!, 5, gap) })
    })
    const result = computeDigraphLatency(sessions)
    expect(result).toHaveLength(10)
    const medians = result.map((e) => e.medianMs)
    expect(medians).toEqual([...medians].sort((a, b) => b - a))
    expect(result.map((e) => e.pair)).not.toContain('ab')
    expect(result[0]?.pair).toBe('uv')
  })

  it('does not emit a pair spanning a delete (prevInsertChar cleared)', () => {
    const log: CommittedChar[] = []
    let t = 0
    let seq = 0
    for (let i = 0; i < 5; i++) {
      log.push(char(seq++, 'insertText', 'a', t))
      t += 50
      log.push(char(seq++, 'deleteContentBackward', null, t))
      t += 50
      log.push(char(seq++, 'insertText', 'b', t))
      t += 50
      log.push(char(seq++, 'deleteContentBackward', null, t))
      t += 50
    }
    const result = computeDigraphLatency([makeSession({ charLog: log })])
    expect(result.find((e) => e.pair === 'ab')).toBeUndefined()
  })

  it('attributes a multi-codepoint insert gap only to its last codepoint (IME)', () => {
    const log: CommittedChar[] = []
    let t = 0
    let seq = 0
    for (let i = 0; i < 5; i++) {
      log.push(char(seq++, 'insertText', 'x', t))
      t += 100
      log.push(char(seq++, 'insertFromComposition', 'ab', t))
      t += 100
    }
    const result = computeDigraphLatency([makeSession({ charLog: log })])
    // Gap attaches to the last IME codepoint after earlier codepoints update
    // prevInsertChar, so the pair is "ab" not "xa"/"xb" (metrics n=10 analog).
    expect(result.find((e) => e.pair === 'xa')).toBeUndefined()
    const ab = result.find((e) => e.pair === 'ab')
    expect(ab?.sampleCount).toBe(5)
    expect(ab?.medianMs).toBe(100)
  })

  it('treats a supplementary-plane codepoint as one Array.from element in the pair key', () => {
    const result = computeDigraphLatency([
      makeSession({ charLog: pairLog('🎉', 'a', 5) }),
    ])
    const entry = result.find((e) => Array.from(e.pair)[0] === '🎉')
    expect(entry).toBeDefined()
    expect(Array.from(entry!.pair)).toEqual(['🎉', 'a'])
    expect(entry!.sampleCount).toBe(5)
  })

  it('keeps "{x" and "[x" as distinct DigraphEntry.pair values', () => {
    const result = computeDigraphLatency([
      makeSession({ charLog: pairLog('{', 'x', 5) }),
      makeSession({ charLog: pairLog('[', 'x', 5) }),
    ])
    const pairs = result.map((e) => e.pair)
    expect(pairs).toEqual(expect.arrayContaining(['{x', '[x']))
    expect(new Set(pairs).size).toBe(pairs.length)
  })

  it('returns [] for no sessions and for sessions whose charLog is empty', () => {
    expect(computeDigraphLatency([])).toEqual([])
    expect(computeDigraphLatency([makeSession({ charLog: [] })])).toEqual([])
  })
})

describe('computeLanguageProfile', () => {
  it('buckets plaintext separately and sorts by sessionCount descending', () => {
    const sessions = [
      makeSession({
        exercise: { text: 'fn', language: 'rust', sourceType: 'upload' },
        metricsSnapshot: { ...baseSnapshot, wpm: 40, symbolAdjustedWpm: 50, accuracy: 0.9 },
      }),
      makeSession({
        exercise: { text: 'fn', language: 'rust', sourceType: 'upload' },
        metricsSnapshot: { ...baseSnapshot, wpm: 60, symbolAdjustedWpm: 70, accuracy: 0.8 },
      }),
      makeSession({
        exercise: { text: 'hi', language: 'plaintext', sourceType: 'paste' },
        metricsSnapshot: { ...baseSnapshot, wpm: 80, symbolAdjustedWpm: 90, accuracy: 1 },
      }),
    ]
    const rows = computeLanguageProfile(sessions)
    expect(rows).toHaveLength(2)
    expect(rows[0]?.language).toBe('rust')
    expect(rows[0]?.sessionCount).toBe(2)
    expect(rows[0]?.wpm).toBe(50)
    expect(rows[0]?.symbolAdjustedWpm).toBe(60)
    expect(rows[0]?.accuracy).toBeCloseTo(0.85)
    expect(rows[1]).toMatchObject({ language: 'plaintext', sessionCount: 1, wpm: 80 })
  })

  it('still contributes a defined symbolAdjustedWpm when metricsSnapshot schema is stale', () => {
    const stale: MetricsResult = {
      schemaVersion: METRICS_SCHEMA_VERSION - 1,
      wpm: 1,
      accuracy: 1,
      slowest5: [],
      symbolAdjustedWpm: 0,
    }
    const rows = computeLanguageProfile([
      makeSession({
        exercise: { text: 'ab', language: 'python', sourceType: 'paste' },
        charLog: [char(0, 'insertText', 'a', 0), char(1, 'insertText', 'b', 100)],
        completedAtTMs: 100,
        metricsSnapshot: stale,
      }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.language).toBe('python')
    expect(rows[0]?.symbolAdjustedWpm).toBeDefined()
    expect(Number.isFinite(rows[0]!.symbolAdjustedWpm)).toBe(true)
    expect(rows[0]?.wpm).toBeDefined()
    expect(rows[0]?.accuracy).toBeDefined()
    expect(rows[0]?.sessionCount).toBe(1)
  })

  it('breaks equal sessionCount ties by language string ascending', () => {
    const rows = computeLanguageProfile([
      makeSession({
        exercise: { text: 'a', language: 'rust', sourceType: 'upload' },
        metricsSnapshot: { ...baseSnapshot, wpm: 10 },
      }),
      makeSession({
        exercise: { text: 'a', language: 'python', sourceType: 'upload' },
        metricsSnapshot: { ...baseSnapshot, wpm: 20 },
      }),
    ])
    expect(rows.map((r) => r.language)).toEqual(['python', 'rust'])
  })
})
