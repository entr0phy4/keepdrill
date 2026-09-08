import type { Exercise } from '../ingestion/types'
import type { CaptureMarker, CommittedChar, KeystrokeEvent, Session } from '../capture/types'
import type { MetricsResult } from '../metrics/metrics'

// D-02/D-03/D-05: the on-disk IndexedDB record shape. This is a one-way door
// once real users have a version(1) DB on disk (see persistence/db.ts) —
// Phase 5/6 read this shape. Never re-export/re-declare the upstream types
// (Session/Exercise/MetricsResult) — reference them by import only.

/** Envelope version; bump when the RECORD SHAPE changes (D-05). Mirrors
 *  metrics.ts's METRICS_SCHEMA_VERSION precedent. */
export const STORED_SESSION_SCHEMA_VERSION = 1

export interface StoredSession {
  /** Auto-increment PK — Dexie fills this in on `add` (D-02 discretion: ++id
   *  over startedAt/UUID, see 04-RESEARCH.md Data Model). */
  id?: number
  /** = STORED_SESSION_SCHEMA_VERSION at write time (D-05). */
  schemaVersion: number
  /** Session.startedAt — Date.now() WALL CLOCK. Indexed; drives ordering
   *  (D-09/D-12) and the row's displayed date. */
  startedAt: number
  /** The `completedAt` value handleComplete received — event.timeStamp / tMs
   *  MONOTONIC domain, for recompute. NOT wall clock (RESEARCH Pitfall 2). */
  completedAtTMs: number
  exercise: Exercise
  events: KeystrokeEvent[]
  charLog: CommittedChar[]
  markers: CaptureMarker[]
  timingResolutionUs: number
  crossOriginIsolated: boolean
  /** Cache; has its own metricsSnapshot.schemaVersion (METRICS_SCHEMA_VERSION). */
  metricsSnapshot: MetricsResult
}

export interface NewSession {
  session: Session
  /** The tMs value CaptureSurface passed to onComplete. */
  completedAt: number
  metricsSnapshot: MetricsResult
}
