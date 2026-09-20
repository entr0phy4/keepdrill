---
phase: 06-cross-session-analytics
plan: 01
subsystem: metrics
tags: [latency, gatedMedian, resolveMetrics, analytics-foundation, vitest]

requires:
  - phase: 03-session-metrics
    provides: "slowestFive exclusive (25ms, 1000ms) window, CHAR_MIN_SAMPLES=3, median, METR-03 golden cases n=7/8/9"
  - phase: 04-session-persistence-history
    provides: "resolveMetrics recompute-if-stale guard; StoredSession; completedAtTMs clock domain"
  - phase: 05-symbol-adjusted-wpm-language-tagging
    provides: "METRICS_SCHEMA_VERSION = 2; MetricsResult.symbolAdjustedWpm companion"
provides:
  - "Shared filter→gate→median in src/metrics/latency-stats.ts (MIN_GAP_MS, MAX_GAP_MS, CHAR_MIN_SAMPLES, DIGRAPH_MIN_SAMPLES, median, gatedMedian)"
  - "slowestFive is a thin gatedMedian(samples, CHAR_MIN_SAMPLES) caller; SlowestKeyEntry still { char, medianMs }"
  - "resolveMetrics + ResolvableSession in src/metrics/resolve-metrics.ts; history-metrics.ts is a one-line re-export"
affects: [06-02 analytics folds, 06-03 AnalyticsDashboard]

tech-stack:
  added: []
  patterns:
    - "One helper owns the exclusive gap window and both sample gates — analytics must import, never copy numbers (D-09)"
    - "ResolvableSession is a Pick of StoredSession so analytics projections without Dexie id stay assignable"
    - "ui/history-metrics.ts is a compatibility re-export; new callers import from metrics/"

key-files:
  created:
    - src/metrics/latency-stats.ts
    - src/metrics/latency-stats.test.ts
    - src/metrics/resolve-metrics.ts
  modified:
    - src/metrics/metrics.ts
    - src/ui/history-metrics.ts

key-decisions:
  - "gatedMedian is the single filter→gate→median owner; DIGRAPH_MIN_SAMPLES=5 is a named export so digraph/heatmap cannot bury 5 as a magic number (D-06, D-09)"
  - "resolveMetrics parameter widened to ResolvableSession (Pick of five StoredSession fields) so analytics Session projections without Dexie id remain assignable (ANLY-05)"

patterns-established:
  - "Extract shared numeric helpers into src/metrics/ siblings (latency-stats, resolve-metrics) rather than into src/analytics/ — slowestFive must not import up from a later module"
  - "Keep HistoryView's import path stable via a one-line re-export when moving a pure helper out of ui/"

requirements-completed: [ANLY-03, ANLY-04, ANLY-05]

coverage:
  - id: D1
    description: "latency-stats.ts owns exclusive (25ms, 1000ms) window, CHAR_MIN_SAMPLES=3, DIGRAPH_MIN_SAMPLES=5, median, and gatedMedian"
    requirement: "ANLY-03"
    verification:
      - kind: unit
        ref: "src/metrics/latency-stats.test.ts — 4-in-window → null; 5-in-window sampleCount===5; 25/1000 discarded, 26/999 kept; median([])=0; even [100,200]=150"
        status: pass
    human_judgment: false
  - id: D2
    description: "slowestFive calls gatedMedian(samples, CHAR_MIN_SAMPLES); private window/median deleted; METR-03 cases n=7/8/9 stay green; SlowestKeyEntry has no sampleCount"
    requirement: "ANLY-03"
    verification:
      - kind: unit
        ref: "src/metrics/metrics.test.ts — cases n=7 (CHAR_MIN_SAMPLES=3), n=8 (exclusive window), n=9 (cap 5)"
        status: pass
    human_judgment: false
  - id: D3
    description: "resolveMetrics lives in src/metrics/resolve-metrics.ts with completedAtTMs as now; HistoryView still imports from ./history-metrics"
    requirement: "ANLY-05"
    verification:
      - kind: unit
        ref: "src/ui/history-metrics.test.ts — identity on schema match; computeSessionMetrics(..., completedAtTMs) on mismatch"
        status: pass
      - kind: other
        ref: "pnpm typecheck — HistoryView import { resolveMetrics } from './history-metrics'"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-09-20
status: complete
---

# Phase 6 Plan 01: Shared Latency Helper + resolveMetrics Extract Summary

**Single `gatedMedian` owns the exclusive (25ms, 1000ms) window and both sample gates; `resolveMetrics` moved to `src/metrics/` so analytics never imports `ui/`**

## Performance

- **Duration:** 4 min
- **Started:** 2026-09-20T18:05:37Z
- **Completed:** 2026-09-20T18:09:00Z
- **Tasks:** 2/2 (each TDD RED→GREEN)
- **Files modified:** 5

## Accomplishments

- `src/metrics/latency-stats.ts` exports `MIN_GAP_MS`, `MAX_GAP_MS`, `CHAR_MIN_SAMPLES`, `DIGRAPH_MIN_SAMPLES`, `median`, and `gatedMedian` — one place owns the post-filter gate so digraph ranking and the heatmap cannot drift from `slowestFive` (D-06, D-09)
- `slowestFive` is a thin `gatedMedian(samples, CHAR_MIN_SAMPLES)` caller; `SlowestKeyEntry` still has only `char` and `medianMs`; METR-03 golden cases n=7/8/9 stay green
- `resolveMetrics` + `ResolvableSession` live in `src/metrics/resolve-metrics.ts`; `history-metrics.ts` is a one-line re-export so HistoryView's import path is unchanged (ANLY-05 foundation)

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED: failing gatedMedian/median tests** - `81a155e` (test)
2. **Task 1 GREEN: extract latency-stats and switch slowestFive** - `e097124` (feat)
3. **Task 2 RED: retarget resolveMetrics import to metrics/** - `e306b1b` (test)
4. **Task 2 GREEN: move resolveMetrics; re-export from history-metrics** - `e90460c` (feat)

**Plan metadata:** pending docs commit

_Note: TDD tasks produced RED→GREEN commit pairs. No REFACTOR commit — the extract matched PATTERNS.md verbatim._

## Files Created/Modified

- `src/metrics/latency-stats.ts` — PURE filter→gate→median helper; named one-line tunes including `DIGRAPH_MIN_SAMPLES = 5`
- `src/metrics/latency-stats.test.ts` — golden Case + it.each table for median and gatedMedian
- `src/metrics/metrics.ts` — private window/median deleted; `slowestFive` calls `gatedMedian`
- `src/metrics/resolve-metrics.ts` — schema-aware WPM recompute with `completedAtTMs` as `now`
- `src/ui/history-metrics.ts` — one-line re-export; guard body gone

## Decisions Made

- `gatedMedian` is the single filter→gate→median owner; `DIGRAPH_MIN_SAMPLES = 5` is a named export so digraph/heatmap cannot bury 5 as a magic number (D-06, D-09)
- `resolveMetrics` parameter widened to `ResolvableSession` (Pick of five `StoredSession` fields) so analytics Session projections without Dexie `id` remain assignable (ANLY-05)

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** None

## Issues Encountered

None

## Authentication Gates

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 06-02 (digraph / heatmap / language-profile folds). Those plans import `gatedMedian` + `DIGRAPH_MIN_SAMPLES` from `latency-stats` and `resolveMetrics` from `metrics/resolve-metrics` — they must not copy-paste the gap-window numbers or import `ui/`.

ANLY-03 / ANLY-04 / ANLY-05 user-facing surfaces are **not** shipped yet. This plan only extracted the shared helpers. REQUIREMENTS.md checkboxes stay open until 06-03.

## TDD Gate Compliance

- RED: `81a155e` (latency-stats tests), `e306b1b` (resolveMetrics import retarget)
- GREEN: `e097124` (latency-stats extract), `e90460c` (resolveMetrics move)
- REFACTOR: none (extract matched PATTERNS.md)

---
*Phase: 06-cross-session-analytics*
*Completed: 2026-09-20*

## Self-Check: PASSED
