// PURE — lives in ui/, NOT persistence/ (D-03: keeps repository.ts a thin
// Dexie wrapper). Never imports ../persistence/db or dexie. D-05's
// recompute-if-stale guard: renders the cached metricsSnapshot directly when
// it is still current, and recomputes from the raw log only when
// metricsSnapshot.schemaVersion !== METRICS_SCHEMA_VERSION. In Phase 4,
// METRICS_SCHEMA_VERSION === 1 and nothing bumps it, so this always returns
// the cache — the recompute branch is dormant until Phase 5.
//
// Never rounds (rounding is display-layer only, HistoryRow / ResultsView
// convention). The recompute's `now` argument is s.completedAtTMs
// (event.timeStamp domain) — NEVER s.startedAt (wall clock), per
// metrics.ts's own clock-domain warning (RESEARCH Pitfall 2).

import { computeSessionMetrics, METRICS_SCHEMA_VERSION } from '../metrics/metrics'
import type { MetricsResult } from '../metrics/metrics'
import type { StoredSession } from '../persistence/types'

export function resolveMetrics(s: StoredSession): MetricsResult {
  if (s.metricsSnapshot.schemaVersion === METRICS_SCHEMA_VERSION) return s.metricsSnapshot
  return computeSessionMetrics(s.exercise.text, s.charLog, s.markers, s.completedAtTMs)
}
