---
phase: 07-github-url-repo-tree
plan: 03
subsystem: ui
tags: [github, repo-browser, tabs, trainer, copy]

requires:
  - phase: 07-github-url-repo-tree
    provides: parseGithubRef, fetchRepoTree, foldTree, isLoadablePath, typed GitHub errors
provides:
  - Trainer-only Paste | GitHub tablist (hide-not-unmount, Paste default)
  - Browse-only RepoBrowser with locked COPY, disclosure tree, and reserved status region
  - Tree/tab CSS using existing tokens (no new colors)
affects: [08 blob/units, 09 typing chrome]

tech-stack:
  added: []
  patterns:
    - COPY const verbatim from UI-SPEC; typed errors map to locked strings
    - Last-wins Import token; previous tree stays until a new success
    - Corpus shell and tabpanels use display none, never hidden, never unmount

key-files:
  created:
    - src/ui/RepoBrowser.tsx
    - src/ui/RepoBrowser.test.tsx
  modified:
    - src/ui/App.tsx
    - src/ui/App.test.tsx
    - src/index.css

key-decisions:
  - "RepoBrowser has no onLoad this phase; file clicks only write the status region"
  - "Paste is the default corpus tab and is not persisted to localStorage"
  - "Rate-limit {time} uses toLocaleTimeString hour numeric minute 2-digit; missing reset uses the unknown-reset string"

patterns-established:
  - "GitHub panel is browse-only: blocked vs not-yet copy, no blob fetch, no handleLoad"
  - "Corpus source tablist lives inside a Trainer-only hide-not-unmount shell"

requirements-completed: [REPO-01, REPO-02, REPO-03, REPO-04]

coverage:
  - id: D1
    description: "RepoBrowser Import form, caption owner/repo@defaultBranch, nested details tree, and reserved status region"
    requirement: REPO-01
    verification:
      - kind: automated_ui
        ref: "src/ui/RepoBrowser.test.tsx#renders caption, open top-level folder, muted README, and full-color App.tsx on success"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every returned path is visible; folders expand via native details; nested folders omit open"
    requirement: REPO-02
    verification:
      - kind: automated_ui
        ref: "src/ui/RepoBrowser.test.tsx#renders caption, open top-level folder, muted README, and full-color App.tsx on success"
        status: pass
    human_judgment: false
  - id: D3
    description: "Non-loadable click shows blocked copy; TS/JS click shows distinct not-yet copy; neither loads an exercise"
    requirement: REPO-03
    verification:
      - kind: automated_ui
        ref: "src/ui/RepoBrowser.test.tsx#shows blocked copy on README.md click and not-yet copy on App.tsx click"
        status: pass
      - kind: automated_ui
        ref: "src/ui/RepoBrowser.test.tsx#shows blocked copy for .mjs, not the not-yet string"
        status: pass
    human_judgment: false
  - id: D4
    description: "404, rate-limit, truncated, empty-repo, invalid URL, other HTTP, and unreachable use locked copy and role split"
    requirement: REPO-04
    verification:
      - kind: automated_ui
        ref: "src/ui/RepoBrowser.test.tsx#keeps the previous tree on RepoNotFoundError and shows the 404 alert"
        status: pass
      - kind: automated_ui
        ref: "src/ui/RepoBrowser.test.tsx#uses the unknown-reset string when RateLimitedError has no resetEpochS"
        status: pass
      - kind: automated_ui
        ref: "src/ui/RepoBrowser.test.tsx#renders truncated listings plus the truncated notice"
        status: pass
    human_judgment: false
  - id: D5
    description: "Trainer Paste | GitHub tablist; Paste default; History/Analytics hide the corpus shell without unmounting"
    requirement: REPO-01
    verification:
      - kind: automated_ui
        ref: "src/ui/App.test.tsx#selects Paste on first paint and keeps #corpus-paste in the Paste tabpanel"
        status: pass
      - kind: automated_ui
        ref: "src/ui/App.test.tsx#does not persist the corpus tab in localStorage or cookies"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-09-20
status: complete
---

# Phase 7 Plan 03: Trainer Paste | GitHub and browse-only RepoBrowser Summary

**Trainer-only Paste | GitHub switch plus a browse-only RepoBrowser that imports a public listing, shows locked blocked/not-yet/404/rate-limit/truncated copy, and never starts a typing session from the tree**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-20T22:14:40Z
- **Completed:** 2026-09-20T22:22:53Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `RepoBrowser` ships the GitHub panel: labeled URL field, Import / Importing…, caption `{owner}/{repo}@{defaultBranch}`, nested `<details>` tree, and one reserved status region with locked 07-UI-SPEC copy
- File clicks are browse-only: `.ts`/`.tsx`/`.js`/`.jsx` get the not-yet sentence; everything else including `.mjs` gets the blocked sentence; no `onLoad`, no blob fetch, no `handleLoad`
- App wraps Paste and GitHub in a Trainer-only corpus shell (`display` none on History/Analytics). Paste is selected on first paint and is not persisted. Header stays Trainer / History / Analytics
- Tree/tab CSS reuses existing tokens: selected tabs match header nav (surface + weight, not accent); `.repo-tree` max-height 40vh; 32px row exemption; 48px status slot

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: RepoBrowser failing tests** - `7d98581` (test)
2. **Task 1 GREEN: RepoBrowser + CSS** - `274b719` (feat)
3. **Task 2 RED: Paste | GitHub shell failing tests** - `36fad0b` (test)
4. **Task 2 GREEN: corpus shell in App** - `8a62a2e` (feat)

**Plan metadata:** (this commit)

_Note: TDD tasks produced RED then GREEN commits._

## Files Created/Modified

- `src/ui/RepoBrowser.tsx` - Form, caption, disclosure tree, status; COPY verbatim from 07-UI-SPEC; no exercise-load prop
- `src/ui/RepoBrowser.test.tsx` - happy-dom; mocked `fetchRepoTree`; blocked vs not-yet; last-wins; empty-repo caption from `EmptyRepoError` fields
- `src/ui/App.tsx` - Trainer-only corpus shell + Paste | GitHub tablist; `CorpusInput onLoad={handleLoad}` unchanged; `<RepoBrowser />` with no extra props
- `src/ui/App.test.tsx` - tab default, hide-not-unmount of `#corpus-paste` and `#github-url`, no corpus-tab localStorage
- `src/index.css` - `.repo-tree`, `.repo-status`, `.repo-caption`, `[role=tab][aria-selected]` — zero new color tokens

## Decisions Made

- `RepoBrowser` has no `onLoad` this phase; file clicks only write the status region (T-07-10, D-05/D-06).
- Paste is the default corpus tab and is not persisted to localStorage (D-03, T-07-11).
- Rate-limit `{time}` uses `toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })` from `resetEpochS * 1000`; missing reset uses the unknown-reset string.

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** None.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Phase 8 (blob fetch + units). `RepoBrowser` is browse-only by design; wiring `onLoad` / blob fetch belongs in the next phase. Paste/upload `SourceType` union is unchanged. COEP `require-corp` was not edited.

## TDD Gate Compliance

RED then GREEN commits exist for both `tdd="true"` tasks (`test(07-03)` `7d98581` then `feat(07-03)` `274b719`; `test(07-03)` `36fad0b` then `feat(07-03)` `8a62a2e`). Plan frontmatter is `type: execute`; no REFACTOR commits (implementation matched PATTERNS/UI-SPEC with no cleanup pass).

## Self-Check: PASSED

- FOUND: src/ui/RepoBrowser.tsx
- FOUND: src/ui/RepoBrowser.test.tsx
- FOUND: src/ui/App.tsx
- FOUND: src/ui/App.test.tsx
- FOUND: src/index.css
- FOUND: 7d98581, 274b719, 36fad0b, 8a62a2e
- VERIFY: vitest ui App+RepoBrowser 28/28 pass; unit url+tree+client 40/40 pass; tsc --noEmit exits 0; COEP require-corp unchanged

---
*Phase: 07-github-url-repo-tree*
*Completed: 2026-09-20*

