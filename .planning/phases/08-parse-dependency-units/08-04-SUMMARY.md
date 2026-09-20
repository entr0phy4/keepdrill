---
phase: 08-parse-dependency-units
plan: 04
subsystem: parse
tags: [wasm, web-tree-sitter, RepoBrowser, FilePlan, onPlanned, FILE-01, PLAN-03]

requires:
  - phase: 08-parse-dependency-units
    provides: web-tree-sitter@0.27.0 + public wasm assets + CSP wasm-unsafe-eval (08-01)
  - phase: 08-parse-dependency-units
    provides: fetchGithubBlob, fromGithubBlob, FileNode.size, github sourceType (08-02)
  - phase: 08-parse-dependency-units
    provides: PURE planUnits / fallbackPlan over TsNode (08-03)
provides:
  - wasm.ts sole web-tree-sitter import with locateFile /${scriptName}
  - RepoBrowser onPlanned(FilePlan) from loadable TS/JS clicks
  - App filePlan state held idle; CaptureSurface still paste/upload only
  - PLAN-03 fallback notice distinct from blocked copy; last-wins click token
affects: [09 scaffolded trainer chrome consuming FilePlan]

tech-stack:
  added: []
  patterns:
    - wasm.ts is the only importer of web-tree-sitter; plan.ts stays PURE
    - UI tests hoist-mock fetchGithubBlob and parseSource; never Language.load in happy-dom
    - FilePlan is held in App via onPlanned; handleLoad stays paste/upload

key-files:
  created:
    - src/parse/wasm.ts
  modified:
    - src/ui/RepoBrowser.tsx
    - src/ui/RepoBrowser.test.tsx
    - src/ui/App.tsx
    - src/ui/App.test.tsx

key-decisions:
  - "wasm.ts is the only WASM runtime importer; locateFile returns /${scriptName}"
  - "Clicks share Import's tokenRef so last-wins holds across overlapping blob GETs"
  - "App holds FilePlan in memory via onPlanned; plan.exercise is never passed to handleLoad"

patterns-established:
  - "Platform seam header on wasm.ts matching db.ts / client.ts"
  - "Loadable click: size gate → fetchGithubBlob → fromGithubBlob → ensureParser/parseSource/planUnits → onPlanned"
  - "Parse throw or plan.fallback → fallbackPlan with COPY.fallback; always onPlanned when the token matches"
  - "Blocked / commit / .mjs still COPY.blocked and never fetch"

requirements-completed: [FILE-01, FILE-02, PLAN-01, PLAN-02, PLAN-03]

coverage:
  - id: D1
    description: "wasm.ts exports ensureParser, loadDialect, parseSource, dialectForPath; locateFile is /${scriptName}; plan.ts has zero WASM imports"
    requirement: FILE-01
    verification:
      - kind: other
        ref: "grep ensureParser, locateFile, tree-sitter-tsx.wasm, from 'web-tree-sitter' in src/parse/wasm.ts; absent from plan.ts; no wasm.test.ts; tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D2
    description: "Loadable .ts/.tsx click fetches blob, plans units, calls onPlanned with fallback false, and does not mount CaptureSurface"
    requirement: FILE-01
    verification:
      - kind: automated_ui
        ref: "src/ui/RepoBrowser.test.tsx#plans App.tsx via blob → corpus → parse, calls onPlanned, and does not mount CaptureSurface"
        status: pass
      - kind: other
        ref: "grep handleLoad src/ui/RepoBrowser.tsx returns no matches"
        status: pass
    human_judgment: false
  - id: D3
    description: "parseSource reject still onPlanned with fallback true, one file unit, and a fallback sentence distinct from blocked copy"
    requirement: PLAN-03
    verification:
      - kind: automated_ui
        ref: "src/ui/RepoBrowser.test.tsx#calls onPlanned with fallback and distinct notice when parseSource rejects"
        status: pass
    human_judgment: false
  - id: D4
    description: "Last-wins overlapping clicks, 100001-byte pre-GET skip, blob 404 blobMissing, commit/.mjs/README blocked without fetch"
    requirement: FILE-01
    verification:
      - kind: automated_ui
        ref: "src/ui/RepoBrowser.test.tsx#last-wins overlapping clicks: slow first sha cannot overwrite the second"
        status: pass
      - kind: automated_ui
        ref: "src/ui/RepoBrowser.test.tsx#refuses a 100001-byte node with the too-large alert and skips the blob GET"
        status: pass
      - kind: automated_ui
        ref: "src/ui/RepoBrowser.test.tsx#maps blob 404 RepoNotFoundError to blobMissing alert"
        status: pass
      - kind: automated_ui
        ref: "src/ui/RepoBrowser.test.tsx#blocks commit entries even when the path looks loadable"
        status: pass
    human_judgment: false
  - id: D5
    description: "App holds FilePlan via onPlanned without starting the trainer; paste Load exercise still mounts CaptureSurface; empty-state still paste/upload"
    requirement: FILE-01
    verification:
      - kind: automated_ui
        ref: "src/ui/App.test.tsx#holds onPlanned FilePlan in memory without starting the trainer"
        status: pass
      - kind: automated_ui
        ref: "src/ui/App.test.tsx#does not mount #capture-surface when switching to GitHub"
        status: pass
      - kind: automated_ui
        ref: "src/ui/App.test.tsx#renders the results panel synchronously and writes one row readable via listNewestFirst"
        status: pass
      - kind: other
        ref: "git diff empty for src/capture/capture.ts"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-09-20
status: complete
---

# Phase 8 Plan 4: Click-to-plan WASM Seam Summary

**TS/JS tree clicks fetch the blob, parse through `wasm.ts`, `planUnits` into App `filePlan`, and never mount CaptureSurface — parse failure still `onPlanned` with a distinct fallback notice**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-20T23:50:40Z
- **Completed:** 2026-09-20T23:58:10Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `src/parse/wasm.ts` is the only `web-tree-sitter` importer: `Parser.init({ locateFile: (scriptName) => \`/${scriptName}\` })`, Map-cached typescript/tsx grammars, `.tsx`/`.jsx` → tsx dialect
- Loadable blob clicks run `fetchGithubBlob` → `fromGithubBlob` (github `sourceType` + `owner/repo:path`) → `planUnits` → `onPlanned`; status `Planned N unit(s) from {path}`
- Parse/`Language.load` throw or empty cover still `onPlanned` with `fallback: true` and `Couldn't split {path}. You'll type the whole file as one unit.` — not the blocked sentence
- App holds `FilePlan | null` via `onPlanned={setFilePlan}`; `CorpusInput onLoad={handleLoad}` is unchanged; empty-state still says paste/upload Load exercise

## Task Commits

Each task was committed atomically:

1. **Task 1: wasm.ts platform seam** - `8d9c882` (feat)
2. **Task 2 RED: RepoBrowser click plans units** - `9d5bd00` (test)
3. **Task 2 GREEN: RepoBrowser click plans units** - `2fd9a0b` (feat)
4. **Task 3 RED: App holds FilePlan** - `6c27af6` (test)
5. **Task 3 GREEN: App holds FilePlan** - `19c67bf` (feat)

**Plan metadata:** this docs commit

_Note: TDD tasks have RED then GREEN commits._

## Files Created/Modified

- `src/parse/wasm.ts` - Sole WASM runtime seam (`ensureParser`, `loadDialect`, `parseSource`, `dialectForPath`)
- `src/ui/RepoBrowser.tsx` - Optional `onPlanned`, last-wins loadable clicks, COPY loading/planned/fallback/errTooLarge/errNonUtf8/blobMissing
- `src/ui/RepoBrowser.test.tsx` - Hoist-mocked blob/wasm click planner cases
- `src/ui/App.tsx` - `useState<FilePlan | null>` wired to `RepoBrowser onPlanned`
- `src/ui/App.test.tsx` - onPlanned hold-without-trainer; GitHub tab does not mount `#capture-surface`

## Decisions Made

- `locateFile` returns a root-absolute `/${scriptName}` so Vite serves `public/web-tree-sitter.wasm` (08-ABI-PIN)
- File clicks reuse the Import monotonic `tokenRef`; a slower first sha cannot overwrite a faster second click's status or `onPlanned`
- `FilePlan` is held idle in App this phase; `plan.exercise` is never passed into `handleLoad`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] clickTreeFile return type vs happy-dom Element**
- **Found during:** Task 3 (`tsc --noEmit` in plan verification)
- **Issue:** `querySelectorAll('.repo-tree button')` is typed as `Element`, not `HTMLButtonElement`
- **Fix:** `clickTreeFile` returns `Promise<void>` (callers never used the button)
- **Files modified:** `src/ui/RepoBrowser.test.tsx`
- **Verification:** `tsc --noEmit -p tsconfig.json` exits 0
- **Committed in:** `19c67bf` (Task 3 GREEN)

**2. [Rule 3 - Blocking] unused `filePlan` under `noUnusedLocals`**
- **Found during:** Task 3
- **Issue:** Holding `FilePlan` in `useState` without a reader would fail `tsc` (`noUnusedLocals`)
- **Fix:** `data-file-plan="true"` on `#corpus-panel-github` when a plan is held — not a hero replacement, not trainer input
- **Files modified:** `src/ui/App.tsx`, `src/ui/App.test.tsx`
- **Verification:** App test asserts the attribute and `#capture-surface` stays null
- **Committed in:** `6c27af6` / `19c67bf`

---

**Total deviations:** 2 auto-fixed (2 blocking type/tsc)
**Impact on plan:** Both required for `tsc --noEmit`. No scope creep; trainer still idle.

## Issues Encountered

None beyond the tsc locals/return-type fixes above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 9 can consume `filePlan` from App to render scaffolded units without teaching paste/upload `handleLoad`
- `wasm.ts` init is main-thread; Worker parse remains out of scope
- Capture/trainer chrome (`capture.ts`) is unmodified

## TDD Gate Compliance

- Task 2: RED `9d5bd00` then GREEN `2fd9a0b`
- Task 3: RED `6c27af6` then GREEN `19c67bf`
- Task 1 was `type="auto"` (no vitest file that calls `Language.load`, per plan)

## Self-Check: PASSED

- FOUND: `src/parse/wasm.ts`
- FOUND: `src/ui/RepoBrowser.tsx`
- FOUND: `src/ui/RepoBrowser.test.tsx`
- FOUND: `src/ui/App.tsx`
- FOUND: `src/ui/App.test.tsx`
- FOUND: `8d9c882`
- FOUND: `9d5bd00`
- FOUND: `2fd9a0b`
- FOUND: `6c27af6`
- FOUND: `19c67bf`

---
*Phase: 08-parse-dependency-units*
*Completed: 2026-09-20*
