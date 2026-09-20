import { describe, it, expect } from 'vitest'
import { computeKeyboardHeatmap } from './heatmap'
import { US_ANSI_KEYS } from './keyboard-geometry'
import { METRICS_SCHEMA_VERSION } from '../metrics/metrics'
import type { MetricsResult } from '../metrics/metrics'
import type { KeystrokeEvent } from '../capture/types'
import type { AnalyticsSession } from './types'

const baseSnapshot: MetricsResult = {
  schemaVersion: METRICS_SCHEMA_VERSION,
  wpm: 40,
  accuracy: 0.9,
  slowest5: [],
  symbolAdjustedWpm: 50,
}

function makeSession(events: readonly KeystrokeEvent[]): AnalyticsSession {
  return {
    completedAtTMs: 5_000,
    exercise: { text: 'ab', language: 'plaintext', sourceType: 'paste' },
    events,
    charLog: [],
    markers: [],
    metricsSnapshot: baseSnapshot,
  }
}

function keydown(
  code: string,
  tMs: number,
  extra: Partial<KeystrokeEvent> = {},
): KeystrokeEvent {
  return {
    seq: 0,
    type: 'keydown',
    key: extra.key ?? '',
    code,
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
    tMs,
    isRepeat: false,
    ...extra,
  }
}

function cell(result: ReturnType<typeof computeKeyboardHeatmap>, code: string) {
  return result.find((c) => c.code === code)
}

describe('computeKeyboardHeatmap', () => {
  it('always returns one cell per US_ANSI_KEYS entry', () => {
    expect(computeKeyboardHeatmap([])).toHaveLength(US_ANSI_KEYS.length)
    expect(computeKeyboardHeatmap([makeSession([])])).toHaveLength(US_ANSI_KEYS.length)
  })

  it('pools Digit9 samples on the physical code, not the character glyph', () => {
    const events = [
      keydown('KeyA', 0, { key: 'a' }),
      keydown('Digit9', 100, { key: '9' }),
      keydown('Digit9', 200, { key: '(' }),
      keydown('Digit9', 300, { key: '9' }),
      keydown('Digit9', 400, { key: '(' }),
      keydown('Digit9', 500, { key: '9' }),
    ]
    const result = computeKeyboardHeatmap([makeSession(events)])
    const digit9 = cell(result, 'Digit9')
    expect(digit9?.sampleCount).toBe(5)
    expect(digit9?.medianMs).toBe(100)
    expect(result).toHaveLength(US_ANSI_KEYS.length)
  })

  it('ignores isRepeat keydowns as both samples and prevTMs anchors', () => {
    const events = [
      keydown('KeyA', 0),
      keydown('Digit1', 100),
      keydown('Digit1', 150, { isRepeat: true }),
      keydown('Digit1', 200),
      keydown('Digit1', 300),
      keydown('Digit1', 400),
      keydown('Digit1', 500),
    ]
    const digit1 = cell(computeKeyboardHeatmap([makeSession(events)]), 'Digit1')
    expect(digit1?.sampleCount).toBe(5)
    expect(digit1?.medianMs).toBe(100)
  })

  it('does not use ShiftLeft as an IKI anchor', () => {
    const events: KeystrokeEvent[] = []
    let t = 0
    for (let i = 0; i < 5; i++) {
      events.push(keydown('KeyA', t))
      events.push(keydown('ShiftLeft', t + 40))
      events.push(keydown('Digit1', t + 140, { key: '!' }))
      t += 240
    }
    const digit1 = cell(computeKeyboardHeatmap([makeSession(events)]), 'Digit1')
    expect(digit1?.medianMs).toBe(140)
    expect(digit1?.medianMs).not.toBe(100)
    expect(digit1?.sampleCount).toBe(5)
  })

  it('keeps below-gate keys in the array with medianMs null', () => {
    const events = [
      keydown('KeyA', 0),
      keydown('KeyB', 100),
      keydown('KeyB', 200),
      keydown('KeyB', 300),
      keydown('KeyB', 400),
    ]
    const result = computeKeyboardHeatmap([makeSession(events)])
    const b = cell(result, 'KeyB')
    expect(result).toHaveLength(US_ANSI_KEYS.length)
    expect(b?.medianMs).toBeNull()
    expect(b?.sampleCount).toBe(0)
    expect(cell(result, 'Space')?.medianMs).toBeNull()
  })

  it('uses tMs deltas only, never a wall-clock session timestamp', () => {
    const events = [
      keydown('KeyA', 10_000),
      keydown('Digit2', 10_100),
      keydown('Digit2', 10_200),
      keydown('Digit2', 10_300),
      keydown('Digit2', 10_400),
      keydown('Digit2', 10_500),
    ]
    const digit2 = cell(computeKeyboardHeatmap([makeSession(events)]), 'Digit2')
    expect(digit2?.medianMs).toBe(100)
    expect(digit2?.sampleCount).toBe(5)
  })
})
