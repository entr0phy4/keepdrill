---
phase: 05-symbol-adjusted-wpm-language-tagging
plan: 01
subsystem: metrics
tags: [wpm, symbol-density, metrics, react, vitest]

requires:
  - phase: 03-session-metrics
    provides: "computeSessionMetrics() / MetricsResult / METRICS_SCHEMA_VERSION and display-layer Math.round() in ResultsView"
  - phase: 04-session-persistence-history
    provides: "resolveMetrics() recompute-if-stale guard; HistoryRow; persisted MetricsResult snapshots"
provides:
  - "Pure symbol-density classifier + linear weighting formula (SYMBOL_WEIGHT=2) in src/metrics/symbol-density.ts"
  - "MetricsResult.symbolAdjustedWpm companion field; METRICS_SCHEMA_VERSION bumped 1→2 (D-06 recompute-on-read)"
  - "D-07 double-counting regression: multiplier depends only on target, never charLog"
  - "ResultsView third 'adj. wpm' stat; HistoryRow compact '{wpm} / {adj} adj.' pairing; 3-column results grid"
affects: [06-cross-session-analytics, history-metrics]

tech-stack:
  added: []
  patterns:
    - "Pure sibling module: symbol-density.ts never imports CommittedChar/CaptureMarker and never rounds"
    - "Additive companion metric: symbolAdjustedWpm sits beside required wpm, never replaces it"
    - "Schema bump activates existing resolveMetrics !== guard — zero migration for pre-v2 snapshots"

key-files:
  created:
    - src/metrics/symbol-density.ts
    - src/metrics/symbol-density.test.ts
  modified:
    - src/metrics/metrics.ts
    - src/metrics/metrics.test.ts
    - src/ui/ResultsView.tsx
    - src/ui/HistoryView.tsx
    - src/index.css
    - src/ui/HistoryView.test.tsx
    - src/ui/history-metrics.test.ts
    - src/persistence/repository.test.ts
    - src/persistence/db.test.ts

key-decisions:
  - "symbolAdjustedWpm is an ADDITIVE companion on MetricsResult; wpm remains the primary/required field (assumption-delta: add-alongside, not promote)"
  - "Rule 3: also added symbolAdjustedWpm to persistence/repository.test.ts and persistence/db.test.ts MetricsResult literals so typecheck stays green (Pitfall 3 listed only the two UI fixtures)"

patterns-established:
  - "Classifier/formula depend only on target text (Array.from codepoints); never weight per charLog attempt"
  - "METRICS_SCHEMA_VERSION bump is the migration: resolveMetrics recomputes stale snapshots on next history read"

requirements-completed: [ANLY-01]

coverage:
  - id: D1
    description: "Pure classifySymbolDensity/computeSymbolAdjustedWpm module with D-01 buckets, Array.from Unicode safety, empty-target guard, and D-05 linear formula"
    requirement: "ANLY-01"
    verification:
      - kind: unit
        ref: "src/metrics/symbol-density.test.ts — alnum/symbol/underscore/whitespace/empty/emoji classifier cases; 0/0.5/1.0 weighting; max bound wpm*SYMBOL_WEIGHT"
        status: pass
    human_judgment: false
  - id: D2
    description: "computeSessionMetrics returns symbolAdjustedWpm; METRICS_SCHEMA_VERSION is 2 so pre-existing history rows recompute on read"
    requirement: "ANLY-01"
    verification:
      - kind: unit
        ref: "src/metrics/metrics.test.ts — every golden case matches computeSymbolAdjustedWpm(wpm, classifySymbolDensity(target)); schemaVersion===2; case 11 exact 100%-symbol doubling"
        status: pass
      - kind: unit
        ref: "src/ui/history-metrics.test.ts — resolveMetrics still compiles against widened MetricsResult"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-07: a backspace-corrected symbol charLog does not inflate symbolAdjustedWpm/wpm versus a clean run of the identical target"
    requirement: "ANLY-01"
    verification:
      - kind: unit
        ref: "src/metrics/metrics.test.ts#D-07: backspace-corrected symbol characters do not inflate the symbolAdjustedWpm/wpm ratio (no double-counting)"
        status: pass
    human_judgment: false
  - id: D4
    description: "ResultsView shows a third always-visible 'adj. wpm' stat peer-sized to wpm/accuracy; desktop grid is 1fr 1fr 1fr"
    requirement: "ANLY-01"
    verification:
      - kind: other
        ref: "grep -c 'adj. wpm' src/ui/ResultsView.tsx == 1; grep 1fr 1fr 1fr on .results-stats >=640px"
        status: pass
    human_judgment: true
    rationale: "Even three-column layout at >=640px and no horizontal overflow from 320px up is a visual backstop (05-UI-SPEC.md); no ResultsView unit test asserts the third stat."
  - id: D5
    description: "Every HistoryRow shows both WPM values inline as '{wpm} / {adj} adj.' with no standalone wpm label"
    requirement: "ANLY-01"
    verification:
      - kind: automated_ui
        ref: "src/ui/HistoryView.test.tsx — fully populated row contains '62 ', 'adj.', '78'; standalone toContain('wpm') removed"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-09-13
status: complete
---

# Phase 5 Plan 01: Symbol-Adjusted WPM Summary

**Companion `symbolAdjustedWpm` from a target-only density classifier (`SYMBOL_WEIGHT=2`), schema v2 recompute-on-read, shown as "adj. wpm" on results and `{wpm} / {adj} adj.` in history**

## Performance

- **Duration:** 7 min
- **Started:** 2026-09-13T18:38:02Z
- **Completed:** 2026-09-13T18:45:05Z
- **Tasks:** 3/3 (Task 1 resumed from existing commit; Tasks 2–3 executed this run)
- **Files modified:** 11

## Accomplishments

- Pure `symbol-density.ts` classifies target codepoints (alnum / whitespace / symbol) and applies D-05's linear multiplier without reading `charLog`
- `MetricsResult` gained required `symbolAdjustedWpm`; `METRICS_SCHEMA_VERSION` is `2`, activating Phase 4's `resolveMetrics` stale-snapshot recompute for every pre-v2 history row
- D-07 golden test proves a backspace-corrected symbol attempt stream cannot inflate `symbolAdjustedWpm / wpm` versus a clean run of the same target
- Results screen shows three peer stats (`wpm`, `accuracy`, `adj. wpm`); history rows show `{wpm} / {adj} adj.`

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure symbol classifier + weighting formula** - `cec7d25` (feat) — already on disk at resume; not redone
2. **Task 2 RED: failing metrics/schema/D-07 tests** - `f8bfdc7` (test)
3. **Task 2 GREEN: wire metrics + schema bump + fixture literals** - `a3c9e4d` (feat)
4. **Task 3: ResultsView / HistoryRow display + CSS grid** - `84e0b0a` (feat)

**Plan metadata:** (this commit)

_Note: Task 1 was a prior GREEN commit from a partial run (`feat(05-01): add pure symbol-density classifier and weighting formula`). Task 2 followed RED→GREEN. Task 3 is display-only (`tdd` not set)._

## Files Created/Modified

- `src/metrics/symbol-density.ts` - Pure classifier + `computeSymbolAdjustedWpm`; `SYMBOL_WEIGHT = 2`
- `src/metrics/symbol-density.test.ts` - Golden-table cases for density buckets and formula bounds
- `src/metrics/metrics.ts` - Schema 2, `symbolAdjustedWpm` on `MetricsResult`, wired in `computeSessionMetrics`
- `src/metrics/metrics.test.ts` - Per-case formula equality, case-11 exact doubling, D-07 ratio regression
- `src/ui/ResultsView.tsx` - Third `.results-stat` labelled `adj. wpm`
- `src/ui/HistoryView.tsx` - Compact `{wpm} / {adj} adj.` pairing; standalone `wpm` label dropped
- `src/index.css` - `.results-stats` ≥640px grid `1fr 1fr 1fr`
- `src/ui/HistoryView.test.tsx` - Fixture `symbolAdjustedWpm: 78`; assertions expect `adj.` / `78`
- `src/ui/history-metrics.test.ts` - Fixture `symbolAdjustedWpm: 60`
- `src/persistence/repository.test.ts` - Fixture field so `MetricsResult` literals typecheck
- `src/persistence/db.test.ts` - Same fixture field

## Decisions Made

- **Add-alongside, not promote.** `symbolAdjustedWpm` is a required companion; `wpm` stays the primary field. Matches CONTEXT.md D-08 (Monkeytype raw/net precedent).
- **Rounding stays display-only.** No `Math.round` in `symbol-density.ts` or `metrics.ts`.
- **Persistence test fixtures were in the blast radius.** RESEARCH Pitfall 3 named two UI files; `repository.test.ts` and `db.test.ts` also construct `MetricsResult` literals and needed the new field for `pnpm typecheck`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Persistence MetricsResult fixtures missing `symbolAdjustedWpm`**
- **Found during:** Task 2 (GREEN typecheck)
- **Issue:** Adding a required field broke `src/persistence/repository.test.ts` and `src/persistence/db.test.ts` object literals. RESEARCH Pitfall 3 only listed the two UI fixtures; the plan's `<files>` list omitted these.
- **Fix:** Added `symbolAdjustedWpm: 42` to both persistence fixtures (no behavior change — tests do not assert the value).
- **Files modified:** `src/persistence/repository.test.ts`, `src/persistence/db.test.ts`
- **Verification:** `pnpm typecheck` exits 0
- **Committed in:** `a3c9e4d` (Task 2 GREEN)

**2. [Rule 1 - Bug] Second HistoryView test still asserted standalone `'wpm'`**
- **Found during:** Task 3
- **Issue:** The plan only called out replacing `.toContain('wpm')` in the fully-populated-row test. The "omits the slowest-key chip" test had the same assertion and would fail after dropping the HistoryRow `wpm` label.
- **Fix:** Replaced that assertion with `.toContain('adj.')`.
- **Files modified:** `src/ui/HistoryView.test.tsx`
- **Verification:** `pnpm test -- src/ui/HistoryView.test.tsx` passes
- **Committed in:** `84e0b0a` (Task 3)

---

**Total deviations:** 2 auto-fixed (1 blocking typecheck, 1 test assertion)
**Impact on plan:** Both required for gates to pass. No scope creep; no formula/UI-SPEC change.

## Issues Encountered

None beyond the two auto-fixed fixture/assertion gaps above.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ANLY-01 shipped. Ready for **05-02** (paste language picker / ANLY-02).
- Visual UAT for the three-column results grid and history pairing is deferred to end-of-phase human-verify (`workflow.human_verify_mode: end-of-phase`).
- No blockers.

## TDD Gate Compliance

Plan `type: execute` (not `type: tdd`). Task-level `tdd="true"` on Tasks 1–2:

- Task 1: resumed from existing GREEN `cec7d25` (no RED commit in this run, per SAFE-RESUME).
- Task 2: RED `f8bfdc7` then GREEN `a3c9e4d` — compliant.
- Task 3: not TDD (display).

## Self-Check: PASSED

- Created/modified files exist on disk.
- Commits `cec7d25`, `f8bfdc7`, `a3c9e4d`, `84e0b0a` present in git log.
- `pnpm test` 173/173; `pnpm typecheck` 0 errors; `pnpm lint` exit 0 (pre-existing CaptureSurface exhaustive-deps warning, out of scope); `pnpm build` succeeded.
- `grep -c -E "CommittedChar|CaptureMarker" src/metrics/symbol-density.ts` = 0.
- No stubs (TODO/FIXME/placeholder) in plan files.

---
*Phase: 05-symbol-adjusted-wpm-language-tagging*
*Completed: 2026-09-13*
