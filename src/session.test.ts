import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCharLog, getEvents, getMarkers } from './capture/capture'
import type { Exercise } from './ingestion/types'
import { probeTimerResolutionUs, readCrossOriginIsolated } from './platform/isolation'
import { assembleSessionFromLogs, buildSession } from './session'

vi.mock('./capture/capture', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./capture/capture')>()
  return {
    ...actual,
    getEvents: vi.fn(actual.getEvents),
    getCharLog: vi.fn(actual.getCharLog),
    getMarkers: vi.fn(actual.getMarkers),
  }
})

const exercise: Exercise = {
  text: 'function a() {}\nfunction b() {}\n',
  language: 'typescript',
  sourceType: 'github',
  sourceRef: 'o/r:src/a.ts',
}

const logs = {
  events: [],
  charLog: [{ seq: 0, inputType: 'insertText', data: 'a', tMs: 10 }],
  markers: [],
}

afterEach(() => {
  vi.mocked(getEvents).mockClear()
  vi.mocked(getCharLog).mockClear()
  vi.mocked(getMarkers).mockClear()
})

describe('assembleSessionFromLogs — flattened persist shape (D-14 / SCAF-03)', () => {
  it('passes the full-file exercise through, keeps startedAt, and copies isolation probes', () => {
    const startedAt = 1_700_000_000_000
    const session = assembleSessionFromLogs(exercise, logs, startedAt)
    expect(session.exercise).toBe(exercise)
    expect(session.exercise.text).toBe('function a() {}\nfunction b() {}\n')
    expect(session.startedAt).toBe(startedAt)
    expect(session.charLog).toBe(logs.charLog)
    expect(session.events).toBe(logs.events)
    expect(session.markers).toBe(logs.markers)
    expect(session.timingResolutionUs).toBe(probeTimerResolutionUs())
    expect(session.crossOriginIsolated).toBe(readCrossOriginIsolated())
  })

  it('does not call getEvents, getCharLog, or getMarkers', () => {
    assembleSessionFromLogs(exercise, logs, 42)
    expect(getEvents).not.toHaveBeenCalled()
    expect(getCharLog).not.toHaveBeenCalled()
    expect(getMarkers).not.toHaveBeenCalled()
  })

  it('matches buildSession field order while buildSession still reads live getters', () => {
    const assembled = assembleSessionFromLogs(exercise, logs, 99)
    vi.mocked(getEvents).mockClear()
    vi.mocked(getCharLog).mockClear()
    vi.mocked(getMarkers).mockClear()
    const built = buildSession(exercise, 99)
    expect(Object.keys(assembled)).toEqual(Object.keys(built))
    expect(getEvents).toHaveBeenCalled()
    expect(getCharLog).toHaveBeenCalled()
    expect(getMarkers).toHaveBeenCalled()
  })
})
