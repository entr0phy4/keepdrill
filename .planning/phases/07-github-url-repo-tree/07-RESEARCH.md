# Phase 7: GitHub URL & Repo Tree - Research

**Researched:** 2026-09-20
**Domain:** Public GitHub REST Git Trees + CORS/COEP browser fetch + nested disclosure tree
**Confidence:** HIGH

Context7 was unavailable this session (research-plan requested it; no MCP/CLI). Findings below are from official GitHub REST and MDN pages fetched this session, cross-checked against locked CONTEXT.md decisions. The classify-confidence seam rates the `webfetch` provider LOW; claims that cite `docs.github.com` / MDN are still treated as authoritative because those pages *are* the primary sources.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### URL + tree placement
- **D-01:** Corpus chrome is a **Paste | GitHub switch** — one panel at a time. The repo tree never shares space with the 8-row paste box. Paste and upload remain on the Paste tab (additional source, not a replacement).
- **D-02:** The whole corpus panel (switch + active tab) is **Trainer-only**. Hide it on History and Analytics. This is an intentional change from today’s always-mounted `CorpusInput` — a filesystem tree is too tall for those views, and paste/upload follow the same hide so the header stays three siblings (Phase 6 D-01).
- **D-03:** **Paste is the default tab** on load. GitHub is opt-in each visit. Do **not** persist last tab (remember-last-URL is a later nicety).
- **D-04:** Switching tabs is **not a reset**. Paste text, language select, and a loaded tree stay in memory. Loading a paste exercise does not discard the tree.

#### TS/JS click this phase
- **D-05:** `.ts` / `.tsx` / `.js` / `.jsx` files are **clickable**. Click does **not** fetch a blob and does **not** call `handleLoad`. No whole-file exercise. Loadable extensions are exactly those four — `.mjs` / `.cjs` / `.mts` / `.cts` take the **blocked-file** path (REPO-03’s list).
- **D-06:** TS/JS click shows a **distinct notice** from blocked files — user-facing “not yet” (browsing only; these files open as scaffolded exercises later). No “Phase 8”, no parser/WASM jargon. Do **not** reuse the blocked-file sentence (that would imply TypeScript cannot be split).
- **D-07:** **No selection state.** The notice is ephemeral. Phase 8 starts from a fresh click, not a pending-file API.
- **D-08:** Every TS/JS click **replaces** the status-region message. No dismiss button. Same file or another file re-asserts the copy.

#### Deep GitHub URLs
- **D-09:** Accept `owner/repo`, `https://github.com/owner/repo`, optional `www.`, `.git`, trailing slash. Extra path (`/blob/...`, `/tree/...`, `/issues/...`) is **silently ignored**. Always the **default branch**. Do not auto-expand to a path. Do not honor a branch in the URL (REPO-05).
- **D-10:** gist, GitLab, `raw.githubusercontent.com`, missing owner/repo, and other hosts are an **inline typed error, no fetch**.
- **D-11:** Fetch happens on an explicit **Import** button. Enter in the field also submits. **No fetch-on-paste** (half-typed URLs must not burn the 60 req/h budget).

#### Tree chrome
- **D-12:** Hand-rolled nested `<ul>` disclosures (STACK.md). No `react-arborist` / `react-complex-tree`. Folders expand/collapse on click; they never show blocked/not-yet notices.
- **D-13:** Non-TS/JS **file** names use `text-muted`. TS/JS files and all folders use full `--color-text`. No icons. Every path still visible (REPO-02).
- **D-14:** **One status region under the tree** for blocked notice, TS/JS “not yet”, 404, rate-limit, truncated, and invalid-URL errors. `role="alert"` for errors (404, rate-limit, invalid URL); `role="status"` for notices (blocked, not-yet, truncated). Reserved min-height so showing copy does not reflow (CorpusInput WR-05).
- **D-15:** `truncated: true` → named notice, still render the entries GitHub returned. **No lazy subdirectory fetches** this phase.
- **D-16:** On successful import, **first level open**, nested folders collapsed.

#### Carried forward (do not relitigate)
- Public GitHub REST only — no Tauri, no isomorphic-git, no generic clone (PROJECT.md).
- `src/github/client.ts` is the **only** module that may `fetch`. Callers see data types or typed errors. No Octokit. `Accept: application/vnd.github+json` only — never `X-GitHub-Api-Version` or `Authorization`.
- Phase 7 client: URL parse + `GET /repos/{owner}/{repo}` (default_branch) + `GET /git/trees/{ref}?recursive=1`. **Blob fetch is Phase 8.**
- Cache the tree in memory by `{owner, repo, sha}`. StrictMode must not double-hit the network on a cache hit. Zero live `api.github.com` calls in Vitest — fixture the JSON shapes.
- COEP `require-corp` stays. GitHub is cors-mode `fetch`. If a target browser blocks it, switch to COEP `credentialless` — **never** strip COEP.
- Unauthenticated 60 req/h. Surface `x-ratelimit-remaining` / reset when mapping 403/429. Named copy, not “Failed to fetch.”
- Error-as-typed-class + inline render (existing `ingestion/errors.ts` pattern). New GitHub error classes live next to the client, not in the UI.
- Header stays three items: Trainer | History | Analytics. No fourth “Repo” view.
- Trainer hide-not-unmount (Phase 4 D-08) is unchanged. Corpus panel hide on History/Analytics is display-none of the corpus chrome, not of the trainer subtree.
- Paste/upload load path (`fromPaste` / `fromFile` / `normalize`) is untouched. `SourceType` stays `'paste' | 'upload'` until Phase 8.
- Third-party corpus stays local — README must state GitHub.com is now an allowed egress for **corpus listing only**; keystroke logs still never leave the machine.
- Tree text is `textContent` / React text nodes only. No `innerHTML`, no markdown render of README (PITFALLS XSS).

### Claude's Discretion
- Exact copy strings (Import button, tab labels, blocked notice, TS/JS not-yet, 404, rate-limit, truncated, invalid URL, empty repo, Import busy label). Subject to a UI-SPEC pass (`UI hint: yes` on this phase).
- Internal names: `RepoRef`, `TreeEntry`, error class names, whether URL parse lives in `github/url.ts` vs `client.ts`.
- Cache structure (module-level Map vs closure) as long as D-cache-by-sha holds.
- Empty-repo and “no files in tree” copy.
- Whether a second Import of a different repo replaces the tree immediately (recommended: last-wins, clear the status region).
- Whether the GitHub tab keeps a caption of `owner/repo@default_branch` after success.
- Test fixture contents beyond: URL parse golden cases, 404/403/truncated mapping, extension blocked vs TS/JS notice, no live network.

### Deferred Ideas (OUT OF SCOPE)
- Remember last repo URL / last tab in localStorage — FEATURES.md “Add After Validation.”
- Auto-expand the tree to a blob/tree path from a deep URL.
- Lazy subdirectory fetch when `truncated: true`.
- Caption/highlight of a pending TS/JS file for Phase 8 to pick up.
- `.mjs`/`.cjs` as loadable (would need REQUIREMENTS amendment + parser coverage in Phase 8).
- Branch/tag/SHA picker (REPO-05), private repos (REPO-06).
- Fourth header item for Repo (rejected; stays a corpus tab).

None of these were requested as this-phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REPO-01 | User can paste a public GitHub URL or `owner/repo` and see the repository as a filesystem tree of the default branch | URL parse golden cases (D-09/D-10); `GET /repos/{owner}/{repo}` → `default_branch`; `GET /git/trees/{ref}?recursive=1`; CSP `connect-src` must allow `https://api.github.com` |
| REPO-02 | User can expand and collapse folders in that tree and see every file path GitHub returns (not only TS/JS) | Nested `<ul>` + `<details>` (D-12); fold flat `tree[]` into a trie; D-16 first-level open; D-13 muted non-loadable names, still visible |
| REPO-03 | User who clicks a non-`.ts`/`.tsx`/`.js`/`.jsx` file sees a notice that the file cannot be split yet, and no exercise loads | Extension allowlist (not `extToLang`); folders never notice; status region `role="status"`; RepoBrowser must not call `handleLoad` |
| REPO-04 | User sees specific, non-generic copy when the repo is missing (404), GitHub rate-limits the client, or the recursive tree is truncated | Typed errors next to client; 404 vs private (GitHub 404s both); 403/429 + `x-ratelimit-*`; `truncated: true` is 200 + notice, not a throw |
</phase_requirements>

## Project Constraints (from .cursor/rules/)

No `.cursor/rules/` or project skills directory exists. Follow existing house style: platform seam (`persistence/db.ts` analogue), typed errors + inline render, `COPY` const in the UI file, hide-not-unmount, React text nodes only.

## Summary

Phase 7 is a **browser-only** integration with GitHub's public REST API: parse a URL, fetch the default branch name, fetch one recursive git tree, fold it into nested disclosures, and keep the tree browse-only. No new npm packages. The dangerous parts are not “can we list a repo” — they are (1) today’s CSP `connect-src 'none'` which will silently block every `fetch`, (2) 60 unauthenticated req/h plus StrictMode/in-flight duplicates, (3) COEP `require-corp` which is safe **only** for cors-mode fetches, and (4) untrusted path names in the tree renderer.

**Primary recommendation:** Split `src/github/` into pure `url.ts` + `tree.ts` + typed `errors.ts` and a single dirty `client.ts` that `fetch`es with `{ mode: 'cors', credentials: 'omit', headers: { Accept: 'application/vnd.github+json' } }` only. Widen CSP to `connect-src 'self' https://api.github.com`. Mount Paste and GitHub panels with `display: none` (never unmount). Tests mock `fetch` / inject tree fixtures — zero live `api.github.com`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| GitHub URL parse | Browser / Client (pure) | — | No network; reject other hosts before fetch |
| Default-branch + recursive tree fetch | Browser / Client | External: `api.github.com` | SPA has no backend; `client.ts` is the platform seam |
| In-memory tree cache | Browser / Client | — | Session-only Map; 60 req/h budget |
| Filesystem tree UI | Browser / Client | — | Nested disclosures; no virtualization library |
| Loadable vs blocked click | Browser / Client | — | Extension allowlist; no `handleLoad` |
| Typed error → inline copy | Browser / Client | — | Same pattern as `ingestion/errors.ts` |
| COOP/COEP headers | CDN / Static (`vite.config.ts`) | — | Keep `require-corp`; never strip |
| CSP `connect-src` | CDN / Static (`index.html`) | — | Must allow `https://api.github.com` or fetch never leaves the browser |
| Paste/upload corpus | Browser / Client | — | Untouched; Paste tab only |

This app has **no API / Backend tier**. Do not invent a proxy.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| GitHub REST via raw `fetch` | Unversioned request → API **2022-11-28** (default when `X-GitHub-Api-Version` is omitted; supported until 2028-03-10) [VERIFIED: docs.github.com/en/rest/about-the-rest-api/api-versions] | `GET /repos/{owner}/{repo}`, `GET /git/trees/{tree_sha}?recursive=1` | Locked. No Octokit. CORS-safelisted `Accept` avoids a preflight. |
| Existing Vite 8.2 / React 19.2 / TypeScript 5.9 / Vitest 4.1 | already in `package.json` | UI + tests | Do not add runtime deps |
| Native `fetch` (browser + Node 24 in Vitest) | platform | HTTP | Node 24.16.0 is on PATH; Vitest unit project is `environment: 'node'` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| *(none)* HTML `<details>` / `<summary>` | platform | Folder expand/collapse | Always for D-12. Implicit ARIA `group`; do not put `role="tree"` on `<details>` [VERIFIED: developer.mozilla.org/en-US/docs/Web/HTML/Element/details] |
| *(none)* URL parse + trie fold | app code | `owner/repo` → `RepoRef`; flat `tree[]` → nested nodes | Always |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw `fetch` | `@octokit/rest` | Locked out. Extra headers historically failed CORS preflight (`X-GitHub-Api-Version` not in `Access-Control-Allow-Headers`) [CITED: github.com/github/docs/issues/24706]. Issue was later marked fixed; still do not send the header (CONTEXT lock) — Accept-only also skips preflight. |
| Nested `<ul>` + `<details>` | `react-arborist` / `react-complex-tree` | Locked out. Wrong weight for a read-only tree. |
| Recursive Trees API | tarball / `codeload.github.com` | Redirects drop CORS [CITED: github/docs#24706 zipball comment]. Out of scope. |
| Recursive Trees API | `raw.githubusercontent.com` listing | Cannot list a tree. Reject as a pasted URL (D-10). Blob fetch is Phase 8. |

**Installation:** none. Do not `pnpm add` anything this phase.

**Version verification:** no new packages. Existing stack from `package.json` (read 2026-09-20): `react@^19.2.8`, `vite@^8.2.2`, `vitest@~4.1.11`, `happy-dom@^20.14.0`.

## Package Legitimacy Audit

This phase installs **no** external packages. Package Legitimacy Gate skipped.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | N/A |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
User pastes URL or owner/repo  ──Enter / Import click──►  RepoBrowser (no fetch-on-paste)
        │
        ▼
 github/url.parseGithubRef(input)
        ├─ InvalidGithubUrlError ──► status role="alert"  (no network)
        └─ RepoRef { owner, repo }
                │
                ▼
 github/client.fetchRepoTree(ref)     ← ONLY module that may fetch
        │   cache hit {owner,repo,sha} or in-flight coalescing
        │
        ├─ GET https://api.github.com/repos/{owner}/{repo}
        │     Accept: application/vnd.github+json
        │     mode: cors, credentials: omit
        │     200 → default_branch
        │     301 → follow (renamed repo)
        │     404 → RepoNotFoundError (also private)
        │     403 remaining=0 / 429 → RateLimitedError
        │
        └─ GET .../git/trees/{encodeURIComponent(default_branch)}?recursive=1
              200 → { sha, tree[], truncated }
              409 → EmptyRepoError { owner, repo, defaultBranch }
              404 → RepoNotFoundError
                │
                ▼
 github/tree.foldTree(tree[])  → nested nodes (pure)
                │
                ▼
 RepoTree: nested <ul><li><details open?>  (first level open)
                │
        click file
        ├─ folder summary  → native toggle, no notice
        ├─ .ts/.tsx/.js/.jsx → role="status" “not yet”  (NO handleLoad, NO blob)
        └─ other file        → role="status" blocked     (NO handleLoad)
                │
        truncated:true → role="status" + still render returned entries
```

CSP and COEP sit in front of the fetch arrow: `connect-src` must allow `https://api.github.com` **before** CORS/COEP are even reached.

### Recommended Project Structure

```
src/
├── github/                    # NEW platform seam + pure helpers
│   ├── client.ts              # the only fetch in src/
│   ├── url.ts                 # parseGithubRef — golden tests
│   ├── tree.ts                # fold flat GitHub tree[] → nested nodes
│   ├── errors.ts              # typed classes (not in ui/)
│   ├── types.ts               # RepoRef, GitTreeEntry, TreeNode
│   ├── url.test.ts            # node env (vite unit project)
│   ├── tree.test.ts
│   └── client.test.ts         # vi.stubGlobal('fetch'); zero live calls
├── ui/
│   ├── RepoBrowser.tsx        # NEW: field, Import, status, tree
│   ├── RepoBrowser.test.tsx   # happy-dom; mock client or pass fixtures
│   ├── CorpusInput.tsx        # UNCHANGED paste/upload; Paste tab only
│   └── App.tsx                # MODIFIED: Paste|GitHub switch; corpus hide on History/Analytics
├── ingestion/                 # UNCHANGED (no sourceType:'github' yet)
index.html                     # MODIFIED: connect-src
README.md                      # MODIFIED: GitHub listing egress
vite.config.ts                 # UNCHANGED COOP/COEP (verify still present)
```

Put URL parse in `github/url.ts` (discretion, recommended): keeps `client.ts` as the grep target for `fetch`.

### Pattern 1: Platform seam — one dirty module

**What:** `client.ts` is the only `fetch`. Callers get `{ owner, repo, defaultBranch, sha, entries, truncated }` or a typed Error.
**When to use:** Always. Matches `persistence/db.ts` as the sole Dexie importer.
**Example:**

```typescript
// Source: locked CONTEXT + docs.github.com/en/rest/git/trees
export async function fetchRepoTree(ref: RepoRef): Promise<RepoTreeResult> {
  const repo = await githubGet(`/repos/${enc(ref.owner)}/${enc(ref.repo)}`)
  const defaultBranch = asRepo(repo).default_branch
  const tree = await githubGet(
    `/repos/${enc(ref.owner)}/${enc(ref.repo)}/git/trees/${enc(defaultBranch)}?recursive=1`,
  )
  return foldAndCache(ref, defaultBranch, asTree(tree))
}

function githubGet(path: string): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    headers: { Accept: 'application/vnd.github+json' },
  })
}
```

Never set `Authorization`, `X-GitHub-Api-Version`, or `User-Agent` from JS. Browsers already send `User-Agent`; GitHub rejects missing UA, not browser UA [VERIFIED: docs.github.com/en/rest/using-the-rest-api/getting-started-with-the-rest-api]. `Accept` is a CORS-safelisted request header (value has no unsafe bytes, length ≪ 128) [VERIFIED: developer.mozilla.org/en-US/docs/Glossary/CORS-safelisted_request_header] — this GET should **not** preflight.

### Pattern 2: Hide-not-unmount for both tabs and corpus chrome

**What:** Paste tab, GitHub tab, and the whole corpus panel use `style.display = 'none'`, never conditional unmount, never the `hidden` attribute (inline `display` would override it — same lesson as Phase 4 D-08 in `App.tsx`).
**When to use:** D-02 + D-04. Returning to Trainer must restore paste text, language, GitHub field, and loaded tree.
**Example:**

```tsx
<div style={{ display: view === 'trainer' ? 'grid' : 'none' }}>
  {/* tablist: Paste | GitHub, Paste default */}
  <div style={{ display: corpusTab === 'paste' ? 'grid' : 'none' }}>
    <CorpusInput onLoad={handleLoad} />
  </div>
  <div style={{ display: corpusTab === 'github' ? 'grid' : 'none' }}>
    <RepoBrowser />
  </div>
</div>
```

`RepoBrowser` does **not** take `onLoad` this phase.

### Pattern 3: Nested disclosures, not ARIA treeview

**What:** Each directory is `<li><details [open]><summary>{name}</summary><ul>…</ul></details></li>`. Files are `<li><button type="button">`.
**When to use:** Always (D-12, D-16).
**Why not `role="tree"`:** MDN: `<details>` implicit role is `group`; **no role permitted** [VERIFIED: MDN details]. A WAI-ARIA tree would need full keyboard (arrow keys, aria-expanded). Native `<details>` already toggles on click/Space/Enter.
**D-16:** only **top-level** `<details>` get the boolean `open` attribute. Nested folders omit it. Never write `open={false}` / `open="false"` — boolean attributes present means open [VERIFIED: MDN details].

### Pattern 4: Result object for truncated trees; throw for HTTP failures

**What:** `truncated: true` is a successful 200. Return it on the result; UI sets `role="status"`. Do not throw `TruncatedTreeError` or the tree will not render (violates D-15).
**When to use:** Always.

### Anti-Patterns to Avoid

- **`fetch` in `RepoBrowser.tsx`:** untestable; privacy grep becomes meaningless. Seam is `client.ts` only.
- **`vi.mock` of `api.github.com` by hitting the network:** 60 req/h + flaky CI. Stub `globalThis.fetch`.
- **`recursive=false` to mean non-recursive:** GitHub documents that **any** `recursive` query value — including `0`, `"false"` — enables recursion. Omit the param to stay non-recursive. This phase always sends `?recursive=1` [VERIFIED: docs.github.com/en/rest/git/trees].
- **Passing `default_branch` unencoded:** branch names may contain `/`. Troubleshooting docs require `%2F` for slashes in path params [VERIFIED: docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api]. Use `encodeURIComponent` on owner, repo, and ref.
- **Using `extToLang` as the blocked test:** `.mjs` maps to `javascript` but is **blocked** this phase (D-05). Allowlist is exactly `{.ts,.tsx,.js,.jsx}`.
- **Calling `handleLoad` on TS/JS click:** ships the whole-file path the user rejected. Notice only.
- **`innerHTML` / markdown of names or README:** XSS (Pitfall 8). React text children only.
- **Stripping COEP when GitHub “fails”:** timer resolution dies. Switch to `credentialless` only.
- **Leaving `connect-src 'none'`:** CSP is evaluated **before** the request is sent [VERIFIED: MDN connect-src]. CORS cannot save it.
- **Setting `credentials: 'include'`:** would send cookies to GitHub and change CORS. Use `omit`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML escaping of file names | DOMPurify / regex sanitizer | React text nodes / `textContent` | JSX already escapes; a sanitizer is a new XSS surface |
| CORS proxy / backend | Vite proxy to GitHub | Direct cors `fetch` to `api.github.com` | GitHub documents `Access-Control-Allow-Origin: *` [VERIFIED: docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests] |
| Rate-limit clock | polling `GET /rate_limit` | `x-ratelimit-reset` (UTC epoch seconds) | `GET /rate_limit` is extra traffic; headers are CORS-exposed |
| Virtualized file tree | react-window + custom tree | Nested `<ul>` + `<details>` | Locked; solo daily-use trees fit in memory |
| Git clone in the browser | isomorphic-git + lightning-fs | Recursive Trees API | Locked GitHub-public; clone needs CORS proxy |

Hand-roll **is** required for: URL parse, trie fold, disclosure tree, ~80-line `client.ts`. Those are the product.

**Key insight:** The hard parts this phase are policy (CSP, headers, cache, no blob click), not libraries.

## Common Pitfalls

### Pitfall 1: CSP `connect-src 'none'` blocks GitHub before CORS runs

**What goes wrong:** Import “does nothing” or throws `TypeError: Failed to fetch`. Network tab shows a CSP violation, not a GitHub 404. Engineers “fix” CORS or COEP and still fail.
**Why it happens:** `index.html` ships `connect-src 'none'` from Phase 1. `fetch()` is a `connect-src` sink [VERIFIED: developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src].
**How to avoid:** Change the meta to:

```
default-src 'self'; connect-src 'self' https://api.github.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'
```

Keep `'self'` so Vite HMR WebSocket / same-origin stays possible. Do **not** add `github.com`, `raw.githubusercontent.com`, or `codeload.github.com` this phase. Update README: GitHub API is allowed **listing** egress; keystroke logs still never leave.
**Warning signs:** Console `Refused to connect because it violates Content Security Policy`. Grep still finds `connect-src 'none'`.

### Pitfall 2: 60 req/h + missing in-flight coalescing

**What goes wrong:** Two Imports of the same repo (or a cache keyed only after the response) burn 4 requests (repo + tree, twice). Tests hitting live GitHub flake CI.
**Why it happens:** Cache-by-sha is empty until the tree returns. Concurrent calls both miss.
**How to avoid:**
1. Module-level `Map` of in-flight `Promise`s keyed by `${owner}/${repo}` while the request runs.
2. After success, cache the tree by `${owner}/${repo}@${sha}` **and** an index `${owner}/${repo}:${defaultBranch} → sha` so a second Import skips **both** GETs.
3. `vi.stubGlobal('fetch', vi.fn())` in `client.test.ts`. Assert `fetch.mock.calls` length. UI tests never import `client.ts` if they can fixture nodes.
**Warning signs:** `403` on the second Import the same hour; StrictMode double `fetch` in DEV if anyone later fetches on mount (Import is click-driven, so click is once — still implement coalescing).

### Pitfall 3: COEP `require-corp` vs GitHub

**What goes wrong:** `no-cors` or a missing CORS response is blocked; someone removes COEP; `crossOriginIsolated` becomes false; timer resolution collapses.
**Why it happens:** COEP `require-corp` blocks **no-cors** cross-origin without CORP. Cors-mode fetches are **not** blocked by COEP; they must still pass CORS [VERIFIED: developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy].
**How to avoid:** `fetch(..., { mode: 'cors' })` (also the default for cross-origin). Keep `vite.config.ts` `require-corp` on **both** `server.headers` and `preview.headers`. Escape hatch: `credentialless`, never strip COEP.
**Warning signs:** `(blocked:NotSameOriginAfterDefaultedToSameOriginByCoep)`; degraded-timing banner after this phase.

### Pitfall 4: 404 is also “private repo”

**What goes wrong:** Copy says “not found” for a repo the user knows exists (it’s private). Or copy says “private” and accidentally confirms existence — GitHub already 404s to avoid that [VERIFIED: docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api].
**How to avoid:** One 404 string: public repository not found (URL wrong or not public). Do not probe further. No fetch for gist/GitLab (D-10) so those never become 404.

### Pitfall 5: Rate-limit 403 vs other 403

**What goes wrong:** Abuse/IP 403 is shown as “rate limited”, or rate-limit 403 is shown as “Failed to fetch”. User retries and gets banned [VERIFIED: docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api].
**How to avoid:** Treat as rate-limit when `status` is 429 **or** (`status` is 403 and `x-ratelimit-remaining === '0'`). Those headers are in `Access-Control-Expose-Headers` [VERIFIED: GitHub CORS docs]. Other 403 → a distinct named error, still not “Failed to fetch”. Surface reset as local time from `Number(x-ratelimit-reset) * 1000`. Do not put the client IP from GitHub’s JSON `message` into the UI.

### Pitfall 6: Untrusted path XSS

**What goes wrong:** A blob named `</pre><img onerror=…>` or a markdown README is rendered with `innerHTML` / `dangerouslySetInnerHTML`.
**How to avoid:** `{node.name}` as a React text child. No highlight.js. No README preview. Grep `innerHTML` / `dangerouslySetInnerHTML` in `src/` at phase end (Phase 1 invariant).

### Pitfall 7: `App.test.tsx` still assumes always-visible CorpusInput

**What goes wrong:** D-02 hides corpus on History/Analytics. Existing test “CorpusInput stays mounted” uses `querySelector('#corpus-paste')` which **still passes** under `display:none`. A future test that checks `offsetParent` / visibility will fail if the panel is unmounted instead of hidden.
**How to avoid:** Hide via `display:none`, keep mounted (D-02 + D-04). Update the Analytics test name/intent: still mounted, wrapper `display:none`. Add a test that History/Analytics do not show the GitHub field either. `loadAndCompleteExercise` still works because Paste is the default tab (D-03).

### Pitfall 8: Recursive tree includes `type: tree` and `type: commit`

**What goes wrong:** Folding only `blob` paths drops submodule commits; folding both `tree` rows and split blob paths double-creates directories. Empty git repo returns **409 Conflict**, not `{ tree: [] }` [VERIFIED: git trees status codes include 409].
**How to avoid:** Walk every entry: `type === 'tree'` ensures a dir node; `blob` / `commit` become leaves. `commit` (submodule) is a non-TS/JS leaf → blocked notice. Map HTTP 409 to empty-repo copy. `tree: []` with 200 → “no files” copy (discretion).

## Code Examples

### Parse GitHub URL (pure)

```typescript
// Source: CONTEXT D-09/D-10. Host allowlist is github.com only.
export type RepoRef = { owner: string; repo: string }

export function parseGithubRef(raw: string): RepoRef {
  const trimmed = raw.trim()
  const nwo = /^([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9._-]+)$/
  const nwoMatch = nwo.exec(trimmed)
  if (nwoMatch) return { owner: nwoMatch[1], repo: stripGit(nwoMatch[2]) }

  let url: URL
  try {
    url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
  } catch {
    throw new InvalidGithubUrlError()
  }
  const host = url.hostname.toLowerCase()
  if (host === 'gist.github.com' || host === 'raw.githubusercontent.com') {
    throw new InvalidGithubUrlError()
  }
  if (host !== 'github.com' && host !== 'www.github.com') {
    throw new InvalidGithubUrlError()
  }
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length < 2) throw new InvalidGithubUrlError()
  return { owner: parts[0], repo: stripGit(parts[1]) } // ignore parts.slice(2)
}

function stripGit(repo: string): string {
  return repo.replace(/\.git$/i, '')
}
```

Golden cases (must-have tests):

| Input | Result |
|-------|--------|
| `owner/repo` | `{ owner, repo }` |
| `https://github.com/owner/repo` | ok |
| `https://www.github.com/owner/repo` | ok |
| `https://github.com/owner/repo.git` | repo without `.git` |
| `https://github.com/owner/repo/` | ok |
| `https://github.com/owner/repo/blob/main/src/a.ts` | ignore extra path; still `{ owner, repo }` |
| `https://github.com/owner/repo/tree/main` | ignore; default branch later |
| `https://github.com/owner/repo/issues/1` | ignore extra path |
| `github.com/owner/repo` (no scheme) | **recommend accept** via `https://` prefix (discretion; D-09 lists the https form) |
| `https://gist.github.com/u/id` | InvalidGithubUrlError, no fetch |
| `https://gitlab.com/o/r` | invalid |
| `https://raw.githubusercontent.com/o/r/main/f.ts` | invalid |
| `https://github.com/owner` | invalid (missing repo) |
| `https://github.com/settings` | invalid |
| whitespace-only | invalid |

### Fetch + error mapping

```typescript
// Source: docs.github.com REST trees + rate-limits + troubleshooting
async function readGithub(res: Response): Promise<unknown> {
  if (res.status === 404) throw new RepoNotFoundError()
  // 409 is mapped in fetchRepoTree after GET /repos learned default_branch —
  // throw EmptyRepoError({ owner: ref.owner, repo: ref.repo, defaultBranch })
  // so 07-03 can caption {owner}/{repo}@{defaultBranch}. Do not return RepoTreeResult.
  if (res.status === 409) {
    throw new EmptyRepoError({ owner, repo, defaultBranch })
  }
  const remaining = res.headers.get('x-ratelimit-remaining')
  const reset = res.headers.get('x-ratelimit-reset')
  if (res.status === 429 || (res.status === 403 && remaining === '0')) {
    throw new RateLimitedError({
      remaining: remaining === null ? 0 : Number(remaining),
      resetEpochS: reset === null ? undefined : Number(reset),
    })
  }
  if (!res.ok) throw new GithubHttpError(res.status)
  return res.json()
}
```

Fixture shapes (check in as JSON, do not live-fetch):

```json
{
  "sha": "fc6274d15fa3ae2ab983129fb037999f264ba9a7",
  "truncated": false,
  "tree": [
    { "path": "src", "mode": "040000", "type": "tree", "sha": "abc" },
    { "path": "src/App.tsx", "mode": "100644", "type": "blob", "sha": "def", "size": 120 },
    { "path": "README.md", "mode": "100644", "type": "blob", "sha": "ghi", "size": 50 }
  ]
}
```

[CITED: docs.github.com/enterprise/2.8/developer/v3/git/trees/ recursive example shape — current REST schema matches `sha` / `url` / `truncated` / `tree[]`.]

### Loadable extension (not language-map)

```typescript
const LOADABLE = new Set(['.ts', '.tsx', '.js', '.jsx'])

export function isLoadablePath(path: string): boolean {
  const base = path.slice(path.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return false
  return LOADABLE.has(base.slice(dot).toLowerCase())
}
```

`.d.ts` → `.ts` (loadable / “not yet”). `.mjs` → blocked. `.gitignore` (`dot === 0`) → blocked.

### Disclosure tree (first level open)

```tsx
// Source: MDN details element — boolean `open`; nested allowed
function Dir({ node, depth }: { node: DirNode; depth: number }) {
  return (
    <li>
      <details open={depth === 0 ? true : undefined}>
        <summary>{node.name}</summary>
        <ul>
          {node.children.map((child) =>
            child.kind === 'dir' ? (
              <Dir key={child.path} node={child} depth={depth + 1} />
            ) : (
              <FileLi key={child.path} node={child} />
            ),
          )}
        </ul>
      </details>
    </li>
  )
}
```

File button: `className={isLoadablePath(node.path) ? undefined : 'text-muted'}`. Folders never muted (D-13).

### Last-wins Import (CorpusInput analogue)

```tsx
const importTokenRef = useRef(0)
async function onImport() {
  const token = ++importTokenRef.current
  setBusy(true)
  setStatus(null)
  try {
    const ref = parseGithubRef(value) // may throw before fetch
    const result = await fetchRepoTree(ref)
    if (importTokenRef.current !== token) return
    setTree(result) // last-wins: different repo replaces immediately
  } catch (err) {
    if (importTokenRef.current !== token) return
    setStatus(mapError(err))
  } finally {
    if (importTokenRef.current === token) setBusy(false)
  }
}
```

Wrap the field + Import in `<form onSubmit={(e) => { e.preventDefault(); void onImport() }}>`.

### Vitest: zero live GitHub

```typescript
// client.test.ts — vite unit project (node)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

it('does not call the network on a cache hit', async () => {
  const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
  fetchMock
    .mockResolvedValueOnce(jsonRes({ default_branch: 'main' }))
    .mockResolvedValueOnce(jsonRes({ sha: 'aaa', truncated: false, tree: [] }))
  await fetchRepoTree({ owner: 'o', repo: 'r' })
  await fetchRepoTree({ owner: 'o', repo: 'r' })
  expect(fetchMock).toHaveBeenCalledTimes(2) // not 4
})
```

Also assert every `fetch` URL starts with `https://api.github.com/` and headers equal `{ Accept: 'application/vnd.github+json' }` only.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Unversioned GitHub REST | `X-GitHub-Api-Version` + dated versions (`2022-11-28`, `2026-03-10`) | 2022 versioning; `2026-03-10` is current | Omitting the header **defaults to 2022-11-28**, supported until 2028-03-10 [VERIFIED: API versions]. Safe for this phase. |
| Octokit in the browser | raw `fetch` + `Accept` only | CORS preflight on version header (2023, github/docs#24706; later claimed fixed) | Still omit the version header (lock + no preflight) |
| COEP `require-corp` forbids all third-party | cors-mode fetch allowed; `credentialless` keeps isolation | MDN COEP | Keep require-corp |

**Deprecated/outdated:**
- JSONP `?callback=` for GitHub: do not use (CSP `script-src`, XSS). CORS GET is the supported browser path.
- GitHub tarball/zipball from the browser: `codeload.github.com` drops CORS.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Scheme-less `github.com/owner/repo` should be accepted by prefixing `https://` | URL parse | If UI-SPEC forbids it, drop the prefix branch; D-09 lists the https form and `owner/repo` only |
| A2 | HTTP 409 on git trees in this app is an empty repository | Error mapping | A legal-hold 409 would get empty-repo copy; still better than “Failed to fetch” |
| A3 | GitHub CORS still exposes `x-ratelimit-*` to JS (documented Expose-Headers) | Rate limit | If a browser hides them, show rate-limit copy without a clock |
| A4 | `Accept: application/vnd.github+json` stays CORS-safelisted (no `+` in the unsafe-byte list) | Headers | If a browser preflights anyway, GitHub still allows GET; do not add extra headers |
| A5 | Owner regex `[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?` and repo `[A-Za-z0-9._-]+` match public GitHub names | URL parse | Unusual org names would 404 after fetch; tighten/loosen in UI-SPEC if needed |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

Discretion items (copy strings, caption, last-wins) are **not** assumptions — they are assigned to UI-SPEC / planner.

## Open Questions (RESOLVED)

1. **Exact user-facing copy** — RESOLVED in `07-UI-SPEC.md` Copywriting Contract
   (verbatim `COPY` keys, including `rateLimitedUnknown`).
2. **Live COEP × GitHub in the operator's Chromium** — RESOLVED as the
   `07-03-PLAN.md` verification `<human-check>` step 5 (`credentialless`
   fallback only; never strip isolation).
3. **Caption `owner/repo@default_branch`** — RESOLVED in `07-UI-SPEC.md`
   Caption row: `{owner}/{repo}@{defaultBranch}` interpolates the API
   `default_branch`. HTTP 409 captions from `EmptyRepoError.owner/repo/defaultBranch`
   (see 07-01/07-02/07-03 empty-success contract).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, Vite | ✓ | v24.16.0 | — |
| pnpm | install/scripts | ✓ | 11.5.3 | — |
| curl | human COOP/COEP header check | ✓ | /usr/bin/curl | — |
| GitHub REST `api.github.com` | live Import | not probed this session (do not burn 60 req/h from research) | — | Fixtures in tests; human live Import in Chromium |
| Context7 MCP / `ctx7` CLI | docs lookup | ✗ | — | Official pages via WebFetch (done) |

**Missing dependencies with no fallback:** none for planning/execution of code. Live GitHub is a **human-check**, not a unit-test dependency.

**Missing dependencies with fallback:** Context7 → official docs.github.com / MDN.

**Step 2.6 note:** No extra CLI (no Octokit, no git clone). Browser `fetch` is the runtime.

## Security Domain

`security_enforcement` is enabled (`.planning/config.json`). ASVS level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unauthenticated public reads only; never `Authorization` |
| V3 Session Management | no | No GitHub session; app has no accounts |
| V4 Access Control | no | Single-user local SPA |
| V5 Input Validation | yes | Allowlist parse (`github.com` / `owner/repo` only); `encodeURIComponent` path params; extension allowlist for click behavior |
| V6 Cryptography | no | No tokens, no hashing of corpus |
| V14 Configuration | yes | CSP `connect-src`; COOP/COEP stay; README egress sentence |

### Known Threat Patterns for GitHub-in-the-browser SPA

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via file/dir names or README | Tampering / Elevation | React text nodes only; no `innerHTML`; no markdown |
| SSRF / fetch-to-arbitrary-URL | Information disclosure | Parse allowlist; `client.ts` concatenates `https://api.github.com/repos/${enc(owner)}/${enc(repo)}/...` — never `fetch(userString)` |
| CSP bypass / extra egress | Information disclosure | `connect-src` only `'self'` + `https://api.github.com`; grep `fetch` = `client.ts` only |
| Rate-limit exhaustion | Denial of service (self) | No fetch-on-paste; cache + in-flight; named 403/429 copy that tells the user to wait |
| Token theft | Information disclosure | No PAT (REPO-06 deferred) |
| Private-repo existence leak | Information disclosure | Trust GitHub’s 404 for private; do not add a second probe |
| Mixed content | Tampering | HTTPS API only |
| Open redirect off GitHub | Spoofing | `fetch` follows 301 on `api.github.com` only; constructed URLs never include user path after owner/repo |

Planner threat-model tasks: CSP edit, README, `fetch` grep, `innerHTML` grep, URL allowlist tests.

## Sources

### Primary (HIGH confidence — official pages, fetched this session)
- https://docs.github.com/en/rest/git/trees — Get a tree, `recursive` any-value trap, 100k / 7 MB, `truncated`, `tree_sha` = SHA or ref, status 409
- https://docs.github.com/en/rest/repos/repos#get-a-repository — `default_branch`, 200/301/403/404
- https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api — 60/h unauthenticated, headers, 403/429
- https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests — `ACAO: *`, Expose-Headers includes `x-ratelimit-*`, preflight Allow-Headers list
- https://docs.github.com/en/rest/using-the-rest-api/getting-started-with-the-rest-api — `Accept: application/vnd.github+json`, User-Agent required
- https://docs.github.com/en/rest/about-the-rest-api/api-versions — omit version header → `2022-11-28` until 2028-03-10; current version `2026-03-10`
- https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api — 404 for private, encode slashes `%2F`
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy — cors-mode not blocked by `require-corp`; `credentialless` keeps isolation
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src — `fetch()` is a connect-src sink
- https://developer.mozilla.org/en-US/docs/Glossary/CORS-safelisted_request_header — `Accept` safelisted
- https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details — disclosure widget, boolean `open`, implicit role `group`
- Existing code: `src/ui/App.tsx`, `CorpusInput.tsx`, `ingestion/errors.ts`, `language-map.ts`, `vite.config.ts`, `index.html`, `README.md`

### Secondary (MEDIUM confidence)
- https://github.com/github/docs/issues/24706 — Octokit/`X-GitHub-Api-Version` CORS preflight (closed “fixed” 2023-04; still honor CONTEXT: do not send the header)
- `.planning/research/{FEATURES,ARCHITECTURE,STACK,PITFALLS,SUMMARY}.md` — milestone research, locked into CONTEXT

### Tertiary (LOW confidence)
- classify-confidence seam rates provider `webfetch` as LOW even with `--verified`; used only as a provider rating, not to downgrade GitHub/MDN page content
- A1–A5 in Assumptions Log

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; GitHub REST endpoints and headers verified on official docs
- Architecture: HIGH — matches locked CONTEXT + existing App/CorpusInput hide-not-unmount and error-class patterns
- Pitfalls: HIGH — CSP `connect-src 'none'` confirmed in `index.html`; COEP/CORS/rate-limit/XSS grounded in official docs + prior phases

**Research date:** 2026-09-20
**Valid until:** 2026-10-20 (GitHub REST + COEP are stable; re-check API default version if this phase slips past early 2028)

## Planner checklist (non-normative)

Wave order that matches build-order in ARCHITECTURE.md step 1:

1. **Wave 0:** CSP + README egress sentence + `github/types.ts` + `errors.ts` (no UI). Tests: none yet besides grep-ready structure.
2. **`url.ts` + golden tests** (no network).
3. **`tree.ts` fold + tests** from fixture JSON (truncated, nested, submodule commit, `.mjs` vs `.tsx`).
4. **`client.ts` + mocked fetch tests** (404, 403 remaining=0, 429, 409, truncated 200, cache hit, header allowlist).
5. **`RepoBrowser.tsx`** (form, status roles, disclosures, click notices, last-wins). Does not call `handleLoad`.
6. **`App.tsx` switch** — Paste default; hide-not-unmount both tabs; corpus `display:none` on History/Analytics; update `App.test.tsx`.
7. **Human-check:** `pnpm dev` → Import a small public repo; `curl -sI` still COOP+COEP; `crossOriginIsolated === true`; CSP allows the request.

Do not: blob fetch, `sourceType: 'github'`, Octokit, arborist, branch picker, fetch-on-paste, lazy truncated subtrees.
