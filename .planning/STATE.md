---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Katas desde GitHub
current_phase: 07
current_phase_name: github-url-repo-tree
status: verifying
stopped_at: Awaiting human UAT for Phase 7
last_updated: "2026-09-20T22:35:00.000Z"
last_activity: 2026-09-20
last_activity_desc: Phase 07 automated verification passed — 6 UAT items pending
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-20 after starting milestone v2.0)

**Core value:** The user can paste or upload a real code/text file, type it with keystroke capture, and see WPM, accuracy, and their five slowest keys — useful enough for a week of daily self-use.
**Current focus:** Phase 07 — github-url-repo-tree

## Current Position

Phase: 07 (github-url-repo-tree) — VERIFYING
Plan: 3 of 3
Status: Automated checks passed — human UAT pending
Last activity: 2026-09-20 — 6 UAT items in 07-UAT.md

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 13
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

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v2.0 corpus source = public GitHub API (URL → tree → blob), not Tauri and not generic git clone.
- Scaffolded file: full text visible, only the current AST unit is typeable.
- Parser = tree-sitter WASM for TypeScript/JavaScript only.
- Click-to-type-whole-file is never the happy path; FILE-* lands in Phase 8 (plan units), typing chrome in Phase 9.
- [Phase 07]: Scheme-less github.com/owner/repo is accepted by prefixing https:// (RESEARCH A1) — Locked this plan so 07-02 callers can pass scheme-less paste without a second parser.
- [Phase 07]: EmptyRepoError and RateLimitedError take object constructors so 07-02 can map HTTP 409/429 without guessing field order — Matches 07-RESEARCH mapping used by fetchRepoTree.
- [Phase 07]: isLoadablePath uses a dedicated LOADABLE Set; it does not import language-map or extToLang — .mjs stays blocked (D-05) even though extToLang maps it to javascript.
- [Phase 07]: githubGet concatenates https://api.github.com + encoded path; never fetch the user-typed URL — T-07-02: construct origin + encodeURIComponent only
- [Phase 07]: HTTP 409 is mapped only after GET /repos so EmptyRepoError.defaultBranch is the API default_branch string — 07-03 captions owner/repo@defaultBranch from those three fields
- [Phase 07]: TypeError from fetch is not wrapped; UI maps unreachable copy — Matches RESEARCH: do not wrap network TypeError in github errors
- [Phase 07]: RepoBrowser has no onLoad this phase; file clicks only write the status region
- [Phase 07]: Paste is the default corpus tab and is not persisted to localStorage
- [Phase 07]: Rate-limit {time} uses toLocaleTimeString hour numeric minute 2-digit; missing reset uses the unknown-reset string

### Pending Todos

None yet.

### Blockers/Concerns

- ANLY-06..09 remain deferred (v2.0 is repo katas, not more analytics).
- Phase 8 needs a wasm ABI pin spike (`web-tree-sitter` vs grammar versions).
- COEP `require-corp` must stay; GitHub via cors `fetch`; `credentialless` only as escape hatch.

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-09-20:

| Category | Item | Status |
|----------|------|--------|
| verification | phase-05-missing-VERIFICATION.md | override_closeout |
| roadmap | phase-05-checkbox-unsealed | override_closeout |

## Session Continuity

Last session: 2026-09-20T22:23:42.959Z
Stopped at: Completed 07-03-PLAN.md
Resume file: None
