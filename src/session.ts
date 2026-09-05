import type { Exercise } from './ingestion/types'
import type { Session } from './capture/types'
import { getCharLog, getEvents, getMarkers } from './capture/capture'
import { readCrossOriginIsolated, probeTimerResolutionUs } from './platform/isolation'

// D-14 shape (additive: charLog + markers, Plan 01-03). Composition only — no
// DOM access, no side effects. Phase 3 metrics fold over this; Phase 4 persists
// it.
export function startSession(exercise: Exercise): Session {
  return {
    exercise,
    events: getEvents(),
    charLog: getCharLog(),
    markers: getMarkers(),
    timingResolutionUs: probeTimerResolutionUs(), // combined measured+expected (A10)
    crossOriginIsolated: readCrossOriginIsolated(),
    startedAt: Date.now(), // wall clock, display only
  }
}
