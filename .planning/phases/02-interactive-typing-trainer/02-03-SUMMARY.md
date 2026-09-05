---
phase: 02-interactive-typing-trainer
plan: 03
subsystem: ui
tags: [react, vitest, happy-dom, keyboard, selection, tdd]

# Dependency graph
requires:
  - phase: 02-interactive-typing-trainer
    plan: 01
    provides: computeTrainerState reducer, transparent-textarea-over-rendered-layer CaptureSurface overlay, D-10/T-02-04 caret-resync useLayoutEffect (the mechanism this plan completes)
  - phase: 02-interactive-typing-trainer
    plan: 02
    provides: Escape-to-Restart handleKeyDown wiring (the handler this plan hardens with an isTrusted guard)
provides:
  - "resyncCaret(): a standalone function (recreated each render) shared by the existing cursor-keyed useLayoutEffect and a new textarea onSelect handler — closes the caret-resync gap for ArrowLeft/Right/Home/End/click-driven native-selection drift (T-02-08)"
  - "handleKeyDown isTrusted guard: rejects script-dispatched synthetic keydown events before evaluating Escape/Tab (T-02-09), matching src/capture/capture.ts's T-01-04 convention"
  - "Regression test pattern for happy-dom's onSelect polyfill: dispatching document.dispatchEvent(new Event('selectionchange')) — not a native 'select' event on the element — is what actually triggers React 19's onSelect prop in this test environment"
affects: [any future CaptureSurface.tsx change touching native selection or handleKeyDown; end-of-phase UAT sign-off]

# Actuals (#2632)
actuals:
  tokens: 2131
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Test-environment workaround for happy-dom's missing beforeinput default action: textarea.value never mutates on a dispatched beforeinput event in happy-dom, so selectionStart/selectionEnd setters clamp to 0 (value.length). Tests that need to observe a non-zero native selection index must set textarea.value directly first — production code never reads textarea.value (CaptureSurface renders purely from computeTrainerState), so this is test-only and doesn't touch any verified code path."
    - "React 19's onSelect prop is polyfilled from focusout/contextmenu/dragend/focusin/keydown/keyup/mousedown/mouseup/selectionchange (registered on `document`), never from a native 'select' event on the element itself — confirmed by reading react-dom's registerTwoPhaseEvent call. Tests exercising onSelect must dispatch 'selectionchange' on `document`, not 'select' on the element."

key-files:
  created: []
  modified:
    - src/ui/CaptureSurface.tsx
    - src/ui/CaptureSurface.test.tsx

key-decisions:
  - "resyncCaret is defined once per render (same recreate-each-render pattern as handleKeyDown/reclaimFocus) and called from two sites: the pre-existing cursor-keyed useLayoutEffect (post-commit resync) and the textarea's new onSelect prop (drift resync) — no dependency-array removal, no separate memoization"
  - "isTrusted guard placed as the very first statement in handleKeyDown, before the Escape/Tab branches, exactly mirroring src/capture/capture.ts's onKey/onBeforeInput/onCompositionStart/onCompositionEnd guard shape (T-01-04)"

patterns-established:
  - "happy-dom onSelect/selectionchange test convention (see tech-stack.patterns above) — reusable for any future CaptureSurface test needing to exercise native-selection-driven React handlers"

requirements-completed: [TYPE-01, TYPE-03]

coverage:
  - id: D1
    description: "Native-selection drift from ArrowLeft/Right/Home/End/click is resynced back to the logical cursor synchronously, independent of whether cursor itself changed (closes 02-VERIFICATION.md gap #1 / 02-REVIEW.md WR-1, T-02-08)"
    requirement: "TYPE-01"
    verification:
      - kind: automated_ui
        ref: "src/ui/CaptureSurface.test.tsx#CaptureSurface — caret resync on selection drift (gap closure, T-02-04) > a native \"selectionchange\" event after selectionStart/selectionEnd drift resyncs them back to cursor synchronously (no rAF wait)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A delete-type commit after a drift-and-resync sequence still reopens the correct logical position to pending — computeTrainerState's char-log-driven cursor tracking is unaffected by native-selection drift (TYPE-01/TYPE-03)"
    requirement: "TYPE-03"
    verification:
      - kind: automated_ui
        ref: "src/ui/CaptureSurface.test.tsx#CaptureSurface — caret resync on selection drift (gap closure, T-02-04) > a delete-type commit after a drift-and-resync sequence still reopens the correct logical position to pending"
        status: pass
    human_judgment: false
  - id: D3
    description: "handleKeyDown rejects untrusted (isTrusted === false) keydown events before evaluating Escape/Tab — a script-dispatched synthetic Escape can no longer trigger Restart and discard an in-progress session (02-REVIEW.md WR-2, T-02-09)"
    verification:
      - kind: automated_ui
        ref: "src/ui/CaptureSurface.test.tsx#CaptureSurface — Tab no-op + Escape restart + caret active state > an untrusted (script-dispatched) Escape keydown does not call onRestartRequested (WR-2, T-02-09)"
        status: pass
      - kind: automated_ui
        ref: "src/ui/CaptureSurface.test.tsx#CaptureSurface — Tab no-op + Escape restart + caret active state > Escape keydown calls the supplied onRestartRequested spy exactly once"
        status: pass
    human_judgment: false

duration: ~12min
completed: 2026-09-05
status: complete
---

# Phase 02 Plan 03: Caret-Resync Selection-Drift Fix + Escape Trust Guard Summary

**`resyncCaret()` now fires on every native selection-change event (ArrowLeft/Right/Home/End/click) via `onSelect`, not only when `cursor` itself changes — closing 02-VERIFICATION.md's one blocking gap — plus an `isTrusted` guard on `handleKeyDown` matching `capture.ts`'s T-01-04 convention.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-05T13:55:00Z (approx.)
- **Completed:** 2026-09-05T14:02:15Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Extracted the caret-resync `useLayoutEffect` body (previously keyed on `[cursor]` alone) into a standalone `resyncCaret()` function, recreated each render like `handleKeyDown`/`reclaimFocus`, and wired it to the textarea's `onSelect` prop in addition to the pre-existing `useLayoutEffect` call site. This closes the actual root cause identified in 02-VERIFICATION.md gap #1 / 02-REVIEW.md WR-1: arrow-key/click-driven native-selection drift never changed `cursor`, so no re-render was ever scheduled and the resync effect never ran.
- Discovered mid-implementation (and documented as a deviation below) that React 19's `onSelect` prop is a polyfill triggered by `focusout`/`contextmenu`/`dragend`/`focusin`/`keydown`/`keyup`/`mousedown`/`mouseup`/`selectionchange` events registered on `document` — never a native `select` event on the element itself. The fix (`onSelect={resyncCaret}`) is unaffected by this (it's even more robust than a raw `select`-event listener would be, since it also covers focus transitions), but the plan's suggested test-dispatch mechanism (`new Event('select', ...)` on the textarea) does not trigger it in this codebase's React version; the tests dispatch `document.dispatchEvent(new Event('selectionchange', { bubbles: true }))` instead, which is exactly what a real browser fires after such drift.
- Added an `isTrusted` guard as the first statement in `handleKeyDown`, before the Escape/Tab branches — matching the exact guard shape already used by every handler in `src/capture/capture.ts` (T-01-04). Closes 02-REVIEW.md WR-2: a script-dispatched synthetic Escape can no longer invoke `onRestartRequested`.
- Both tasks followed strict TDD (RED commit with failing tests, then GREEN commit with the implementation) — verified by re-stashing the implementation and re-running the suite to confirm the tests genuinely fail without the fix.

## Task Commits

Each task was committed atomically, following TDD RED -> GREEN:

1. **Task 1: Fix caret-resync to fire on every native selection change** - `ca6f44e` (test, RED) -> `9dee8fd` (feat, GREEN)
2. **Task 2: Add isTrusted guard to handleKeyDown** - `e64d2c5` (test, RED) -> `391c87e` (feat, GREEN)

_No refactor commits were needed for either task._

## Files Created/Modified
- `src/ui/CaptureSurface.tsx` - `resyncCaret()` extracted from the `useLayoutEffect` body, wired to both the cursor-keyed effect and the textarea's new `onSelect` prop; `isTrusted` guard added to `handleKeyDown`
- `src/ui/CaptureSurface.test.tsx` - two new tests in a `caret resync on selection drift (gap closure, T-02-04)` describe block (drift-then-resync-synchronously, drift-then-delete-reopens-correct-position); one new test in the existing Tab/Escape describe block (`an untrusted (script-dispatched) Escape keydown does not call onRestartRequested`)

## Decisions Made
- `resyncCaret` closes over `cursor` from this render (recreated each render, same pattern as `handleKeyDown`/`reclaimFocus`) rather than being memoized — matches the codebase's existing convention and avoids a stale-closure risk from `useCallback` with an incomplete dependency array.
- The `isTrusted` guard is placed as the literal first statement in `handleKeyDown`, before any key-specific branch, mirroring `capture.ts`'s convention exactly rather than guarding only the Escape branch — future key handling added to this function inherits the same trust boundary automatically.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's suggested "select" event dispatch does not trigger React 19's onSelect in this codebase**
- **Found during:** Task 1 (test authoring, RED phase)
- **Issue:** The plan's `<action>` directed dispatching `new Event('select', { bubbles: true })` on the textarea to simulate native selection-change and trigger the `onSelect={resyncCaret}` handler. Reading `node_modules/react-dom/cjs/react-dom-client.development.js` directly showed React 19 registers `onSelect` via `registerTwoPhaseEvent("onSelect", ["focusout","contextmenu","dragend","focusin","keydown","keyup","mousedown","mouseup","selectionchange"])` — a native `select` event is never one of the trigger types. Dispatching it left the tests unable to observe the fix at all (both new tests failed even after the implementation was correct).
- **Fix:** Dispatch `document.dispatchEvent(new Event('selectionchange', { bubbles: true }))` instead — the same event a real browser fires after ArrowLeft/Right/Home/End/click drift, and the one React actually listens for (registered on `document`, confirmed by reading `listenToAllSupportedEvents`).
- **Files modified:** `src/ui/CaptureSurface.test.tsx`
- **Commit:** `ca6f44e` (test/RED), verified again against `9dee8fd` (feat/GREEN)

**2. [Rule 1 - Bug] happy-dom implements no native default action for `beforeinput`, clamping selectionStart/selectionEnd to 0**
- **Found during:** Task 1 (test authoring, RED phase)
- **Issue:** After correcting the event-dispatch issue above, the tests still failed: `textarea.selectionStart`/`selectionEnd` never left `0` even after a "committed" character via `beforeinput`. Direct experimentation (see debug script run during this session) confirmed happy-dom does not mutate `textarea.value` on a dispatched `beforeinput` event (unlike a real browser's native default action) — a selection index can never exceed `value.length`, so with `value` permanently `""`, `selectionStart = cursor` (e.g. `1`) always clamps back to `0`.
- **Fix:** Set `textarea.value = 'ab'` directly in the two new tests (a test-environment-only workaround — production code never reads `textarea.value`; `CaptureSurface`'s overlay renders purely from `computeTrainerState(text, getCharLog())`, per D-01/D-02). This lets `selectionStart`/`selectionEnd` hold the non-zero values needed to observe the resync fix, without touching any code path the tests verify.
- **Files modified:** `src/ui/CaptureSurface.test.tsx`
- **Commit:** `ca6f44e` (test/RED), verified again against `9dee8fd` (feat/GREEN)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in the plan's test-authoring guidance, not in the codebase itself)
**Impact on plan:** Both deviations were confined to test-dispatch mechanics discovered while writing the RED-phase tests; the planned implementation approach (extract `resyncCaret`, wire `onSelect`, add `isTrusted` guard) was correct as specified and required no changes. No scope creep — `src/trainer/state.ts`, `src/trainer/active-time.ts`, `src/ui/App.tsx`, and `src/index.css` remain untouched, matching the plan's stated output boundary.

## Issues Encountered

None beyond the two auto-fixed items above (both resolved during RED-phase test authoring, before any implementation commit).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 02-VERIFICATION.md's one blocking gap (gap #1 / WR-1) is closed and provable by an automated test rather than deferred to manual UAT — the caret-resync mitigation (D-10/T-02-04) now actually holds for every interaction that can move native selection.
- 02-REVIEW.md's WR-2 finding is also closed — `handleKeyDown` now matches the codebase-wide T-01-04 isTrusted convention.
- Full test suite (`pnpm vitest run`, all three projects: unit/dom/ui) passes at 115 tests across 6 files; `pnpm exec tsc --noEmit -p tsconfig.json` passes clean under strict + `noUncheckedIndexedAccess`.
- Phase 2's remaining human-verification items (long-line wrap, caret-blink cycle — both UI-SPEC backstops unrenderable under happy-dom) are unaffected by this plan and still pending end-of-phase UAT sign-off per `workflow.human_verify_mode: end-of-phase`.

---
*Phase: 02-interactive-typing-trainer*
*Completed: 2026-09-05*

## Self-Check: PASSED

All created/modified files confirmed present on disk; all four commits (`ca6f44e`, `9dee8fd`, `e64d2c5`, `391c87e`) confirmed present in git history.
