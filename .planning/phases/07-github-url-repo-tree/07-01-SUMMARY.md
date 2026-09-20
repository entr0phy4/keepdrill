---
phase: 07-github-url-repo-tree
plan: 01
subsystem: github
tags: [github, url-parse, tree-fold, csp, typed-errors]

requires:
  - phase: 01-corpus-input-keystroke-capture
    provides: ingestion types/errors analog and PURE-header convention
provides:
  - RepoRef, GitTreeEntry, RepoTreeResult, TreeNode contracts
  - Typed GitHub errors including EmptyRepoError with defaultBranch
  - PURE parseGithubRef (D-09, D-10, scheme-less A1)
  - PURE foldTree and isLoadablePath (D-05, REPO-02)
  - CSP connect-src allowlist for https://api.github.com listing
affects: [07-02 GitHub client, 07-03 RepoBrowser UI]

tech-stack:
  added: []
  patterns:
    - PURE github helpers with zero fetch
    - Typed error classes next to the domain, not in ui/
    - Loadable-extension Set distinct from extToLang

key-files:
  created:
    - src/github/types.ts
    - src/github/errors.ts
    - src/github/url.ts
    - src/github/url.test.ts
    - src/github/tree.ts
    - src/github/tree.test.ts
  modified:
    - index.html
    - README.md

key-decisions:
  - "Scheme-less github.com/owner/repo is accepted by prefixing https:// (RESEARCH A1)"
  - "EmptyRepoError and RateLimitedError take object constructors so 07-02 can map HTTP 409/429 without guessing field order"
  - "isLoadablePath uses a dedicated LOADABLE Set; it does not import language-map or extToLang"

patterns-established:
  - "src/github/ is the GitHub platform seam; url.ts and tree.ts stay PURE"
  - "CSP connect-src is 'self' plus https://api.github.com only — no github.com, raw, or codeload"

requirements-completed: [REPO-01, REPO-02]

coverage:
  - id: D1
    description: "GitHub domain types and five typed error classes, including EmptyRepoError owner/repo/defaultBranch"
    requirement: REPO-01
    verification:
      - kind: other
        ref: "test -f src/github/types.ts && test -f src/github/errors.ts && grep InvalidGithubUrlError,RateLimitedError,defaultBranch src/github/errors.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "CSP connect-src allows 'self' and https://api.github.com; README Privacy names listing-only egress and local keystroke logs"
    requirement: REPO-01
    verification:
      - kind: other
        ref: "grep https://api.github.com index.html; README Privacy no longer claims zero outbound requests"
        status: pass
    human_judgment: false
  - id: D3
    description: "PURE parseGithubRef accepts D-09/A1 shapes and throws InvalidGithubUrlError on D-10 rejects with no network"
    requirement: REPO-01
    verification:
      - kind: unit
        ref: "src/github/url.test.ts#parseGithubRef — D-09 accept golden table"
        status: pass
      - kind: unit
        ref: "src/github/url.test.ts#parseGithubRef — D-10 reject golden table"
        status: pass
    human_judgment: false
  - id: D4
    description: "PURE foldTree walks every tree[] entry into nested nodes in first-seen order; isLoadablePath is .ts/.tsx/.js/.jsx only"
    requirement: REPO-02
    verification:
      - kind: unit
        ref: "src/github/tree.test.ts#foldTree — golden cases (REPO-02)"
        status: pass
      - kind: unit
        ref: "src/github/tree.test.ts#isLoadablePath — D-05 allowlist"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-09-20
status: complete
---

# Phase 7 Plan 01: GitHub Types, URL Parse, and Tree Fold Summary

**PURE GitHub URL parse and tree fold with typed errors and listing-only CSP for api.github.com**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-20T22:01:26Z
- **Completed:** 2026-09-20T22:06:15Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Named GitHub contracts (`RepoRef`, `GitTreeEntry`, `RepoTreeResult`, `DirNode`/`FileNode`/`TreeNode`) and five typed error classes; `EmptyRepoError` carries `owner`, `repo`, and `defaultBranch` for 07-03 captions
- CSP `connect-src` is `'self' https://api.github.com` only; README Privacy now states listing-only egress while keystroke logs stay local
- `parseGithubRef` golden-tested for D-09 (including scheme-less `github.com/owner/repo`) and D-10 rejects before any network exists
- `foldTree` folds GitHub `tree[]` into nested nodes in first-seen order (commit entries stay file leaves); `isLoadablePath` allowlist is `.ts` `.tsx` `.js` `.jsx`, not `extToLang`

## Task Commits

Each task was committed atomically:

1. **Task 1: CSP listing egress, README, types, and typed errors** - `0235e0f` (feat)
2. **Task 2 RED: parseGithubRef golden cases** - `593500f` (test)
3. **Task 2 GREEN: parseGithubRef** - `f508479` (feat)
4. **Task 3 RED: foldTree and isLoadablePath** - `043da63` (test)
5. **Task 3 GREEN: foldTree and isLoadablePath** - `901c3eb` (feat)

**Plan metadata:** `docs(07-01): complete GitHub types URL parse tree fold plan`

_Note: TDD tasks produced RED then GREEN commits._

## Files Created/Modified

- `src/github/types.ts` - Named GitHub types only; no runtime, no `sourceType`
- `src/github/errors.ts` - `InvalidGithubUrlError`, `RepoNotFoundError`, `EmptyRepoError`, `RateLimitedError`, `GithubHttpError`
- `src/github/url.ts` - PURE `parseGithubRef` (host allowlist, `.git` strip, extra path ignored)
- `src/github/url.test.ts` - D-09/D-10 golden `it.each` tables
- `src/github/tree.ts` - PURE `foldTree` + `isLoadablePath` Set allowlist
- `src/github/tree.test.ts` - Nested fixture, commit leaf, empty tree, first-seen order, D-05 cases
- `index.html` - CSP `connect-src` widened for `api.github.com`
- `README.md` - Privacy rewritten for listing-only GitHub egress

## Decisions Made

- Scheme-less `github.com/owner/repo` is accepted by prefixing `https://` (RESEARCH A1 locked this plan).
- `EmptyRepoError` and `RateLimitedError` take object constructors matching 07-RESEARCH mapping so 07-02 does not guess field order.
- `isLoadablePath` uses a dedicated `LOADABLE` Set; it does not import `language-map` (`.mjs` stays blocked).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Guarded parseGithubRef indexes for noUncheckedIndexedAccess**
- **Found during:** Task 2 (GREEN parseGithubRef)
- **Issue:** Project `tsconfig` enables `noUncheckedIndexedAccess`; RESEARCH snippet indexed regex groups and URL path parts directly
- **Fix:** Explicit undefined checks on nwo capture groups and pathname parts before returning `RepoRef`
- **Files modified:** `src/github/url.ts`
- **Verification:** `pnpm exec tsc --noEmit` exits 0; 16 url tests pass
- **Committed in:** `f508479` (Task 2 GREEN)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Type-safety only. Parse behavior matches D-09/D-10. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 07-02 (`fetchRepoTree` in `src/github/client.ts`). Types, errors, and PURE parse/fold are importable; CSP already allows listing. No fetch exists in `src/` yet — that is 07-02's platform seam.

## TDD Gate Compliance

RED then GREEN commits exist for both `tdd="true"` tasks (`test(07-01)` then `feat(07-01)` for URL parse and tree fold). Plan frontmatter is `type: execute`; no REFACTOR commits (implementation matched PATTERNS/RESEARCH with no cleanup pass).

## Self-Check: PASSED

- FOUND: src/github/types.ts
- FOUND: src/github/errors.ts
- FOUND: src/github/url.ts
- FOUND: src/github/url.test.ts
- FOUND: src/github/tree.ts
- FOUND: src/github/tree.test.ts
- FOUND: index.html
- FOUND: README.md
- FOUND: 0235e0f, 593500f, f508479, 043da63, 901c3eb
- VERIFY: vitest unit url+tree 30/30 pass; CSP and README greps pass

---
*Phase: 07-github-url-repo-tree*
*Completed: 2026-09-20*
