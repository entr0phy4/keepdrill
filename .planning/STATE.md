---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Katas desde GitHub
current_phase: 08
current_phase_name: parse-dependency-units
status: verifying
stopped_at: Completed 08-05-PLAN.md
last_updated: "2026-09-21T00:43:23.094Z"
last_activity: 2026-09-20
last_activity_desc: Phase 08 execution started
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 8
  completed_plans: 8
  percent: 67
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-20 after Phase 7)

**Core value:** The user can paste or upload a real code/text file, type it with keystroke capture, and see WPM, accuracy, and their five slowest keys — useful enough for a week of daily self-use.
**Current focus:** Phase 08 — parse-dependency-units

## Current Position

Phase: 08 (parse-dependency-units) — EXECUTING
Plan: 5 of 5
Status: All plans complete — ready for verification
Last activity: 2026-09-20 — Phase 08 execution started

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 18
- Average duration: ~13 min
- Total execution time: ~1.7 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | - | - |
| 02 | 3 | - | - |
| 03 | 2 | - | - |
| 04 | 2 | - | - |
| 05 | 2 | 11 min | ~5.5 min |
| 06 | 3 | 19 min | ~6 min |
| 07 | 3 | - | - |

**Recent Trend:**

- Last 5 plans: 15min, 5min, 12min, ~15min, ~20min
- Trend: Stable

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 07 P01 | 5 min | 3 tasks | 8 files |
| Phase 07 P02 | 4 min | 2 tasks | 2 files |
| Phase 07 P03 | 8 min | 2 tasks | 5 files |
| Phase 08 P01 | 4 min | 3 tasks | 8 files |
| Phase 08 P02 | 7 min | 3 tasks | 10 files |
| Phase 08 P03 | 8 min | 3 tasks | 5 files |
| Phase 08 P04 | 8 min | 3 tasks | 5 files |
| Phase 08 P05 | 3 min | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Click-to-type-whole-file is never the happy path; FILE-* lands in Phase 8 (plan units), typing chrome in Phase 9.
- Parser = tree-sitter WASM for TypeScript/JavaScript only.
- Scaffolded file: full text visible, only the current AST unit is typeable.
- GitHub listing is browse-only: TS/JS clicks use not-yet copy; no blob fetch yet.
- Phase 8 needs a wasm ABI pin spike (`web-tree-sitter` vs grammar versions).
- [Phase 08]: Pin web-tree-sitter@0.27.0 — Language.load of tree-sitter-typescript@0.23.2 typescript and tsx wasm succeeded in Node (abiVersion 14); 0.25.10 and tree-sitter-cli were not needed
- [Phase 08]: locateFile scriptName is web-tree-sitter.wasm; copy that basename to public/
- [Phase 08]: cli_rebuild false; do not install tree-sitter-javascript or tree-sitter-cli
- [Phase 08]: sourceRef for github is owner/repo:path (colon separator, no blob sha) — FILE-02 / RESEARCH A2; History must not show blob sha
- [Phase 08]: blob cache/inflight keyed by sha only; resetGithubCache clears tree and blob maps — content-addressed cache; overlapping clicks share one GET
- [Phase 08]: missing blob content on HTTP 200 throws GithubHttpError(422) — plan action: prefer 422 when content is absent on 200
- [Phase 08]: Unit ids are kind-start-seq so equal-start cycle members stay unique for dependsOn — Two function units can share start in a cycle leftover; kind-start alone would collide in the dependsOn graph
- [Phase 08]: Import units never emit dependsOn; specifiers are definitions (in-degree 0) — PLAN-02: imports are in-degree 0 so they come first; specifier names are defs not in-file uses
- [Phase 08]: plan.ts and utf16.ts stay PURE with zero WASM imports; 08-04 owns Parser.init — Success criterion: plan.ts and utf16.ts MUST NOT import the WASM runtime
- [Phase 08]: wasm.ts is the only WASM runtime importer; locateFile returns /${scriptName}
- [Phase 08]: Clicks share Import's tokenRef so last-wins holds across overlapping blob GETs
- [Phase 08]: App holds FilePlan in memory via onPlanned; plan.exercise is never passed to handleLoad
- [Phase 08]: Split shared tokenRef into clickGenRef (every file click) and importGenRef (Import busy only) — Sharing one counter let a loadable click skip onImport setBusy(false) and left blocked/commit clicks without a generation bump.
- [Phase 08]: onImport increments clickGenRef at start so a slower in-flight loadable cannot overwrite Import status or fire stale onPlanned — T-08-05-02: Import must invalidate in-flight file clicks without sharing the busy counter.

### Pending Todos

None yet.

### Blockers/Concerns

- ANLY-06..09 remain deferred (v2.0 is repo katas, not more analytics).
- COEP `require-corp` must stay; GitHub via cors `fetch`; `credentialless` only as escape hatch.

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-09-20:

| Category | Item | Status |
|----------|------|--------|
| verification | phase-05-missing-VERIFICATION.md | override_closeout |
| roadmap | phase-05-checkbox-unsealed | override_closeout |

## Session Continuity

Last session: 2026-09-21T00:42:33.818Z
Stopped at: Completed 08-05-PLAN.md
Resume file: None
