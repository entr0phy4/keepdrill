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

/** The committed-character log — a sibling of KeystrokeEvent[], reconciled by
 *  `seq`, never merged (Pitfall 9). Comes from beforeinput/input + composition,
 *  never from KeyboardEvent.key (D-04). */
export interface CommittedChar {
  seq: number
  inputType: string
  data: string | null
  tMs: number
}

/** Lifecycle markers so Phase 2/3 can bound active time (A7, PITFALLS #3). */
export type MarkerKind = 'blur' | 'focus' | 'hidden' | 'visible'

export interface CaptureMarker {
  seq: number
  kind: MarkerKind
  tMs: number
}

// D-14 — the in-memory value object Phase 3 folds over and Phase 4 persists.
// charLog + markers are additive extensions from Plan 01-03 (RESOLVED Open
// Question 5: markers are a Session-level sibling list, not a KeystrokeEvent
// variant — D-12's `type` union stays keydown|keyup only).
export interface Session {
  exercise: Exercise
  events: readonly KeystrokeEvent[]
  charLog: readonly CommittedChar[]
  markers: readonly CaptureMarker[]
  timingResolutionUs: number
  crossOriginIsolated: boolean
  /** Date.now() wall clock, display only (RESEARCH Open Question 6). */
  startedAt: number
}
