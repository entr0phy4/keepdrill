---
phase: 08-parse-dependency-units
plan: 02
subsystem: ingestion
tags: [github, blob, fetch, utf-8, history, sourceType]

requires:
  - phase: 07-github-url-repo-tree
    provides: githubGet cors/omit Accept-only fetch seam, foldTree, FileNode, HistoryView upload/paste labels
  - phase: 01-paste-type-capture
    provides: MAX_BYTES, fromFile UTF-8/BOM/U+FFFD/normalize, CorpusTooLargeError, NonUtf8Error
provides:
  - fetchGithubBlob with sha cache/inflight and MAX_BYTES gates before and after atob
  - fromGithubBlob Exercise tagged github with sourceRef owner/repo:path
  - FileNode.size copied from GitTreeEntry.size
  - HistoryView three-way sourceLabel (upload, github, paste)
affects: [08-04 RepoBrowser click, 09 persist github sessions]

tech-stack:
  added: []
  patterns:
    - client.ts remains the only fetch; blob GET reuses githubGet/enc/readGithub
    - Blob cache and inflight keyed by sha only; resetGithubCache clears tree and blob maps
    - GitHub corpus reuses upload MAX_BYTES / BOM / TextDecoder / U+FFFD / normalize

key-files:
  created:
    - src/ingestion/github.ts
    - src/ingestion/github.test.ts
  modified:
    - src/github/types.ts
    - src/github/tree.ts
    - src/github/tree.test.ts
    - src/github/client.ts
    - src/github/client.test.ts
    - src/ingestion/types.ts
    - src/ui/HistoryView.tsx
    - src/ui/HistoryView.test.tsx

key-decisions:
  - "sourceRef for github is owner/repo:path (colon separator, no blob sha)"
  - "blob cache/inflight keyed by sha only; resetGithubCache clears tree and blob maps"
  - "missing blob content on HTTP 200 throws GithubHttpError(422)"

patterns-established:
  - "Size gate JSON size ?? 0 then decoded byteLength vs MAX_BYTES 100000; throw CorpusTooLargeError before atob when JSON size exceeds"
  - "History sourceLabel is three-way: upload → sourceRef ?? Uploaded file; github → sourceRef ?? GitHub file; else Pasted snippet"

requirements-completed: [FILE-01, FILE-02]

coverage:
  - id: D1
    description: "FileNode.size is copied from GitTreeEntry.size through foldTree so the UI can refuse oversize before GET"
    requirement: FILE-01
    verification:
      - kind: unit
        ref: "src/github/tree.test.ts#nested src + App.tsx + sibling README.md"
        status: pass
      - kind: unit
        ref: "src/github/tree.test.ts#omits size when GitTreeEntry has no size"
        status: pass
    human_judgment: false
  - id: D2
    description: "fetchGithubBlob GETs /git/blobs/{sha} with the same Accept/cors/omit headers, caches by sha, and gates 100000 bytes before atob"
    requirement: FILE-01
    verification:
      - kind: unit
        ref: "src/github/client.test.ts#fetchGithubBlob"
        status: pass
    human_judgment: false
  - id: D3
    description: "fromGithubBlob applies upload corpus rules (MAX_BYTES, BOM, U+FFFD, normalize) and tags sourceType github with owner/repo:path"
    requirement: FILE-01
    verification:
      - kind: unit
        ref: "src/ingestion/github.test.ts#fromGithubBlob"
        status: pass
    human_judgment: false
  - id: D4
    description: "HistoryView shows sourceRef for github rows and does not label them Pasted snippet"
    requirement: FILE-02
    verification:
      - kind: unit
        ref: "src/ui/HistoryView.test.tsx#shows sourceRef for a github row and does not show Pasted snippet"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-09-20
status: complete
---

# Phase 8 Plan 2: GitHub Blob Fetch & Corpus Tag Summary

**Git blob GET through the existing client, upload UTF-8/100 KB rules as `fromGithubBlob`, `sourceType: github` with `owner/repo:path`, and a History label that is not Pasted snippet**

## Performance

- **Duration:** 7 min
- **Started:** 2026-09-20T23:26:46Z
- **Completed:** 2026-09-20T23:33:21Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- `foldTree` copies `GitTreeEntry.size` onto `FileNode.size` so the UI can refuse oversize before a blob GET
- `fetchGithubBlob` GETs `/repos/{owner}/{repo}/git/blobs/{sha}` with the same Accept/cors/omit headers as tree listing; sha cache + inflight; `MAX_BYTES` before `atob` and again on `byteLength`
- `fromGithubBlob` reuses `MAX_BYTES`, UTF-16 BOM sniff, `TextDecoder('utf-8')`, U+FFFD scan, and `normalize`; tags `sourceType: 'github'` and `sourceRef: owner/repo:path`
- History shows github `sourceRef` and does not call those rows Pasted snippet; Dexie `version(1)` is unchanged

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1: FileNode.size through foldTree**
   - `bbf4521` (test) add failing FileNode.size goldens
   - `58b63f3` (feat) copy size through foldTree
2. **Task 2: fetchGithubBlob cache, size gate, base64**
   - `8306cf6` (test) add failing blob fetch tests
   - `e9589c6` (feat) implement fetchGithubBlob
3. **Task 3: fromGithubBlob, SourceType github, History label**
   - `8ab3f49` (test) add failing fromGithubBlob and History github tests
   - `2718165` (feat) implement fromGithubBlob and History three-way label

**Plan metadata:** pending docs commit

_Note: TDD tasks produced two commits each (test → feat)._

## Files Created/Modified

- `src/github/types.ts` — optional `FileNode.size`; file-lead no longer claims SourceType lives here
- `src/github/tree.ts` — `foldTree` copies `entry.size`
- `src/github/tree.test.ts` — goldens include size 120 / 50; omitted-size case
- `src/github/client.ts` — `fetchGithubBlob`, blob cache/inflight, `resetGithubCache` clears both
- `src/github/client.test.ts` — stubbed blob GET, wrap, cap, cache, 404/429/422
- `src/ingestion/types.ts` — `SourceType` includes `github`; `sourceRef` documents `owner/repo:path`
- `src/ingestion/github.ts` — sync `fromGithubBlob`
- `src/ingestion/github.test.ts` — cap, 100000 boundary, BOM, U+FFFD, sourceRef, normalize parity, empty
- `src/ui/HistoryView.tsx` — three-way `sourceLabel`
- `src/ui/HistoryView.test.tsx` — github row asserts `o/r:src/App.tsx` and not Pasted snippet

## Decisions Made

- `sourceRef` for github is `owner/repo:path` (colon separator, no blob sha) — FILE-02 / RESEARCH A2
- Blob cache and inflight are keyed by sha only (content-addressed); `resetGithubCache` clears tree maps and blob maps
- Missing `content` on HTTP 200 throws `GithubHttpError(422)` rather than inventing a decode error

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

- Click-ready blob bytes exist behind `fetchGithubBlob`; 08-04 can fetch on TS/JS click without a second fetch module
- `fromGithubBlob` is the corpus seam; 08-03 can parse those bytes / that Exercise without network I/O
- History can name github sessions; Phase 9 persist is not blocked on the label
- Trainer is not started in this plan (intentional)

## TDD Gate Compliance

Each task followed RED (`test(08-02): …`) then GREEN (`feat(08-02): …`). Plan frontmatter is `type: execute` with per-task `tdd="true"`; both gates present for all three tasks. No REFACTOR commits (implementation stayed minimal).

## Verification

- `pnpm exec vitest run --project unit src/github/client.test.ts src/github/tree.test.ts src/ingestion/github.test.ts` — 46 passed
- `pnpm exec vitest run --project ui src/ui/HistoryView.test.tsx` — 7 passed
- `src/github/client.ts` is the only `src/` production file with `fetch(`
- `client.ts` has no `Authorization` header
- `src/persistence/db.ts` still `this.version(1).stores({ sessions: '++id, startedAt' })`

## Self-Check: PASSED

- Created files exist: `src/ingestion/github.ts`, `src/ingestion/github.test.ts`
- Modified files exist on disk
- Commits `bbf4521`, `58b63f3`, `8306cf6`, `e9589c6`, `8ab3f49`, `2718165` present in `git log`

---
*Phase: 08-parse-dependency-units*
*Completed: 2026-09-20*
