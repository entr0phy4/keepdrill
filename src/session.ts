import type { Exercise } from './ingestion/types'
import type { Session } from './capture/types'
import { getCharLog, getEvents, getMarkers } from './capture/capture'
import { readCrossOriginIsolated, probeTimerResolutionUs } from './platform/isolation'

// D-14 shape (additive: charLog + markers, Plan 01-03). Composition only — no
// DOM access, no side effects. Phase 3 metrics fold over this; Phase 4 persists
// it.
//
// CR-01: this is a LIVE snapshot, not a one-time event — events/charLog/markers
// reflect whatever capture.ts has recorded at the instant of the call. Calling
// this once at load time (before any typing has happened) and caching the
// result forever produces a Session frozen at empty forever. Callers that want
// the snapshot to reflect real keystrokes must call this again later (e.g. on
// an interval while an exercise is loaded, or when the exercise completes) —
// `startedAt` is threaded through as a parameter precisely so re-snapshotting
// doesn't reset the wall-clock start time.
export function buildSession(exercise: Exercise, startedAt: number): Session {
  return {
    exercise,
    events: getEvents(),
    charLog: getCharLog(),
    markers: getMarkers(),
    timingResolutionUs: probeTimerResolutionUs(), // combined measured+expected (A10)
    crossOriginIsolated: readCrossOriginIsolated(),
    startedAt,
  }
}

/** File-complete persist from concatenated unit snapshots. Does not read live
 *  capture getters — those only hold the last unit after resetCapture (D-14).
 *  `exercise` stays the full file; metrics typedTarget is joined elsewhere. */
export function assembleSessionFromLogs(
  exercise: Exercise,
  logs: Pick<Session, 'events' | 'charLog' | 'markers'>,
  startedAt: number,
): Session {
  return {
    exercise,
    events: logs.events,
    charLog: logs.charLog,
    markers: logs.markers,
    timingResolutionUs: probeTimerResolutionUs(),
    crossOriginIsolated: readCrossOriginIsolated(),
    startedAt,
  }
}
