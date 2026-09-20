---
phase: 07-github-url-repo-tree
verified: 2026-09-20T22:32:00Z
status: passed
score: 46/47 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "REPO-01 unclassified URL/listing edge not covered by D-09/D-10/D-11 (backstop / insufficient_spec)"
    expected: "No extra taxonomy appears; unexpected shapes either parse+list like the happy path or fail as InvalidGithubUrlError before network"
    why_human: "Plan tagged this truth verification: backstop. Golden tables cover locked shapes only; a held-out URL is not inferable from the spec"
  - test: "pnpm dev in Chromium — Trainer Paste selected; switch to GitHub; import a small public owner/repo"
    expected: "Caption owner/repo@default_branch; top-level folders open; nested closed; expand/collapse works; non-TS/JS shows blocked sentence; TS/JS shows not-yet; trainer still says No exercise loaded"
    why_human: "Live api.github.com, real tree size, and visual folder state are outside happy-dom fixtures"
  - test: "Paste a gist or GitLab URL and Import; watch the network tab"
    expected: "Alert 'Paste a GitHub URL or owner/repo.'; no api.github.com request"
    why_human: "Unit tests stub fetch; only a live Network panel proves parse rejects before egress"
  - test: "After a successful GitHub import, switch History then Analytics, then back to Trainer"
    expected: "URL field and tree are not visible on History/Analytics; returning to Trainer keeps GitHub tree and Paste text"
    why_human: "happy-dom proves mount + paste persistence; visual hide and GitHub field/tree restore need a real layout engine"
  - test: "curl -sI against pnpm preview for COOP/COEP; in the running app check crossOriginIsolated"
    expected: "Cross-Origin-Opener-Policy: same-origin; Cross-Origin-Embedder-Policy: require-corp; crossOriginIsolated === true. If GitHub listing is blocked, COEP credentialless only — never drop isolation"
    why_human: "Isolation and live GitHub CORS/COEP interaction are runtime/browser properties"
  - test: "Review flagged must-NOTs in the running app (unverified-prohibition — human review recommended)"
    expected: "No typing session from Import or tree click; one 404 string for private and missing; blocked ≠ not-yet; no Phase 8/parser/WASM jargon; no GitHub JSON/IP/stack as copy; no localStorage of last URL or tab"
    why_human: "Prohibitions are verification: flagged. Automated tests cover most of these; judgment-tier must-NOTs still need a human pass"
---

# Phase 7: GitHub URL & Repo Tree Verification Report

**Phase Goal:** The user can import a public GitHub repository by URL and browse it as a filesystem tree, with honest blocked-file and error copy — without starting a typing session from the tree.
**Verified:** 2026-09-20T22:32:00Z
**Status:** passed
**Re-verification:** No — initial verification

Automated must-haves are present, wired, and exercised by passing unit/UI tests (68/68 in the phase files). Status is `human_needed` because (1) a `verification: backstop` REPO-01 truth has no held-out evidence, (2) 07-03 harvested live Chromium / COEP checks, and (3) flagged must-NOT prohibitions require a human pass. No implementation gaps.

## Goal Achievement

### Observable Truths

Roadmap success criteria are the contract. Plan-only truths are listed after; wording that restated an SC was folded into that SC.

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | User can paste a public GitHub URL or `owner/repo` and see the repository as a filesystem tree of the default branch | ✓ VERIFIED | `parseGithubRef` + `fetchRepoTree` + `foldTree` wired in `RepoBrowser.onImport`. UI test renders `o/r@main` and nested details from fixture entries |
| 2 | User can expand and collapse folders and see every file path GitHub returns (not only TS/JS) | ✓ VERIFIED | Native `<details>` for every dir; README.md and `index.mjs` rendered; nested `src/nested` present; `foldTree` keeps commit leaves |
| 3 | Non-`.ts`/`.tsx`/`.js`/`.jsx` click shows cannot-split-yet notice and no exercise loads | ✓ VERIFIED | README.md / `.mjs` → `COPY.blocked`; `RepoBrowser` has no `onLoad`; App mounts `<RepoBrowser />` with no exercise-load prop |
| 4 | Specific non-generic copy for missing (404), rate-limit, and truncated tree | ✓ VERIFIED | Locked UI-SPEC strings; tests for `RepoNotFoundError`, `RateLimitedError` ± `resetEpochS`, and `truncated: true` plus arrived names |
| 5 | Selecting a TypeScript or JavaScript file does not load a whole-file typing session | ✓ VERIFIED | App.tsx click → `COPY.notYet` only; no blob fetch; `handleLoad` stays on `CorpusInput` only |
| 6 | `parseGithubRef` accepts owner/repo, https, www, `.git`, trailing slash, extra path (D-09) | ✓ VERIFIED | `url.test.ts` D-09 golden table (9 cases) passed |
| 7 | Scheme-less `github.com/owner/repo` accepted by prefixing `https://` | ✓ VERIFIED | Same table includes `github.com/owner/repo`; `url.ts` prefixes when `://` is missing |
| 8 | gist, GitLab, raw, other hosts, missing owner/repo, whitespace throw `InvalidGithubUrlError` with no network | ✓ VERIFIED | D-10 table + RepoBrowser test asserts `fetchRepoTree` not called |
| 9 | `foldTree` walks every entry: tree → dir; blob/commit → leaves; shared prefix is parent/child | ✓ VERIFIED | Golden cases 1–3 in `tree.test.ts` |
| 10 | `foldTree([])` is `[]`; single root blob is one file node | ✓ VERIFIED | Cases 4–5 |
| 11 | Sibling order is first-seen, not locale sort | ✓ VERIFIED | Case 6 (`z.txt` then `a.txt`) |
| 12 | `isLoadablePath` true only for `.ts` `.tsx` `.js` `.jsx` (incl. `.d.ts`); `.mjs` `.cjs` `.mts` `.cts` and dotfiles false | ✓ VERIFIED | Dedicated `LOADABLE` Set; tests for `.tsx` `.d.ts` `.mjs` `.cjs` `.gitignore`. `.js`/`.jsx`/`.mts`/`.cts` follow the same Set (no `extToLang`) |
| 13 | `EmptyRepoError` carries `owner`, `repo`, `defaultBranch` | ✓ VERIFIED | Constructor + client 409 test + UI caption `acme/empty@develop` |
| 14 | `index.html` `connect-src` is `'self'` and `https://api.github.com` only | ✓ VERIFIED | CSP meta line; no github.com / raw / codeload |
| 15 | REPO-01 unclassified specless edge (no extra taxonomy beyond D-09/D-10/D-11) | ⚠️ insufficient_spec | `verification: backstop`. Happy-path parse+list is tested; unclassified extra shapes have no held-out test — see Human Verification |
| 16 | `fetchRepoTree` GET `/repos/{owner}/{repo}` then recursive `git/trees/{default_branch}` | ✓ VERIFIED | Cold-import test: two URLs, `recursive=1` |
| 17 | Every fetch uses `mode: cors`, `credentials: omit`, headers exactly `{ Accept: application/vnd.github+json }` | ✓ VERIFIED | `assertListingFetch` on both calls |
| 18 | HTTP 404 → `RepoNotFoundError` (private and missing share one class) | ✓ VERIFIED | client test + single `COPY.notFound` |
| 19 | HTTP 429 or 403 + remaining `0` → `RateLimitedError` | ✓ VERIFIED | Both mapping tests |
| 20 | HTTP 403 with remaining ≠ `0` → `GithubHttpError(403)` | ✓ VERIFIED | remaining `'12'` test |
| 21 | Tree GET 409 → `EmptyRepoError` from `/repos` `default_branch`; no `RepoTreeResult` | ✓ VERIFIED | 409 mapping test |
| 22 | HTTP 200 `truncated: true` returns result + tree[], does not throw | ✓ VERIFIED | client truncated test |
| 23 | Second `fetchRepoTree` for same owner/repo issues no additional fetch | ✓ VERIFIED | 2 calls total, not 4 |
| 24 | Concurrent same-ref calls share one in-flight Promise | ✓ VERIFIED | overlapping `Promise.all` still 2 fetches |
| 25 | `resetEpochS` is `Number(x-ratelimit-reset)` seconds; missing header → undefined | ✓ VERIFIED | 429 stores `1700000000`; 403-remaining-0 leaves undefined |
| 26 | `src/github/client.ts` is the only production `fetch(` in `src/` | ✓ VERIFIED | ripgrep `fetch(` under `src/**/*.{ts,tsx}` hits only `client.ts` |
| 27 | Trainer Paste \| GitHub tablist; Paste selected on first paint; one panel visible | ✓ VERIFIED | App first-paint test: Paste `aria-selected=true`, GitHub panel `display:none` |
| 28 | Corpus shell uses `display: none` on History/Analytics and stays mounted | ✓ VERIFIED | `#corpus-paste` and `#github-url` remain in document; shell parent `display:none` |
| 29 | Switching tabs does not clear paste text, GitHub field, caption, tree, or status | ✓ VERIFIED | Paste text kept across tabs; `RepoBrowser` stays mounted (same instance, no unmount) |
| 30 | Invalid URL / 404 / rate-limit / other HTTP / unreachable use `role=alert` + destructive; blocked / not-yet / truncated / empty-repo use `role=status` + muted | ✓ VERIFIED | Role assertions in RepoBrowser tests; CSS class + `--color-destructive` on alerts |
| 31 | First successful import opens only top-level details | ✓ VERIFIED | `open={depth === 0 ? true : undefined}`; `src` open, `nested` no `open` |
| 32 | Empty GitHub panel is labeled URL field + Import — no extra empty-state paragraph | ✓ VERIFIED | No getting-started copy; label `GitHub URL or owner/repo` |
| 33 | While Importing… submit is disabled, URL stays enabled, no spinner | ✓ VERIFIED | Busy test: `Importing…`, `disabled`, input enabled, `aria-busy` |
| 34 | Named error copy; previous tree stays; `aria-invalid` only for invalid-URL copy | ✓ VERIFIED | Invalid-URL sets `aria-invalid`; 404 keeps `o/r@main` + App.tsx |
| 35 | URL field is full width | ✓ VERIFIED | `#github-url` `style={{ width: '100%' }}` |
| 36 | Caption `min-height: 1.4em` is a floor; wraps with `overflow-wrap: anywhere` | ✓ VERIFIED | `.repo-caption` in `index.css`; no `overflow: hidden` / ellipsis |
| 37 | Empty-repo success omits tree `ul`; caption from `EmptyRepoError` or `RepoTreeResult` | ✓ VERIFIED | 409 and `tree []` tests |
| 38 | Previous tree/caption stay until a new success; on error the tree stays browseable | ✓ VERIFIED | 404 keeps tree; last-wins success replaces caption |
| 39 | Tree wrapper `max-height: 40vh; overflow: auto` | ✓ VERIFIED | `.repo-tree` rules |
| 40 | One or many files share the same row layout — no plural copy | ✓ VERIFIED | Single `FileLi` button; no "files" plural string |
| 41 | File and folder names wrap with `overflow-wrap: anywhere`; no ellipsis | ✓ VERIFIED | `.repo-tree button, summary`; no `text-overflow` |
| 42 | Status `min-height: 48px`; copy wraps; no ellipsis | ✓ VERIFIED | `.repo-status` |
| 43 | Last-wins Import token: start clears status; success replaces tree/caption; stale resolve ignored | ✓ VERIFIED | Overlapping-import test keeps `second/win@main` |
| 44 | Folder summary toggles only and never writes the status region | ✓ VERIFIED | Summary click leaves blocked copy unchanged |
| 45 | No selection highlight or pending-file API | ✓ VERIFIED | No `aria-current` / selected class on file rows; no pending-file API |
| 46 | Rate-limit `{time}` uses `toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })`; missing reset uses unknown-reset string | ✓ VERIFIED | Both rate-limit UI tests |
| 47 | Header nav stays exactly Trainer, History, Analytics | ✓ VERIFIED | App nav `textContent` assertion |

**Score:** 46/47 truths verified (0 present, behavior-unverified; 1 backstop abstained)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/github/types.ts` | RepoRef, GitTreeEntry, RepoTreeResult, TreeNode | ✓ VERIFIED | Exists, named types only, imported by tree/client/UI |
| `src/github/errors.ts` | Five typed classes; EmptyRepoError fields | ✓ VERIFIED | Wired from url + client + RepoBrowser |
| `src/github/url.ts` | PURE `parseGithubRef` | ✓ VERIFIED | No `fetch(`; throws `InvalidGithubUrlError` |
| `src/github/tree.ts` | PURE `foldTree` + `isLoadablePath` | ✓ VERIFIED | No language-map import |
| `index.html` | CSP listing egress | ✓ VERIFIED | `connect-src 'self' https://api.github.com` |
| `README.md` | Listing-only egress; local keystroke logs | ✓ VERIFIED | Privacy rewritten (stale “later plan” sentence is INFO) |
| `src/github/client.ts` | `fetchRepoTree` + cache | ✓ VERIFIED | Sole production fetch |
| `src/github/client.test.ts` | Stubbed fetch fixtures | ✓ VERIFIED | Zero live GitHub |
| `src/ui/RepoBrowser.tsx` | Form, caption, tree, COPY | ✓ VERIFIED | No exercise-load prop |
| `src/ui/RepoBrowser.test.tsx` | happy-dom; mocked client | ✓ VERIFIED | Blocked vs not-yet |
| `src/ui/App.tsx` | Trainer corpus shell | ✓ VERIFIED | `CorpusInput onLoad={handleLoad}`; `<RepoBrowser />` |
| `src/index.css` | `.repo-tree` / `.repo-status` / `.repo-caption` / tab selected | ✓ VERIFIED | Reuses existing color tokens |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `src/github/url.ts` | `src/github/errors.ts` | throws `InvalidGithubUrlError` | WIRED | Pattern + D-10 tests |
| `src/github/tree.ts` | `src/github/types.ts` | `foldTree` → `TreeNode[]` | WIRED | Imports + return type |
| `src/github/client.ts` | `src/github/errors.ts` | status mapping | WIRED | All four named classes thrown |
| `src/github/client.ts` | `https://api.github.com` | `githubGet` concatenates origin + encoded path | WIRED | Never fetches the raw user string |
| `src/ui/RepoBrowser.tsx` | `src/github/client.ts` | `parseGithubRef` then `fetchRepoTree` | WIRED | Invalid URL returns before fetch |
| `src/ui/App.tsx` | `src/ui/RepoBrowser.tsx` | GitHub tabpanel, no exercise-load prop | WIRED | `<RepoBrowser />` |
| `src/ui/RepoBrowser.tsx` | `src/github/tree.ts` | `foldTree` + `isLoadablePath` | WIRED | Mute + click branch |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `RepoBrowser` | `nodes` / `caption` | `fetchRepoTree` → `foldTree(result.entries)` or `EmptyRepoError` fields | Yes — live `api.github.com` JSON in production; tests stub the same shape | ✓ FLOWING |
| `RepoBrowser` | `status.text` | Locked `COPY` from typed errors / click path | Yes — no GitHub JSON interpolation | ✓ FLOWING |
| `App` GitHub panel | (no hollow props) | `<RepoBrowser />` with no empty data props | N/A | ✓ FLOWING |

`client.ts` also writes unused cache keys `${owner}/${repo}@${sha}` and `${owner}/${repo}:${defaultBranch}`. Lookup is by `owner/repo`. Observable cache-hit behavior still holds (INFO, not a gap).

### Behavioral Spot-Checks

Phase tests enumerated with `vitest list`, then run once (not the full workspace suite).

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 07 unit + UI tests exist | `pnpm exec vitest list` on url/tree/client/RepoBrowser/App | 68 named tests listed | ✓ PASS |
| Those tests pass | `pnpm exec vitest run --project unit src/github/url.test.ts src/github/tree.test.ts src/github/client.test.ts --project ui src/ui/RepoBrowser.test.tsx src/ui/App.test.tsx` | 5 files, 68 passed | ✓ PASS |
| Production fetch only in client | `rg 'fetch\\(' src --glob '*.ts' --glob '*.tsx'` | Only `src/github/client.ts:22` | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | — | No `scripts/**/tests/probe-*.sh` and no probe declared in PLAN/SUMMARY | N/A |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| REPO-01 | 07-01, 07-02, 07-03 | Paste URL or `owner/repo` and see default-branch filesystem tree | ✓ SATISFIED | Parse + fetch + fold + RepoBrowser Import |
| REPO-02 | 07-01, 07-03 | Expand/collapse folders; every returned path visible | ✓ SATISFIED | `foldTree` + native details + non-TS/JS rows |
| REPO-03 | 07-03 | Non-loadable click shows cannot-split notice; no exercise | ✓ SATISFIED | `COPY.blocked`; no `onLoad` |
| REPO-04 | 07-02, 07-03 | Specific 404 / rate-limit / truncated copy | ✓ SATISFIED | Typed mapping + locked strings |

No orphaned Phase 7 IDs. FILE-01.. and later IDs belong to Phase 8/9 and are not this phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `README.md` | 67–68 | “The only `fetch` call … will live in `src/github/client.ts` (added in a later plan)” | ℹ️ Info | Stale after 07-02; Privacy egress sentence still correct |
| `src/github/client.ts` | 82–83 | Cache keys `@sha` / `:defaultBranch` written, never read | ℹ️ Info | Hit path uses `owner/repo`; second Import still issues 0 GETs |
| Phase 07 files | — | TBD / FIXME / XXX | — | None |

No stub handlers, no empty `onClick`, no HTML-string injection of GitHub names (React text children).

### Human Verification Required

Harvested from 07-03 plan `<verification><human-check>` (end-of-phase mode) plus the backstop truth and flagged prohibitions.

### 1. Backstop — unclassified REPO-01 edge

**Test:** Try a GitHub URL shape that is not in the D-09/D-10 golden table (and is not a locked D-11 network case).
**Expected:** Either the default-branch listing happy path or `InvalidGithubUrlError` / invalid-URL copy before any fetch. No third taxonomy.
**Why human:** Tagged `verification: backstop`. Presence of the happy path does not prove the specless remainder.

### 2. Live public-repo import (Chromium)

**Test:** `pnpm dev`, Trainer → GitHub, paste `owner/repo`, Import.
**Expected:** Caption `owner/repo@default_branch`; top-level folders open; nested closed; blocked vs not-yet copy; trainer remains “No exercise loaded”.
**Why human:** Real GitHub payload, CORS/COEP, and visual disclosure state.

### 3. Rejected host — no network

**Test:** Gist or GitLab URL + Import; watch Network.
**Expected:** Invalid-URL alert; zero `api.github.com` requests.
**Why human:** Unit tests stub `fetch`; live egress is a browser fact.

### 4. History / Analytics hide-and-restore

**Test:** Import a repo, switch History then Analytics, return to Trainer.
**Expected:** No URL field/tree on those views; GitHub tree and Paste text still there on return.
**Why human:** happy-dom has no layout engine for “not visible”.

### 5. Preview isolation headers

**Test:** `curl -sI` on `pnpm preview`; `crossOriginIsolated` in the app.
**Expected:** COOP `same-origin`, COEP `require-corp` (or `credentialless` only if listing is blocked — never remove isolation).
**Why human:** Server header + browser isolation bit.

### 6. Flagged must-NOTs

**Test:** Confirm the seven flagged prohibitions in the running app.
**Expected:** No session from Import/tree; one 404 string; blocked ≠ not-yet; no Phase 8/parser/WASM jargon; no GitHub JSON/IP/stack; no last-URL/tab persistence.
**Why human:** `verification: flagged`. Tests already cover most of these; they must not be a silent pass.

### Gaps Summary

No implementation gaps. Phase 8 (FILE-01 blob load / units) is later-milestone work and is intentionally *not* done here — that is success criterion 5, not a deferral of a failure.

### Confirmation-bias notes (do not fail the phase)

1. **Partial test table:** `isLoadablePath` tests omit explicit `.js` / `.jsx` / `.mts` / `.cts` rows. The `LOADABLE` Set still implements the contract.
2. **Narrow persistence test:** App asserts no `corpus-tab` key; it does not assert last URL. `RepoBrowser` / `App` contain no `localStorage` writes.
3. **Uncovered HTTP path:** 409 on GET `/repos` (not the tree GET) maps to `GithubHttpError`, matching the plan’s tree-only 409 contract.

---

_Verified: 2026-09-20T22:32:00Z_
_Verifier: Claude (gsd-verifier)_
