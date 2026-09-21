---
phase: 08-parse-dependency-units
plan: 05
subsystem: ui
tags: [RepoBrowser, last-wins, clickGenRef, importGenRef, FILE-01, PLAN-03]

requires:
  - phase: 08-parse-dependency-units
    provides: RepoBrowser onPlanned(FilePlan) from loadable TS/JS clicks (08-04)
provides:
  - clickGenRef last-wins for every tree-file click including blocked and commit
  - importGenRef isolates Import busy so a file click cannot leave Import disabled
affects: [09 scaffolded trainer chrome consuming FilePlan]

tech-stack:
  added: []
  patterns:
    - clickGenRef is the only generation counter for onFileClick status and onPlanned
    - importGenRef is the only generation counter for onImport setBusy
    - onImport increments clickGenRef at start so a stale loadable cannot land after Import began

key-files:
  created: []
  modified:
    - src/ui/RepoBrowser.tsx
    - src/ui/RepoBrowser.test.tsx

key-decisions:
  - "Split shared tokenRef into clickGenRef (every file click) and importGenRef (Import busy only)"
  - "onImport increments clickGenRef at start so a slower in-flight loadable cannot overwrite Import status or fire stale onPlanned"

patterns-established:
  - "onFileClick first statement is ++clickGenRef before any setStatus, including COPY.blocked for commit and non-loadable"
  - "onImport finally setBusy(false) only when importGenRef.current still equals that Import token"

requirements-completed: [FILE-01, PLAN-03]

coverage:
  - id: D1
    description: "A slower first loadable click cannot overwrite a later blocked README click's COPY.blocked status or fire onPlanned"
    requirement: FILE-01
    verification:
      - kind: automated_ui
        ref: "src/ui/RepoBrowser.test.tsx#last-wins overlapping clicks: slow first loadable cannot overwrite a later blocked README click"
        status: pass
    human_judgment: false
  - id: D2
    description: "A slower first loadable click cannot overwrite a later commit mod.ts click's COPY.blocked status or fire onPlanned"
    requirement: PLAN-03
    verification:
      - kind: automated_ui
        ref: "src/ui/RepoBrowser.test.tsx#last-wins overlapping clicks: slow first loadable cannot overwrite a later commit mod.ts click"
        status: pass
    human_judgment: false
  - id: D3
    description: "A loadable file click during Import cannot leave the Import submit button disabled after fetchRepoTree resolves"
    requirement: FILE-01
    verification:
      - kind: automated_ui
        ref: "src/ui/RepoBrowser.test.tsx#file click during Import still re-enables Import when the tree fetch resolves"
        status: pass
    human_judgment: false
  - id: D4
    description: "RepoBrowser uses clickGenRef for every file click and importGenRef for Import busy; existing loadable-vs-loadable last-wins stays green"
    requirement: FILE-01
    verification:
      - kind: automated_ui
        ref: "src/ui/RepoBrowser.test.tsx#last-wins overlapping clicks: slow first sha cannot overwrite the second"
        status: pass
      - kind: other
        ref: "pnpm exec vitest run --project ui src/ui/RepoBrowser.test.tsx (28 passed) && pnpm exec tsc --noEmit -p tsconfig.json; grep clickGenRef and importGenRef in RepoBrowser.tsx"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-09-21
status: complete
---

# Phase 8 Plan 05: Last-wins click generation Summary

**RepoBrowser splits clickGenRef and importGenRef so blocked/commit clicks last-win against in-flight loadables and a file click cannot stick Import disabled**

## Performance

- **Duration:** 3 min
- **Started:** 2026-09-21T00:38:49Z
- **Completed:** 2026-09-21T00:41:31Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Every tree-file click, including blocked README and commit `mod.ts`, bumps `clickGenRef` before `setStatus`; a slower `fetchGithubBlob` no longer overwrites `COPY.blocked` or fires `onPlanned`
- Import busy uses `importGenRef` only; a loadable click during Import cannot skip `setBusy(false)`
- Existing loadable-vs-loadable last-wins, FILE-01 blob ingest, and PLAN-03 fallback copy are unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Failing last-wins tests for blocked, commit, and Import isolation** - `48d621e` (test)
2. **Task 2: Split clickGenRef and importGenRef; bump generation before setStatus** - `c793079` (feat)

**Plan metadata:** `f35677b` (docs: complete plan)

_Note: TDD RED → GREEN. No REFACTOR commit — implementation matched the plan with no cleanup needed._

## TDD Gate Compliance

- RED: `48d621e` `test(08-05): añadir tests last-wins que fallan para blocked, commit e Import` — three new tests failed against shared `tokenRef` (blocked/commit returned before `++token`; Import `finally` skipped `setBusy(false)`)
- GREEN: `c793079` `feat(08-05): separar clickGenRef e importGenRef para last-wins` — 28/28 UI tests pass; `tsc --noEmit` exits 0
- REFACTOR: skipped (no cleanup)

## Files Created/Modified

- `src/ui/RepoBrowser.test.tsx` - three last-wins cases: loadable-then-blocked README, loadable-then-commit mod.ts, file click during Import re-enables submit
- `src/ui/RepoBrowser.tsx` - replaced shared `tokenRef` with `clickGenRef` + `importGenRef`; `onFileClick` increments click generation first; `onImport` gates busy on import generation and invalidates in-flight clicks

## Decisions Made

- Split the 08-04 shared `tokenRef` into `clickGenRef` (status/`onPlanned` last-wins for every file click) and `importGenRef` (`setBusy` only). Sharing one counter was the busy leak.
- `onImport` also increments `clickGenRef` at start so a slower in-flight loadable cannot overwrite Import status or fire stale `onPlanned` (T-08-05-02).

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** None.

## Issues Encountered

None

## Authentication Gates

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 08 last-wins gap is closed; FILE-01/PLAN-03 concurrency truths for blocked, commit, and Import busy now have passing UI tests
- Ready for phase verification / next GSD step; Phase 9 still owns trainer chrome over `FilePlan`
- Remaining 08-VERIFICATION.md human backstops (CSP wasm compile, sourceRef shapes, live click-to-plan, flagged must-NOTs) are unchanged and out of this plan's scope

## Self-Check: PASSED

- FOUND: `src/ui/RepoBrowser.tsx`
- FOUND: `src/ui/RepoBrowser.test.tsx`
- FOUND: `48d621e` (RED)
- FOUND: `c793079` (GREEN)
- FOUND: grep `clickGenRef` / `importGenRef` in `src/ui/RepoBrowser.tsx`
- FOUND: `pnpm exec vitest run --project ui src/ui/RepoBrowser.test.tsx` exit 0 (28 passed)
- FOUND: `pnpm exec tsc --noEmit -p tsconfig.json` exit 0

---
*Phase: 08-parse-dependency-units*
*Completed: 2026-09-21*
