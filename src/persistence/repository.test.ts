import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { saveSession, listNewestFirst } from './repository'
import type { NewSession } from './types'
import type { Exercise } from '../ingestion/types'
import type { Session } from '../capture/types'
import { METRICS_SCHEMA_VERSION, type MetricsResult } from '../metrics/metrics'

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
  symbolAdjustedWpm: 42,
}

function buildInput(overrides: Partial<Session> = {}, completedAt = 600): NewSession {
  const session: Session = {
    exercise,
    events: [],
    charLog: [],
    markers: [],
    timingResolutionUs: 5,
    crossOriginIsolated: true,
    startedAt: Date.now(),
    ...overrides,
  }
  return { session, completedAt, metricsSnapshot }
}

describe('persistence/repository — round-trip and ordering', () => {
  it('db opens at schema version 1', () => {
    expect(db.verno).toBe(1)
  })

  it('saveSession then listNewestFirst round-trips events/charLog/markers/exercise by value', async () => {
    const events: Session['events'] = [
      { seq: 0, type: 'keydown', key: 'a', code: 'KeyA', ctrl: false, alt: false, shift: false, meta: false, tMs: 0, isRepeat: false },
    ]
    const charLog: Session['charLog'] = [{ seq: 0, inputType: 'insertText', data: 'a', tMs: 0 }]
    const markers: Session['markers'] = [{ seq: 1, kind: 'focus', tMs: 0 }]

    const id = await saveSession(buildInput({ events, charLog, markers }))
    expect(typeof id).toBe('number')

    const rows = await listNewestFirst()
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row).toBeDefined()
    expect(row?.events).toEqual(events)
    expect(row?.charLog).toEqual(charLog)
    expect(row?.markers).toEqual(markers)
    expect(row?.exercise).toEqual(exercise)
    // Arrays are copies, not shared references.
    expect(row?.events).not.toBe(events)
  })

  it('a completion whose charLog is empty still writes a well-formed row', async () => {
    await saveSession(buildInput({ events: [], charLog: [], markers: [] }))
    const rows = await listNewestFirst()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.events).toEqual([])
    expect(rows[0]?.charLog).toEqual([])
    expect(rows[0]?.markers).toEqual([])
    expect(rows[0]?.metricsSnapshot).toEqual(metricsSnapshot)
  })

  it('two writes with an identical startedAt return ++id-descending', async () => {
    const startedAt = Date.now()
    const id1 = await saveSession(buildInput({ startedAt }))
    const id2 = await saveSession(buildInput({ startedAt }))
    const rows = await listNewestFirst()
    expect(rows.map((r) => r.id)).toEqual([id2, id1])
  })

  interface Case {
    name: string
    startedAts: number[]
  }
  const cases: Case[] = [
    { name: 'three writes with distinct startedAt', startedAts: [1000, 3000, 2000] },
    { name: 'ascending insertion order', startedAts: [100, 200, 300] },
  ]

  it.each(cases)('$name returns strict newest-first order', async ({ startedAts }) => {
    for (const startedAt of startedAts) {
      await saveSession(buildInput({ startedAt }))
    }
    const rows = await listNewestFirst()
    const sortedDesc = [...startedAts].sort((a, b) => b - a)
    expect(rows.map((r) => r.startedAt)).toEqual(sortedDesc)
  })
})
