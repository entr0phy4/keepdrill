---
phase: 03-session-metrics
plan: 01
subsystem: metrics
tags: [metrics, wpm, accuracy, tracer, results-panel]
status: complete
dependency-graph:
  requires:
    - src/trainer/state.ts (computeTrainerState, completedAt)
    - src/trainer/active-time.ts (computeActiveElapsedMs)
    - src/capture/types.ts (CommittedChar, CaptureMarker)
    - src/session.ts (buildSession)
  provides:
    - src/metrics/metrics.ts (computeSessionMetrics/computeWpm/computeAccuracy, MetricsResult, METRICS_SCHEMA_VERSION)
    - src/ui/ResultsView.tsx (ResultsView component)
    - src/ui/CaptureSurface.tsx onComplete prop
  affects:
    - src/ui/App.tsx (handleComplete, metrics state, ResultsView mount)
tech-stack:
  added: []
  patterns:
    - "Pure metrics core: computeSessionMetrics/computeWpm/computeAccuracy have zero DOM access and zero non-`import type` runtime imports besides computeActiveElapsedMs"
    - "Fire-once completion callback via a ref-guarded useEffect (mirrors the existing one-effect-per-concern style in CaptureSurface.tsx)"
    - "Auto-revealed results panel: no button, gated purely on `metrics !== null`"
key-files:
  created:
    - src/metrics/metrics.ts
    - src/metrics/metrics.test.ts
    - src/ui/ResultsView.tsx
  modified:
    - src/ui/CaptureSurface.tsx
    - src/ui/CaptureSurface.test.tsx
    - src/ui/App.tsx
decisions:
  - "computeTrainerState's `completedAt` destructure had to move earlier in CaptureSurface.tsx (immediately after the computeTrainerState call) so the new onComplete-firing useEffect could reference it in the same render pass — the plan's literal 'place after the visibilitychange effect' instruction was adjusted to 'place immediately after computeTrainerState is destructured, still after the visibilitychange effect in source order' since completedAt did not exist yet at the original insertion point."
metrics:
  duration: "~15 min"
  completed: 2026-09-05
actuals:
  tokens: 4547
  tasks: 2
  commits: 2
---

# Phase 3 Plan 1: Tracer — Completion Signal to WPM + Accuracy Summary

Built the pure metrics core (`computeSessionMetrics`, D-01/D-02) and wired it end-to-end into
a new auto-revealed results panel: typing an exercise to completion now instantly shows net
WPM and accuracy, with zero stale data surviving a restart or fresh load.

## What Was Built

- **`src/metrics/metrics.ts`** — a pure module (zero DOM access, zero non-`import type` runtime
  imports besides a direct call to `computeActiveElapsedMs`) exporting:
  - `METRICS_SCHEMA_VERSION = 1` and `MetricsResult { schemaVersion, wpm, accuracy }`
  - `computeWpm(correctChars, elapsedMs)` — guards `elapsedMs <= 0` to return `0` (Pitfall 2)
  - `computeAccuracy(correctAttempts, totalAttempts)` — guards `totalAttempts === 0` to return `1`
  - `computeSessionMetrics(target, charLog, markers, now)` — calls `computeActiveElapsedMs` for
    the WPM time basis (D-01) and a private `replayAttempts` that mirrors `computeTrainerState`'s
    delete/insert branching but replays *every* insert-branch attempt individually (D-02),
    including attempts later overwritten by a backspace-and-retype
- **`src/ui/ResultsView.tsx`** — a `role="status" aria-live="polite"` panel rendering rounded
  WPM and accuracy percentage as plain JSX text children (never `dangerouslySetInnerHTML`);
  `Math.round()` happens only here, never inside `metrics.ts` (Pitfall 5)
- **`src/ui/CaptureSurface.tsx`** — new `onComplete?: (completedAt: number) => void` prop, fired
  at most once per distinct `completedAt` value via a `firedCompletedAtRef`-guarded `useEffect`
  (D-07)
- **`src/ui/App.tsx`** — new `metrics` state, `handleComplete` (rebuilds a fresh `Session` per
  `session.ts`'s CR-01 "live snapshot" rule, then calls `computeSessionMetrics`), `ResultsView`
  mounted between `CaptureSurface` and the Restart button gated on `metrics !== null`, and
  `setMetrics(null)` in both `handleLoad` and `handleRestart` so no stale results ever survive
- **`src/ui/CaptureSurface.test.tsx`** — a `beforeInputAt(el, init, tMs)` helper (deterministic
  keystroke timing, mirroring `capture.test.ts`'s timeStamp-override convention) and a
  `MetricsHarness` component (mirroring the existing `RestartHarness` precedent) proving the
  whole tracer end-to-end: typing "ab" to completion reveals `.results-panel` with "40 wpm" and
  "100%", and `onComplete` fires exactly once even after a further post-completion frame tick
- **`src/metrics/metrics.test.ts`** — 6 golden cases on `computeSessionMetrics` (zero-elapsed
  guard, corrected-denominator + delete exclusion, clock-domain fidelity, active-time/marker
  integration, IME multi-codepoint commit, zero-attempt safety default) plus a schema-version
  lock, matching `state.test.ts`/`active-time.test.ts`'s `Case`/`it.each` convention

## Verification

- `pnpm exec vitest run` — 124/124 tests passing (no regressions in Phase 1/2 suites)
- `pnpm exec tsc --noEmit -p tsconfig.json` — zero errors
- All plan acceptance-criteria greps pass: exactly one `computeSessionMetrics` export, exactly
  one `ResultsView` export, zero `dangerouslySetInnerHTML` occurrences, `onComplete` referenced
  6 times in `CaptureSurface.tsx` (prop declaration + effect + dependency array)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `completedAt` used before it existed in scope**

- **Found during:** Task 1, wiring `CaptureSurface.tsx`'s `onComplete` effect
- **Issue:** The plan's action text placed the new `onComplete`-firing `useEffect` "after the
  existing visibilitychange effect," but `completedAt` is destructured from
  `computeTrainerState(text, getCharLog())`, which in the pre-plan file came *after* that
  effect. Following the plan literally would reference `completedAt` before its declaration.
- **Fix:** Moved the `computeTrainerState` destructure (now including `completedAt`) to
  immediately precede the new effect, keeping the effect itself directly adjacent to that
  destructure and still after every other existing effect in source order (Escape/Tab handler,
  visibilitychange) — satisfying the intent (one-effect-per-concern, placed late) without a
  temporal-dead-zone reference error.
- **Files modified:** `src/ui/CaptureSurface.tsx`
- **Commit:** `1331698`

**2. [Test-authoring correction] Golden-case 2's expected WPM value**

- **Found during:** Task 2, running the new golden-case table
- **Issue:** Case 2 (`D-02`'s corrected-denominator case) was hand-drafted with an incorrect
  expected `wpm` of `3`; running the test surfaced the actual computed value.
- **Fix:** Recomputed by hand (`1 correct char / 5 / (20ms / 60000)` = `600`) and corrected the
  expectation to match the documented D-01 formula exactly — the production formula was never
  in question, only the test's hand-authored expected value.
- **Files modified:** `src/metrics/metrics.test.ts`
- **Commit:** `ce402d2`

No architectural changes, no auth gates, no out-of-scope discoveries.

## Known Stubs

None.

## Threat Flags

None — all security-relevant surface touched by this plan (untrusted-corpus-character
rendering in `ResultsView.tsx`, the `computeWpm` DoS guard, the `onComplete` bridge) was
already registered in the plan's own `<threat_model>` (T-03-01/02/03) and mitigated exactly as
specified.

## Self-Check: PASSED

- FOUND: src/metrics/metrics.ts
- FOUND: src/metrics/metrics.test.ts
- FOUND: src/ui/ResultsView.tsx
- FOUND: src/ui/CaptureSurface.tsx (modified)
- FOUND: src/ui/CaptureSurface.test.tsx (modified)
- FOUND: src/ui/App.tsx (modified)
- FOUND commit: 1331698
- FOUND commit: ce402d2
