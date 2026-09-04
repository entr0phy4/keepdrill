import type { Exercise } from '../ingestion/types'

// D-12 — verbatim shape. Reversibility: costly. Every downstream metric consumes
// this; adding a field later is safe, changing/removing one is not.
export interface KeystrokeEvent {
  seq: number
  type: 'keydown' | 'keyup'
  key: string
  code: string
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
  /** = event.timeStamp (a DOMHighResTimeStamp, monotonic) — D-07. */
  tMs: number
  isRepeat: boolean
}

// D-14 — the in-memory value object Phase 3 folds over and Phase 4 persists.
export interface Session {
  exercise: Exercise
  events: readonly KeystrokeEvent[]
  timingResolutionUs: number
  crossOriginIsolated: boolean
  /** Date.now() wall clock, display only (RESEARCH Open Question 6). */
  startedAt: number
}
