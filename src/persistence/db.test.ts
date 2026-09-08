import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { saveSession, listNewestFirst } from './repository'
import type { NewSession } from './types'
import type { Exercise } from '../ingestion/types'
import type { Session } from '../capture/types'
import { METRICS_SCHEMA_VERSION, type MetricsResult } from '../metrics/metrics'

// D-05 / RESEARCH Pitfall 3: a migration test harness now, even trivial, so
// the version-block discipline pattern exists before Phase 5 needs it.

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const exercise: Exercise = {
  text: 'ab',
  language: 'plaintext',
  sourceType: 'paste',
}

const metricsSnapshot: MetricsResult = {
  schemaVersion: METRICS_SCHEMA_VERSION,
  wpm: 42,
  accuracy: 0.9,
  slowest5: [],
}

function buildInput(): NewSession {
  const session: Session = {
    exercise,
    events: [],
    charLog: [],
    markers: [],
    timingResolutionUs: 5,
    crossOriginIsolated: true,
    startedAt: Date.now(),
  }
  return { session, completedAt: 600, metricsSnapshot }
}

describe('persistence/db — schema version + reload survival (PERS-01)', () => {
  it('opens with a sessions object store at schema version 1', () => {
    expect(db.verno).toBe(1)
    expect(db.tables.map((t) => t.name)).toContain('sessions')
  })

  it('a seeded row survives a connection close + reopen (reload-survival proxy)', async () => {
    await saveSession(buildInput())

    await db.close()
    await db.open()

    const rows = await listNewestFirst()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.exercise).toEqual(exercise)
  })
})
