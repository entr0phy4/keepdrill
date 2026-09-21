---
phase: 09-scaffolded-trainer
plan: 02
subsystem: ui
tags: [FileScaffold, startScaffold, curriculum, persist, github, tdd]

requires:
  - phase: 09-scaffolded-trainer
    provides: sliceUnit, joinUnitSlices, coverFile, flattenSnapshots, assembleSessionFromLogs
  - phase: 08-parse-dependency-units
    provides: FilePlan units in leaves-first curriculum order; github sourceRef owner/repo:path
  - phase: 02-interactive-typing-trainer
    provides: CaptureSurface props text, onRestartRequested, onComplete
provides:
  - FileScaffold source-order chrome with landmark N / M and slice-only CaptureSurface
  - App startScaffold click-to-type unit 0; handleLoad last-wins paste/upload whole-file
  - Unit advance snapshots then resetCapture; last-unit flatten + joinUnitSlices metrics + one saveSession
  - Escape/Restart unit restarts current unit only; Restart hidden after persist
affects: [verify-work UAT, History github sourceRef human-check, Phase 9 closeout]

tech-stack:
  added: []
  patterns:
    - FileScaffold owns landmark + coverFile segments; CaptureSurface stays slice-ignorant
    - startScaffold never calls handleLoad(plan.exercise)
    - Last-unit persist: flattenSnapshots then assembleSessionFromLogs; metrics target is joinUnitSlices
    - Hide-not-unmount trainer subtree unchanged; tab switch is not a reset

key-files:
  created:
    - src/ui/FileScaffold.tsx
    - src/ui/FileScaffold.test.tsx
  modified:
    - src/ui/App.tsx
    - src/ui/App.test.tsx

key-decisions:
  - "Landmark COPY.landmark is '{n} / {m}' with spaces; KIND_LABEL.other is the empty string — never a visible word"
  - "startScaffold sets curriculum from plan.units and mounts FileScaffold immediately, including fallback 1-unit"
  - "handleLoad clears curriculum and mounts whole-file CaptureSurface; Paste|GitHub tabs do not reset"
  - "Last-unit metrics use joinUnitSlices typedTarget; Session.exercise.text stays the source-order file"
  - "After persist, scaffoldComplete hides Restart and unmounts CaptureSurface so Escape cannot arm a second saveSession"

patterns-established:
  - "COPY consts live in the UI file verbatim from 09-UI-SPEC.md"
  - "Static FileScaffold regions are React text + glyphFor .ws-glyph; no innerHTML"
  - "Snapshot getEvents/getCharLog/getMarkers then resetCapture before remounting the next slice"

requirements-completed: [SCAF-01, SCAF-02, SCAF-03, SCAF-04, SCAF-05]

coverage:
  - id: D1
    description: "FileScaffold paints source-order unit/gap chrome; only the current code-point slice is typeable; markup fixtures stay characters"
    requirement: SCAF-01
    verification:
      - kind: automated_ui
        ref: "src/ui/FileScaffold.test.tsx#puts #capture-surface only in the current card; static regions have zero textareas"
        status: pass
      - kind: automated_ui
        ref: "src/ui/FileScaffold.test.tsx#paints source-order top-to-bottom so a later-source current unit sits below a future unit"
        status: pass
      - kind: automated_ui
        ref: "src/ui/FileScaffold.test.tsx#renders markup-looking fixture as characters; querySelector(img) is null"
        status: pass
    human_judgment: false
  - id: D2
    description: "Clicking a planned TS/JS file starts unit 0 immediately; paste/upload handleLoad exits scaffold to whole-file typing; last-wins second onPlanned; tabs do not reset"
    requirement: SCAF-05
    verification:
      - kind: automated_ui
        ref: "src/ui/App.test.tsx#starts typing immediately on a fallback FilePlan with a 1 / 1 landmark"
        status: pass
      - kind: automated_ui
        ref: "src/ui/App.test.tsx#puts the first curriculum slice into CaptureSurface, not the full two-unit file"
        status: pass
      - kind: automated_ui
        ref: "src/ui/App.test.tsx#handleLoad after a scaffold unmounts FileScaffold and mounts whole-file CaptureSurface"
        status: pass
      - kind: automated_ui
        ref: "src/ui/App.test.tsx#switching Paste | GitHub tabs does not clear an in-progress scaffold"
        status: pass
      - kind: automated_ui
        ref: "src/ui/App.test.tsx#a second onPlanned replaces the first: landmark returns to 1 / M of the new plan"
        status: pass
    human_judgment: false
  - id: D3
    description: "Completing a non-last unit advances instantly with no History row and no ResultsView"
    requirement: SCAF-02
    verification:
      - kind: automated_ui
        ref: "src/ui/App.test.tsx#completing unit 0 does not persist or show results; landmark becomes 2 / 2"
        status: pass
    human_judgment: false
  - id: D4
    description: "Last unit persist writes one github session: full Exercise.text, sourceRef owner/repo:path, charLog from both slices, ResultsView shown, Restart hidden"
    requirement: SCAF-03
    verification:
      - kind: automated_ui
        ref: "src/ui/App.test.tsx#last unit persist writes one github History row with full file text and both slices"
        status: pass
      - kind: automated_ui
        ref: "src/ui/App.test.tsx#after scaffold persist, History shows sourceRef and not Pasted snippet"
        status: pass
      - kind: automated_ui
        ref: "src/ui/App.test.tsx#does not write a second History row after last-unit persist"
        status: pass
    human_judgment: false
  - id: D5
    description: "Escape and Restart unit remount the current slice only; unitIndex and completed snapshots stay"
    requirement: SCAF-04
    verification:
      - kind: automated_ui
        ref: "src/ui/App.test.tsx#Escape after unit 0 keeps unitIndex at 1 and does not persist"
        status: pass
      - kind: automated_ui
        ref: "src/ui/App.test.tsx#Restart unit remounts the current slice and keeps completed snapshots"
        status: pass
    human_judgment: false
  - id: D6
    description: "Current-card scrollIntoView nearest/instant and done/future glyph column alignment with the overlay"
    requirement: SCAF-01
    verification:
      - kind: automated_ui
        ref: "src/ui/FileScaffold.test.tsx#calls scrollIntoView on the current card on mount and when unitIndex changes"
        status: pass
      - kind: automated_ui
        ref: "src/ui/FileScaffold.test.tsx#renders glyphFor middle-dot and newline via .ws-glyph on a gap"
        status: pass
    human_judgment: true
    rationale: "scrollIntoView is spied, not scrollTop (happy-dom has no layout). Glyph characters are asserted; pixel column alignment vs CaptureSurface overlay is a Chromium layout-engine check."

duration: 10min
completed: 2026-09-21
status: complete
---

# Phase 9 Plan 02: FileScaffold Chrome + App Curriculum Summary

**Source-order FileScaffold with slice-only CaptureSurface, click-to-type startScaffold, instant unit advance, unit-only restart, and one github History row whose metrics use joinUnitSlices**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-21T02:03:41Z
- **Completed:** 2026-09-21T02:13:22Z
- **Tasks:** 3/3 (6 TDD commits: RED+GREEN each)
- **Files modified:** 4

## Accomplishments

- `FileScaffold` paints the full file as source-order unit/gap segments; only the current curriculum slice is typeable; landmark is `N / M` with kind/name; untrusted blob text is React text + `glyphFor`
- `App.startScaffold` starts typing on unit 0 from `onPlanned` (including 1-unit fallback); paste/upload `handleLoad` clears curriculum and stays whole-file; last-wins replaces an in-progress scaffold
- Completing a non-last unit snapshots capture logs and remounts the next slice with no persist; last unit flattens snapshots, `assembleSessionFromLogs` keeps full `Exercise.text`, metrics use `joinUnitSlices`, Restart is hidden, History shows `owner/repo:path`

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED: failing FileScaffold chrome tests** - `b2134f7` (test)
2. **Task 1 GREEN: implement FileScaffold source-order chrome** - `1f71573` (feat)
3. **Task 2 RED: failing startScaffold / last-wins tests** - `93bb309` (test)
4. **Task 2 GREEN: startScaffold, FileScaffold mount, paste exit** - `62dc483` (feat)
5. **Task 3 RED: failing advance / persist / restart tests** - `832fda4` (test)
6. **Task 3 GREEN: unit advance, last-unit persist, unit restart** - `4e432d5` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/ui/FileScaffold.tsx` - Landmark, coverFile chrome, slice-only CaptureSurface, scrollIntoView
- `src/ui/FileScaffold.test.tsx` - Source-order vs curriculum, XSS, glyphs, 1 / 1, complete, scroll spy
- `src/ui/App.tsx` - `startScaffold`, curriculum/unitIndex/snapshots, last-wins `handleLoad`, last-unit flatten persist, unit restart
- `src/ui/App.test.tsx` - Inverted idle onPlanned; slice ≠ file; paste exit; tabs; last-wins; advance; persist; History sourceRef

## Decisions Made

- COPY and KIND_LABEL copied verbatim from 09-UI-SPEC.md; `other` is never a visible word
- GitHub `onPlanned={startScaffold}` never passes `plan.exercise` into the paste/upload load callback
- 250ms live `buildSession` interval is skipped while curriculum is non-null so persist cannot depend on a current-unit-only sessionRef
- Last-unit `computeSessionMetrics` first argument is `joinUnitSlices`; `resolve-metrics.ts` and Dexie are unchanged (metricsSnapshot is what History shows)
- After persist, `scaffoldComplete` unmounts CaptureSurface and hides Restart (Pitfall 11 option a) so Escape cannot write a second row

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test] Glyph-aware textContent assertions**
- **Found during:** Task 1 GREEN
- **Issue:** Overlay and static regions render spaces as `·` via `glyphFor`; tests that expected raw `'function a'` failed despite correct rendering
- **Fix:** Assert glyph text (`function·a`) and XSS as `'<img'` + `'onerror=alert(1)>'` without requiring a raw space
- **Files modified:** `src/ui/FileScaffold.test.tsx`
- **Verification:** FileScaffold.test.tsx 11/11 pass
- **Committed in:** `1f71573`

**2. [Rule 3 - Blocking] Hide-not-unmount ancestor walk**
- **Found during:** Task 2 GREEN
- **Issue:** `closest('div[style]')` from `#capture-surface` hits the current card, not the trainer `display:none` wrapper
- **Fix:** Walk ancestors until `style.display === 'none'`
- **Files modified:** `src/ui/App.test.tsx`
- **Verification:** hide-not-unmount test passes
- **Committed in:** `62dc483`

**3. [Rule 3 - Blocking] tsc types for scrollIntoView spy and HTMLElement query**
- **Found during:** Task 3 verification (`tsc --noEmit`)
- **Issue:** `vi.fn()` not assignable to `scrollIntoView`; `querySelector` Element vs HTMLElement
- **Fix:** Cast spy; use `querySelector<HTMLTextAreaElement>`
- **Files modified:** `src/ui/FileScaffold.test.tsx`, `src/ui/App.test.tsx`
- **Verification:** `tsc --noEmit -p tsconfig.json` exit 0
- **Committed in:** `4e432d5`

---

**Total deviations:** 3 auto-fixed (1 test assertion, 2 blocking types/DOM)
**Impact on plan:** None on product behavior. Tests match glyphFor and nested chrome.

## Issues Encountered

None

## Authentication Gates

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 9 plans are complete. Ready for `/gsd-verify-work` (human Chromium checks: glyph column alignment, live GitHub click-to-type) then phase verification / milestone closeout. `capture.ts`, `CaptureSurface.tsx`, `HistoryView.tsx`, and `RepoBrowser.tsx` are unmodified.

## TDD Gate Compliance

Each of the three `tdd="true"` tasks produced a `test(09-02)` RED commit followed by a `feat(09-02)` GREEN commit. No REFACTOR commits.

## Verification

- `pnpm exec vitest run --project ui src/ui/FileScaffold.test.tsx src/ui/App.test.tsx` — 2 files, 36 tests, exit 0
- `pnpm exec vitest run --project unit src/scaffold/slice.test.ts src/scaffold/cover.test.ts src/scaffold/flatten.test.ts src/session.test.ts` — 4 files, 20 tests, exit 0
- `pnpm exec tsc --noEmit -p tsconfig.json` — exit 0
- `git diff -- src/capture/capture.ts src/ui/CaptureSurface.tsx src/ui/HistoryView.tsx src/ui/RepoBrowser.tsx` — empty
- `FileScaffold.tsx` and `App.tsx` contain no `innerHTML` token and no `dangerouslySetInnerHTML` token

## Self-Check: PASSED

---
*Phase: 09-scaffolded-trainer*
*Completed: 2026-09-21*
