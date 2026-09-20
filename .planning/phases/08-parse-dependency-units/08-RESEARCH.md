# Phase 8: Parse & Dependency Units - Research

**Researched:** 2026-09-20
**Domain:** GitHub git-blob fetch + UTF-8/100 KB corpus reuse + tree-sitter WASM unit planner
**Confidence:** HIGH for blob/corpus/CSP; MEDIUM for wasm ABI pin (Wave 0 spike)

Context7 MCP/CLI were unavailable this session (research-plan requested `context7`; no MCP/CLI). Findings below are from official GitHub REST, MDN CSP, and tree-sitter `lib/binding_web/README.md` fetched this session, plus `npm view` on the registry and the live keebdrill codebase. The classify-confidence seam rates `webfetch` LOW even with `--verified`; claims that cite `docs.github.com`, MDN, or the official tree-sitter README are still treated as authoritative because those pages *are* the primary sources.

No `08-CONTEXT.md` — user continued without discuss-phase. Constraints below are project-locked from `PROJECT.md`, `STATE.md`, `REQUIREMENTS.md`, and Phase 7 carried-forward decisions. Treat them as locked.

<user_constraints>
## User Constraints (from PROJECT.md / STATE.md / Phase 7 — no discuss-phase)

### Locked Decisions

- Parser = tree-sitter WASM for TypeScript/JavaScript only (`PROJECT.md` Key Decisions; `STATE.md`).
- Scaffolded file typing chrome is Phase 9. Click-to-type-the-whole-file is never the happy path. Phase 8 fetches, normalizes, tags, and plans units — it does **not** start a whole-file `handleLoad` session (`ROADMAP.md` success criterion 1; Phase 7 D-05/T-07-10).
- Loadable extensions stay exactly `{.ts,.tsx,.js,.jsx}`. `.mjs`/`.cjs`/`.mts`/`.cts` stay blocked (Phase 7 D-05).
- `src/github/client.ts` is the **only** module that may `fetch`. No Octokit. `Accept: application/vnd.github+json` only — never `X-GitHub-Api-Version` or `Authorization`.
- COEP `require-corp` must stay. GitHub is cors-mode `fetch`. If a target browser blocks it, switch to COEP `credentialless` — **never** strip COEP.
- Unauthenticated 60 req/h. Blob **on click only**; cache blob by sha. Zero live `api.github.com` in Vitest.
- Paste/upload path (`fromPaste` / `fromFile` / `normalize`) stays the whole-file corpus path. Reuse `MAX_BYTES` (100_000), UTF-8 BOM sniff, U+FFFD scan, and `normalize()` — do not invent a parallel pipeline (FILE-01).
- `SourceType` gains `'github'`. `sourceRef` holds repo and path so History can show origin (FILE-02). Dexie `version(1)` stays — `exercise` is an unindexed blob; additive union, no data migration.
- Unit policy (PLAN-01): non-overlapping syntactic units — top-level functions, import/type blocks; **a class is one unit**; nested functions stay inside their parent. Class-method split is PLAN-05 (deferred).
- Units ordered by in-file dependencies: indispensable/leaf units first, then dependents (PLAN-02).
- If the file cannot be split: whole file is the single unit, with a notice — never a silent no-op (PLAN-03).
- Tree text / blob text render as React text nodes / `textContent` only. No `innerHTML`, no syntax-highlighter DOM sinks.
- Phase 7 D-07: no pending-file selection API. Phase 8 starts from a **fresh click**.
- Third-party corpus stays local. README must say GitHub.com is allowed egress for **corpus listing and blob contents**; keystroke logs still never leave.

### Claude's Discretion (no discuss-phase — research recommendations below)

- Exact COPY strings for loading / planned N units / fallback / blob errors (Phase 8 has no UI-SPEC).
- `sourceRef` string shape (`owner/repo:path` recommended).
- Whether consecutive `import_statement` nodes merge into one block (recommended: yes) and whether consecutive type-only decls merge (recommended: no — each is a unit).
- `.js` grammar: typescript wasm vs `tree-sitter-javascript` (recommended: typescript + tsx only; see Standard Stack).
- Winning wasm ABI pin after Wave 0 (`web-tree-sitter` 0.27.0 vs 0.25.10 vs rebuilt grammar wasm).
- Whether `FilePlan` lives in `App` state (recommended: yes, for Phase 9) vs only inside `RepoBrowser`.
- Committing copied `.wasm` into `public/` (recommended: yes).

### Deferred Ideas (OUT OF SCOPE)

- SCAF-01..05 scaffolded trainer chrome (Phase 9). Do not change `capture.ts`. Do not put the full file in the textarea.
- PLAN-04 other languages; PLAN-05 class methods as separate units.
- REPO-05 branch/tag/SHA picker; REPO-06 private repos / PAT.
- `.mjs`/`.cjs` as loadable.
- Prefetching blobs on Import; `raw.githubusercontent.com` / tarball / `codeload.github.com`.
- Octokit, isomorphic-git, Monaco/CodeMirror, TypeScript compiler API as the parser.
- Remember last URL / last tab; auto-expand deep blob paths.
- Worker-thread parse; CDN-hosted wasm.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FILE-01 | Click a TS/JS file → blob loaded as corpus under the same 100 KB cap and UTF-8 rules as upload, then `normalize()` like paste/upload — **not** started as a whole-file typing session | `GET .../git/blobs/{sha}`; check `size` before `atob`; reuse `MAX_BYTES`, BOM sniff, U+FFFD, `normalize()`; `RepoBrowser` must not call `handleLoad` |
| FILE-02 | Resulting exercise tagged `sourceType: 'github'` with repo and path in `sourceRef` so History can show origin | Extend `SourceType`; `fromGithubBlob` sets `sourceRef: `${owner}/${repo}:${path}``; `HistoryView` currently maps anything non-upload to “Pasted snippet” — must grow a github branch |
| PLAN-01 | Split into non-overlapping syntactic units (top-level functions, import/type blocks; class = one unit; nested functions stay inside parent) | Walk `program` named children; `function_declaration` / arrow-bound `lexical_declaration`; merge consecutive imports; `class_declaration` as one range; inject a `SyntaxNode`-like fixture in tests (no WASM) |
| PLAN-02 | Type those units in dependency order: leaf/indispensable first, then dependents | In-file identifier def/use graph + Kahn topo; cycles keep source order; imports are in-degree 0 so they come first |
| PLAN-03 | If the file cannot be split: whole file is the single unit, with a notice — never a silent no-op | `units.length === 0` or parse/`Language.load` throw → `{ fallback: true, units: [wholeFile] }` + status copy; never swallow the click |
</phase_requirements>

## Project Constraints (from .cursor/rules/)

No `.cursor/rules/` or project skills directory exists. Follow existing house style: platform seam (`client.ts` / new `parse/wasm.ts`), typed errors + inline render, `COPY` const in the UI file, hide-not-unmount, React text nodes only, Vitest fixtures (zero live GitHub, zero WASM in unit tests).

## Summary

Phase 8 has three seams, not one: (1) fetch a git blob through the existing GitHub client, (2) run that payload through the **existing** upload corpus rules, (3) parse with tree-sitter WASM and emit a dependency-ordered `FilePlan`. The trainer stays idle. `handleLoad` is still the paste/upload whole-file path; a GitHub click that calls it would ship the happy path the user rejected.

The dangerous parts are policy, not novel algorithms. Today’s CSP `default-src 'self'` will **block `WebAssembly.instantiate`** unless `script-src` gains `'wasm-unsafe-eval'`. `web-tree-sitter@0.27.0` ships `web-tree-sitter.wasm` (not the README’s older `tree-sitter.wasm` name). Prebuilt grammar wasm from `tree-sitter-typescript@0.23.2` (dated 2024-11-11) may use the legacy `dylink` section that `web-tree-sitter` ≥ 0.26 rejects — Wave 0 must pin ABI before any planner code depends on a live parse. `HistoryView` will mislabel github sessions as “Pasted snippet” until FILE-02 lands.

**Primary recommendation:** Wave 0 wasm ABI spike first. Then extend `client.ts` with `fetchGithubBlob` (cache-by-sha, size gate, same headers), add `ingestion/github.ts` that reuses `MAX_BYTES`/`normalize`/UTF-8, add a pure `src/parse/plan.ts` behind a WASM seam, wire TS/JS clicks to status copy + `onPlanned(FilePlan)` — never `handleLoad`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Blob fetch (`GET /git/blobs/{sha}`) | Browser / Client | External: `api.github.com` | SPA has no backend; `client.ts` stays the only `fetch` |
| 100 KB + UTF-8 + `normalize` | Browser / Client (pure ingestion) | — | Same rules as `fromFile`; no network |
| `sourceType: 'github'` + History label | Browser / Client | Database / Storage (IndexedDB blob) | Tag at ingest; Dexie already stores whole `Exercise`; History reads it later (Phase 9 persist) |
| WASM runtime + grammar load | Browser / Client | CDN / Static (`public/*.wasm`) | Same-origin wasm so COEP `require-corp` holds |
| Syntactic unit split | Browser / Client (pure planner) | — | Walk a tree-sitter `Tree`; tests inject fixtures |
| In-file dependency order | Browser / Client (pure planner) | — | Identifier graph + topo; no typechecker |
| Fallback whole-file unit + notice | Browser / Client | — | PLAN-03; status region already exists |
| CSP `wasm-unsafe-eval` | CDN / Static (`index.html`) | — | `default-src 'self'` currently blocks Wasm compile |
| COOP/COEP headers | CDN / Static (`vite.config.ts`) | — | Unchanged `require-corp` |
| Capture / trainer chrome | — | Phase 9 | Out of scope; do not call `handleLoad` |

This app has **no API / Backend tier**. Do not invent a proxy or worker origin.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| GitHub REST git blobs | Unversioned request → API **2022-11-28** default when `X-GitHub-Api-Version` is omitted [CITED: docs.github.com/en/rest/git/blobs] | `GET /repos/{owner}/{repo}/git/blobs/{file_sha}` | Locked client. Content is **always Base64** in the JSON body. Max blob 100 MB (we cap 100 KB). Same CORS + headers as Phase 7 trees. |
| Existing `normalize` / `MAX_BYTES` / `CorpusTooLargeError` / `NonUtf8Error` | already in `src/ingestion/` | FILE-01 corpus rules | Do not fork. |
| `web-tree-sitter` | **0.27.0** current on npm (modified 2026-08-30); Wave 0 may pin **0.25.10** if 0.27 rejects grammar wasm [CITED: github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/README.md] | `Parser.init` + `Language.load` | Official WASM binding. Runtime asset in 0.27 is `web-tree-sitter.wasm` (`npm pack --dry-run` this session). Serve same-origin from `public/`. |
| `tree-sitter-typescript` | **0.23.2** (npm, 2024-11-11) [CITED: github.com/tree-sitter/tree-sitter-typescript README] | `tree-sitter-typescript.wasm` + `tree-sitter-tsx.wasm` | Official grammars. `.ts` → typescript; `.tsx` **and `.jsx`** → tsx. `.js` → typescript grammar (see Alternatives). Native `node-gyp-build` bindings unused in the browser. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tree-sitter-javascript` | **0.25.0** (latest; **0.23.2 does not exist** on npm — versions jump 0.23.1 → 0.25.0) [VERIFIED: `npm view tree-sitter-javascript versions`] | `tree-sitter-javascript.wasm` | Only if Wave 0 shows typescript grammar systematically failing real `.js` fixtures. Do not install by default. |
| `tree-sitter-cli` | **0.27.0** (matches runtime) [CITED: binding_web README “Generating .wasm files”] | `tree-sitter build --wasm` | Only if prebuilt grammar wasm fails `Language.load` on both 0.27.0 and 0.25.10. Has `install: node install.js` (downloads a binary) — do not add unless the spike needs it. |
| Existing Vitest 4.1 / happy-dom | already in `package.json` | Unit + UI tests | Planner tests inject a `SyntaxNode`-like fixture. Blob tests `vi.stubGlobal('fetch')`. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| GitHub git blobs JSON | `Accept: application/vnd.github.raw+json` | Different Accept → CORS preflight risk. Locked Accept-only. |
| GitHub git blobs | `raw.githubusercontent.com` | Would widen `connect-src`. Fine as a later fallback; not this phase. |
| GitHub git blobs | `GET /repos/.../contents/{path}` | Needs path+ref; tree already has content-addressed `sha`. Blobs is the right object. |
| `web-tree-sitter` | TypeScript compiler API (`typescript` package) | ~10 MB typechecker, not a range API. Locked out. |
| `web-tree-sitter` | `@lezer/javascript` | Editor parser. We need named node types + ranges, not CM6. |
| typescript+tsx wasm only | Also `tree-sitter-javascript@0.25.0` | More accurate JS (HTML comments, `with`). Extra wasm + ABI matrix. PLAN-03 covers parse failure. |
| `web-tree-sitter@0.27.0` | Pin `0.25.10` | 0.25.10 is more likely to load 2024 prebuilt wasm (legacy `dylink`). Prefer this **over** adding `tree-sitter-cli` if 0.27 fails. |
| Main-thread parse | Worker | 100 KB parse is cheap; worker-src CSP + COEP worker scripts are extra surface. Skip. |

**Installation (after Wave 0 confirms the runtime pin):**

```bash
pnpm add web-tree-sitter@0.27.0
pnpm add -D tree-sitter-typescript@0.23.2
# If node-gyp-build fails on the grammar package:
#   pnpm add -D tree-sitter-typescript@0.23.2 --ignore-scripts

# Copy same-origin wasm (adjust names after ls node_modules/web-tree-sitter/*.wasm):
mkdir -p public/wasm
cp node_modules/web-tree-sitter/web-tree-sitter.wasm public/web-tree-sitter.wasm
cp node_modules/tree-sitter-typescript/tree-sitter-typescript.wasm public/wasm/
cp node_modules/tree-sitter-typescript/tree-sitter-tsx.wasm public/wasm/
```

**Version verification (this session, 2026-09-20):**

| Package | `npm view` version | Modified | Notes |
|---------|-------------------|----------|-------|
| `web-tree-sitter` | 0.27.0 | 2026-08-30 | Also 0.25.10 exists |
| `tree-sitter-typescript` | 0.23.2 | 2024-11-11 | Ships both `.wasm` files (`npm pack --dry-run`) |
| `tree-sitter-javascript` | 0.25.0 latest | 2026-05-18 | **0.23.2 → 404**. 0.25.0 ships `tree-sitter-javascript.wasm` |
| `tree-sitter-cli` | 0.27.0 | 2026-08-30 | Optional rebuild only |

STACK.md’s `web-tree-sitter@0.25.10` + `tree-sitter-javascript@0.23.2` pin is **stale**: JS 0.23.2 is not on the registry, and 0.27.0 renamed the runtime wasm file.

## Package Legitimacy Audit

> Seam `gsd-tools query package-legitimacy check` returned **SUS** for every package with `signals.exists/publishedAt/weeklyDownloads/repoUrl = null` (`unknown-age`, `unknown-downloads`, `no-repository`). That is a **probe failure in this environment**, not a slopsquat signal. Independent `npm view` this session: all four packages exist, MIT, repository `git+https://github.com/tree-sitter/tree-sitter.git` (or `.../tree-sitter-typescript.git` / `.../tree-sitter-javascript.git`). Official tree-sitter README names `web-tree-sitter` and grammar packages explicitly.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `web-tree-sitter` | npm | since 2019 (created); 0.27.0 on 2026-08-30 | npm page reports millions/wk [CITED: registry.npmjs.org/web-tree-sitter] | github.com/tree-sitter/tree-sitter (`lib/binding_web`) | seam [SUS] / docs OK | Approved **after** `checkpoint:human-verify` (protocol for SUS) |
| `tree-sitter-typescript` | npm | 0.23.2 on 2024-11-11; package since 2017 | ~700k/wk on registry page | github.com/tree-sitter/tree-sitter-typescript | seam [SUS] / docs OK | Approved after human-verify |
| `tree-sitter-javascript` | npm | 0.25.0 on 2026-05-18 | — | github.com/tree-sitter/tree-sitter-javascript | seam [SUS] | **Do not install by default** |
| `tree-sitter-cli` | npm | 0.27.0 on 2026-08-30 | — | github.com/tree-sitter/tree-sitter | seam [SUS]; `scripts.install` = `node install.js` (binary download) | **Do not install unless Wave 0 rebuild is required** |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** all four from the seam (null signals). Planner inserts `checkpoint:human-verify` before `pnpm add`. Grammar packages run `install: node-gyp-build` (native addon, unused in browser) — prefer `--ignore-scripts` if CI lacks a compiler.

**Postinstall review:** `web-tree-sitter` has **no** `scripts.postinstall`. `tree-sitter-typescript` / `tree-sitter-javascript` `install` = `node-gyp-build` (local compile, not a network dropper). `tree-sitter-cli` `install` downloads a CLI binary — treat as high-risk optional.

## Architecture Patterns

### System Architecture Diagram

```
User clicks .ts/.tsx/.js/.jsx in RepoBrowser
        │
        ├─ not loadable / entryType==='commit' ──► status blocked (unchanged)
        └─ loadable
                │
                ▼
 github/client.fetchGithubBlob(owner, repo, sha)
   cache hit by sha? ──yes──► bytes
        │ no
        ▼
 GET https://api.github.com/repos/{o}/{r}/git/blobs/{sha}
     Accept: application/vnd.github+json
     mode: cors, credentials: omit
        ├─ 404 → RepoNotFoundError / GithubHttpError
        ├─ 403 remaining=0 / 429 → RateLimitedError
        ├─ JSON.size > MAX_BYTES → CorpusTooLargeError  (no atob)
        └─ 200 { content: base64, encoding, size, sha }
                │
                ▼
 strip newlines → atob → Uint8Array
                │
                ▼
 ingestion/github.fromGithubBlob(bytes, { owner, repo, path })
   1. size (already gated) / BOM sniff / decode UTF-8 / U+FFFD
   2. normalize(raw)           ← SAME as upload
   3. Exercise { sourceType:'github', sourceRef:'owner/repo:path',
                 language: extToLang(path), text }
                │
                ▼
 parse/wasm.ensureParser()     ← Parser.init({ locateFile: name => `/${name}` })
 parse/wasm.parse(text, dialect) → Tree | throw
                │
        ┌───────┴────────┐
        │ fail / empty   │ success
        ▼                ▼
 PLAN-03 fallback     parse/plan.planUnits(tree, text)
 whole file = 1 unit    namedChildren → units (class=1, nested stay)
 notice in status       identifier graph → topo (leaves first)
        │                │
        └───────┬────────┘
                ▼
 FilePlan { exercise, units, fallback }
        │
        ▼
 App.onPlanned(plan)  — HOLD IN MEMORY
 status role="status" planned | fallback
 CaptureSurface / handleLoad  NOT called   ← Phase 9 consumes FilePlan
```

CSP sits in front of both fetch and wasm: `connect-src` already allows `api.github.com`; `script-src` must allow `'wasm-unsafe-eval'` before `Parser.init`.

### Recommended Project Structure

```
src/
├── github/
│   ├── client.ts          # ADD fetchGithubBlob; still the only fetch
│   ├── client.test.ts     # ADD blob fixtures; still stub fetch
│   ├── types.ts           # ADD size? on FileNode if fold copies it
│   └── tree.ts            # optionally copy entry.size onto FileNode
├── ingestion/
│   ├── types.ts           # SourceType += 'github'
│   ├── github.ts          # NEW fromGithubBlob — reuse MAX_BYTES/normalize/errors
│   ├── github.test.ts     # golden: cap, BOM, U+FFFD, sourceRef, normalize
│   ├── upload.ts          # UNCHANGED (fromFile)
│   └── normalize.ts       # UNCHANGED
├── parse/
│   ├── types.ts           # FilePlan, PlanUnit
│   ├── utf16.ts           # PURE utf16 index → code-point offset
│   ├── plan.ts            # PURE Tree-like → units + topo
│   ├── plan.test.ts       # fixtures, no WASM
│   └── wasm.ts            # DIRTY Parser.init / Language.load seam
├── ui/
│   ├── RepoBrowser.tsx    # TS/JS click fetches+plans; still no handleLoad
│   ├── HistoryView.tsx    # github sourceLabel
│   └── App.tsx            # onPlanned holds FilePlan; handleLoad unchanged
public/
├── web-tree-sitter.wasm   # copied; locateFile target
└── wasm/
    ├── tree-sitter-typescript.wasm
    └── tree-sitter-tsx.wasm
index.html                 # script-src 'self' 'wasm-unsafe-eval'
README.md                  # listing + blob egress; wasm same-origin
```

Do **not** put `fetch` in `parse/` or `ingestion/`. Do **not** import `web-tree-sitter` from `plan.ts`.

### Pattern 1: Blob fetch stays in the GitHub platform seam

**What:** `fetchGithubBlob` lives next to `fetchRepoTree`. Same `githubGet`, same error mapper, new cache keyed by blob `sha` (content-addressed — sha is enough).
**When to use:** Always for FILE-01.

```typescript
// Source: docs.github.com/en/rest/git/blobs + existing src/github/client.ts githubGet
export async function fetchGithubBlob(
  ref: RepoRef,
  sha: string,
): Promise<{ sha: string; size: number; bytes: Uint8Array }> {
  const cached = blobCache.get(sha)
  if (cached) return cached
  const inflight = blobInflight.get(sha)
  if (inflight) return inflight
  const pending = (async () => {
    const res = await githubGet(
      `/repos/${enc(ref.owner)}/${enc(ref.repo)}/git/blobs/${enc(sha)}`,
    )
    const body = (await readGithub(res)) as {
      content: string
      encoding: string
      size: number | null
      sha: string
    }
    const size = body.size ?? 0
    if (size > MAX_BYTES) throw new CorpusTooLargeError(size)
    const b64 = body.content.replace(/\n/g, '')
    const binary = atob(b64)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    if (bytes.byteLength > MAX_BYTES) throw new CorpusTooLargeError(bytes.byteLength)
    const out = { sha: body.sha, size: bytes.byteLength, bytes }
    blobCache.set(sha, out)
    return out
  })().finally(() => blobInflight.delete(sha))
  blobInflight.set(sha, pending)
  return pending
}
```

Tree `FileNode` should carry `size?: number` from `GitTreeEntry.size` so the UI can refuse oversize **before** the GET when GitHub already reported size.

### Pattern 2: Ingestion reuses upload rules; only the tag changes

**What:** `fromGithubBlob` is `fromFile` without `File.text()`. Same order: size (already gated) → UTF-16 BOM sniff on first two bytes → decode UTF-8 → U+FFFD scan → `normalize` → `Exercise`.
**When to use:** Always (FILE-01/FILE-02).

```typescript
// Source: src/ingestion/upload.ts order (load-bearing)
export function fromGithubBlob(
  bytes: Uint8Array,
  meta: { owner: string; repo: string; path: string },
  tabWidth = 4,
): Exercise {
  if (bytes.byteLength > MAX_BYTES) throw new CorpusTooLargeError(bytes.byteLength)
  if (
    bytes.length >= 2 &&
    ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))
  ) {
    throw new NonUtf8Error(meta.path)
  }
  const raw = new TextDecoder('utf-8').decode(bytes)
  if (raw.includes('�')) throw new NonUtf8Error(meta.path)
  return {
    text: normalize(raw, { tabWidth }),
    language: extToLang(meta.path),
    sourceType: 'github',
    sourceRef: `${meta.owner}/${meta.repo}:${meta.path}`,
  }
}
```

`sourceRef` format `owner/repo:path` is discretion (FILE-02 only requires repo and path). Do not put a SHA in the History label.

### Pattern 3: WASM seam vs pure planner

**What:** `wasm.ts` is the only importer of `web-tree-sitter`. `plan.ts` accepts a structural `TsNode` (`type`, `startIndex`, `endIndex`, `namedChildren`, optional `childForFieldName('name')`). Unit tests never boot WASM.
**When to use:** Always. Matches `persistence/db.ts` / `github/client.ts`.

```typescript
// Source: tree-sitter lib/binding_web/README.md (Parser.init, Language.load)
import { Parser, Language } from 'web-tree-sitter'

let initOnce: Promise<void> | null = null
const langs = new Map<string, Language>()

export function ensureParser(): Promise<void> {
  initOnce ??= Parser.init({
    locateFile: (scriptName: string) => `/${scriptName}`,
  })
  return initOnce
}

export async function loadDialect(kind: 'typescript' | 'tsx'): Promise<Language> {
  const hit = langs.get(kind)
  if (hit) return hit
  const path =
    kind === 'tsx' ? '/wasm/tree-sitter-tsx.wasm' : '/wasm/tree-sitter-typescript.wasm'
  const lang = await Language.load(path)
  langs.set(kind, lang)
  return lang
}
```

Dialect map: `.ts`/`.js` → `typescript`; `.tsx`/`.jsx` → `tsx` [CITED: tree-sitter-typescript README — two dialects; Flow/JSX → tsx].

### Pattern 4: Non-overlapping cover + class-as-one-unit

**What:** Walk `program` **named** children only (not every descendant `function_declaration`). Nested functions therefore stay inside the parent range.
**When to use:** PLAN-01.

| Top-level node | Unit kind | Notes |
|----------------|-----------|-------|
| consecutive `import_statement` | `import` | Merge into one block |
| `function_declaration`, `generator_function_declaration` | `function` | Name from `name` field |
| `lexical_declaration` / `variable_declaration` whose declarator value is `arrow_function` or `function`/`function_expression` | `function` | `const f = () =>` |
| `class_declaration`, `abstract_class_declaration` | `class` | **Whole node**, including methods |
| `interface_declaration`, `type_alias_declaration`, `enum_declaration` | `type` | One unit each (do not merge) |
| `export_statement` | unwrap | Use declaration’s kind; range = the **export_statement** node (includes `export`) |
| other named children (`expression_statement`, `ambient_declaration`, …) | `other` | Still a unit so leftover code is typed |
| empty namedChildren / only `ERROR` / throw | fallback | PLAN-03: one `file` unit covering all of `exercise.text` |

Node type names: `function_declaration`, `class_declaration`, `import_statement`, `export_statement`, `lexical_declaration`, `interface_declaration`, `type_alias_declaration`, `enum_declaration`, `generator_function_declaration`, `abstract_class_declaration`, `program` [CITED: tree-sitter-typescript `typescript/src/node-types.json`].

Convert every `startIndex`/`endIndex` through `utf16ToCodePoint` before slicing `Array.from(text)` (Phase 3 Unicode bug).

### Pattern 5: Leaves-first topo, cycles keep source order

**What:** Unit A depends on B if A’s body contains an `identifier` or `type_identifier` whose name is **defined** by B (function/class/binding/type name). Imports define the names in their specifiers. Edges B→A mean “B before A”. Kahn’s algorithm; remaining cycle: stable sort by original source `start`.
**When to use:** PLAN-02.

Ignore `property_identifier` (`foo.bar` — only `foo` is an in-file ref). Do not resolve imported modules (in-file only). A function that calls a sibling is a dependent; the callee is a leaf relative to it.

### Pattern 6: Click plans; trainer stays idle

**What:** `RepoBrowser` grows `onPlanned?: (plan: FilePlan) => void`. App stores the plan. `handleLoad` stays paste/upload-only. Status region: loading / planned / fallback / corpus errors. Replace Phase 7 `COPY.notYet`.
**When to use:** Success criteria 1 and 5.

Last-wins token already on Import — **reuse it** (or a second token) for blob clicks so a slow first click cannot overwrite a faster second click.

### Anti-Patterns to Avoid

- **`handleLoad(exercise)` on TS/JS click:** ships whole-file typing. Hold `FilePlan` instead.
- **Fetching `raw.githubusercontent.com`:** extra CSP origin. Blobs API is already allowlisted.
- **`Accept: application/vnd.github.raw+json`:** extra header, possible preflight.
- **Prefetch every blob on Import:** 60 req/h death. Click only; cache by sha.
- **`Parser.init` without `locateFile`:** Vite serves JS from `/src/...` or a hashed chunk; wasm 404s. Copy to `public/` and return `/${scriptName}`.
- **CDN wasm / `unpkg`:** COEP `require-corp` blocks cross-origin wasm without CORP.
- **Walking every `function_declaration` descendant:** nested functions become overlapping units (PLAN-01 violation).
- **Splitting `method_definition`:** PLAN-05. Class is one unit.
- **Slicing with UTF-16 indices on `Array.from` text:** Phase 3 uncompletable-exercise bug returns.
- **Unit tests that `Language.load`:** flaky ABI, slow, needs public wasm in Vitest. Inject a fixture tree.
- **Silent `units = []`:** PLAN-03 forbids it. Fallback + notice.
- **`HistoryView` ternary `upload ? ref : 'Pasted snippet'`:** github becomes “Pasted snippet” (FILE-02).
- **`'unsafe-eval'` in CSP:** too broad. Use `'wasm-unsafe-eval'` only.
- **Stripping COEP when wasm “fails”:** timer resolution dies. Fix locateFile/CSP/ABI instead.
- **`innerHTML` of blob text:** XSS (Pitfall 8).
- **Dexie `version(2)` for sourceType:** unnecessary; `exercise` is unindexed structured-clone JSON.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TS/JS parse to ranges | Regex / brace counter | tree-sitter WASM | Nested templates, JSX, `ERROR` nodes; regex will overlap units |
| UTF-8 decode | Manual charset sniff | `TextDecoder` + existing U+FFFD/BOM rules | Upload already solved this |
| Base64 | Custom decoder | `atob` after stripping GitHub newlines | Platform |
| WASM instantiate under CSP | Disable CSP | `script-src 'self' 'wasm-unsafe-eval'` | MDN: wasm compile is gated on that token |
| CORS proxy for blobs | Vite proxy | Direct cors `fetch` to `api.github.com` | Same as Phase 7 |

**Hand-roll IS required for:** unit cover policy, identifier dependency graph, topo sort, utf16→code-point helper, `fromGithubBlob` glue, RepoBrowser click wiring. Those are the product.

**Key insight:** The parser is a library; the planner is the product. Tests lock the planner against fixtures so a wasm ABI pin cannot silently change unit policy.

## Common Pitfalls

### Pitfall 1: CSP blocks Wasm compile before Parser.init runs

**What goes wrong:** Click looks like a no-op; console: `WebAssembly.instantiate(): Wasm code generation disallowed by embedder` / CSP violation. Engineers “fix” COEP.
**Why it happens:** `index.html` has `default-src 'self'` and no `script-src`. Wasm compile is a `script-src` concern and falls back to `default-src`. Without `'wasm-unsafe-eval'`, instantiation is blocked [CITED: developer.mozilla.org CSP `'wasm-unsafe-eval'`].
**How to avoid:** Set

```
default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https://api.github.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'
```

Do **not** add `'unsafe-eval'`. Keep `connect-src` as-is (no raw.githubusercontent.com).
**Warning signs:** First `Language.load` fails in `pnpm preview` but a Node spike without CSP passes.

### Pitfall 2: Runtime wasm filename + locateFile

**What goes wrong:** `Parser.init` 404s `tree-sitter.wasm` next to a hashed JS chunk. Official README still documents `cp node_modules/web-tree-sitter/tree-sitter.wasm public`.
**Why it happens:** `web-tree-sitter@0.27.0` package files include `web-tree-sitter.wasm`, not `tree-sitter.wasm` (`npm pack --dry-run` this session). 0.26+ also renamed the asset [CITED: tree-sitter issue discussion / binding_web README locateFile].
**How to avoid:** Wave 0 `ls node_modules/web-tree-sitter/*.wasm`. Copy that file to `public/` under the name `locateFile` receives (`scriptName`). `locateFile: (scriptName) => `/${scriptName}``. Commit the copied files so `pnpm preview` and CI do not depend on postinstall.
**Warning signs:** Network 404 on `/_next/`-style or `/src/`-adjacent wasm; empty `Error` from `Language.load`.

### Pitfall 3: Grammar wasm `dylink` vs `dylink.0` (the STATE.md spike)

**What goes wrong:** `Language.load` throws an empty `Error` (`failIf(name2 !== "dylink.0")`). Planner never runs; if uncaught, silent no-op.
**Why it happens:** `web-tree-sitter` ≥ 0.26 requires the modern `dylink.0` section; some prebuilt grammar wasm (and anything built with CLI 0.20) still have legacy `dylink` [CITED: github.com/tree-sitter/tree-sitter/issues/5171]. Parser ABI 13–15 is **not** the same check — ABI can match and load still fail. `tree-sitter-typescript@0.23.2` wasm is from 2024-11 — treat as suspect until the spike says otherwise.
**How to avoid — Wave 0 matrix (run in Node, no CSP):**
1. `web-tree-sitter@0.27.0` + 0.23.2 prebuilt typescript/tsx wasm.
2. If fail: `web-tree-sitter@0.25.10` + same wasm (prefer this over adding CLI).
3. If fail: `tree-sitter-cli@0.27.0` + `tree-sitter build --wasm` and keep runtime 0.27.0.
Lock the winner in PLAN.md before planner integration. Wrap `Language.load` / `parse` in try/catch → PLAN-03 fallback.
**Warning signs:** Empty message `Error` at `Language.load`; Node spike works on 0.25.10 only.

### Pitfall 4: UTF-16 indices vs code-point trainer

**What goes wrong:** Unit slices start one character early after an emoji in a comment. Last unit `end` > `Array.from(text).length`.
**Why it happens:** `SyntaxNode.startIndex` is a JS UTF-16 offset. Capture/metrics iterate code points (`PROJECT.md` Phase 3).
**How to avoid:** One helper `utf16ToCodePoint(text, utf16Index)`. Golden tests: supplementary-plane char **outside** a function and **inside** a function body.
**Warning signs:** Overlay/caret desync on the first file with `😀`.

### Pitfall 5: Overlapping units from descendant walk

**What goes wrong:** `assertNonOverlapping` fails; class methods double-count; “complete the file” never reaches wrapper braces.
**Why it happens:** Collecting every `function_declaration` + `method_definition` + `arrow_function` in the tree.
**How to avoid:** Only `program` named children (plus merged import runs). Class = the `class_declaration` node. Nested arrows stay inside the parent’s range.
**Warning signs:** Two units with `[start,end)` overlap; a method name appears as its own unit.

### Pitfall 6: Empty parse is a silent no-op

**What goes wrong:** WIP / broken `.ts` file click does nothing. tree-sitter returns `ERROR` nodes, not a throw. A planner that only matches `function_declaration` misses `export default function` and `const f = () =>`.
**Why it happens:** PLAN-03 not applied at every failure site (load wasm, parse, zero units).
**How to avoid:** Cover export wrappers and arrow-bound lexicals. If `units.length === 0` **or** any throw: one unit = whole `exercise.text`, status notice, still `onPlanned`. Never `return` without a plan.
**Warning signs:** Click `.ts` → status stays on previous not-yet/blocked string.

### Pitfall 7: History mislabels github as paste

**What goes wrong:** FILE-02 looks done on `Exercise` but History shows “Pasted snippet”.
**Why it happens:** `HistoryView.tsx` `sourceType === 'upload' ? sourceRef : 'Pasted snippet'`.
**How to avoid:** Three-way label: upload → `sourceRef`; github → `sourceRef` (already `owner/repo:path`); else paste. Add a HistoryView test with `sourceType: 'github'`.
**Warning signs:** Fixture session with github source still contains “Pasted snippet”.

### Pitfall 8: 60 req/h on file clicks + StrictMode

**What goes wrong:** Demo opening 10 files plus a failed uncached retry 429s the browser.
**Why it happens:** Each blob is +1 GET. No prefetch, but missing sha cache / inflight map doubles clicks.
**How to avoid:** Cache-by-sha + inflight coalescing (same as tree). Last-wins click token. Tests assert `fetch.mock.calls` length on a second click of the same sha.
**Warning signs:** Two GETs for one sha; 403 remaining=0 after a short browse.

### Pitfall 9: GitHub base64 newlines + size-after-decode

**What goes wrong:** `atob` throws on wrapped base64; or a 100_001-byte file sneaks through because JSON `size` was missing and encoded length was not checked.
**Why it happens:** Blob JSON `content` is wrapped; `size` may be null.
**How to avoid:** `content.replace(/\n/g, '')`. Gate on `size` when present; always re-check `bytes.byteLength`.
**Warning signs:** `InvalidCharacterError` from `atob`; oversize file reaches `normalize`.

## Code Examples

### FILE-01/02 — History label

```tsx
// Source: src/ui/HistoryView.tsx today (must change)
const sourceLabel =
  session.exercise.sourceType === 'paste'
    ? 'Pasted snippet'
    : (session.exercise.sourceRef ??
      (session.exercise.sourceType === 'github' ? 'GitHub file' : 'Uploaded file'))
```

Prefer showing `sourceRef` for both `upload` and `github`.

### PLAN-01 — utf16 → code point

```typescript
// Source: PROJECT.md Phase 3 (Array.from indexing) — implement once, test with U+1F600
export function utf16ToCodePoint(text: string, utf16Index: number): number {
  return Array.from(text.slice(0, utf16Index)).length
}
```

Do not use `text.length` as a code-point length.

### PLAN-02 — Kahn leaves-first

```typescript
// Source: standard topo; keep cycle members in source order
function orderByDeps(units: PlanUnit[]): PlanUnit[] {
  const byId = new Map(units.map((u) => [u.id, u]))
  const indeg = new Map(units.map((u) => [u.id, 0]))
  for (const u of units) for (const d of u.dependsOn) indeg.set(u.id, (indeg.get(u.id) ?? 0) + 1)
  const ready = units.filter((u) => indeg.get(u.id) === 0).sort((a, b) => a.start - b.start)
  const out: PlanUnit[] = []
  while (ready.length) {
    const n = ready.shift()!
    out.push(n)
    for (const u of units) {
      if (!u.dependsOn.includes(n.id)) continue
      const next = (indeg.get(u.id) ?? 0) - 1
      indeg.set(u.id, next)
      if (next === 0) ready.push(u)
      ready.sort((a, b) => a.start - b.start)
    }
  }
  const leftover = units.filter((u) => !out.includes(u)).sort((a, b) => a.start - b.start)
  return out.concat(leftover)
}
```

### PLAN-03 — fallback unit

```typescript
function fallbackPlan(exercise: Exercise, notice: string): FilePlan {
  const end = Array.from(exercise.text).length
  return {
    exercise,
    fallback: true,
    notice,
    units: [{ id: 'file', kind: 'file', start: 0, end, dependsOn: [] }],
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| STACK.md `tree-sitter.wasm` copy | `web-tree-sitter.wasm` in npm 0.27 | 0.26+ | locateFile + public/ filenames |
| STACK.md `tree-sitter-javascript@0.23.2` | **Version does not exist**; latest 0.25.0 | verified 2026-09-20 | Do not pin 0.23.2 |
| `web-tree-sitter` 0.25.x dylink tolerant | 0.26+ requires `dylink.0` | 0.26 / issue #5171 | Wave 0 spike is load-bearing |
| Phase 7 browse-only TS/JS click | Phase 8 blob + plan, still no trainer | this phase | Replace `COPY.notYet` |
| `SourceType` paste\|upload | + `github` | this phase | History label; no Dexie bump |
| CSP `default-src 'self'` | Need `script-src 'self' 'wasm-unsafe-eval'` | this phase | Else wasm never compiles |

**Deprecated/outdated:**
- STACK.md install block (`web-tree-sitter@0.25.10` + `tree-sitter-javascript@0.23.2` + `tree-sitter.wasm` filename): do not copy verbatim.
- Official binding_web README `cp tree-sitter.wasm` example: verify package files after install.
- Phase 7 `COPY.notYet` (“next step / browsing only”): delete once clicks plan units.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `.js` files parse well enough with the **typescript** grammar; `.jsx` with **tsx** | Standard Stack | Odd JS (HTML comments, `with`) falls through to PLAN-03 whole-file — acceptable. If many files fallback, add `tree-sitter-javascript@0.25.0` |
| A2 | `sourceRef` = `` `${owner}/${repo}:${path}` `` | FILE-02 / Pattern 2 | Path can contain `:` rarely; History still shows a usable string. User can bikeshed the separator |
| A3 | Consecutive imports merge; consecutive type aliases do **not** | Pattern 4 | More/fewer units than the user imagined; policy is local to `plan.ts` |
| A4 | Phase 8 does not persist sessions; History github label is still required so Phase 9 is not blocked | FILE-02 | Extra HistoryView test this phase |
| A5 | 100 KB tree-sitter parse stays on the main thread without a worker | Architecture | If a huge file janks, Phase 9+ can move parse to a worker (CSP worker-src) |

**Seam-tagged `[ASSUMED]` count:** A1–A5 above are research recommendations, not discuss-phase locks.

## Open Questions

1. **Winning wasm ABI pin**
   - What we know: 0.27.0 is current; 0.23.2 grammar wasm may be `dylink` (legacy); 0.25.10 is the documented compatibility pin; CLI rebuild is last resort (`install.js` downloads a binary).
   - What's unclear: which combo `Language.load`s typescript+tsx wasm **in this repo** under Node and under `pnpm preview` (CSP+COEP).
   - Recommendation: Wave 0 spike is the first plan; do not write `wasm.ts` against an unverified pin.

2. **COPY strings**
   - What we know: Phase 8 has no UI-SPEC (`ROADMAP` UI hint is on Phase 9, not 8). Status region + role split already exist.
   - What's unclear: exact sentences for loading / N units / fallback / blob 404.
   - Recommendation: planner drafts COPY in `RepoBrowser.tsx` in the Phase 7 voice (plain, second person, no “Phase 9” / “WASM” / “tree-sitter”). Fallback must be distinct from blocked-file copy.

3. **Does `onPlanned` replace the empty-state hero immediately?**
   - What we know: trainer must not start. Empty state today says “Paste code… Load exercise”.
   - What's unclear: whether to show “Planned N units from `src/foo.ts`” in the main pane or only in the GitHub status region.
   - Recommendation: **status region only** this phase. Main pane unchanged until Phase 9. Avoid implying the file is typeable.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite, Vitest, optional wasm spike | ✓ | v24.16.0 | — |
| pnpm | installs | ✓ | 11.5.3 | — |
| npm registry (`npm view`) | version pins | ✓ | npm 11.13.0 | — |
| `tree-sitter` CLI | rebuild grammar wasm | ✗ | — | Pin `web-tree-sitter@0.25.10` instead of installing CLI |
| `wasm32-wasi-clang` | manual wasm toolchain | ✗ | — | CLI 0.27 auto-downloads wasi-sdk if rebuild is needed [CITED: binding_web README since v0.26.1] |
| GitHub API from Vitest | — | n/a | — | **Do not use.** Fixture JSON |
| Context7 CLI (`ctx7`) | docs lookup | ✗ | — | Official URLs via WebFetch (done) |

**Missing dependencies with no fallback:** none that block planning. Wave 0 needs Node (present).

**Missing dependencies with fallback:** `tree-sitter-cli` → try 0.25.10 runtime first.

**Nyquist validation:** `workflow.nyquist_validation` is `false` in `.planning/config.json` — Validation Architecture section omitted.

Existing test infra (for the planner, not a Nyquist map): Vitest projects in `vite.config.ts` (`unit` node for `src/**/*.test.ts`, `ui` happy-dom for `src/ui/**/*.test.tsx`). Quick: `pnpm test`. New files: `src/ingestion/github.test.ts`, `src/parse/plan.test.ts`, `src/github/client.test.ts` (blob cases), `src/ui/RepoBrowser.test.tsx` (click plans, no handleLoad), `src/ui/HistoryView.test.tsx` (github label).

## Security Domain

`security_enforcement` is enabled (ASVS level 1).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Public GitHub only; no PAT |
| V3 Session Management | no | No app auth cookies |
| V4 Access Control | no | Single-user local SPA |
| V5 Input Validation | yes | Size cap before decode; UTF-8; `encodeURIComponent` on owner/repo/sha; extension allowlist already in `isLoadablePath` |
| V6 Cryptography | no | No new crypto; do not hash corpus |

### Known Threat Patterns for GitHub blob + WASM + untrusted corpus

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via typed URL | Information disclosure | Unchanged: never `fetch(userString)`; only constructed `api.github.com` paths |
| Oversize blob DoS | Denial of service | `size` gate then `byteLength` gate at `MAX_BYTES`; no prefetch |
| Invalid UTF-8 / binary labeled `.ts` | Tampering | BOM + U+FFFD → `NonUtf8Error`; typed copy |
| XSS via blob text in DOM | Tampering | React text nodes only; no highlighter |
| Wasm from CDN (COEP bypass attempt) | Tampering / elevation | Same-origin `public/` only; keep `require-corp` |
| CSP `'unsafe-eval'` over-grant | Elevation | `'wasm-unsafe-eval'` only |
| Grammar package `node-gyp-build` / CLI `install.js` | Tampering (supply chain) | Human-verify; `--ignore-scripts` for grammars; avoid CLI unless spike requires it |
| History/privacy: github path in IndexedDB | Information disclosure | Local-only (existing); README: blob contents stay on device |
| Click starts trainer with attacker-controlled huge text | Denial of service | Do not `handleLoad`; 100 KB cap |

Phase 7 T-07-10 (no exercise-load prop) **changes shape**: `onPlanned` is allowed; `handleLoad` is still forbidden. Planner should replace that threat with “blob click must not call `handleLoad` / must not mount CaptureSurface on `exercise.text`”.

## Sources

### Primary (HIGH confidence — official pages fetched this session)

- https://docs.github.com/en/rest/git/blobs — Get a blob: always Base64 JSON, `size`, 100 MB cap
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy — `'wasm-unsafe-eval'` vs `'unsafe-eval'`; `script-src` fallback from `default-src`
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src — wasm keyword details
- https://raw.githubusercontent.com/tree-sitter/tree-sitter/master/lib/binding_web/README.md — `Parser.init`, `Language.load`, `locateFile`, ABI table 0.24 vs ≥0.25, prebuilt wasm warning, Vite `public/` copy, `tree-sitter build --wasm` since 0.26.1
- https://raw.githubusercontent.com/tree-sitter/tree-sitter-typescript/master/README.md — two dialects `typescript` / `tsx`
- https://github.com/tree-sitter/tree-sitter-typescript/blob/master/typescript/src/node-types.json — named node types
- `npm view` / `npm pack --dry-run` 2026-09-20 — versions and wasm filenames
- Live codebase: `src/ingestion/upload.ts`, `src/github/client.ts`, `src/ui/RepoBrowser.tsx`, `src/ui/HistoryView.tsx`, `index.html` CSP, `vite.config.ts` COEP

### Secondary (MEDIUM confidence)

- https://tree-sitter.github.io/tree-sitter/using-parsers/7-abi-versions.html — library ABI 13–15 for ≥0.25
- https://github.com/tree-sitter/tree-sitter/issues/5171 — 0.26 `dylink.0` vs legacy `dylink`; pin 0.25.10 workaround
- `.planning/research/STACK.md` and `PITFALLS.md` — project research 2026-09-20; **corrected** JS 0.23.2 pin and wasm filename against live npm

### Tertiary (LOW confidence)

- classify-confidence seam rates `webfetch` LOW even for official docs (same as Phase 7 research)
- Package-legitimacy seam SUS with null signals — overridden by `npm view` + official READMEs, still gated by human-verify

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — libraries and GitHub API are documented; **which wasm pin loads** is unproven until Wave 0
- Architecture: HIGH — seams copy Phase 7/ingestion patterns; FILE-01 must not call `handleLoad` is explicit in the roadmap
- Pitfalls: HIGH — CSP wasm, locateFile, UTF-16, overlap, History ternary, 60 req/h are either documented or already bugs in this repo

**Research date:** 2026-09-20
**Valid until:** 7 days for wasm ABI/npm pins (fast-moving); 30 days for GitHub blobs + CSP + corpus reuse
