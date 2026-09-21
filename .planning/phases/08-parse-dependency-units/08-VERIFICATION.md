---
phase: 08-parse-dependency-units
verified: 2026-09-21T00:51:51Z
status: passed
score: 35/37 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 33/36
  gaps_closed:

    - "Last-wins token on file clicks: a slower first click cannot overwrite a faster second click's status or onPlanned"
    - "Import busy uses a separate import-generation counter so a file click cannot leave Import disabled"
  gaps_remaining: []
  regressions: []
human_verification:

  - test: "FILE-01 unclassified specless edge — wasm compile under CSP (backstop / insufficient_spec)"
    expected: "Parser.init instantiates same-origin public/web-tree-sitter.wasm under script-src 'self' 'wasm-unsafe-eval' without a general eval keyword; a .ts click plans units instead of a permanent Loading… or CSP console error"
    why_human: "Plan tagged this truth verification: backstop. Node ABI spike and CSP source are not a held-out browser compile under COEP require-corp"

  - test: "FILE-02 unclassified specless edge — sourceRef shapes beyond owner/repo:path (backstop / insufficient_spec)"
    expected: "No extra sourceRef taxonomy; History still prefers sourceRef for upload and github and never labels github rows Pasted snippet"
    why_human: "Plan tagged this truth verification: backstop. Goldens lock owner/repo:path only"

  - test: "pnpm dev in Chromium — import a small public repo, click a real .ts file, then a .tsx/.js/.jsx file"
    expected: "Status Loading {path}… then Planned N unit(s) from {path}. CaptureSurface stays unmounted. Empty-state still says paste/upload Load exercise. Fallback copy is used only when split fails, and it is not the blocked-file sentence"
    why_human: "UI tests hoist-mock parseSource/Language.load; live wasm under CSP/COEP is not exercised in happy-dom"

  - test: "Review flagged must-NOTs in the running app (unverified-prohibition — human review recommended)"
    expected: "No whole-file typing session from a tree click; no general script-src eval; COEP require-corp holds; no CDN wasm; no second fetch module; no Authorization/raw.githubusercontent.com; sourceRef has no blob sha; Dexie still version(1); github rows are not Pasted snippet; COPY has no WASM/tree-sitter/Phase 9 jargon; no innerHTML of blob text; no prefetch on Import; a blocked/commit click is not later overwritten by an in-flight loadable; Import is not left disabled because a file click stole busy generation"
    why_human: "Prohibitions are verification: flagged. Grep and UI tests cover most of these; judgment-tier must-NOTs still need a human pass"
---

# Phase 8: Parse & Dependency Units Verification Report

**Phase Goal:** The user's clicked TypeScript/JavaScript file becomes a planned, dependency-ordered set of syntactic units (or a labeled whole-file fallback), tagged as GitHub corpus — still not a click-to-type-the-whole-file path.
**Verified:** 2026-09-21T00:51:51Z
**Status:** human_needed
**Re-verification:** Yes — after gap-closure plan 08-05

The previous `gaps_found` (33/36) had one failed truth: last-wins skipped `++tokenRef` on blocked/commit clicks and shared the counter with Import. 08-05 replaced `tokenRef` with `clickGenRef` (every file click, first statement) and `importGenRef` (Import busy only). Named UI tests for loadable-then-blocked, loadable-then-commit, and Import isolation all pass. Roadmap success criteria 1–5 still hold. Two `verification: backstop` truths and flagged must-NOTs remain human-only; they do not reopen `gaps_found`.

## Goal Achievement

### Observable Truths

Roadmap success criteria are the contract. Plan-only truths follow; wording that restated an SC was folded into that SC. Truths 1–29 and 31–36 are regression-checked from the previous report. Truth 30 is fully re-verified. Truth 37 is the 08-05 must-have that was a missing item of the same gap.

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | User who clicks a `.ts`/`.tsx`/`.js`/`.jsx` file gets that blob loaded as corpus under the same 100 KB cap and UTF-8 rules as upload, then normalized like paste/upload — not started as a whole-file typing session | ✓ VERIFIED | Regression: `onFileClick` still `fetchGithubBlob` → `fromGithubBlob` → `planUnits`. `App` still `onPlanned={setFilePlan}` only; `handleLoad` stays on `CorpusInput` |
| 2 | User's resulting exercise is tagged `sourceType: 'github'` with repo and path in `sourceRef`, so History can show where it came from | ✓ VERIFIED | Regression: `fromGithubBlob` still `sourceType: 'github'`; `HistoryView` still `sourceType === 'github'` branch |
| 3 | User's TS/JS file is split into non-overlapping syntactic units (top-level functions, import/type blocks; a class is one unit; nested functions stay inside their parent) | ✓ VERIFIED | Regression: `planUnits` still exported from `src/parse/plan.ts`; UI still calls it, no second splitter |
| 4 | Those units are ordered by in-file dependencies: indispensable/leaf units first, then units that depend on them | ✓ VERIFIED | Regression: `plan.ts` unchanged this re-verify; previous Kahn/cycle goldens stand |
| 5 | User still gets an exercise if the file cannot be split: the whole file is the single unit, with a notice — never a silent no-op | ✓ VERIFIED | Regression: `fallbackPlan` still called on parse throw and `plan.fallback` |
| 6 | Wave 0 pins a web-tree-sitter runtime that Language.load-s tree-sitter-typescript and tree-sitter-tsx wasm | ✓ VERIFIED | Regression: `08-ABI-PIN.md` and wasm binaries still present |
| 7 | Committed same-origin runtime wasm at `public/<locateFile scriptName>` and grammar wasm at `public/wasm/tree-sitter-typescript.wasm` plus `public/wasm/tree-sitter-tsx.wasm` | ✓ VERIFIED | Regression: three wasm files still on disk (209613 / 1413849 / 1445638 B) |
| 8 | `index.html` script-src is `'self'` plus the wasm-compile token; connect-src stays `'self'` and `https://api.github.com`; COEP require-corp is untouched | ✓ VERIFIED | Regression: `script-src 'self' 'wasm-unsafe-eval'` still in `index.html` |
| 9 | README Privacy names api.github.com egress for listing and blob contents, and same-origin wasm (not network egress); keystroke logs still never leave | ✓ VERIFIED | Unchanged this re-verify (08-05 did not touch README) |
| 10 | FILE-01 unclassified specless edge — wasm compile under CSP | ⚠️ insufficient_spec | `verification: backstop`. No held-out browser `Parser.init` under this document's CSP — see Human Verification |
| 11 | `fetchGithubBlob` GETs `/repos/{owner}/{repo}/git/blobs/{sha}` with the same Accept/cors/omit headers; owner, repo, and sha are `encodeURIComponent` | ✓ VERIFIED | Regression: `src/github/client.ts` still the only production `fetch(` |
| 12 | JSON size greater than 100000 throws `CorpusTooLargeError` before `atob`; 100000 is accepted; decoded `byteLength` greater than 100000 also throws | ✓ VERIFIED | Unchanged this re-verify |
| 13 | Blob JSON content newlines are stripped before `atob`; size null still re-checks `byteLength` after decode | ✓ VERIFIED | Unchanged this re-verify |
| 14 | Second `fetchGithubBlob` of the same sha does not call fetch; overlapping cold calls share one GET; `resetGithubCache` clears blob maps | ✓ VERIFIED | Unchanged this re-verify |
| 15 | `fromGithubBlob` reuses `MAX_BYTES`, UTF-16 BOM sniff on bytes[0]/bytes[1], `TextDecoder` utf-8, U+FFFD scan, and `normalize` — same order as `fromFile` | ✓ VERIFIED | Regression: `src/ingestion/github.ts` still present and wired |
| 16 | Empty bytes that pass UTF-8 rules produce an Exercise with normalized text tagged github | ✓ VERIFIED | Unchanged this re-verify |
| 17 | `foldTree` copies `GitTreeEntry.size` onto `FileNode.size` when present | ✓ VERIFIED | Unchanged this re-verify |
| 18 | Dexie `version(1)` stores block is unchanged — github is an additive `SourceType` on the unindexed exercise blob | ✓ VERIFIED | Regression: `src/persistence/db.ts` still `this.version(1).stores({ sessions: '++id, startedAt' })` |
| 19 | FILE-02 unclassified specless edge — sourceRef shape beyond `owner/repo:path` | ⚠️ insufficient_spec | `verification: backstop`. Locked shape is tested; extra shapes have no held-out test — see Human Verification |
| 20 | Consecutive `import_statement` nodes merge into one import unit; consecutive type/interface/enum do not merge | ✓ VERIFIED | Unchanged this re-verify |
| 21 | `class_declaration` / `abstract_class_declaration` are one class unit including methods; nested functions stay inside the parent | ✓ VERIFIED | Unchanged this re-verify |
| 22 | lexical/variable declaration whose value is arrow/function/function_expression is a function unit; `export_statement` range includes the export keyword | ✓ VERIFIED | Unchanged this re-verify |
| 23 | Other named children become kind `other` so leftover top-level statements are still units | ✓ VERIFIED | Unchanged this re-verify |
| 24 | `utf16ToCodePoint` uses `Array.from(text.slice(0, utf16Index)).length` | ✓ VERIFIED | Unchanged this re-verify |
| 25 | Unit A depends on B when A's subtree contains `identifier` or `type_identifier` whose name B defines; `property_identifier` is ignored | ✓ VERIFIED | Unchanged this re-verify |
| 26 | Kahn topo emits in-degree 0 first, then dependents; leftover cycle members keep ascending source start | ✓ VERIFIED | Unchanged this re-verify |
| 27 | `planUnits` is pure and synchronous — no shared mutable parser cache | ✓ VERIFIED | Unchanged this re-verify |
| 28 | PLAN-02 unclassified specless edge — in-file identifier graph only; imported modules are not resolved | ✓ VERIFIED | Directly observed previously; 08-05 did not touch `plan.ts` |
| 29 | Status shows Planned N unit(s) from {path} on success; fallback notice is distinct from blocked-file copy | ✓ VERIFIED | Regression: `COPY.plannedOne` / `plannedMany` / `fallback` / `blocked` unchanged |
| 30 | Last-wins token on file clicks: a slower first click cannot overwrite a faster second click's status or onPlanned | ✓ VERIFIED | `onFileClick` first statement is `const token = ++clickGenRef.current` (line 121), then blocked/commit `setStatus(COPY.blocked)` and return. Loadable path gates `onPlanned` and later `setStatus` on `clickGenRef.current === token`. Named tests passed: loadable-then-blocked README, loadable-then-commit `mod.ts`, and existing loadable-vs-loadable |
| 31 | `node.size` greater than `MAX_BYTES` sets the 100 KB alert and does not call `fetchGithubBlob` | ✓ VERIFIED | Regression: size gate still before GET |
| 32 | Non-loadable and commit entries still use blocked copy and do not fetch | ✓ VERIFIED | Regression: commit / `!isLoadablePath` still `COPY.blocked` after the generation bump; no `fetchGithubBlob` |
| 33 | App holds `FilePlan` in memory via `onPlanned`; paste/upload `CorpusInput` path is unchanged | ✓ VERIFIED | Regression: `onPlanned={setFilePlan}`; `CorpusInput onLoad={handleLoad}` |
| 34 | Empty-state hero still says paste/upload Load exercise — planned files are status-region only | ✓ VERIFIED | Unchanged this re-verify |
| 35 | `wasm.ts` is the only importer of the WASM runtime; `locateFile` returns `/${scriptName}`; `.ts`/`.js` load typescript wasm, `.tsx`/`.jsx` load tsx wasm | ✓ VERIFIED | Unchanged this re-verify |
| 36 | PLAN-01 adjacency at the UI seam — units come from `planUnits`; this plan does not re-split in the component | ✓ VERIFIED | Directly observed: `RepoBrowser` still calls `planUnits` / `fallbackPlan` |
| 37 | Import busy uses a separate import-generation counter so a file click cannot leave Import disabled | ✓ VERIFIED | `importGenRef` is the only busy counter. `onFileClick` never increments it. `onImport finally` does `setBusy(false)` only when `importGenRef.current === importToken`. Named test passed: `file click during Import still re-enables Import when the tree fetch resolves`. `onImport` also `++clickGenRef` at start so a stale loadable cannot land after Import began |

**Score:** 35/37 truths verified (0 present, behavior-unverified; 2 insufficient_spec)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `.planning/phases/08-parse-dependency-units/08-ABI-PIN.md` | Winning runtime, locateFile name, grammar version, `cli_rebuild` | ✓ VERIFIED | Regression: still present |
| `package.json` | `web-tree-sitter` pin; typescript grammar in devDependencies | ✓ VERIFIED | Regression |
| `index.html` | script-src `'self'` plus wasm-compile token | ✓ VERIFIED | `'wasm-unsafe-eval'` |
| `public/web-tree-sitter.wasm` | Runtime wasm copied from node_modules | ✓ VERIFIED | Still on disk |
| `public/wasm/tree-sitter-typescript.wasm` | TypeScript grammar wasm | ✓ VERIFIED | Still on disk |
| `public/wasm/tree-sitter-tsx.wasm` | TSX grammar wasm | ✓ VERIFIED | Still on disk |
| `src/github/client.ts` | `fetchGithubBlob` + blob cache/inflight; `resetGithubCache` clears both | ✓ VERIFIED | Regression |
| `src/ingestion/github.ts` | `fromGithubBlob(bytes, meta) -> Exercise` | ✓ VERIFIED | Wired from `RepoBrowser` |
| `src/ingestion/types.ts` | `SourceType` includes `github`; `sourceRef` documents `owner/repo:path` | ✓ VERIFIED | |
| `src/github/types.ts` | `FileNode.size?: number` | ✓ VERIFIED | |
| `src/ui/HistoryView.tsx` | three-way sourceLabel: upload, github, else paste | ✓ VERIFIED | |
| `src/parse/types.ts` | `TsNode`, `PlanUnit`, `FilePlan`, `PlanUnitKind` | ✓ VERIFIED | |
| `src/parse/utf16.ts` | `utf16ToCodePoint` | ✓ VERIFIED | |
| `src/parse/plan.ts` | `planUnits`, `fallbackPlan` | ✓ VERIFIED | |
| `src/parse/wasm.ts` | `ensureParser`, `loadDialect`, `parseSource`, `dialectForPath` | ✓ VERIFIED | |
| `src/ui/RepoBrowser.tsx` | `onPlanned(FilePlan)`; COPY loading/planned/fallback; last-wins for every tree-file click; Import busy isolated | ✓ VERIFIED | `clickGenRef` before every `setStatus`; `importGenRef` gates `setBusy`. gsd-tools `verify.artifacts` 08-05: 2/2 passed. No leftover `tokenRef` |
| `src/ui/RepoBrowser.test.tsx` | loadable-then-blocked, loadable-then-commit, Import isolation last-wins | ✓ VERIFIED | Three 08-05 titles present; named tests passed |
| `src/ui/App.tsx` | `useState FilePlan \| null`; `onPlanned={setFilePlan}` | ✓ VERIFIED | Trainer still idle |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `index.html` | `public/web-tree-sitter.wasm` | script-src wasm-compile token | ✓ WIRED | Regression |
| `src/github/client.ts` | `src/ingestion/upload.ts` | `MAX_BYTES` and `CorpusTooLargeError` before `atob` | ✓ WIRED | Regression |
| `src/ingestion/github.ts` | `src/ingestion/normalize.ts` | `fromGithubBlob` calls `normalize(raw)` | ✓ WIRED | Regression |
| `src/ui/HistoryView.tsx` | `src/ingestion/types.ts` | sourceType github branch uses sourceRef | ✓ WIRED | Regression |
| `src/parse/plan.ts` | `src/parse/utf16.ts` | convert startIndex/endIndex | ✓ WIRED | Regression |
| `src/parse/plan.ts` | `src/ingestion/types.ts` | `FilePlan.exercise: Exercise` | ✓ WIRED | Regression |
| `src/ui/RepoBrowser.tsx` | `src/github/client.ts` | loadable click calls `fetchGithubBlob` | ✓ WIRED | Regression |
| `src/ui/RepoBrowser.tsx` | `src/ingestion/github.ts` | `fromGithubBlob(bytes, { owner, repo, path })` | ✓ WIRED | Regression |
| `src/ui/RepoBrowser.tsx` | `src/parse/wasm.ts` | `ensureParser` + `parseSource` then `planUnits` | ✓ WIRED | Regression |
| `src/ui/App.tsx` | `src/ui/RepoBrowser.tsx` | `onPlanned` holds FilePlan; CorpusInput still paste/upload only | ✓ WIRED | Regression |
| `src/ui/RepoBrowser.tsx` `onFileClick` | `clickGenRef` | `++clickGenRef.current` before any `setStatus`, including `COPY.blocked` | ✓ WIRED | Line 121 then 122–124. gsd-tools `verify.key-links` false-negatived because `from` is not a bare file path; manual read confirms |
| `src/ui/RepoBrowser.tsx` `onImport` `finally` | `importGenRef` | `setBusy(false)` only when `importGenRef.current === importToken` | ✓ WIRED | Line 239. `onFileClick` never writes `importGenRef` |
| `src/ui/RepoBrowser.tsx` `onFileClick` | `onPlanned` | call `onPlanned` only when `clickGenRef.current` still equals the click token | ✓ WIRED | Guard at line 160 immediately before `onPlanned?.(plan)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `src/ingestion/github.ts` | `Exercise.text` / `sourceType` / `sourceRef` | blob `Uint8Array` → BOM/`TextDecoder`/`normalize` | Yes | ✓ FLOWING |
| `src/parse/plan.ts` | `FilePlan.units` | `TsNode` named children + identifier graph | Yes | ✓ FLOWING |
| `src/ui/RepoBrowser.tsx` | status text | `COPY.*` + `node.path` / `plan.units.length` | Yes — last-wins now applies to blocked/commit too | ✓ FLOWING |
| `src/ui/App.tsx` | `filePlan` | `onPlanned={setFilePlan}` | Yes — stale `onPlanned` from a slower loadable is now dropped when a later click/Import bumped `clickGenRef` | ✓ FLOWING |
| `src/ui/HistoryView.tsx` | `sourceLabel` | `session.exercise.sourceType` / `sourceRef` | Yes when a github session exists. Persist is Phase 9 | ✓ FLOWING (label path) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Last-wins loadable-then-blocked | `pnpm exec vitest run --project ui src/ui/RepoBrowser.test.tsx -t "last-wins overlapping clicks: slow first loadable cannot overwrite a later blocked README click"` | 1 passed | ✓ PASS |
| Last-wins loadable-then-commit | same file, `-t "…later commit mod.ts click"` | 1 passed | ✓ PASS |
| Import isolation vs file click | same file, `-t "file click during Import still re-enables Import when the tree fetch resolves"` | 1 passed | ✓ PASS |
| Last-wins loadable-vs-loadable (regression) | same file, `-t "last-wins overlapping clicks: slow first sha cannot overwrite the second"` | 1 passed | ✓ PASS |
| Full workspace suite (this session, orchestrator) | `pnpm test` | 31 files, 345 passed | ✓ PASS (not re-run here) |
| Live Language.load under CSP | (no `wasm.test.ts` by plan; happy-dom mocks `parseSource`) | not run | ? SKIP — human |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | — | No `scripts/*/tests/probe-*.sh` and none declared in PLAN/SUMMARY | SKIPPED |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| FILE-01 | 08-01, 08-02, 08-04, 08-05 | Click TS/JS → blob as corpus, 100 KB + UTF-8, normalized like paste/upload | ✓ SATISFIED | Pipeline unchanged. FILE-01 concurrency last-wins now holds for blocked/commit and Import busy |
| FILE-02 | 08-02, 08-04 | `sourceType: 'github'` with repo and path in `sourceRef`; History can show origin | ✓ SATISFIED | `fromGithubBlob` + `HistoryView` github branch. Persist of that row is Phase 9 |
| PLAN-01 | 08-03, 08-04 | Non-overlapping syntactic units (functions, import/type blocks; class is one unit; nested stay inside parent) | ✓ SATISFIED | `planUnits` goldens; UI calls `planUnits` and does not re-split |
| PLAN-02 | 08-03, 08-04 | Units ordered leaves-first by in-file dependencies | ✓ SATISFIED | Kahn + cycle leftovers. REQUIREMENTS wording “User types those units” is the Phase 9 trainer; this phase delivers the ordered `FilePlan` |
| PLAN-03 | 08-03, 08-04, 08-05 | Whole-file fallback with a notice — never a silent no-op | ✓ SATISFIED | `fallbackPlan` + UI parse-throw path. PLAN-03 concurrency: a slower loadable can no longer overwrite blocked/commit status or fire stale `onPlanned` |

No orphaned REQUIREMENTS.md IDs for Phase 8. SCAF-01..05 are Phase 9 (pending). Phase 9 goal/success criteria do not cover last-wins — nothing to defer.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/github/client.ts` | ~131–133 | `atob` `DOMException` not mapped | ⚠️ Warning | Malformed blob 200 can leave `Loading {path}…`; `onPlanned` never fires. Not the PLAN-03 parse-fallback path. Pre-existing; not the closed gap |
| `src/parse/plan.ts` | ~53–56 | Top-level `ERROR` named children skipped | ⚠️ Warning | Mixed ERROR + valid children → `fallback: false` with cover holes. Only-ERROR still fallbacks. Pre-existing |
| `src/parse/plan.ts` | ~221–228 | `definedNames` for non-import is `unit.name` only | ⚠️ Warning | `const x = 1` (`other`) does not publish `x`. Pre-existing |
| `src/parse/wasm.ts` | ~14–18 | Rejected `Parser.init` cached forever | ⚠️ Warning | First wasm 404/COEP glitch maps later clicks to fallback until reload. Pre-existing |
| `src/ui/App.tsx` | ~66–72 | `handleLoad` does not `setFilePlan(null)` | ℹ️ Info | Stale `data-file-plan` after paste/upload. Phase 9 must not pair the wrong plan with the active exercise |
| production `src/` | — | TBD / FIXME / XXX | none | No debt markers in 08-05 files. `tokenRef` is gone |

The previous 🛑 Blocker (last-wins skipped on blocked/commit; shared Import/click counter) is closed. Commits `48d621e` (RED tests) and `c793079` (GREEN split refs) exist.

### Human Verification Required

These remain after the last-wins fix. They set `human_needed`; they are not `gaps_found`.

### 1. FILE-01 wasm compile under CSP (backstop)

**Test:** `pnpm preview` (or `pnpm dev`) in Chromium with COEP require-corp. Click a `.ts` file. Watch the console for CSP `EvalError` / wasm instantiate failure.
**Expected:** Same-origin `web-tree-sitter.wasm` compiles; status becomes Planned N units (or the fallback sentence if the file cannot split) — not a stuck Loading… and not a general `'unsafe-eval'` grant.
**Why human:** Tagged `verification: backstop`. Node ABI pin is not a browser CSP compile.

### 2. FILE-02 unclassified sourceRef shapes (backstop)

**Test:** After a github session exists in History, confirm the row shows `owner/repo:path` and never Pasted snippet. Do not invent extra sourceRef formats.
**Expected:** Locked RESEARCH A2 shape only.
**Why human:** Tagged `verification: backstop`. Goldens cover one shape.

### 3. Live click-to-plan (wasm not mocked)

**Test:** Import a small public repo. Click `.ts`, `.tsx`, `.js`, `.jsx`. Click README (blocked). Confirm the empty-state hero still says paste/upload Load exercise and CaptureSurface does not mount.
**Expected:** Planned N unit(s) from {path} on success; blocked copy for README; trainer idle. A slow first loadable then a README click should stay on blocked copy.
**Why human:** UI tests hoist-mock `parseSource`. Real `Language.load` is plan-excluded from vitest.

### 4. Flagged must-NOTs

**Test:** Review the prohibition list below in the running app and network panel.
**Expected:** Each must-NOT holds.
**Why human:** `verification: flagged` — never a silent pass.

**Prohibition grep (non-authoritative LLM-judge):**

| Must-NOT | Grep / read | Notes |
| -------- | ----------- | ----- |
| No general script eval — only wasm-compile token | `index.html` `script-src 'self' 'wasm-unsafe-eval'` | Holds in source |
| No strip COEP / CDN wasm | `vite.config.ts` require-corp; wasm under `public/` | Holds in source |
| No `tree-sitter-javascript` / `tree-sitter-cli` direct install | `package.json` | Holds; lockfile may still nest javascript natively from the grammar package |
| No second fetch module; no Authorization / `X-GitHub-Api-Version`; no `raw.githubusercontent.com` blob GET | only `client.ts` `fetch(`; Accept-only headers | Holds in production `src/` |
| No blob sha in sourceRef | `fromGithubBlob` + test | Holds |
| No Dexie schema bump | `version(1)` | Holds |
| No Pasted snippet for github | `HistoryView` | Holds |
| No parallel UTF-8 pipeline | `fromGithubBlob` reuses upload order | Holds |
| No class-method split; no descendant `function_declaration` collect; no empty `units` | `plan.ts` | Holds |
| No WASM import from `plan.ts` / `utf16.ts`; RepoBrowser imports `wasm.ts` not `web-tree-sitter` | ripgrep | Holds |
| No whole-file typing from tree click | `onPlanned` ≠ `handleLoad` | Holds |
| No WASM jargon in COPY; no innerHTML; no prefetch on Import | COPY keys; no `innerHTML`; Import only `fetchRepoTree` | Holds in source |
| No stale `onPlanned` after blocked/commit click | `clickGenRef` + UI tests | Holds in tests; still flagged for a human pass |
| No Import stuck disabled after a file click | `importGenRef` + UI test | Holds in tests; still flagged for a human pass |

### Gaps Summary

No remaining automated gaps. The phase goal holds in code: a TS/JS click fetches the blob, builds a github-tagged Exercise, plans non-overlapping leaves-first units (or a labeled whole-file fallback), and does not start the trainer. Last-wins now covers every tree-file click, including blocked and commit, and Import busy no longer shares that counter.

Human backstops (CSP wasm, extra sourceRef shapes, live click-to-plan, flagged must-NOTs) are unchanged and out of 08-05 scope.

Confirmation-bias notes (not extra gaps): (1) REQUIREMENTS PLAN-02 says “User types those units” — typing is Phase 9. (2) Last-wins tests now click blocked/commit second and resolve the hung blob. (3) `atob` failure is still an uncovered error path that can stick on Loading….

---

_Verified: 2026-09-21T00:51:51Z_
_Verifier: Claude (gsd-verifier)_
