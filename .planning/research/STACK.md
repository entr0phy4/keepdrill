# Stack Research

**Domain:** Public GitHub repo ingestion + in-browser TS/JS tree-sitter scaffolding for an existing local-first Vite/React typing SPA
**Researched:** 2026-09-20
**Confidence:** MEDIUM-HIGH (GitHub REST + COEP/CORS verified against official docs; tree-sitter WASM versions verified on npm 2026-09-20; ABI pin between `web-tree-sitter` 0.27 and grammar packages is a spike-time check)

## Context: what v1.1 already has (do not re-add)

keebdrill is a Vite 8.2 / React 19.2 / TypeScript 5.9 SPA with Dexie 4.4.4 isolated behind `persistence/db.ts`. Capture, trainer, metrics, history, and analytics are shipped. COOP `same-origin` + COEP `require-corp` are set on both `server.headers` and `preview.headers` in `vite.config.ts` so `crossOriginIsolated === true` and high-res `event.timeStamp` stays the differentiator.

v2.0 adds two new platform seams: GitHub REST from the browser, and tree-sitter WASM for TS/JS. Everything else (Dexie, capture hot path, metrics) stays.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| GitHub REST (raw `fetch`) | API version implicit (do **not** send `X-GitHub-Api-Version`) | Resolve default branch, recursive git tree, blob contents | GitHub documents CORS from any origin (`Access-Control-Allow-Origin: *`). Unauthenticated public reads are enough. A `fetch` wrapper in a platform seam (`src/github/client.ts`) is ~80 lines; `@octokit/rest` adds bundle, preflight headers, and a historical CORS bug with `X-GitHub-Api-Version`. |
| `web-tree-sitter` | 0.25.x preferred for grammar ABI match; 0.27.0 is current on npm (2026-08-30) | In-browser Parser + Language loader | Official WASM binding. Must be served **same-origin** (copy `tree-sitter.wasm` into `public/`) so COEP `require-corp` is happy. `locateFile` must point at `/tree-sitter.wasm`, not the Vite chunk path. |
| `tree-sitter-typescript` | 0.23.2 (npm, 2024-11-11) | TS + TSX grammars | One package, two dialects (`typescript` / `tsx`). `.ts` → typescript wasm; `.tsx` → tsx wasm. Native `node-addon-api` bindings are unused in the browser — copy only the `.wasm` files into `public/wasm/`. |
| `tree-sitter-javascript` | 0.23.x (align with typescript's `^0.23.1` dep, **not** latest 0.25.0) | JS + JSX grammar | `.js` / `.mjs` / `.cjs` → javascript wasm; `.jsx` can use the same JS grammar (JSX is in tree-sitter-javascript) or the TSX grammar. Pin 0.23 to keep ABI next to typescript 0.23.2. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| *(none — hand-rolled)* GitHub URL parser | — | Accept `owner/repo`, `https://github.com/owner/repo`, optional `.git` / trailing slash; reject other hosts | Always. Tiny pure function with golden cases. |
| *(none — hand-rolled)* File tree view | — | Nested `<ul>` / disclosure from the flat recursive tree | Always. `react-arborist` / `react-complex-tree` are the wrong weight for a read-only click-to-load tree. |
| *(none — hand-rolled)* Unit planner | — | Walk a tree-sitter `Tree`, emit non-overlapping source ranges, topological-order by identifier deps | Always. This is the product, not a library. Tests must not boot WASM — parse seam returns a `SyntaxNode`-like fixture. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest (existing) + golden source fixtures | Unit-test the planner against checked-in `.ts` snippets | Parser seam is injected; Node tests never load WASM. One optional happy-dom smoke test may load WASM if `public/wasm` is reachable. |
| `tree-sitter-cli` (dev, optional) | Rebuild grammar wasm if prebuilt files fail to load on `web-tree-sitter` 0.25+ | Official warning: some prebuilt `.wasm` use an older dynamic-linking format. Rebuild with current CLI rather than downgrading the runtime. |
| GitHub REST from CI? | Do **not** hit api.github.com from unit tests | 60 req/h unauthenticated. Fixture the JSON tree/blob shapes. |

## Installation

```bash
# Parser runtime (browser). Native grammar packages are only a wasm source.
pnpm add web-tree-sitter@0.25.10
pnpm add -D tree-sitter-typescript@0.23.2 tree-sitter-javascript@0.23.2

# Copy WASM next to index.html (same-origin, COEP-safe). Adjust names after
# inspecting node_modules for the actual .wasm filenames.
# postinstall:
#   cp node_modules/web-tree-sitter/tree-sitter.wasm public/
#   cp node_modules/tree-sitter-typescript/**/*.wasm public/wasm/
#   cp node_modules/tree-sitter-javascript/*.wasm public/wasm/
```

No Octokit. No isomorphic-git. No CORS proxy.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Raw `fetch` to `api.github.com` | `@octokit/rest` / `@octokit/request` | Never for this milestone. Extra preflight headers (`X-GitHub-Api-Version`) have broken browser CORS before (github/docs#24706). |
| GitHub Git Data API (trees + blobs) | `isomorphic-git` clone into lightning-fs | Only if we needed generic git hosts. User locked GitHub public. A browser clone is a large WASM/CORS-proxy project. |
| GitHub Git Data API | `raw.githubusercontent.com` for file bytes | Fine as a **fallback** for blob content (simple GET, no auth). Do not use it for the tree listing. Avoid tarball/`codeload.github.com` — redirects drop CORS. |
| `web-tree-sitter` + grammar wasm | TypeScript compiler API (`typescript` package) | `typescript` is ~10MB and is a typechecker, not a range extractor. Heavier, still needs a worker, worse for JSX/JS. |
| `web-tree-sitter` | `@lezer/javascript` (CodeMirror) | Lezer is great inside CM6. We do not want an editor — we want function ranges + a call graph. Tree-sitter's named nodes (`function_declaration`, `import_statement`) map directly. |
| COEP `require-corp` (keep) | COEP `credentialless` | Switch only if a GitHub `fetch({mode:'cors'})` is blocked in a target browser. CORS-mode fetches to a CORS-enabled API are allowed under `require-corp`; `credentialless` is the escape hatch, still keeps `crossOriginIsolated`. |
| Hand-rolled tree | File System Access `showDirectoryPicker` | That is local-folder, not GitHub URL. Out of scope. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@octokit/rest` | Bundle + `X-GitHub-Api-Version` CORS preflight | `fetch` + `Accept: application/vnd.github+json` only |
| `isomorphic-git` / `memfs` / `lightning-fs` | Full clone, CORS proxy for git protocol, wrong host scope | GitHub Trees + Blobs |
| CDN-hosted `tree-sitter.wasm` | COEP `require-corp` will block third-party wasm without CORP | Same-origin `public/` copy |
| `typescript` npm package as the parser | Huge, slow to init, not a range API | tree-sitter WASM |
| Monaco / CodeMirror as the trainer | Fights capture.ts (`beforeinput`/`input`, no `preventDefault` blanket). Overlay textarea is the locked capture host | Keep CaptureSurface; add a file chrome around it |
| GitHub PAT in localStorage | Private repos are out of scope; a token in a COOP-isolated SPA is still theft bait | Unauthenticated public only |
| Recursive fetch of every blob at import time | 60 req/h unauthenticated; a medium repo would 429 immediately | One recursive tree; blob on click |

## Stack Patterns by Variant

**If GitHub `fetch` fails under COEP `require-corp` in Firefox:**
- Switch `vite.config.ts` (and README `_headers`) to `Cross-Origin-Embedder-Policy: credentialless`
- Because MDN: `credentialless` still yields `crossOriginIsolated` with COOP `same-origin`

**If grammar `.wasm` fails to instantiate on `web-tree-sitter` 0.25+:**
- Rebuild wasm with current `tree-sitter-cli` (`tree-sitter build --wasm`)
- Because official binding_web README warns about old dynamic-linking format

**If a file is JS not TS:**
- Load `tree-sitter-javascript` wasm (or TSX grammar for `.jsx`)
- Because TypeScript grammar rejects some JS (e.g. HTML-style comments, some ASI edge cases)

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `web-tree-sitter` 0.24.x | parser ABI 13–14 | Too old if we rebuild wasm with CLI 0.25+ |
| `web-tree-sitter` ≥ 0.25.0 | parser ABI 13–15 | Current 0.27.0 is in this band |
| `tree-sitter-typescript` 0.23.2 | `tree-sitter-javascript` ^0.23.1 | Do not jump JS grammar to 0.25 without a wasm load test |
| GitHub REST unauthenticated | 60 req / hour / IP | Cache tree in memory per `{owner,repo,sha}` |

## Integration with existing SPA

- **COEP:** keep `require-corp`. GitHub calls are `fetch` (cors mode). WASM is same-origin.
- **No `fetch` in `src/` today** (Phase 1 privacy grep). Introduce fetch **only** in `src/github/client.ts`. Document in README that GitHub.com is now a network egress for corpus, while keystroke logs still never leave the machine.
- **Ingestion:** extend `SourceType` with `'github'`; `sourceRef` becomes `owner/repo:path` (or `owner/repo@sha:path`). Still run `normalize()` on blob text so CRLF/tabs match paste/upload.
- **100 KB cap:** apply `MAX_BYTES` to decoded blob before parse, same as upload.

## Sources

- [GitHub REST: CORS](https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests) — HIGH
- [GitHub REST: rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) — HIGH (60/h unauthenticated)
- [GitHub REST: git trees](https://docs.github.com/en/rest/git/trees) — HIGH (recursive, truncated @ 100k entries / 7 MB)
- [MDN COEP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy) — HIGH (`require-corp` allows cors-mode fetches; `credentialless` keeps isolation)
- [web-tree-sitter 0.27.0 npm](https://www.npmjs.com/package/web-tree-sitter) — HIGH (2026-08-30)
- [tree-sitter-typescript 0.23.2 npm](https://www.npmjs.com/package/tree-sitter-typescript) — HIGH
- [tree-sitter-javascript 0.25.0 npm](https://www.npmjs.com/package/tree-sitter-javascript) — HIGH (latest; we still pin 0.23.x)
- [github/docs#24706](https://github.com/github/docs/issues/24706) — MEDIUM (Octokit `X-GitHub-Api-Version` CORS)

---
*Stack research for: GitHub public repo katas + TS/JS tree-sitter scaffolding*
*Researched: 2026-09-20*
