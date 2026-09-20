# Phase 7: GitHub URL & Repo Tree - Context

**Gathered:** 2026-09-20
**Status:** Ready for planning

<domain>
## Phase Boundary

The user can paste a public GitHub URL or `owner/repo`, import the default
branch, and browse it as a filesystem tree — expand/collapse folders, see
every path GitHub returns, click a non-TS/JS file and get a blocked notice,
click a `.ts`/`.tsx`/`.js`/`.jsx` file and get a distinct “not yet” notice.
No typing session starts from the tree. Paste and upload stay available as
the existing whole-file corpus path.

**In scope:** REPO-01 (URL → default-branch tree), REPO-02 (expand/collapse,
every path), REPO-03 (non-TS/JS blocked notice, no exercise), REPO-04
(specific copy for 404, rate-limit, truncated tree). Success criterion 5:
selecting a TS/JS file does **not** load a whole-file typing session.

**Out of scope (own phases / deferred):** blob fetch, `sourceType: 'github'`,
normalize/size/UTF-8 on file contents (FILE-01/02 — Phase 8); parse, units,
dependency order (PLAN-* — Phase 8); scaffolded trainer (SCAF-* — Phase 9);
branch/tag/SHA picker (REPO-05); private repos / PAT (REPO-06); GitLab,
local folder, Tauri, isomorphic-git; prefetching blobs; remembering last
URL in localStorage.

</domain>

<decisions>
## Implementation Decisions

### URL + tree placement
- **D-01:** Corpus chrome is a **Paste | GitHub switch** — one panel at a
  time. The repo tree never shares space with the 8-row paste box. Paste and
  upload remain on the Paste tab (additional source, not a replacement).
- **D-02:** The whole corpus panel (switch + active tab) is **Trainer-only**.
  Hide it on History and Analytics. This is an intentional change from
  today’s always-mounted `CorpusInput` — a filesystem tree is too tall for
  those views, and paste/upload follow the same hide so the header stays
  three siblings (Phase 6 D-01).
- **D-03:** **Paste is the default tab** on load. GitHub is opt-in each
  visit. Do **not** persist last tab (remember-last-URL is a later nicety).
- **D-04:** Switching tabs is **not a reset**. Paste text, language select,
  and a loaded tree stay in memory. Loading a paste exercise does not
  discard the tree.

### TS/JS click this phase
- **D-05:** `.ts` / `.tsx` / `.js` / `.jsx` files are **clickable**. Click
  does **not** fetch a blob and does **not** call `handleLoad`. No whole-file
  exercise. Loadable extensions are exactly those four — `.mjs` / `.cjs` /
  `.mts` / `.cts` take the **blocked-file** path (REPO-03’s list).
- **D-06:** TS/JS click shows a **distinct notice** from blocked files —
  user-facing “not yet” (browsing only; these files open as scaffolded
  exercises later). No “Phase 8”, no parser/WASM jargon. Do **not** reuse
  the blocked-file sentence (that would imply TypeScript cannot be split).
- **D-07:** **No selection state.** The notice is ephemeral. Phase 8 starts
  from a fresh click, not a pending-file API.
- **D-08:** Every TS/JS click **replaces** the status-region message. No
  dismiss button. Same file or another file re-asserts the copy.

### Deep GitHub URLs
- **D-09:** Accept `owner/repo`, `https://github.com/owner/repo`, optional
  `www.`, `.git`, trailing slash. Extra path (`/blob/...`, `/tree/...`,
  `/issues/...`) is **silently ignored**. Always the **default branch**.
  Do not auto-expand to a path. Do not honor a branch in the URL (REPO-05).
- **D-10:** gist, GitLab, `raw.githubusercontent.com`, missing owner/repo,
  and other hosts are an **inline typed error, no fetch**.
- **D-11:** Fetch happens on an explicit **Import** button. Enter in the
  field also submits. **No fetch-on-paste** (half-typed URLs must not burn
  the 60 req/h budget).

### Tree chrome
- **D-12:** Hand-rolled nested `<ul>` disclosures (STACK.md). No
  `react-arborist` / `react-complex-tree`. Folders expand/collapse on click;
  they never show blocked/not-yet notices.
- **D-13:** Non-TS/JS **file** names use `text-muted`. TS/JS files and all
  folders use full `--color-text`. No icons. Every path still visible
  (REPO-02).
- **D-14:** **One status region under the tree** for blocked notice, TS/JS
  “not yet”, 404, rate-limit, truncated, and invalid-URL errors. `role="alert"`
  for errors (404, rate-limit, invalid URL); `role="status"` for notices
  (blocked, not-yet, truncated). Reserved min-height so showing copy does
  not reflow (CorpusInput WR-05).
- **D-15:** `truncated: true` → named notice, still render the entries
  GitHub returned. **No lazy subdirectory fetches** this phase.
- **D-16:** On successful import, **first level open**, nested folders
  collapsed.

### Carried forward (do not relitigate)
- Public GitHub REST only — no Tauri, no isomorphic-git, no generic clone
  (PROJECT.md).
- `src/github/client.ts` is the **only** module that may `fetch`. Callers
  see data types or typed errors. No Octokit. `Accept: application/vnd.github+json`
  only — never `X-GitHub-Api-Version` or `Authorization`.
- Phase 7 client: URL parse + `GET /repos/{owner}/{repo}` (default_branch)
  + `GET /git/trees/{ref}?recursive=1`. **Blob fetch is Phase 8.**
- Cache the tree in memory by `{owner, repo, sha}`. StrictMode must not
  double-hit the network on a cache hit. Zero live `api.github.com` calls
  in Vitest — fixture the JSON shapes.
- COEP `require-corp` stays. GitHub is cors-mode `fetch`. If a target
  browser blocks it, switch to COEP `credentialless` — **never** strip COEP.
- Unauthenticated 60 req/h. Surface `x-ratelimit-remaining` / reset when
  mapping 403/429. Named copy, not “Failed to fetch.”
- Error-as-typed-class + inline render (existing `ingestion/errors.ts`
  pattern). New GitHub error classes live next to the client, not in the UI.
- Header stays three items: Trainer | History | Analytics. No fourth “Repo”
  view.
- Trainer hide-not-unmount (Phase 4 D-08) is unchanged. Corpus panel hide
  on History/Analytics is display-none of the corpus chrome, not of the
  trainer subtree.
- Paste/upload load path (`fromPaste` / `fromFile` / `normalize`) is
  untouched. `SourceType` stays `'paste' | 'upload'` until Phase 8.
- Third-party corpus stays local — README must state GitHub.com is now an
  allowed egress for **corpus listing only**; keystroke logs still never
  leave the machine.
- Tree text is `textContent` / React text nodes only. No `innerHTML`, no
  markdown render of README (PITFALLS XSS).

### Claude's Discretion
- Exact copy strings (Import button, tab labels, blocked notice, TS/JS
  not-yet, 404, rate-limit, truncated, invalid URL, empty repo, Import
  busy label). Subject to a UI-SPEC pass (`UI hint: yes` on this phase).
- Internal names: `RepoRef`, `TreeEntry`, error class names, whether URL
  parse lives in `github/url.ts` vs `client.ts`.
- Cache structure (module-level Map vs closure) as long as D-cache-by-sha
  holds.
- Empty-repo and “no files in tree” copy.
- Whether a second Import of a different repo replaces the tree immediately
  (recommended: last-wins, clear the status region).
- Whether the GitHub tab keeps a caption of `owner/repo@default_branch`
  after success.
- Test fixture contents beyond: URL parse golden cases, 404/403/truncated
  mapping, extension blocked vs TS/JS notice, no live network.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.0 Milestone Research (primary — read before planning)
- `.planning/research/FEATURES.md` — URL shapes, trailing path ignored,
  blocked-not-hidden tree, anti-features (whole-file click, clone, prefetch,
  private repos, branch picker).
- `.planning/research/ARCHITECTURE.md` — `github/client.ts` + `github/url.ts`
  + `ui/RepoBrowser.tsx`; fetch-only-in-client; suggested build order step 1
  (tree before blob); do not ship click-to-whole-file.
- `.planning/research/STACK.md` — raw `fetch`, no Octokit, hand-rolled tree,
  GitHub CORS, 60 req/h, keep COEP `require-corp`.
- `.planning/research/PITFALLS.md` Pitfall 1 (COEP vs GitHub), Pitfall 2
  (60 req/h + cache + no live tests), Pitfall 8 (no innerHTML of untrusted
  names), truncated-tree UX, rate-limit copy.
- `.planning/research/SUMMARY.md` §Phase 7 — browse-only until planner
  exists.

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — REPO-01..04 (this phase); FILE-*/PLAN-*
  Phase 8; SCAF-* Phase 9; REPO-05/06 Future.
- `.planning/ROADMAP.md` §"Phase 7" — goal, five success criteria (including
  TS/JS click does not start a session), `UI hint: yes`.
- `.planning/PROJECT.md` §Key Decisions — public GitHub API, COEP, platform
  seam, no accounts.

### Prior UI / ingestion patterns
- `src/ui/CorpusInput.tsx` — copy contract, last-wins load token, reserved
  error row, busy-on-button, WR-05 alert vs status.
- `src/ingestion/errors.ts` — typed error classes caught at the UI edge.
- `src/ingestion/language-map.ts` — `extToLang`; loadable-vs-blocked in
  this phase is extension allowlist, not the language map’s full vocabulary.
- `src/ui/App.tsx` — `view` union, header nav, `handleLoad`, hide-not-unmount
  trainer subtree, `CorpusInput` currently always mounted (this phase moves
  it behind the switch and Trainer-only).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/ui/CorpusInput.tsx` — paste/upload form; becomes the Paste tab
  contents. Keep `onLoad(exercise)` seam. Do not teach it about GitHub.
- `src/ingestion/errors.ts` — pattern for `RepoNotFoundError`,
  `RateLimitedError`, `TruncatedTreeError`, `InvalidGithubUrlError` (names
  are discretion).
- `src/ingestion/language-map.ts::extToLang` — do **not** use “is this a
  known language?” as the blocked test. Blocked = not in
  `{.ts,.tsx,.js,.jsx}`.
- `src/ui/App.tsx` — owns `view` and `handleLoad`. RepoBrowser reports
  notices locally; it must not call `handleLoad` this phase.
- `src/index.css` — `--color-text-muted`, `--color-destructive`,
  `.text-label`, `.text-muted`, `.control`, `.primary`. Reuse; no new
  palette unless UI-SPEC says so.

### Established Patterns
- Platform seam: one dirty module (`dexie` today, `fetch` now). Tests
  never import the seam; they fixture data.
- Inline errors under the offending control; no toasts, no thrown overlays.
- Last-wins monotonic token for in-flight async (CorpusInput file load).
- Header is three buttons, `aria-current="page"`. No router.
- Copy lives as a `COPY` const in the UI file, verbatim from UI-SPEC once
  that exists.

### Integration Points
- New `src/github/` (url parse + client + types) and `src/ui/RepoBrowser.tsx`.
- `App.tsx` wraps CorpusInput + RepoBrowser in a Trainer-only Paste | GitHub
  switch. History/Analytics no longer see CorpusInput.
- `vite.config.ts` COOP/COEP headers must still be present after this
  phase; verify with a live cors `fetch` in the running app (human-check)
  plus fixtures in unit tests.
- README privacy/egress sentence: GitHub.com for corpus listing.

### Creative options
- Architecture enables a later blob-on-click without changing the tree UI:
  RepoBrowser already clicks files; Phase 8 swaps the TS/JS notice for
  `GET /git/blobs/{sha}`.
- Do not add `sourceType: 'github'` until Phase 8 actually builds an
  Exercise.

</code_context>

<specifics>
## Specific Ideas

- TS/JS notice tone (locked): “TypeScript/JavaScript files open as
  scaffolded exercises in the next step. Browsing only for now.” Exact
  wording is UI-SPEC’s, this is the intent.
- Blocked-file tone (from REQUIREMENTS): the file cannot be split yet;
  no exercise loads.
- Import is the GitHub equivalent of “Load exercise” — a named primary
  button, not an implicit paste handler.

</specifics>

<deferred>
## Deferred Ideas

- Remember last repo URL / last tab in localStorage — FEATURES.md “Add
  After Validation.”
- Auto-expand the tree to a blob/tree path from a deep URL.
- Lazy subdirectory fetch when `truncated: true`.
- Caption/highlight of a pending TS/JS file for Phase 8 to pick up.
- `.mjs`/`.cjs` as loadable (would need REQUIREMENTS amendment + parser
  coverage in Phase 8).
- Branch/tag/SHA picker (REPO-05), private repos (REPO-06).
- Fourth header item for Repo (rejected; stays a corpus tab).

None of these were requested as this-phase scope.

</deferred>

---

*Phase: 7-GitHub URL & Repo Tree*
*Context gathered: 2026-09-20*
