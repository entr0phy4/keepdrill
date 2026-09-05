---
phase: 03-session-metrics
verified: 2026-09-05T20:30:48Z
status: passed
score: 18/18 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 3: Session Metrics Verification Report

**Phase Goal:** On finishing an exercise, the user sees trustworthy speed, accuracy, and slowest-key numbers from a pure, re-runnable metrics engine.
**Verified:** 2026-09-05T20:30:48Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Net WPM computed as correctAttempts / 5 / activeMinutes, using computeActiveElapsedMs (D-01) — never wall-clock | ✓ VERIFIED | `src/metrics/metrics.ts:157,139-142` — `computeActiveElapsedMs(charLog, markers, now)` feeds `computeWpm`; guard `elapsedMs <= 0 -> 0`. Golden case 3 (`metrics.test.ts`) proves `now` is used literally, no substitution. |
| 2 | Accuracy computed by replaying every insert-branch attempt (incl. overwritten ones), not from `perCharStatus` (D-02) | ✓ VERIFIED | `replayAttempts` (`metrics.ts:57-104`) independently folds `charLog`, never reads `TrainerState.perCharStatus`. Golden case 2 proves delete-then-retype counts both attempts in the denominator. |
| 3 | `metrics.ts` is a pure module — zero DOM access, only `computeActiveElapsedMs` as a runtime import | ✓ VERIFIED | `metrics.ts:29-30` — only imports are `import type {...}` and `computeActiveElapsedMs`. No DOM/browser API references anywhere in the file. |
| 4 | `MetricsResult` carries `schemaVersion` (`METRICS_SCHEMA_VERSION = 1`) on every result | ✓ VERIFIED | `metrics.ts:32,39-44,161` |
| 5 | Results panel auto-renders the instant `completedAt` transitions null→non-null, no button | ✓ VERIFIED | `CaptureSurface.tsx:143-148` fires `onComplete` via ref-guarded effect on the `completedAt` transition; `App.tsx:149` gates `ResultsView` purely on `metrics !== null`, no button. Behaviorally proven by `CaptureSurface.test.tsx`'s tracer test (typing "ab" reveals `.results-panel` with "40 wpm"/"100%"). |
| 6 | Trainer surface remains mounted/unchanged after completion — never hidden/dimmed/replaced | ✓ VERIFIED | `App.tsx:142-153` — `CaptureSurface` and `ResultsView` are always-sibling grid items; `CaptureSurface` has no conditional unmount logic tied to `metrics`. |
| 7 | Restart button renders after results panel in DOM order; behavior unchanged | ✓ VERIFIED | `App.tsx:142-153` — DOM order is `CaptureSurface` → `ResultsView` (conditional) → Restart button, unchanged from Phase 2's `handleRestart`. |
| 8 | Restart discards metrics and returns to pre-typing state | ✓ VERIFIED | `App.tsx:90` — `handleRestart` calls `setMetrics(null)` alongside the existing `resetCapture()`/`loadToken` bump. |
| 9 | Results panel carries `role="status" aria-live="polite"` | ✓ VERIFIED | `ResultsView.tsx:24` |
| 10 | If `computeActiveElapsedMs` returns 0, WPM renders "0 wpm" never Infinity/NaN | ✓ VERIFIED (backstop) | `computeWpm` guard `elapsedMs <= 0 -> return 0` (`metrics.ts:140`); golden case 1 asserts exactly `0`, not `Infinity`/`NaN`. |
| 11 | WPM counts correct chars via code-point iteration (`Array.from`), matching state.ts's convention | ✓ VERIFIED | `metrics.ts:69,83` — `Array.from(target)`/`Array.from(rec.data ?? '')`. Independently confirmed against pre-fix code (see CR-01 verification below) that this is the corrected, code-point-consistent form. |
| 12 | Empty-target exercises never reach the results panel (Phase 2 behavior, unmodified) | ✓ VERIFIED | `state.ts:67-69` — `completedAt` only set inside the charLog fold; an empty charLog against an empty target never executes an insert branch, so `completedAt` stays null. Unmodified by this phase. |
| 13 | Zero-attempt accuracy denominator returns 1 (100%) safety default | ✓ VERIFIED | `computeAccuracy` guard `totalAttempts === 0 -> return 1` (`metrics.ts:147`); golden case 6 confirms. |
| 14 | wpm/accuracy are unrounded in metrics.ts; `Math.round()` only in ResultsView.tsx | ✓ VERIFIED | `metrics.ts` — no `Math.round` calls anywhere; `ResultsView.tsx:28,31,47` — all three displayed numbers rounded only at render. |
| 15 | `computeSessionMetrics` has no shared mutable module state; `onComplete` fires at most once per `completedAt` | ✓ VERIFIED | `metrics.ts` module-level consts are `const` primitives (`MIN_GAP_MS`/`MAX_GAP_MS`/`MIN_SAMPLES`/`METRICS_SCHEMA_VERSION`), no mutable state; `firedCompletedAtRef` guard in `CaptureSurface.tsx:143-148` proven by the "fires exactly once" test in `CaptureSurface.test.tsx`. |
| 16 | Five slowest keystrokes grouped by logical char (D-03), ranked by descending median, gated ≥3 post-filter samples (D-04, METR-03) | ✓ VERIFIED | `slowestFive` (`metrics.ts:127-135`) groups by `char` (from `CommittedChar.data`, never `KeyboardEvent.code`), filters, gates `< MIN_SAMPLES` exclusion, sorts descending, slices to 5. Golden cases in `metrics.test.ts` cover the 2-vs-3-sample boundary, `{`-vs-`[` distinct grouping, and a 6-candidate cap-at-5 case. |
| 17 | Outlier gaps of exactly 1000ms/25ms discarded — filter strictly `gap > 25 && gap < 1000` | ✓ VERIFIED | `metrics.ts:130` — `samples.filter((gap) => gap > MIN_GAP_MS && gap < MAX_GAP_MS)`, both bounds strict. Golden cases assert 26ms/999ms survive, 25ms/1000ms excluded. |
| 18 | Slowest-keys list never exceeds 5 rows; renders exactly N (1-4) without padding; falls back to "not enough data" message when 0, while WPM/accuracy still render | ✓ VERIFIED | `slowestFive` returns `.slice(0, 5)`; `ResultsView.tsx:36-51` — conditional renders either the fallback `<p>` or an `<ol>` mapping `metrics.slowest5` directly (no padding), positioned below the always-rendered `results-stats` div. |

**Score:** 18/18 truths verified (0 present-but-behavior-unverified)

### CR-01 Independent Verification (Critical Bug Fix)

The code review's CR-01 finding (UTF-16 code-unit vs. Unicode code-point index mismatch, commit `a44174c`) was independently re-derived, not just diff-reviewed:

1. **Diff inspected** across all three claimed files (`src/trainer/state.ts`, `src/metrics/metrics.ts`, `src/ui/CaptureSurface.tsx`) — confirmed each now builds a `targetChars = Array.from(target)` code-point array and indexes/sizes exclusively off that array (`targetChars[cursor]`, `targetChars.length`), never `target[cursor]`/`target.length` directly.
2. **Regression tests hand-traced against the pre-fix code** (checked out via `git show a44174c~1:...`), not merely read:
   - `state.test.ts` case 10 (target `'🎉a'`): pre-fix code sizes `perCharStatus`/`wasEverWrong` at `target.length` (3 UTF-16 units), and compares each code-point-iterated `ch` against `target[cursor]` (a lone surrogate half at indices 0/1). Manually executing the pre-fix algorithm against this fixture yields `perCharStatus: ['incorrect','incorrect','pending']`, `cursor: 2`, `completedAt: null` — mismatching the test's expected `{ perCharStatus: ['correct','correct'], cursor: 2, completedAt: 20 }`. The test would fail pre-fix.
   - `metrics.test.ts` case 12 (target `'🎉a'`, charLog `[🎉@10, a@610]`): manually executing the pre-fix `replayAttempts` against this fixture yields `correctAttempts: 0, incorrectAttempts: 2` (both code-point comparisons miss against lone surrogate halves), giving `accuracy: 0` and `wpm: 0` — mismatching the test's expected `accuracy: 1, wpm: 40`. The test would fail pre-fix.
3. **Executed live**: `pnpm exec vitest run src/trainer/state.test.ts src/metrics/metrics.test.ts` → 28/28 passing on current code. `pnpm exec vitest run` (full suite) → 132/132 passing. `pnpm exec tsc --noEmit -p tsconfig.json` → zero output (clean).

**Conclusion:** CR-01's fix is real, correctly applied in all three claimed files, and the two named regression tests are proven — by hand-execution against the pre-fix source, not just by reading the diff — to be sensitive to exactly the bug they claim to guard against.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/metrics/metrics.ts` | Pure module: `computeSessionMetrics`/`computeWpm`/`computeAccuracy`/`slowestFive`/`median`, `MetricsResult`, `SlowestKeyEntry`, `METRICS_SCHEMA_VERSION` | ✓ VERIFIED | All exports present, substantive, wired |
| `src/metrics/metrics.test.ts` | Golden-case tests locking D-01/D-02/D-03/D-04 + Pitfalls 1/2/3/4/6/7 + CR-01 | ✓ VERIFIED | 12 cases (incl. CR-01 case 12), all passing |
| `src/ui/ResultsView.tsx` | Auto-revealed panel: WPM, accuracy, slowest-keys-or-fallback | ✓ VERIFIED | All three sections present in fixed order |
| `src/ui/CaptureSurface.tsx` | `onComplete` prop, fire-once via ref guard | ✓ VERIFIED | Prop declared, effect wired, code-point fix applied |
| `src/ui/App.tsx` | `handleComplete`, `metrics` state, `ResultsView` mount, resets on load/restart | ✓ VERIFIED | All present and wired |
| `src/index.css` | `.results-panel`/`.results-stats`/`.results-slowest*`/`.key-chip` + `results-fade-in` keyframes | ✓ VERIFIED | All classes present, fade-in guarded by `prefers-reduced-motion` |

### Key Link Verification

| From | To | Via | Status |
|------|-----|-----|--------|
| `CaptureSurface.tsx` | `App.tsx` | `onComplete?.(completedAt)` fired once per transition | ✓ WIRED |
| `App.tsx` | `metrics/metrics.ts` | `computeSessionMetrics(...)` call in `handleComplete` | ✓ WIRED |
| `App.tsx` | `ResultsView.tsx` | `metrics !== null && <ResultsView metrics={metrics} />` | ✓ WIRED |
| `metrics.ts` | `trainer/active-time.ts` | `computeActiveElapsedMs(charLog, markers, now)` | ✓ WIRED |
| `ResultsView.tsx` | `trainer/state.ts` | `glyphFor(entry.char)` reused for space/newline chips | ✓ WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Tracer end-to-end (typing "ab" reveals 40 wpm / 100%) | `pnpm exec vitest run src/ui/CaptureSurface.test.tsx` (single describe block) | 13/13 passing incl. tracer test | ✓ PASS |
| CR-01 regression, state.ts (surrogate-pair completion) | `pnpm exec vitest run src/trainer/state.test.ts` | 11/11 passing (case 10 present) | ✓ PASS |
| CR-01 regression, metrics.ts (surrogate-pair accuracy/wpm) | `pnpm exec vitest run src/metrics/metrics.test.ts` | 12+/12+ passing (case 12 present) | ✓ PASS |
| CR-01 fix would fail without the patch | Manual hand-execution of pre-fix algorithm against both fixtures (see above) | Mismatches expected values in both cases | ✓ CONFIRMED SENSITIVE |
| Full suite regression check | `pnpm exec vitest run` (once) | 132/132 passing | ✓ PASS |
| Type check | `pnpm exec tsc --noEmit -p tsconfig.json` | zero errors/output | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| METR-01 | 03-01-PLAN.md | Net WPM, industry-standard formula | ✓ SATISFIED | `computeWpm`, D-01 basis, golden cases |
| METR-02 | 03-01-PLAN.md | Accuracy/error rate, corrections in denominator | ✓ SATISFIED | `computeAccuracy`/`replayAttempts`, D-02 golden cases |
| METR-03 | 03-02-PLAN.md | Five slowest keystrokes, gated + outlier-filtered | ✓ SATISFIED | `slowestFive`/`median`, D-03/D-04 golden cases |
| METR-04 | 03-01-PLAN.md, 03-02-PLAN.md | Pure, re-runnable, versioned, documented, golden-tested | ✓ SATISFIED | Purity confirmed by import audit; `METRICS_SCHEMA_VERSION`; formulas documented in header comment; 12 golden cases |

No orphaned requirements — all four Phase 3 REQUIREMENTS.md IDs (METR-01..04) are claimed across the two plans and satisfied.

### Anti-Patterns Found

None. Grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and `dangerouslySetInnerHTML` across all phase-modified files returned zero matches. No gamification/color-threshold framing found in `ResultsView.tsx` (prohibition honored). No IndexedDB/localStorage/network persistence calls found (prohibition honored).

### Human Verification Required

None. All must-haves are programmatically verifiable and were verified against actual source, not SUMMARY claims.

### Non-Blocking Warnings (carried forward from 03-REVIEW.md, not gating this verification)

- **WR-01** (confirmed still open): `src/ui/App.tsx`'s `handleComplete` is not wrapped in `useCallback` — confirmed via `grep -n "useCallback" src/ui/App.tsx` returning no matches. The fire-once correctness currently relies entirely on `CaptureSurface.tsx`'s `firedCompletedAtRef` guard rather than a stable effect dependency. Fragile but currently correct, per the code review's own disposition — not a phase-goal blocker.
- **WR-02** (confirmed still open): `ResultsView.tsx`'s whitespace-glyph chip (`glyphFor(entry.char)` for space/newline) has no accompanying `aria-hidden`/`sr-only` label — confirmed via source inspection (line 45), no such span exists. Accessibility gap, not a phase-goal blocker (goal is "user sees" the numbers; visual sightedness is unaffected).

### Gaps Summary

None. All 18 derived must-have truths verified against actual source code (not SUMMARY.md narrative). The one critical defect the code review found and the executor claimed to fix (CR-01) was independently re-derived: the diff was inspected in all three claimed files, and both named regression tests were hand-executed against the pre-fix source to confirm they would have failed without the patch — not merely accepted on the SUMMARY's word. Full test suite (132/132) and `tsc --noEmit` were both run fresh in this verification session, not read from a prior claim.

---

_Verified: 2026-09-05T20:30:48Z_
_Verifier: Claude (gsd-verifier)_
