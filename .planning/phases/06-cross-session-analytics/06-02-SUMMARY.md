---
phase: 06-cross-session-analytics
plan: 02
subsystem: analytics
tags: [digraph, heatmap, language-profile, US-ANSI, vitest]

requires:
  - phase: 06-cross-session-analytics
    provides: "gatedMedian + DIGRAPH_MIN_SAMPLES from latency-stats; resolveMetrics + ResolvableSession"
  - phase: 04-session-persistence-history
    provides: "StoredSession projection fields (charLog, events, exercise, metricsSnapshot, completedAtTMs)"
  - phase: 05-symbol-adjusted-wpm-language-tagging
    provides: "exercise.language including plaintext; METRICS_SCHEMA_VERSION = 2; symbolAdjustedWpm companion"
provides:
  - "AnalyticsSession / DigraphEntry / HeatmapCell / LanguageProfileRow in src/analytics/types.ts"
  - "US_ANSI_KEYS + isSampleable in src/analytics/keyboard-geometry.ts (D-10, D-13)"
  - "computeDigraphLatency + computeLanguageProfile in src/analytics/analytics.ts (ANLY-03, ANLY-05)"
  - "computeKeyboardHeatmap in src/analytics/heatmap.ts (ANLY-04)"
affects: [06-03 AnalyticsDashboard]

tech-stack:
  added: []
  patterns:
    - "Pure analytics folds over readonly AnalyticsSession[] — zero DOM, zero Dexie, zero rounding"
    - "Digraphs group by committed codepoint pairs; heatmap groups by KeystrokeEvent.code (Anti-Pattern 4 both axes)"
    - "Language profile is the unweighted mean of per-session resolveMetrics; plaintext is a normal map key"

key-files:
  created:
    - src/analytics/types.ts
    - src/analytics/keyboard-geometry.ts
    - src/analytics/keyboard-geometry.test.ts
    - src/analytics/analytics.ts
    - src/analytics/analytics.test.ts
    - src/analytics/heatmap.ts
    - src/analytics/heatmap.test.ts
  modified:
    - src/metrics/resolve-metrics.ts

key-decisions:
  - "Language aggregation is the unweighted arithmetic mean of per-session resolveMetrics values, not duration-weighted (RESEARCH A2)"
  - "Heatmap latency is keydown→keydown IKI among sampleable codes; modifiers and isRepeat are neither samples nor anchors (RESEARCH A1)"
  - "Equal sessionCount language rows sort by language string ascending so tests are deterministic"
  - "ResolvableSession charLog/markers widened to readonly so AnalyticsSession assigns without a Dexie-shaped cast"

patterns-established:
  - "src/analytics/ is a pure sibling of src/metrics/ — repository fetches, folds receive plain arrays"
  - "Geometry is a static US-ANSI table (language-map analog), never platform/layout.ts"

requirements-completed: [ANLY-03, ANLY-04, ANLY-05]

coverage:
  - id: D1
    description: "computeDigraphLatency returns at most 10 DigraphEntry rows, gated at 5 post-filter samples, Unicode-safe pairs, omits sub-threshold pairs"
    requirement: "ANLY-03"
    verification:
      - kind: unit
        ref: "src/analytics/analytics.test.ts — 4-vs-5 gate, cap 10, delete-reset, IME last-codepoint, supplementary-plane, {x vs [x, empty []"
        status: pass
    human_judgment: false
  - id: D2
    description: "computeKeyboardHeatmap returns one HeatmapCell per US_ANSI_KEYS, keyed by physical code, medianMs null below gate"
    requirement: "ANLY-04"
    verification:
      - kind: unit
        ref: "src/analytics/heatmap.test.ts — length===US_ANSI_KEYS, Digit9 pooling, isRepeat skip, ShiftLeft non-anchor, below-gate null, tMs-only"
        status: pass
    human_judgment: false
  - id: D3
    description: "computeLanguageProfile returns one row per distinct exercise.language (plaintext distinct), unweighted mean of resolveMetrics, sorted by sessionCount desc"
    requirement: "ANLY-05"
    verification:
      - kind: unit
        ref: "src/analytics/analytics.test.ts — two rust + one plaintext; stale schema still defines symbolAdjustedWpm; tie-break by language ascending"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-09-20
status: complete
---

# Phase 6 Plan 02: Analytics Folds Summary

**Pure `src/analytics/` folds: ranked digraphs (top 10, n≥5), full US-ANSI heatmap by physical code, and unweighted per-language `resolveMetrics` means — zero DOM, zero Dexie, zero rounding**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-20T18:11:37Z
- **Completed:** 2026-09-20T18:19:58Z
- **Tasks:** 3/3 (each TDD RED→GREEN)
- **Files modified:** 8 created, 1 modified

## Accomplishments

- `src/analytics/types.ts` exports `AnalyticsSession` (StoredSession projection, no Dexie `id`) plus `DigraphEntry`, `HeatmapCell`, `LanguageProfileRow`
- `US_ANSI_KEYS` covers the canonical W3C alphanumeric block; modifiers are drawn (`sampleable: false`); F-row / arrows / numpad / Intl codes are absent
- `computeDigraphLatency` pools `charLog` pairs across sessions, gates at `DIGRAPH_MIN_SAMPLES`, caps at 10, omits sub-threshold pairs, and is Unicode/IME/delete-safe
- `computeLanguageProfile` averages `resolveMetrics` per raw `exercise.language` tag; `plaintext` is its own bucket; rows sort by `sessionCount` desc with language-string tie-break
- `computeKeyboardHeatmap` returns the full US-ANSI cell list keyed by `KeystrokeEvent.code`; IKI skips `isRepeat` and unsampleable modifiers as both samples and anchors; below-gate keys stay with `medianMs: null`

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED: failing US-ANSI geometry tests** - `c26b7fc` (test)
2. **Task 1 GREEN: analytics types + geometry table** - `71a8625` (feat)
3. **Task 2 RED: failing digraph + language-profile tests** - `fc31da7` (test)
4. **Task 2 GREEN: computeDigraphLatency + computeLanguageProfile** - `1e48a96` (feat)
5. **Task 3 RED: failing heatmap tests** - `2e740aa` (test)
6. **Task 3 GREEN: computeKeyboardHeatmap** - `074f0c8` (feat)

**Plan metadata:** pending docs commit

_Note: TDD tasks produced RED→GREEN commit pairs. No REFACTOR commit — implementation matched PATTERNS.md._

## Files Created/Modified

- `src/analytics/types.ts` — read projection + three fold-output types
- `src/analytics/keyboard-geometry.ts` — PURE static US-ANSI table + `isSampleable`
- `src/analytics/keyboard-geometry.test.ts` — sampleable / membership / span golden cases
- `src/analytics/analytics.ts` — `computeDigraphLatency` + `computeLanguageProfile`
- `src/analytics/analytics.test.ts` — gate/cap/delete/IME/Unicode/plaintext/stale-schema cases
- `src/analytics/heatmap.ts` — `computeKeyboardHeatmap` physical-code IKI fold
- `src/analytics/heatmap.test.ts` — Digit9 pooling, isRepeat, ShiftLeft non-anchor, below-gate null
- `src/metrics/resolve-metrics.ts` — `ResolvableSession` charLog/markers widened to readonly

## Decisions Made

- Language aggregation is the unweighted arithmetic mean of per-session `resolveMetrics` values, not duration-weighted (RESEARCH A2)
- Heatmap latency is keydown→keydown IKI among `sampleable` codes; modifiers and `isRepeat` are neither samples nor anchors (RESEARCH A1)
- Equal `sessionCount` language rows sort by language string ascending so tests are deterministic
- `ResolvableSession` `charLog`/`markers` widened to readonly so `AnalyticsSession` assigns without a Dexie-shaped cast

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Widened ResolvableSession arrays to readonly**
- **Found during:** Task 2 (`pnpm typecheck`)
- **Issue:** `AnalyticsSession.charLog` / `markers` are `readonly` arrays; `Pick<StoredSession, ...>` kept mutable arrays, so `resolveMetrics(s)` failed assignability (`TS2345` / `TS2352`)
- **Fix:** `ResolvableSession` now uses `readonly` `charLog` and `markers`. `StoredSession` remains assignable (mutable satisfies readonly)
- **Files modified:** `src/metrics/resolve-metrics.ts`
- **Verification:** `pnpm typecheck` and `history-metrics.test.ts` still green
- **Committed in:** `1e48a96` (Task 2 GREEN)

---

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** Necessary for the plan's own "AnalyticsSession is assignable to ResolvableSession" contract. No scope creep.

## Issues Encountered

IME golden assertion first expected pair `"xb"` (previous record + last IME codepoint). The plan's `forEach` walk updates `prevInsertChar` for non-last codepoints before attributing the gap, so the pair is `"ab"`. Test aligned to that walk during GREEN; not a code deviation.

## Authentication Gates

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 06-03 (Analytics dashboard UI). That plan should import `computeDigraphLatency` / `computeLanguageProfile` from `analytics.ts` and `computeKeyboardHeatmap` from `heatmap.ts`, round only at the display layer, and never re-derive gates or averages.

ANLY-03 / ANLY-04 / ANLY-05 user-facing surfaces are **not** shipped yet. REQUIREMENTS.md checkboxes stay open until 06-03.

## TDD Gate Compliance

- RED: `c26b7fc` (geometry), `fc31da7` (digraph/language), `2e740aa` (heatmap)
- GREEN: `71a8625` (geometry), `1e48a96` (digraph/language), `074f0c8` (heatmap)
- REFACTOR: none (implementation matched PATTERNS.md)

---
*Phase: 06-cross-session-analytics*
*Completed: 2026-09-20*

## Self-Check: PASSED

