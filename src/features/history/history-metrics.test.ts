import { describe, it, expect, vi } from 'vitest'
import { resolveMetrics } from './history-metrics'
import { METRICS_SCHEMA_VERSION, computeSessionMetrics } from '@/metrics/metrics'
import type { MetricsResult } from '@/metrics/metrics'
import type { StoredSession } from '@/persistence/types'

vi.mock('@/metrics/metrics', async () => {
  const actual = await vi.importActual<typeof import('@/metrics/metrics')>('@/metrics/metrics')
  return {
    ...actual,
    computeSessionMetrics: vi.fn(actual.computeSessionMetrics),
  }
})

const baseSnapshot: MetricsResult = {
  schemaVersion: METRICS_SCHEMA_VERSION,
  wpm: 42,
  accuracy: 0.9,
  slowest5: [],
  symbolAdjustedWpm: 60,
}

function makeStoredSession(overrides: Partial<StoredSession> = {}): StoredSession {
  return {
    id: 1,
    schemaVersion: 1,
    startedAt: 1_000,
    completedAtTMs: 5_000,
    exercise: { text: 'ab', language: 'plaintext', sourceType: 'paste' },
    events: [],
    charLog: [],
    markers: [],
    timingResolutionUs: 100,
    crossOriginIsolated: true,
    metricsSnapshot: baseSnapshot,
    ...overrides,
  }
}

describe('resolveMetrics', () => {
  it('returns the exact metricsSnapshot object reference when schemaVersion matches', () => {
    const s = makeStoredSession()
    const result = resolveMetrics(s)
    expect(result).toBe(s.metricsSnapshot)
  })

  it('routes to computeSessionMetrics with completedAtTMs as `now` when schemaVersion mismatches', () => {
    const mockedCompute = computeSessionMetrics as unknown as ReturnType<typeof vi.fn>
    mockedCompute.mockClear()

    const staleSnapshot: MetricsResult = { ...baseSnapshot, schemaVersion: METRICS_SCHEMA_VERSION + 1 }
    const s = makeStoredSession({ metricsSnapshot: staleSnapshot, completedAtTMs: 9_999 })

    const result = resolveMetrics(s)

    expect(mockedCompute).toHaveBeenCalledWith(s.exercise.text, s.charLog, s.markers, 9_999)
    expect(result).not.toBe(staleSnapshot)
    expect(result.schemaVersion).toBe(METRICS_SCHEMA_VERSION)
  })
})
