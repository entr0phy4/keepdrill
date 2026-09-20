# Project Research Summary

**Project:** keebdrill
**Domain:** Public GitHub repo katas + in-browser TS/JS tree-sitter scaffolding on an existing local-first typing SPA
**Researched:** 2026-09-20
**Confidence:** MEDIUM-HIGH

## Executive Summary

v2.0 is the first corpus source that is not paste/upload: the user pastes a **public GitHub URL**, browses the repo as a **filesystem tree**, opens a **TypeScript/JavaScript** file, and types it **in place** as a **scaffolded** exercise — full file visible, only the current syntactic unit typeable, units ordered **leaves-first by in-file dependencies** until the file is complete. Paste/upload stay as the fallback.

Experts who have done “GitHub in the browser” (VS Code's GitHub FS provider) use the **Git Data API**: one recursive tree, blob-on-read, no clone. Experts who parse TS/JS in the browser use **web-tree-sitter** with same-origin wasm — not the `typescript` package, not Monaco. keebdrill should do the same, behind two new platform seams (`github/client.ts`, `parse/wasm.ts`), without touching `capture.ts`.

The main risks are not “can we list a repo”: (1) **COEP `require-corp`** must stay; wasm from `public/`, GitHub via cors `fetch`, `credentialless` only as escape hatch. (2) **60 unauthenticated req/h** — cache tree, never prefetch blobs, never hit GitHub from tests. (3) **tree-sitter UTF-16 indices vs code-point trainer cursor** — convert once or Phase 3's desync bug returns. (4) **CaptureSurface is 1:1 with `text`** — the textarea gets the **current unit only**; the file chrome is a separate renderer. Nested classes/functions need a locked containment policy or ranges overlap.

## Key Findings

### Recommended Stack

Two new runtime concerns, one new runtime package:

**Core technologies:**
- **GitHub REST via raw `fetch`:** `GET /repos/{owner}/{repo}` → default branch; `GET /git/trees/{ref}?recursive=1`; `GET /git/blobs/{sha}`. No Octokit (CORS preflight on `X-GitHub-Api-Version`). No isomorphic-git.
- **`web-tree-sitter` 0.25.x** (0.27.0 is current; pin after a wasm-load spike) **+ `tree-sitter-typescript` 0.23.2** (TS/TSX) **+ `tree-sitter-javascript` 0.23.x** (not 0.25, ABI-align with typescript). Copy `.wasm` into `public/`.
- **Keep** Vite/React/Dexie/COOP+COEP `require-corp`. Hand-roll URL parse, tree UI, and unit planner.

### Expected Features

**Must have (table stakes):**
- Public GitHub URL / `owner/repo` → default-branch tree
- Full filesystem tree; non-TS/JS visible but blocked with a notice
- TS/JS click → blob → normalize → parse → dependency-ordered units
- Full file visible; current unit only typeable; advance until file complete
- Paste/upload unchanged
- Named errors: 404, rate limit, truncated tree, too large, parse fallback

**Should have (competitive):**
- Leaf-first dependency order (the differentiator vs “type the file”)
- `sourceType: 'github'` + `sourceRef` on Exercise for later analytics
- Restart = current unit, not the whole file

**Defer (v2+):**
- Branch picker, private repos, extra languages, per-function history rows, Tauri/local git

### Architecture Approach

Extend the existing **pure core / platform seam / hot-path** split. GitHub fetch and WASM never enter `trainer/` or `capture/`. `Exercise.text` is the **full file**. `App` owns `curriculum` + `unitIndex`. CaptureSurface still receives a string — the unit slice. On unit complete: snapshot logs, `resetCapture()`, remount. On last unit: concatenate snapshots into one Session and `saveSession` as today.

**Major components:**
1. `github/` — URL parse + fetch client + RepoBrowser
2. `parse/` + `scaffold/plan.ts` — WASM seam + pure unit planner
3. `FileScaffold` + App curriculum — unit chrome and advance

**Suggested build order:** client+tree → parse+plan → scaffolded trainer. Do not ship click-to-whole-file as the user-visible path.

### Critical Pitfalls

1. **COEP vs GitHub/WASM** — same-origin wasm; cors fetch; never strip COEP.
2. **60 req/h** — cache by sha; blob-on-click; fixture tests.
3. **UTF-16 vs code points** — convert tree-sitter indices before planning.
4. **Overlapping nested units** — v2.0: top-level functions + import/type blocks; **classes as one unit**; nested functions stay inside parent.
5. **Capture reset / session concat** — one History row per file; Escape restarts current unit.
6. **Full-file textarea** — don't. Unit-sized textarea + file chrome.
7. **Empty parse** — labeled whole-file fallback, never a silent no-op.

## Implications for Roadmap

Phase numbers **continue from v1.1** (last shipped: Phase 6). v2.0 starts at **Phase 7**.

### Phase 7: GitHub URL & Repo Tree
**Rationale:** Unblocks every later feature; proves COEP+CORS in the real app before WASM.
**Delivers:** URL field, default-branch recursive tree, expand/collapse, non-TS/JS blocked notice, rate-limit/404/truncated copy. No click-to-type yet (or click shows “opening files lands in the next phase” — prefer disabled TS/JS until Phase 8–9 wire it, to avoid a whole-file regression).
**Addresses:** URL import, filesystem tree, blocked files
**Avoids:** COEP strip, prefetch blobs, Octokit, live API in tests

### Phase 8: Parse & Dependency Units
**Rationale:** Planner is pure and testable without the trainer change; must exist before scaffold.
**Delivers:** wasm init, TS/JS grammars, `planUnits` with non-overlapping code-point ranges, topo order (leaves first), whole-file fallback, Unicode golden cases.
**Uses:** web-tree-sitter + grammar wasm from STACK.md
**Implements:** `parse/` + `scaffold/plan.ts`
**Avoids:** UTF-16 desync, overlapping nested units, empty-plan hang

### Phase 9: Scaffolded Trainer
**Rationale:** UI that the user actually types in. Depends on units from Phase 8 and a file from Phase 7.
**Delivers:** File chrome (done/current/future), CaptureSurface on current unit, advance, file-complete → existing results + persist, Escape restarts unit, paste/upload still whole-file.
**Implements:** `FileScaffold`, App curriculum state
**Avoids:** capture.ts rewrites, full-file textarea, last-unit-only sessions

### Phase Ordering Rationale

- Network isolation proof before WASM (if COEP is wrong, parser work is wasted).
- Pure planner before UI (fixtures lock the product policy: classes, nested functions, fallback).
- Trainer last so CaptureSurface's contract stays the integration test.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 8:** tree-sitter node types for `export async function`, `const f = () =>`, TSX; wasm ABI spike (`0.25` runtime vs `0.23` grammars).
- **Phase 9:** FileScaffold layout (stacked unit in a `<pre>` vs overlay). Prefer stacked-in-flow; overlay is a FLAG not a must.

Phases with standard patterns (skip extra research-phase):
- **Phase 7:** GitHub Trees/Blobs + a disclosure tree are well-documented. Plan-phase threat model for untrusted paths/names is enough.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | GitHub REST + COEP verified; wasm ABI pin needs a 30-min spike in Phase 8 |
| Features | HIGH | Locked by user; competitor gaps are contrast not imitation |
| Architecture | HIGH | Seam split matches the codebase; session-concat is the one product fork (recommended: one Session/file) |
| Pitfalls | HIGH | COEP, rate limit, Unicode, capture remount are grounded in prior phases |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Session granularity:** one Session per file (recommended) vs per unit — confirm in discuss-phase if it comes up; default is per file.
- **Class splitting:** deferred to whole-class unit; call out in Phase 8 CONTEXT.
- **Grammar wasm filenames** in `tree-sitter-typescript` 0.23.2 on disk — confirm during Phase 8 install, not now.
- **COEP `credentialless`:** only if live GitHub fetch fails under `require-corp` in the operator's Chromium.

## Sources

### Primary (HIGH confidence)
- GitHub REST CORS, rate limits, git trees docs
- MDN COEP (`require-corp` + `credentialless`)
- npm: web-tree-sitter 0.27.0, tree-sitter-typescript 0.23.2, tree-sitter-javascript 0.25.0 (pin 0.23.x)
- keebdrill `App.tsx`, `CaptureSurface.tsx`, `trainer/state.ts`, `vite.config.ts`

### Secondary (MEDIUM confidence)
- github/docs#24706 Octokit CORS header
- VS Code GitHubFileSystemProvider (tree + blob-on-read)
- web-tree-sitter ABI / old wasm format warning

---
*Research completed: 2026-09-20*
*Ready for roadmap: yes*
