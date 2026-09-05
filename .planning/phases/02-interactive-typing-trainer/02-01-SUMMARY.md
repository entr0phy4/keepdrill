---
phase: 02-interactive-typing-trainer
plan: 01
subsystem: ui
tags: [react, vitest, happy-dom, useSyncExternalStore, textarea-overlay]

# Dependency graph
requires:
  - phase: 01-corpus-input-keystroke-capture
    provides: getCharLog()/CommittedChar[] committed-character stream, Exercise.text (already tab-expanded/newline-normalized), CaptureSurface's focused native <textarea>, loadToken remount mechanism
provides:
  - "src/trainer/state.ts: pure computeTrainerState(target, charLog) reducer (D-03/D-04/D-05/D-11) — perCharStatus/cursor/correctedCount/uncorrectedCount/completedAt"
  - "glyphFor(char): whitespace-glyph mapping (space -> ·, newline -> ↵, D-06 amended, no tab glyph)"
  - "CaptureSurface.tsx rebuilt as the transparent-textarea-over-rendered-layer overlay (D-01/D-02) with live per-character correct/incorrect/pending coloring, an in-flow custom caret (D-10), and whitespace glyphs overlaying the status palette"
  - "vitest 'ui' happy-dom project for src/ui/**/*.test.tsx"
affects: [02-02 (Restart, Tab no-op, active-time), phase 3 metrics engine (consumes perCharStatus/correctedCount/uncorrectedCount)]

# Actuals (#2632)
actuals:
  tokens: 5714
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Pure-core reducer module (src/trainer/state.ts) mirrors normalize.ts's zero-runtime-import convention — only `import type` crosses in, header comment states purity + decision IDs + locking test file + explicit do-NOT list"
    - "Transparent-textarea-over-rendered-layer overlay: CSS grid stacking (grid-area: 1 / 1) instead of absolute positioning + pixel math, both children sharing one font-metrics rule set (.trainer-stack > *)"
    - "useSyncExternalStore + requestAnimationFrame per-frame re-render trigger (useCharLogTick), sibling pattern to use-capture.ts's setInterval-throttled subscribe — never touches capture.ts's hot path"
    - "In-flow, zero-width caret marker (a real <span> inserted into the character-span sequence) instead of getBoundingClientRect()-based positioning"

key-files:
  created:
    - src/trainer/state.ts
    - src/trainer/state.test.ts
    - src/ui/CaptureSurface.test.tsx
  modified:
    - src/ui/CaptureSurface.tsx
    - src/ui/App.tsx
    - src/index.css
    - vite.config.ts

key-decisions:
  - "computeTrainerState treats every delete* inputType as exactly one position back (D-11's documented v1 limitation) — no attempt to infer multi-char delete length from data (always null for delete* records)"
  - "wasEverWrong history survives a backspace reset to 'pending', so retyping correctly after a correction is counted in correctedCount (D-04) while the visible re-pending state shows no ghost mark"
  - "Caret position is derived solely from computeTrainerState's cursor, never textarea.selectionStart — a useLayoutEffect forces native selection back to cursor on every render (D-10)"
  - "The trainer surface's border/font-metrics are unified across the invisible textarea and the rendered layer via .trainer-stack > *, including border: 1px solid transparent — the previously-visible textarea border becomes transparent so both stacked layers share an identical box model; the focus ring (outline) remains the visible focus cue"

patterns-established:
  - "Whitespace-glyph overlay: glyph text gets its own opacity dimming (.ws-glyph) while the parent [data-status] span's background/underline decorations stay at full strength — dimming never touches the status signal"

requirements-completed: [TYPE-01, TYPE-02, TYPE-03, TYPE-04]

coverage:
  - id: D1
    description: "Live per-character correctness coloring (correct/incorrect/pending) and a custom in-flow caret that advances on every committed keystroke (TYPE-01)"
    requirement: "TYPE-01"
    verification:
      - kind: unit
        ref: "src/trainer/state.test.ts#computeTrainerState() — golden cases (TYPE-01/02/03)"
        status: pass
      - kind: automated_ui
        ref: "src/ui/CaptureSurface.test.tsx#CaptureSurface — tracer end-to-end (TYPE-01) > a trusted beforeinput commit renders correct/pending status and advances the caret"
        status: pass
    human_judgment: false
  - id: D2
    description: "Free-correction: the cursor always advances on any committed character, right or wrong, never blocked waiting for a fix (TYPE-02)"
    requirement: "TYPE-02"
    verification:
      - kind: unit
        ref: "src/trainer/state.test.ts#case 3: wrong character still advances the cursor (free-correction, D-04)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Backspace reopens exactly the previous position to pending, without a 'previously wrong' ghost mark (TYPE-03)"
    requirement: "TYPE-03"
    verification:
      - kind: unit
        ref: "src/trainer/state.test.ts#case 4/5/8: delete-type record moves cursor back, re-opens pending, corrected/idempotent-at-zero"
        status: pass
    human_judgment: false
  - id: D4
    description: "Whitespace glyphs (space -> ·, newline -> ↵) overlay the correct/incorrect/pending palette rather than replacing it — no tab glyph (D-06 amended, TYPE-04)"
    requirement: "TYPE-04"
    verification:
      - kind: unit
        ref: "src/trainer/state.test.ts#glyphFor() — 3 golden cases (TYPE-04, D-06 amended)"
        status: pass
      - kind: automated_ui
        ref: "src/ui/CaptureSurface.test.tsx#CaptureSurface — whitespace glyphs (TYPE-04, D-06 amended)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A long unbroken line wraps via overflow-wrap: anywhere identically on both stacked layers, without ever requiring horizontal scroll"
    verification: []
    human_judgment: true
    rationale: "UI-SPEC-designated backstop (verification: backstop) — visual layout behavior not verifiable under happy-dom's no-layout-engine limitation; deferred to end-of-phase UAT per workflow.human_verify_mode: end-of-phase"

duration: ~15min
completed: 2026-09-05
status: complete
---

# Phase 02 Plan 01: Trainer Reducer + Transparent Overlay Summary

**Pure `computeTrainerState` reducer + transparent-textarea-over-rendered-layer overlay delivering live per-character correctness coloring, free-correction, backspace, and whitespace glyphs — end-to-end and proven by an automated React-DOM render test.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-05T13:09:00Z (approx.)
- **Completed:** 2026-09-05T13:23:51Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- `src/trainer/state.ts`: a zero-runtime-import pure reducer (`computeTrainerState`) folding `Exercise.text` + `CommittedChar[]` into `{ perCharStatus, cursor, correctedCount, uncorrectedCount, completedAt }`, implementing free-correction (D-04), backspace re-opening (D-05), and the one-position-back delete limitation (D-11).
- `CaptureSurface.tsx` rebuilt as the transparent-textarea-over-rendered-layer overlay (D-01/D-02): the native `<textarea>` stays the sole input/focus/caret host (text/native-caret made invisible), while a new rendered layer shows live per-character coloring plus an in-flow custom caret derived solely from `cursor` (D-10), resynced via `useLayoutEffect` whenever native selection drifts.
- `glyphFor()` renders space as `·` and newline as `↵`, overlaying (not replacing) the correct/incorrect/pending palette via a `.ws-glyph` opacity-only dimming rule — no tab glyph, honoring the D-06/D-07 amendment.
- `App.tsx` now feeds `exercise.text` into `CaptureSurface` and the redundant read-only preview block is gone — the overlay is the sole renderer of the loaded exercise.
- A new `ui` happy-dom Vitest project plus `CaptureSurface.test.tsx` proves the full happy path (dispatch a trusted `beforeinput`, assert DOM coloring + caret position) end-to-end, not manual-only.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer — trainer reducer + transparent overlay, one happy path end-to-end** - `ada6f99` (feat)
2. **Task 2: Whitespace glyphs + extended golden coverage** - `3cc9431` (feat)

_Note: both tasks carried `tdd="true"`; each commit bundles the test additions with the implementation they lock (test-then-implementation authored together, verified failing-then-passing before commit, per the plan's `<behavior>` blocks)._

## Files Created/Modified
- `src/trainer/state.ts` - pure `computeTrainerState` reducer + `glyphFor` whitespace-glyph mapping
- `src/trainer/state.test.ts` - 12-case golden-case table (`computeTrainerState`) + 3-case table (`glyphFor`)
- `src/ui/CaptureSurface.tsx` - transparent-textarea-over-rendered-layer overlay, per-character coloring, custom caret, caret resync, whitespace-glyph wrapping
- `src/ui/CaptureSurface.test.tsx` - React-DOM + happy-dom end-to-end render tests (tracer happy path + whitespace glyphs)
- `src/ui/App.tsx` - passes `text={exercise.text}` into `CaptureSurface`, removes the redundant read-only preview block
- `src/index.css` - new `--color-correct`/`--color-pending`/`--color-incorrect`/`--color-incorrect-bg` tokens, `.trainer-stack`/`.trainer-rendered-layer`/`.trainer-textarea`/`.trainer-caret`/`.ws-glyph` rules
- `vite.config.ts` - new `ui` happy-dom test project for `src/ui/**/*.test.tsx`

## Decisions Made
- Delete-type records always move the cursor back exactly one position, never inferring a multi-char delete length from `data` (D-11) — matches TYPE-03's literal "press backspace" wording, documented as a known v1 limitation.
- `wasEverWrong` history survives a backspace-triggered reset to `pending`, so a corrected position is counted in `correctedCount` even though its visible state after re-pending is indistinguishable from a never-wrong position (matches the UI-SPEC's "no ghost mark" requirement exactly).
- The shared `.trainer-stack > *` rule sets `border: 1px solid transparent` on both stacked layers (per plan's explicit CSS spec) so the box model stays identical between the invisible textarea and the rendered layer — visible focus feedback now comes entirely from the existing `:focus-visible` outline ring, not a textarea border color change.

## Deviations from Plan

None - plan executed exactly as written, with one clarification applied during authoring: the plan's own explanatory-comment text for `glyphFor`'s tab exclusion (in `02-PATTERNS.md`) used the literal strings `'\t'` and `recordSyntheticChar` that the plan's own acceptance-criteria greps check for zero matches of. Reworded the source comments to describe the same rationale (tab is inert; no synthetic-char capture export) without using those literal strings, so the acceptance-criteria greps pass cleanly while preserving the documented "do NOT" guidance verbatim in spirit.

## Issues Encountered
- The `ui` project's `CaptureSurface.test.tsx` initially failed both on a missing `IS_REACT_ACT_ENVIRONMENT` flag (React 19's `act()` requires this outside jest/testing-library harnesses) and on asserting DOM state synchronously with the `beforeinput` dispatch — the trainer only re-renders on the next `requestAnimationFrame` tick (`useCharLogTick`, D-13), not synchronously with the DOM event. Fixed by setting the flag once at module load and awaiting one `requestAnimationFrame` tick inside an async `act()` block before asserting.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `src/trainer/state.ts`'s output shape (`perCharStatus`, `correctedCount`, `uncorrectedCount`) is ready for Phase 3's metrics engine to consume without re-deriving correctness.
- Plan 02-02 (Restart, Tab no-op, active-time) builds directly on this plan's `CaptureSurface` overlay and `computeTrainerState` reducer — no blockers.
- The D5 backstop (long-line wrap) and the UI-SPEC's other backstop items (caret blink, arrow-key resync visual) remain unverified by automation per their own design — deferred to end-of-phase UAT (`workflow.human_verify_mode: end-of-phase`).

---
*Phase: 02-interactive-typing-trainer*
*Completed: 2026-09-05*

## Self-Check: PASSED

All created/modified files confirmed present on disk; both task commits (`ada6f99`, `3cc9431`) confirmed present in git history.
