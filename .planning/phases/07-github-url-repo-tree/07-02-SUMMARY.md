---
phase: 07-github-url-repo-tree
plan: 02
subsystem: github
tags: [github, fetch, cors, cache, rate-limit]

requires:
  - phase: 07-github-url-repo-tree
    provides: RepoRef, RepoTreeResult, typed GitHub errors, PURE parse/fold
provides:
  - fetchRepoTree platform seam (GET /repos then recursive tree)
  - HTTP mapping to RepoNotFoundError, RateLimitedError, EmptyRepoError, GithubHttpError
  - In-flight coalescing and sha/defaultBranch cache via resetGithubCache
affects: [07-03 RepoBrowser UI]

tech-stack:
  added: []
  patterns:
    - client.ts is the only production fetch in src/
    - githubGet uses mode cors, credentials omit, Accept-only headers
    - In-flight Map by owner/repo plus cache by owner/repo@sha and owner/repo:defaultBranch

key-files:
  created:
    - src/github/client.ts
    - src/github/client.test.ts
  modified: []

key-decisions:
  - "githubGet concatenates https://api.github.com + encodeURIComponent path; never fetch the user-typed URL"
  - "HTTP 409 is mapped only after GET /repos so EmptyRepoError.defaultBranch is the API default_branch string"
  - "TypeError from fetch is not wrapped; UI maps unreachable copy"

patterns-established:
  - "Platform seam: src/github/client.ts is the only production fetch(, mirroring persistence/db.ts"
  - "resetGithubCache clears in-flight and result Maps so unit tests stay isolated"

requirements-completed: [REPO-01, REPO-04]

coverage:
  - id: D1
    description: "fetchRepoTree issues GET /repos/{owner}/{repo} then recursive git/trees with cors, credentials omit, and Accept-only headers"
    requirement: REPO-01
    verification:
      - kind: unit
        ref: "src/github/client.test.ts#issues repo then recursive tree GETs on a cold import"
        status: pass
      - kind: unit
        ref: "src/github/client.test.ts#encodes a slashed default branch in the tree URL"
        status: pass
      - kind: other
        ref: "rg fetch( src excluding tests — only src/github/client.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "HTTP 404/429/403-remaining-0/403-other/409/truncated-200 map to typed errors or RepoTreeResult.truncated"
    requirement: REPO-04
    verification:
      - kind: unit
        ref: "src/github/client.test.ts#maps 404 to RepoNotFoundError"
        status: pass
      - kind: unit
        ref: "src/github/client.test.ts#maps 403 with remaining 0 to RateLimitedError remaining 0"
        status: pass
      - kind: unit
        ref: "src/github/client.test.ts#maps 429 to RateLimitedError and stores resetEpochS seconds"
        status: pass
      - kind: unit
        ref: "src/github/client.test.ts#maps 403 with remaining 12 to GithubHttpError 403"
        status: pass
      - kind: unit
        ref: "src/github/client.test.ts#maps tree GET 409 to EmptyRepoError from the repo payload"
        status: pass
      - kind: unit
        ref: "src/github/client.test.ts#returns truncated true with the fixture tree[] on 200"
        status: pass
    human_judgment: false
  - id: D3
    description: "Second Import of the same owner/repo is a cache hit; overlapping cold calls share one in-flight pair (2 fetches, not 4)"
    requirement: REPO-01
    verification:
      - kind: unit
        ref: "src/github/client.test.ts#does not call fetch again on a second import of the same ref"
        status: pass
      - kind: unit
        ref: "src/github/client.test.ts#shares one in-flight pair for overlapping cold calls"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-09-20
status: complete
---

# Phase 7 Plan 02: fetchRepoTree GitHub Client Summary

**Unauthenticated cors fetchRepoTree with Accept-only headers, typed HTTP mapping, and in-flight/sha cache so a second Import does not double-spend the 60 req/h budget**

## Performance

- **Duration:** 4 min
- **Started:** 2026-09-20T22:08:35Z
- **Completed:** 2026-09-20T22:12:46Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `fetchRepoTree` is the GitHub platform seam: GET `https://api.github.com/repos/{owner}/{repo}` then GET `.../git/trees/{encodeURIComponent(default_branch)}?recursive=1`
- Every fetch uses `mode: 'cors'`, `credentials: 'omit'`, and headers exactly `{ Accept: 'application/vnd.github+json' }` — no auth, API-version, or User-Agent
- HTTP mapping: 404 → `RepoNotFoundError`; 429 or 403 + `x-ratelimit-remaining === '0'` → `RateLimitedError` (`resetEpochS` from `x-ratelimit-reset` seconds); other 403 → `GithubHttpError(403)`; tree 409 → `EmptyRepoError` with API `default_branch`; `truncated: true` stays on the result
- In-flight Promise keyed by `owner/repo`; success cache by `owner/repo@sha` plus `owner/repo:defaultBranch` → sha so a second Import issues zero new GETs; `resetGithubCache` clears both Maps

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: stubbed fetch contract for fetchRepoTree** - `98899b8` (test)
2. **Task 2 GREEN: client.ts seam, mapping, cache** - `cc28269` (feat)

**Plan metadata:** (this commit)

_Note: TDD plan produced RED then GREEN commits. No REFACTOR — implementation matched PATTERNS/RESEARCH._

## Files Created/Modified

- `src/github/client.ts` - Sole production `fetch(`; `fetchRepoTree` + `resetGithubCache`
- `src/github/client.test.ts` - `vi.stubGlobal('fetch')` fixtures; zero live `api.github.com`

## Decisions Made

- `githubGet` concatenates `https://api.github.com` + encoded path; it never fetches the user-typed string (T-07-02).
- HTTP 409 is mapped only after GET `/repos` so `EmptyRepoError.defaultBranch` is the API `default_branch` string — 07-03 captions from those three fields.
- `TypeError` from `fetch` is not wrapped; UI maps unreachable copy.

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

Ready for 07-03 (`RepoBrowser` UI). `fetchRepoTree` returns flat `RepoTreeResult.entries` for `foldTree`; typed errors are importable. Blob fetch is still out of scope.

## TDD Gate Compliance

RED then GREEN commits exist (`test(07-02)` `98899b8` then `feat(07-02)` `cc28269`). No REFACTOR commit (implementation matched PATTERNS/RESEARCH with no cleanup pass).

## Self-Check: PASSED

- FOUND: src/github/client.ts
- FOUND: src/github/client.test.ts
- FOUND: 98899b8, cc28269
- VERIFY: vitest unit client+url+tree 40/40 pass; production `fetch(` only in `src/github/client.ts`; `tsc --noEmit` exits 0

---
*Phase: 07-github-url-repo-tree*
*Completed: 2026-09-20*
