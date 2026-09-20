// PURE — zero DOM access, zero Dexie. Recompute-if-stale guard: renders the
// cached metricsSnapshot directly when it is still current, and recomputes
// from the raw log only when metricsSnapshot.schemaVersion !==
// METRICS_SCHEMA_VERSION.
//
// Never rounds (rounding is display-layer only, HistoryRow / ResultsView
// convention). The recompute's `now` argument is s.completedAtTMs
// (event.timeStamp domain) — NEVER s.startedAt (wall clock), per
// metrics.ts's own clock-domain warning (RESEARCH Pitfall 2).
// Widened from StoredSession to ResolvableSession so analytics Session
// projections (no Dexie id) remain assignable (ANLY-05, Open Question 2).

import { computeSessionMetrics, METRICS_SCHEMA_VERSION } from './metrics'
import type { MetricsResult } from './metrics'
import type { StoredSession } from '../persistence/types'

/** The five StoredSession fields resolveMetrics reads. charLog/markers are
 *  readonly so AnalyticsSession projections (no Dexie `id`) stay assignable;
 *  StoredSession remains assignable because mutable arrays satisfy readonly. */
export type ResolvableSession = Pick<
  StoredSession,
  'exercise' | 'completedAtTMs' | 'metricsSnapshot'
> & {
  charLog: readonly StoredSession['charLog'][number][]
  markers: readonly StoredSession['markers'][number][]
}

export function resolveMetrics(s: ResolvableSession): MetricsResult {
  if (s.metricsSnapshot.schemaVersion === METRICS_SCHEMA_VERSION) return s.metricsSnapshot
  return computeSessionMetrics(s.exercise.text, s.charLog, s.markers, s.completedAtTMs)
}
