---
phase: 02-interactive-typing-trainer
plan: 02
subsystem: ui
tags: [react, vitest, happy-dom, keyboard, css-animation, pure-function]

# Dependency graph
requires:
  - phase: 02-interactive-typing-trainer
    plan: 01
    provides: computeTrainerState reducer, transparent-textarea-over-rendered-layer CaptureSurface overlay, .trainer-caret marker, App.tsx's loadToken remount mechanism, ui happy-dom vitest project
provides:
  - "App.tsx handleRestart: resetCapture() + loadToken bump, same exercise content, no confirmation dialog (D-08)"
  - "CaptureSurface onRestartRequested prop + Escape keydown handler — the keyboard-only path to Restart since Tab is fully absorbed"
  - "CaptureSurface Tab keydown no-op (e.preventDefault(), zero char/cursor/capture-log change) — D-07 amended"
  - "CaptureSurface isActive state (focus/blur + visibilitychange) exposed via .trainer-caret[data-active]"
  - "src/index.css trainer-caret-blink keyframes (prefers-reduced-motion-gated) + data-active=false solid-caret override"
  - "src/trainer/active-time.ts: pure computeActiveElapsedMs(charLog, markers, now) toggle-state-machine (D-09)"
affects: [phase 3 metrics engine (consumes computeActiveElapsedMs directly), end-of-phase UAT (caret blink is a UI-SPEC backstop item)]

# Actuals (#2632)
actuals:
  tokens: 4600
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Same-wave interlocking prop addition: App.tsx (Task 1) passes onRestartRequested into CaptureSurface before CaptureSurface's prop type declares it (Task 2) — both tasks land in the same wave, verified together by the plan-level tsc/vitest gate rather than each task independently type-checking"
    - "Toggle-state-machine over CaptureMarker[] (src/trainer/active-time.ts) — a single inactiveSince: number | null, not index-based pair-matching — robust to overlapping blur+hidden and out-of-order/duplicate focus/visible markers"
    - "isActive (focus/blur + visibilitychange) surfaced as a data-attribute (data-active) consumed purely by CSS, not by conditionally rendering different DOM"

key-files:
  created:
    - src/trainer/active-time.ts
    - src/trainer/active-time.test.ts
  modified:
    - src/ui/App.tsx
    - src/ui/CaptureSurface.tsx
    - src/ui/CaptureSurface.test.tsx
    - src/index.css

key-decisions:
  - "handleRestart never calls setExercise — only resetCapture() + a loadToken bump, re-deriving loadRef/sessionRef for the SAME exercise with a fresh startedAt, mirroring handleLoad's shape without loading new content (D-08)"
  - "Escape is checked before Tab in the same onKeyDown handler, per the UI-SPEC's Keyboard-only Restart access amendment — Tab is fully absorbed so it can never carry focus to the Restart button, making Escape the only keyboard path"
  - "isActive starts true (not false) on mount, since the textarea is focused synchronously by CaptureSurface's own focus effect — starting false would flash the caret to its inactive/solid state for one frame before that effect runs"
  - "visibilitychange sets isActive to the literal !document.hidden (not just a hidden-only branch), so tab-visible transitions restore blinking the same way a focus event does"

patterns-established:
  - "Pure-core module header convention (state.ts's purity statement + decision IDs + locking test file) reused verbatim for active-time.ts"

requirements-completed: [TYPE-04, TYPE-05, TYPE-06]

coverage:
  - id: D1
    description: "Restart control: always-visible primary button, resets to initial all-pending state with the same exercise content, no confirmation dialog (TYPE-05, D-08)"
    requirement: "TYPE-05"
    verification:
      - kind: automated_ui
        ref: "src/ui/CaptureSurface.test.tsx#CaptureSurface — Restart control (TYPE-05, D-08) > clicking Restart resets all character spans to pending and moves the caret back to index 0"
        status: pass
      - kind: unit
        ref: "grep -n \"window.confirm\" src/ui/App.tsx — zero matches"
        status: pass
    human_judgment: false
  - id: D2
    description: "Escape triggers the identical restart action as clicking Restart — the keyboard-only path since Tab is fully absorbed (UI-SPEC Keyboard-only Restart access amendment)"
    requirement: "TYPE-05"
    verification:
      - kind: automated_ui
        ref: "src/ui/CaptureSurface.test.tsx#CaptureSurface — Tab no-op + Escape restart + caret active state > Escape keydown calls the supplied onRestartRequested spy exactly once"
        status: pass
      - kind: automated_ui
        ref: "src/ui/CaptureSurface.test.tsx#... > Escape keydown without onRestartRequested supplied does not throw"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tab keydown is fully absorbed: zero visual change, zero capture-log change, focus stays in the textarea (TYPE-04 support, D-07 amended)"
    requirement: "TYPE-04"
    verification:
      - kind: automated_ui
        ref: "src/ui/CaptureSurface.test.tsx#CaptureSurface — Tab no-op + Escape restart + caret active state > Tab keydown leaves focus and the char log unchanged (D-07 amended)"
        status: pass
      - kind: unit
        ref: "grep -n \"recordSyntheticChar\" src/capture/capture.ts src/ui/CaptureSurface.tsx — zero matches"
        status: pass
    human_judgment: false
  - id: D4
    description: "computeActiveElapsedMs: pure, exported, golden-tested toggle-state-machine over CaptureMarker[] covering every ordering edge case (no keystroke, no blur, full pair, unmatched hidden, overlapping pair, duplicate/out-of-order focus) (TYPE-06, D-09)"
    requirement: "TYPE-06"
    verification:
      - kind: unit
        ref: "src/trainer/active-time.test.ts — 7 golden cases, all pass"
        status: pass
    human_judgment: false
  - id: D5
    description: "The custom caret blinks on a ~1s cycle while focused+visible, renders solid under prefers-reduced-motion: reduce, and renders solid (not hidden) while blurred/hidden"
    verification:
      - kind: automated_ui
        ref: "src/ui/CaptureSurface.test.tsx#... > a blur event on the textarea flips .trainer-caret to data-active=\"false\" (proves the blurred-solid half only)"
        status: pass
    human_judgment: true
    rationale: "UI-SPEC-designated backstop (verification: backstop) — the animation timing/visual blink itself is not verifiable under happy-dom's no-layout/no-CSS-animation-engine limitation; deferred to end-of-phase UAT per workflow.human_verify_mode: end-of-phase. Automation confirms the data-active wiring that gates the CSS."

duration: ~5min
completed: 2026-09-05
status: complete
---

# Phase 02 Plan 02: Restart Control, Tab No-op, Active-Time Summary

**Restart button (D-08) with an Escape-key keyboard path, a Tab keydown that fully no-ops instead of stealing focus (D-07 amended), a focus/visibility-aware caret blink, and a pure `computeActiveElapsedMs` toggle-state-machine ready for Phase 3.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-09-05T08:26:00Z (approx., resuming from 02-01)
- **Completed:** 2026-09-05T08:31:43Z
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- `App.tsx`'s `handleRestart` resets the trainer to its initial all-pending state — same exercise content, fresh session timing, no `setExercise` call, no confirmation dialog — wired to both a primary "Restart exercise" button and (via a new `onRestartRequested` prop) `CaptureSurface`'s Escape keydown.
- `CaptureSurface`'s Tab keydown is fully absorbed (`e.preventDefault()`, zero character insertion, zero cursor movement, zero new `capture.ts` export) — the amended D-07 that supersedes the pre-amendment `recordSyntheticChar`/`setRangeText` design in 02-RESEARCH.md/02-PATTERNS.md. Escape is checked first in the same handler and fires the Restart callback, giving keyboard-only users a path to Restart that doesn't depend on Tab order.
- Focus/blur and `visibilitychange` are tracked as `isActive`, exposed on `.trainer-caret` via `data-active` — CSS-only consumption, no branch in the render tree.
- `src/index.css` adds `trainer-caret-blink` keyframes nested under `@media (prefers-reduced-motion: no-preference)` (blink only when motion is allowed) plus a `[data-active="false"]` override that forces the caret solid while blurred/hidden.
- `src/trainer/active-time.ts` is a new zero-runtime-import pure module implementing 02-RESEARCH.md Pattern 4's toggle-state-machine verbatim, golden-tested against 7 cases (no keystroke, no blur, full pair, unmatched-hidden open interval, overlapping blur+hidden, duplicate/out-of-order focus, pre-session markers ignored).

## Task Commits

Each task was committed atomically:

1. **Task 1: Restart control (D-08)** - `138c921` (feat)
2. **Task 2: Tab keydown no-op + caret-blink motion** - `a70f3ec` (feat)
3. **Task 3: computeActiveElapsedMs (D-09)** - `2ddb198` (test, RED) → `031a36b` (feat, GREEN)

_Note: Task 3 carried `tdd="true"` — the failing golden-case suite was committed first (RED gate), then the pure implementation that turns it green (GREEN gate); no refactor commit was needed._

## Files Created/Modified
- `src/trainer/active-time.ts` - pure `computeActiveElapsedMs` toggle-state-machine (D-09)
- `src/trainer/active-time.test.ts` - 7-case golden-case table locking the toggle-state-machine's ordering edges
- `src/ui/App.tsx` - `handleRestart`, the "Restart exercise" primary button, `onRestartRequested` wired into `CaptureSurface`
- `src/ui/CaptureSurface.tsx` - `onRestartRequested` prop, Escape/Tab keydown handler, `isActive` state (focus/blur + visibilitychange), `data-active` on both caret render branches
- `src/ui/CaptureSurface.test.tsx` - Restart-click reset test (via a local harness mirroring App's remount wiring), Tab no-op test, Escape→restart-spy test, Escape-without-handler no-throw test, blur→`data-active="false"` test
- `src/index.css` - `trainer-caret-blink` `@keyframes` gated under `prefers-reduced-motion: no-preference`, `.trainer-caret[data-active="false"]` solid override

## Decisions Made
- `handleRestart` never calls `setExercise` — only `resetCapture()` + a `loadToken` bump, re-deriving `loadRef`/`sessionRef` for the same exercise with a fresh `startedAt` (mirrors `handleLoad`'s shape without loading new content), matching D-08's "keeping the loaded content and resetting all session state."
- Escape is checked before Tab in one `onKeyDown` handler on the textarea — the UI-SPEC's Keyboard-only Restart access amendment requires this ordering since Tab is fully absorbed and can never carry focus to the Restart button.
- `isActive` initializes to `true` (not `false`) because the textarea is focused synchronously by `CaptureSurface`'s existing mount-focus effect — starting `false` would flash the caret to its inactive/solid rendering for one frame before that effect runs.
- The `visibilitychange` handler sets `isActive` to the literal `!document.hidden`, not just a hidden-only one-way branch, so a tab becoming visible again resumes blinking exactly like a `focus` event does.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking issue] Reworded a source comment to avoid the acceptance-criteria's own grep target**
- **Found during:** Task 2
- **Issue:** The Tab-branch comment I first wrote referenced the literal string `recordSyntheticChar` (to explain what the amended design supersedes), which the plan's own acceptance criteria (`grep -n "recordSyntheticChar" src/capture/capture.ts src/ui/CaptureSurface.tsx` must return zero matches) would then fail against — the same trap 02-01-SUMMARY.md documented for `glyphFor`'s comment text.
- **Fix:** Reworded the comment to describe the same rationale ("supersedes 02-RESEARCH.md's pre-amendment synthetic-character-capture design") without using the literal string, preserving the documented "do NOT build this" guidance in spirit.
- **Files modified:** `src/ui/CaptureSurface.tsx`
- **Commit:** `a70f3ec`

**2. [Rule 3 - blocking issue] `blur` event does not bubble; React 17+ delegates via `focusout`**
- **Found during:** Task 2 (test authoring)
- **Issue:** Dispatching a native `blur` `FocusEvent` directly on the textarea in the vitest harness did not trigger `CaptureSurface`'s `onBlur` handler — native `blur` does not bubble, and React 17+'s event delegation listens for the bubbling `focusout` event instead.
- **Fix:** Dispatched `focusout` in the test instead of `blur`, matching how a real blur transition actually reaches React's synthetic event system.
- **Files modified:** `src/ui/CaptureSurface.test.tsx`
- **Commit:** `a70f3ec`

### Commit-splitting note (not a deviation, a scoping clarification)

Both tasks land in the same wave and Task 1's own acceptance criteria describe a rendered test that depends on Task 2's `onRestartRequested` prop existing on `CaptureSurface` (the plan states this explicitly: "this task's `App.tsx` change compiles once Task 2 lands"). Given that interlock, the Restart-click reset test and the Tab/Escape/blur tests both live in `CaptureSurface.test.tsx`, and that whole file was committed together with Task 2's commit (`a70f3ec`) rather than split across both task commits — `App.tsx` alone is Task 1's commit (`138c921`); `CaptureSurface.tsx` + `index.css` + the full test file are Task 2's commit. This mirrors the plan's own acknowledgment that the two tasks are verified together, not independently.

## Issues Encountered

None beyond the two auto-fixed items above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `src/trainer/active-time.ts`'s `computeActiveElapsedMs(charLog, markers, now)` is ready for Phase 3's metrics engine to consume directly — zero-runtime-import, golden-tested.
- The caret-blink animation itself (visual timing, `prefers-reduced-motion` behavior) remains a UI-SPEC backstop item, unverified by automation under happy-dom's no-CSS-animation-engine limitation — deferred to end-of-phase UAT (`workflow.human_verify_mode: end-of-phase`), alongside 02-01's carried-forward D5 (long-line wrap) backstop.
- Phase 2's three plans are now complete: TYPE-01 through TYPE-06 all have automated coverage; only visual/motion backstops remain for human sign-off.

---
*Phase: 02-interactive-typing-trainer*
*Completed: 2026-09-05*

## Self-Check: PASSED

All created/modified files confirmed present on disk; all four commits (`138c921`, `a70f3ec`, `2ddb198`, `031a36b`) confirmed present in git history.
