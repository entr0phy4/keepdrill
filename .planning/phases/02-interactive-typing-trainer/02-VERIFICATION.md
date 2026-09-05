---
phase: 02-interactive-typing-trainer
verified: 2026-09-05T09:10:00Z
status: human_needed
score: 7/9 must-haves verified
behavior_unverified: 2 # caret-blink cycle + long-unbroken-line wrap — UI-SPEC backstops, unrenderable under happy-dom (unchanged carry-forward from prior verification; not touched by 02-03)
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 6/9
  gaps_closed:
    - "Arrow-key/mouse-click native-selection drift is silently re-synced to the logical cursor within one render frame (gap #1 / WR-1) — CLOSED by 02-03-PLAN.md: resyncCaret() extracted and wired to the textarea's onSelect prop, which fires independent of React's render cycle (React's onSelect polyfill listens on document for focusout/contextmenu/dragend/focusin/keydown/keyup/mousedown/mouseup/selectionchange). Confirmed genuine (not tautological) by reverting src/ui/CaptureSurface.tsx to its pre-fix (ca6f44e) state and re-running the new regression tests: 3 of 11 tests fail without the fix (the two drift-resync tests plus the untrusted-Escape test), confirming they exercise real production code paths."
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Type a long unbroken line (minified code, no whitespace) into the loaded exercise and confirm it wraps via `overflow-wrap: anywhere` in both the invisible textarea and the rendered layer, identically, with no horizontal scroll."
    expected: "Text wraps identically in both stacked layers; no independent scroll container appears."
    why_human: "UI-SPEC-designated backstop — visual layout behavior not observable under happy-dom's no-layout-engine test environment. Unaffected by 02-03 (index.css untouched)."
  - test: "Focus the capture surface and observe the custom caret for several seconds, then blur the window/tab and observe again; also enable `prefers-reduced-motion: reduce` in the OS/browser and repeat."
    expected: "Caret blinks on a ~1s cycle (~530ms visible/hidden) while focused+visible; renders solid (never hidden) while blurred/tab-hidden; renders solid under reduced-motion."
    why_human: "CSS `@keyframes` animation timing/visual blink is not exercised by happy-dom (no CSS animation engine); only the `data-active` attribute wiring that gates the animation was verified automatically. Unaffected by 02-03 (index.css untouched)."
behavior_unverified_items:
  - truth: "The custom caret blinks ~1s while focused+visible, renders solid under reduced-motion, renders solid while blurred/hidden (UI-SPEC backstop)"
    test: "Focus the capture surface, watch for ~2-3s, then blur/hide the tab and watch again; repeat with prefers-reduced-motion: reduce enabled."
    expected: "Blink cycle visible only while focused+visible+no-reduced-motion; solid otherwise."
    why_human: "CSS animation timing cannot be observed under happy-dom (no CSS engine)."
  - truth: "A long unbroken line wraps via overflow-wrap: anywhere identically in both stacked layers, no horizontal scroll (UI-SPEC backstop)"
    test: "Paste/load a long minified line with no whitespace and observe wrap behavior in both the textarea and rendered layer."
    expected: "Both layers wrap identically at the same points; no horizontal scrollbar."
    why_human: "Layout/wrap behavior requires a real layout engine; happy-dom has none."
---

# Phase 02: Interactive Typing Trainer Verification Report

**Phase Goal:** The user can type a loaded exercise with live per-character feedback and natural editing under a free-correction policy, with honest session timing.
**Verified:** 2026-09-05T09:10:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (02-03-PLAN.md / 02-03-SUMMARY.md)

## Goal Achievement

### What changed since the last verification

The prior verification (`gaps_found`, 6/9) flagged one blocking gap: the caret-resync `useLayoutEffect` in `src/ui/CaptureSurface.tsx` was keyed on `[cursor]` alone, so it never corrected native-selection drift caused by ArrowLeft/Right/Home/End or a mouse click (none of which change `cursor` or trigger any other re-render) — risking a silently-dropped Backspace at a drifted selection boundary (TYPE-01/TYPE-03 violation).

`02-03-PLAN.md` (gap-closure plan, passed plan-check) was executed and produced `02-03-SUMMARY.md`. Verified directly against the codebase (not trusting the SUMMARY's claims):

1. **`resyncCaret()` extraction + `onSelect` wiring** — read `src/ui/CaptureSurface.tsx` lines 143-154 and 193: the resync logic is now a standalone function called from both the pre-existing `useLayoutEffect(() => resyncCaret(), [cursor])` (post-commit resync, unchanged behavior) **and** a new `onSelect={resyncCaret}` prop on the `<textarea>`. `grep -n "resyncCaret"` shows 3 matches as required by the plan's acceptance criteria.
2. **Mechanism is real, not test-only** — confirmed React 19 registers `onSelect` as a polyfill triggered by `focusout/contextmenu/dragend/focusin/keydown/keyup/mousedown/mouseup/selectionchange` (documented in commit `9dee8fd` and `02-03-SUMMARY.md`, and consistent with known React internals). This means the fix responds to the actual browser events fired by arrow keys (`keydown`/`keyup`) and mouse clicks (`mousedown`/`mouseup`), not merely a native `select` event that browsers fire inconsistently — closing the root cause for real interaction, not just for the test harness.
3. **Regression test is genuine, not tautological** — reverted `src/ui/CaptureSurface.tsx` to its pre-fix state (`git show ca6f44e:src/ui/CaptureSurface.tsx`) and re-ran `pnpm vitest run --project ui`: **3 of 11 tests fail** without the fix — both new caret-resync drift tests and the untrusted-Escape test — proving these tests exercise the actual production code path and would have caught the original bug. Restored the fixed file afterward (working tree confirmed clean).
4. **Full suite still green** — `pnpm vitest run` (all 3 projects) reports **115 tests passed** (up from 112 pre-gap-closure, matching the 3 new tests: 2 drift-resync + 1 untrusted-Escape). `pnpm exec tsc --noEmit -p tsconfig.json` passes clean (strict + `noUncheckedIndexedAccess`).
5. **WR-2 hardening also verified** — `handleKeyDown` now guards `if (!e.isTrusted) return` as its first statement (line 113), matching `src/capture/capture.ts`'s T-01-04 convention (`onKey`/`onBeforeInput`/`onCompositionStart`/`onCompositionEnd` all use the identical guard). A script-dispatched synthetic Escape can no longer trigger Restart.

**One caveat noted for completeness (not a gap):** the delete-after-drift regression test (`CaptureSurface.test.tsx` lines 341-377) dispatches a manually-constructed `beforeinput` event directly rather than reproducing the real browser condition where a native Backspace at a drifted-to-0 selection produces *zero* `beforeinput` events at all (the actual mechanism of the original bug). This is an inherent happy-dom limitation (documented in the test file's own comments — happy-dom implements no native default action for `beforeinput`). The test's real value is confirming `resyncCaret`'s DOM mutation doesn't corrupt the char-log-driven cursor tracking (`computeTrainerState` never reads `textarea.value`/`selectionStart`, confirmed by reading `src/capture/capture.ts` — `charLog` is populated purely from `beforeinput`/`input` events, independent of DOM selection). The actual closure of the "browser refuses to fire beforeinput at a boundary" scenario comes from item #2 above: since `onSelect` now fires on the arrow key/click's own `keydown`/`keyup`/`mousedown`/`mouseup`, native selection is corrected back to `cursor` before the user's *next* keystroke arrives — so a subsequent Backspace never actually sees `selectionStart === 0` when `cursor > 0`. This is architecturally sound and not testable in happy-dom (which is why it was a threat-model mitigation, not a unit-testable claim, from the outset).

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | TYPE-01: User sees exercise text with a caret and live per-character coloring (correct/incorrect/pending) updating while typing | ✓ VERIFIED | Unchanged since prior verification — `src/trainer/state.ts#computeTrainerState`; `CaptureSurface.tsx` renders `[data-status]` spans + `.trainer-caret`; regression-checked via full suite pass (115/115) |
| 2 | TYPE-02: User can advance past a mistyped character; corrected and uncorrected errors tracked separately | ✓ VERIFIED | Unchanged — `state.test.ts` cases 3/4/5, still passing |
| 3 | TYPE-03: User can press backspace to correct earlier characters | ✓ VERIFIED | Unchanged — `state.test.ts` cases 4/5/8, still passing; edge-case regression from gap #1 now closed (see #7 below) |
| 4 | TYPE-04: Whitespace renders as visible glyphs; Tab is a safe no-op | ✓ VERIFIED | Unchanged — `glyphFor` golden cases + `CaptureSurface.test.tsx` glyph/Tab tests, still passing |
| 5 | TYPE-05: User can restart the exercise — same content, all session state reset, no confirmation dialog | ✓ VERIFIED | Unchanged — `App.tsx#handleRestart`, Restart-click test, still passing |
| 6 | TYPE-06: Session timing starts on first keystroke, excludes blurred/hidden time; pasting is blocked/flagged | ✓ VERIFIED | Unchanged — `active-time.ts` golden cases, paste-block wiring, still present |
| 7 | Arrow-key/mouse-click native-selection drift is silently re-synced to the logical cursor within one render frame (UI-SPEC backstop; D-10/T-02-04) | ✓ VERIFIED | **GAP CLOSED.** `resyncCaret()` now wired to `onSelect` (fires on native keydown/keyup/mousedown/mouseup/selectionchange via React's polyfill, independent of `cursor` changing); regression test in `CaptureSurface.test.tsx` (`caret resync on selection drift` describe block) passes on the fixed code and genuinely fails (3/11 tests) when reverted to the pre-fix commit — confirmed by direct revert-and-rerun, not just SUMMARY claim |
| 8 | The custom caret blinks ~1s while focused+visible, renders solid under reduced-motion, renders solid while blurred/hidden (UI-SPEC backstop) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Unchanged carry-forward — CSS + `data-active` wiring present and unit-tested for the blur half; blink timing/visual rendering not exercisable under happy-dom. `index.css` untouched by 02-03. |
| 9 | A long unbroken line wraps via `overflow-wrap: anywhere` identically in both stacked layers, no horizontal scroll (UI-SPEC backstop) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Unchanged carry-forward — CSS rule present; visual wrap behavior not exercisable under happy-dom. `index.css` untouched by 02-03. |

**Score:** 7/9 truths verified (2 present, behavior-unverified — both pre-existing and out of scope for this gap-closure round)

### Additional (non-roadmap) truth closed by this round

| Truth | Status | Evidence |
|-------|--------|----------|
| `handleKeyDown` rejects untrusted (`isTrusted === false`) keydown events before evaluating Escape/Tab (WR-2, T-02-09) | ✓ VERIFIED | `grep -n "isTrusted" src/ui/CaptureSurface.tsx` shows the guard as `handleKeyDown`'s first statement (line 113); regression test confirms a script-dispatched synthetic Escape no longer triggers `onRestartRequested`, and confirmed to genuinely fail without the fix via the same revert test above |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/ui/CaptureSurface.tsx` | `resyncCaret()` shared by post-commit effect and `onSelect`; `isTrusted` guard in `handleKeyDown` | ✓ VERIFIED | Both present, wired, confirmed by direct read + grep (3 `resyncCaret` matches, 1 `isTrusted` match at guard position) |
| `src/ui/CaptureSurface.test.tsx` | Regression tests: drift-resync independent of cursor change, drift-then-delete lands correctly, untrusted Escape rejected | ✓ VERIFIED | 3 new tests present (2 in new `caret resync on selection drift` describe block, 1 in existing Tab/Escape block); all pass on fixed code, 3/3 fail when reverted to pre-fix commit |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `CaptureSurface.tsx` (textarea `onSelect`) | `CaptureSurface.tsx` (`resyncCaret`) | `onSelect={resyncCaret}` | ✓ WIRED | Line 193; confirmed fires on React's `onSelect` polyfill trigger events (keydown/keyup/mousedown/mouseup/selectionchange/focusin/focusout/contextmenu/dragend) |
| `CaptureSurface.tsx` (`handleKeyDown`) | T-01-04 convention (`capture.ts`) | `if (!e.isTrusted) return` guard, identical shape | ✓ WIRED | Line 113, matches `capture.ts`'s `onKey`/`onBeforeInput`/`onCompositionStart`/`onCompositionEnd` guards exactly |
| (carried forward, unchanged) `CaptureSurface.tsx` -> `trainer/state.ts` | `computeTrainerState(text, getCharLog())` | ✓ WIRED | Unchanged, still recomputed each render |
| (carried forward, unchanged) `App.tsx` -> `CaptureSurface.tsx` | `text={exercise.text}` prop | ✓ WIRED | Unchanged |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `ui` project tests pass (fixed code) | `pnpm vitest run --project ui` | 11 tests, all pass | ✓ PASS |
| Regression tests genuinely fail without the fix (not tautological) | reverted `CaptureSurface.tsx` to `ca6f44e`, re-ran `pnpm vitest run --project ui` | 3/11 fail (2 drift-resync tests + untrusted-Escape test) | ✓ PASS (proves genuine regression coverage) |
| Full suite passes (one-time full run) | `pnpm vitest run` | 6 files, 115 tests, all pass (was 112 pre-gap-closure) | ✓ PASS |
| TypeScript strict + `noUncheckedIndexedAccess` compiles clean | `pnpm exec tsc --noEmit -p tsconfig.json` | exit 0, no errors | ✓ PASS |
| No debt markers in modified files | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER" src/ui/CaptureSurface.tsx src/ui/CaptureSurface.test.tsx` | 0 matches | ✓ PASS |
| No dangerous HTML sinks | `grep -n -E "dangerouslySetInnerHTML\|\.innerHTML" src/ui/CaptureSurface.tsx` | 0 matches | ✓ PASS |
| Working tree clean after revert-and-restore test | `git status --short` | no modifications to tracked files | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| TYPE-01 | 02-01, 02-03 | Live per-char coloring + caret; caret-integrity edge case | ✓ SATISFIED | Truths #1 and #7 above |
| TYPE-02 | 02-01 | Free-correction, corrected/uncorrected tracked | ✓ SATISFIED | Truth #2 above |
| TYPE-03 | 02-01, 02-03 | Backspace correction; drift-then-backspace edge case | ✓ SATISFIED | Truths #3 and #7 above |
| TYPE-04 | 02-01, 02-02 | Whitespace glyphs + safe Tab no-op | ✓ SATISFIED | Truth #4 above |
| TYPE-05 | 02-02 | Restart control | ✓ SATISFIED | Truth #5 above |
| TYPE-06 | 02-02 | Active-time computation + paste block | ✓ SATISFIED | Truth #6 above |

Cross-referenced against `.planning/REQUIREMENTS.md` (lines 28-33, 97-102): all 6 IDs (TYPE-01..TYPE-06) map to Phase 2 and are marked `[x]`/"Complete". No orphaned requirements — 02-01/02-02/02-03's combined `requirements` frontmatter covers all 6 IDs.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| ~~`src/ui/CaptureSurface.tsx`~~ | ~~131-138~~ | ~~Caret-resync effect keyed on `[cursor]` only~~ | ~~🛑 Blocker~~ | **RESOLVED by 02-03** — `resyncCaret()` now also wired to `onSelect`, confirmed fires independent of `cursor` changes |
| ~~`src/ui/CaptureSurface.tsx`~~ | ~~108-124~~ | ~~`handleKeyDown` missing `isTrusted` guard~~ | ~~⚠️ Warning~~ | **RESOLVED by 02-03** — guard added as first statement |
| `src/trainer/state.ts` | 27, 37, 51 | `wasEverWrong`/`perCharStatus` updated by non-adjacent branches with an implicit, comment-only invariant | ℹ️ Info | Unchanged, maintainability-only (code-review WR-3); no test failure |
| `src/ui/CaptureSurface.tsx` | 131 | `computeTrainerState(text, getCharLog())` called directly in render body | ℹ️ Info | Unchanged, latent tearing risk only under concurrent rendering (code-review IN-1) |
| `src/trainer/state.test.ts` | — | No golden case for backspace after multi-character typing | ℹ️ Info | Unchanged, coverage gap only (code-review IN-2) |
| `src/ui/CaptureSurface.test.tsx` | — | No test for `visibilitychange`-driven `isActive` transition | ℹ️ Info | Unchanged, coverage gap only (code-review IN-3) |

No TBD/FIXME/XXX debt markers found in any file modified by this phase (including 02-03's changes).

### Human Verification Required

See `human_verification` in frontmatter. Two items remain, both pre-existing UI-SPEC backstops unaffected by this gap-closure round (neither touches `index.css`, which was untouched by `02-03-PLAN.md`):

1. **Long-line wrap** — visual layout behavior, no layout engine in happy-dom.
2. **Caret-blink cycle** — CSS animation timing, no CSS animation engine in happy-dom.

These are advisory per `workflow.human_verify_mode: end-of-phase` and do not block phase progression on their own, but should be confirmed before final phase sign-off per the existing human-verification protocol.

### Gaps Summary

**No blocking gaps remain.** The one gap from the prior verification (caret-resync never firing on arrow-key/click-only drift, risking a silently-dropped Backspace) has been closed by `02-03-PLAN.md`/`02-03-SUMMARY.md` and independently re-verified in this session by:
- Direct code reading confirming the `onSelect={resyncCaret}` wiring exists and is backed by a real React event-polyfill mechanism (not a test-only artifice).
- Reverting the file to its pre-fix commit and re-running the test suite, confirming 3 of the 11 `ui`-project tests genuinely fail without the fix — proof the new regression tests are not tautological.
- A full-suite run (115/115 pass) and a clean strict TypeScript compile.

The status is `human_needed` rather than `passed` only because two pre-existing, unaffected UI-SPEC visual/animation backstops (long-line wrap, caret-blink cycle) still require manual confirmation outside happy-dom's capabilities — both carried forward unchanged from the prior verification and outside this gap-closure plan's scope.

---

_Verified: 2026-09-05T09:10:00Z_
_Verifier: Claude (gsd-verifier)_
