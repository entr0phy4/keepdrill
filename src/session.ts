import type { Exercise } from './ingestion/types'
import type { Session } from './capture/types'
import { getEvents } from './capture/capture'
import { readCrossOriginIsolated, probeTimerResolutionUs } from './platform/isolation'

// D-14 shape, verbatim. Composition only — no DOM access, no side effects.
// Phase 3 metrics fold over this; Phase 4 persists it.
export function startSession(exercise: Exercise): Session {
  return {
    exercise,
    events: getEvents(),
    timingResolutionUs: probeTimerResolutionUs(),
    crossOriginIsolated: readCrossOriginIsolated(),
    startedAt: Date.now(), // wall clock, display only
  }
}
