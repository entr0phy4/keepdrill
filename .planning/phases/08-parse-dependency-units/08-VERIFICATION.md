---
phase: 08-parse-dependency-units
verified: 2026-09-21T00:16:06Z
status: gaps_found
score: 33/36 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Last-wins token on file clicks: a slower first click cannot overwrite a faster second click's status or onPlanned"
    status: failed
    reason: "Blocked and commit clicks return before ++tokenRef. A slower in-flight loadable fetch still matches the old token, overwrites COPY.blocked, and fires onPlanned. The passing UI test only covers two loadable clicks."
    artifacts:
      - path: "src/ui/RepoBrowser.tsx"
        issue: "onFileClick increments tokenRef only after the commit/non-loadable early return (lines 119-126); Import and clicks share one counter so a click during Import can also skip setBusy(false)"
    missing:
      - "Bump the click generation for every tree-file click, including blocked and commit entries, before setStatus"
      - "Keep Import busy on a separate import-generation counter so a file click cannot leave Import disabled"
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
    expected: "No whole-file typing session from a tree click; no general script-src eval; COEP require-corp holds; no CDN wasm; no second fetch module; no Authorization/raw.githubusercontent.com; sourceRef has no blob sha; Dexie still version(1); github rows are not Pasted snippet; COPY has no WASM/tree-sitter/Phase 9 jargon; no innerHTML of blob text; no prefetch on Import"
    why_human: "Prohibitions are verification: flagged. Grep covers most of these; judgment-tier must-NOTs still need a human pass"
---

# Phase 8: Parse & Dependency Units Verification Report

**Phase Goal:** The user's clicked TypeScript/JavaScript file becomes a planned, dependency-ordered set of syntactic units (or a labeled whole-file fallback), tagged as GitHub corpus — still not a click-to-type-the-whole-file path.
**Verified:** 2026-09-21T00:16:06Z
**Status:** gaps_found
**Re-verification:** No — initial verification

Roadmap success criteria 1–5 hold in code and tests. One 08-04 PLAN concurrency must-have does not: last-wins on file clicks fails when the second click is blocked/commit. Two `verification: backstop` truths have no held-out evidence. Flagged must-NOTs need a human pass after the gap is closed.

## Goal Achievement

### Observable Truths

Roadmap success criteria are the contract. Plan-only truths are listed after; wording that restated an SC was folded into that SC.

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | User who clicks a `.ts`/`.tsx`/`.js`/`.jsx` file gets that blob loaded as corpus under the same 100 KB cap and UTF-8 rules as upload, then normalized like paste/upload — not started as a whole-file typing session | ✓ VERIFIED | `RepoBrowser.onFileClick` → `fetchGithubBlob` → `fromGithubBlob` (same `MAX_BYTES` / BOM / `TextDecoder` / U+FFFD / `normalize` order as `fromFile`). `App` wires `onPlanned={setFilePlan}` only; `handleLoad` stays on `CorpusInput`. UI test: plans App.tsx, `#capture-surface` null |
| 2 | User's resulting exercise is tagged `sourceType: 'github'` with repo and path in `sourceRef`, so History can show where it came from | ✓ VERIFIED | `fromGithubBlob` sets `sourceType: 'github'` and `sourceRef: owner/repo:path` with no sha. `HistoryView` three-way `sourceLabel`; test asserts `o/r:src/App.tsx` and not `Pasted snippet`. Persist of github sessions is Phase 9; the label path is wired |
| 3 | User's TS/JS file is split into non-overlapping syntactic units (top-level functions, import/type blocks; a class is one unit; nested functions stay inside their parent) | ✓ VERIFIED | `planUnits` walks `program.namedChildren` only. Golden cover cases 1–13 plus `assertNonOverlapping`. Nested `inner` is not its own unit; class method `m` is not a unit |
| 4 | Those units are ordered by in-file dependencies: indispensable/leaf units first, then units that depend on them | ✓ VERIFIED | Kahn ready-queue of in-degree 0 sorted by `start`. Tests: callee `b` before caller `a`; import specifier in-degree 0 first; cycle leftovers concatenated by `start`; `property_identifier` ignored |
| 5 | User still gets an exercise if the file cannot be split: the whole file is the single unit, with a notice — never a silent no-op | ✓ VERIFIED | Empty / only-ERROR / zero collected → `fallbackPlan` (`units` never `[]`). UI: `parseSource` reject still `onPlanned` with `fallback: true`, one `file` unit, and `Couldn't split {path}…` ≠ blocked copy |
| 6 | Wave 0 pins a web-tree-sitter runtime that Language.load-s tree-sitter-typescript and tree-sitter-tsx wasm | ✓ VERIFIED | `package.json` `web-tree-sitter@0.27.0`, `tree-sitter-typescript@0.23.2`. `08-ABI-PIN.md` records Node `abiVersion` 14, `cli_rebuild: false` |
| 7 | Committed same-origin runtime wasm at `public/<locateFile scriptName>` and grammar wasm at `public/wasm/tree-sitter-typescript.wasm` plus `public/wasm/tree-sitter-tsx.wasm` | ✓ VERIFIED | `public/web-tree-sitter.wasm` 209613 B; typescript 1413849 B; tsx 1445638 B. All `file(1)` WebAssembly MVP |
| 8 | `index.html` script-src is `'self'` plus the wasm-compile token; connect-src stays `'self'` and `https://api.github.com`; COEP require-corp is untouched | ✓ VERIFIED | CSP meta: `script-src 'self' 'wasm-unsafe-eval'`. No separate `'unsafe-eval'`. `vite.config.ts` still `Cross-Origin-Embedder-Policy: require-corp` |
| 9 | README Privacy names api.github.com egress for listing and blob contents, and same-origin wasm (not network egress); keystroke logs still never leave | ✓ VERIFIED | README Privacy: listing **and** blob contents; wasm under `public/` is not egress; keystroke logs never leave |
| 10 | FILE-01 unclassified specless edge — wasm compile under CSP | ⚠️ insufficient_spec | `verification: backstop`. CSP token and Node pin exist; no held-out browser `Parser.init` under this document's CSP — see Human Verification |
| 11 | `fetchGithubBlob` GETs `/repos/{owner}/{repo}/git/blobs/{sha}` with the same Accept/cors/omit headers; owner, repo, and sha are `encodeURIComponent` | ✓ VERIFIED | `loadGithubBlob` uses `githubGet` + `enc`. Client tests: URL, `assertListingFetch`, slashed-name encoding |
| 12 | JSON size greater than 100000 throws `CorpusTooLargeError` before `atob`; 100000 is accepted; decoded `byteLength` greater than 100000 also throws | ✓ VERIFIED | Size 100001 with invalid base64 still throws before `atob`. Size 100000 accepted. `size: null` re-checks `byteLength` |
| 13 | Blob JSON content newlines are stripped before `atob`; size null still re-checks `byteLength` after decode | ✓ VERIFIED | `body.content.replace(/\n/g, '')`. Wrapped-base64 decode test; null-size oversize test |
| 14 | Second `fetchGithubBlob` of the same sha does not call fetch; overlapping cold calls share one GET; `resetGithubCache` clears blob maps | ✓ VERIFIED | sha `blobCache` / `blobInflight`; `resetGithubCache` clears both tree and blob maps. Three client tests passed |
| 15 | `fromGithubBlob` reuses `MAX_BYTES`, UTF-16 BOM sniff on bytes[0]/bytes[1], `TextDecoder` utf-8, U+FFFD scan, and `normalize` — same order as `fromFile` | ✓ VERIFIED | `src/ingestion/github.ts` matches `fromFile` order. Tests: cap, BOM LE/BE, U+FFFD, normalize parity with `fromPaste` |
| 16 | Empty bytes that pass UTF-8 rules produce an Exercise with normalized text tagged github | ✓ VERIFIED | Empty `Uint8Array` → `text: ''`, `sourceType: 'github'`, `sourceRef: o/r:src/main.ts` |
| 17 | `foldTree` copies `GitTreeEntry.size` onto `FileNode.size` when present | ✓ VERIFIED | `size: entry.size`. Tree test omits when absent (`size` undefined); goldens include 120 / 50 |
| 18 | Dexie `version(1)` stores block is unchanged — github is an additive `SourceType` on the unindexed exercise blob | ✓ VERIFIED | `src/persistence/db.ts` still `this.version(1).stores({ sessions: '++id, startedAt' })` |
| 19 | FILE-02 unclassified specless edge — sourceRef shape beyond `owner/repo:path` | ⚠️ insufficient_spec | `verification: backstop`. Locked shape is tested; extra shapes have no held-out test — see Human Verification |
| 20 | Consecutive `import_statement` nodes merge into one import unit; consecutive type/interface/enum do not merge | ✓ VERIFIED | Cover cases 1 and 6 |
| 21 | `class_declaration` / `abstract_class_declaration` are one class unit including methods; nested functions stay inside the parent | ✓ VERIFIED | Cover cases 2, 3, 12. Nested `function inner` is a child of the parent unit, not collected |
| 22 | lexical/variable declaration whose value is arrow/function/function_expression is a function unit; `export_statement` range includes the export keyword | ✓ VERIFIED | Cover cases 4, 5, 13 |
| 23 | Other named children become kind `other` so leftover top-level statements are still units | ✓ VERIFIED | Cover case 7 `expression_statement` → `other`. Mixed top-level `ERROR` siblings are skipped (anti-pattern WR-03), not a SC 3 overlap failure |
| 24 | `utf16ToCodePoint` uses `Array.from(text.slice(0, utf16Index)).length` | ✓ VERIFIED | Implementation plus utf16 tests (emoji outside a later range is one code point). Cover case 10 |
| 25 | Unit A depends on B when A's subtree contains `identifier` or `type_identifier` whose name B defines; `property_identifier` is ignored | ✓ VERIFIED | `walkIdentifiers` returns on `property_identifier`. Tests: `a` depends on `b`; `foo.bar` does not depend on `bar` |
| 26 | Kahn topo emits in-degree 0 first, then dependents; leftover cycle members keep ascending source start | ✓ VERIFIED | `orderByDeps`. Tests: import first; `b` before `a`; cycle leftovers after Kahn prefix; equal-start leftovers keep source order |
| 27 | `planUnits` is pure and synchronous — no shared mutable parser cache | ✓ VERIFIED | `plan.ts` / `utf16.ts` have zero WASM imports, zero module-level plan cache |
| 28 | PLAN-02 unclassified specless edge — in-file identifier graph only; imported modules are not resolved | ✓ VERIFIED | Directly observed: `attachDeps` only maps names from collected in-file units. No module loader. Import units force `dependsOn: []`. Callee-as-leaf test passed |
| 29 | Status shows Planned N unit(s) from {path} on success; fallback notice is distinct from blocked-file copy | ✓ VERIFIED | `COPY.plannedOne` / `plannedMany` / `fallback` / `blocked`. Tests assert `Planned 2 units from src/App.tsx.` and fallback ≠ blocked |
| 30 | Last-wins token on file clicks: a slower first click cannot overwrite a faster second click's status or onPlanned | ✗ FAILED | Loadable-vs-loadable last-wins test passed. Blocked/commit clicks return before `++tokenRef` (`RepoBrowser.tsx` 119-126), so a slower first loadable click still matches the token, overwrites `COPY.blocked`, and calls `onPlanned`. Import and clicks share one counter — a click during Import can skip `setBusy(false)` |
| 31 | `node.size` greater than `MAX_BYTES` sets the 100 KB alert and does not call `fetchGithubBlob` | ✓ VERIFIED | `(node.size ?? 0) > MAX_BYTES` before GET. Test: `huge.ts` 100001, `fetchGithubBlob` not called, too-large alert |
| 32 | Non-loadable and commit entries still use blocked copy and do not fetch | ✓ VERIFIED | README / `.mjs` / `mod.ts` commit → `COPY.blocked`, no blob GET |
| 33 | App holds `FilePlan` in memory via `onPlanned`; paste/upload `CorpusInput` path is unchanged | ✓ VERIFIED | `useState<FilePlan \| null>`; `RepoBrowser onPlanned={setFilePlan}`; `CorpusInput onLoad={handleLoad}`. Test: `data-file-plan="true"`, `#capture-surface` null |
| 34 | Empty-state hero still says paste/upload Load exercise — planned files are status-region only | ✓ VERIFIED | Hero copy unchanged when `filePlan` is set and `exercise` is null. App test asserts Paste code / Load exercise |
| 35 | `wasm.ts` is the only importer of the WASM runtime; `locateFile` returns `/${scriptName}`; `.ts`/`.js` load typescript wasm, `.tsx`/`.jsx` load tsx wasm | ✓ VERIFIED | Only `src/parse/wasm.ts` imports `web-tree-sitter`. `locateFile: (scriptName) => \`/${scriptName}\``. `dialectForPath` basename `.tsx`/`.jsx` → tsx, else typescript |
| 36 | PLAN-01 adjacency at the UI seam — units come from `planUnits`; this plan does not re-split in the component | ✓ VERIFIED | Directly observed: `RepoBrowser` calls `planUnits(root, exercise)` / `fallbackPlan`; no second splitter. UI test mock returns a two-function `TsNode` and asserts `plan.units.length === 2` from real `planUnits` |

**Score:** 33/36 truths verified (0 present, behavior-unverified; 2 insufficient_spec; 1 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `.planning/phases/08-parse-dependency-units/08-ABI-PIN.md` | Winning runtime, locateFile name, grammar version, `cli_rebuild` | ✓ VERIFIED | `web-tree-sitter@0.27.0`, `web-tree-sitter.wasm`, `tree-sitter-typescript@0.23.2`, `cli_rebuild: false` |
| `package.json` | `web-tree-sitter` pin; typescript grammar in devDependencies | ✓ VERIFIED | `0.27.0` / `0.23.2`. No `tree-sitter-javascript` or `tree-sitter-cli` as direct deps |
| `index.html` | script-src `'self'` plus wasm-compile token | ✓ VERIFIED | `'wasm-unsafe-eval'` |
| `public/web-tree-sitter.wasm` | Runtime wasm copied from node_modules | ✓ VERIFIED | 209613 B WASM MVP |
| `public/wasm/tree-sitter-typescript.wasm` | TypeScript grammar wasm | ✓ VERIFIED | 1413849 B WASM MVP |
| `public/wasm/tree-sitter-tsx.wasm` | TSX grammar wasm | ✓ VERIFIED | 1445638 B WASM MVP |
| `src/github/client.ts` | `fetchGithubBlob` + blob cache/inflight; `resetGithubCache` clears both | ✓ VERIFIED | Exists, substantive, only `fetch(` in `src/` |
| `src/ingestion/github.ts` | `fromGithubBlob(bytes, meta) -> Exercise` | ✓ VERIFIED | Wired from `RepoBrowser` |
| `src/ingestion/types.ts` | `SourceType` includes `github`; `sourceRef` documents `owner/repo:path` | ✓ VERIFIED | |
| `src/github/types.ts` | `FileNode.size?: number` | ✓ VERIFIED | |
| `src/ui/HistoryView.tsx` | three-way sourceLabel: upload, github, else paste | ✓ VERIFIED | |
| `src/parse/types.ts` | `TsNode`, `PlanUnit`, `FilePlan`, `PlanUnitKind` | ✓ VERIFIED | |
| `src/parse/utf16.ts` | `utf16ToCodePoint` | ✓ VERIFIED | PURE, zero imports |
| `src/parse/plan.ts` | `planUnits`, `fallbackPlan` | ✓ VERIFIED | PURE; no WASM import |
| `src/parse/wasm.ts` | `ensureParser`, `loadDialect`, `parseSource`, `dialectForPath` | ✓ VERIFIED | Sole `web-tree-sitter` import |
| `src/ui/RepoBrowser.tsx` | `onPlanned(FilePlan)`; COPY loading/planned/fallback; last-wins | ⚠️ PARTIAL | Wired click→plan path. Last-wins token does not cover blocked/commit clicks |
| `src/ui/App.tsx` | `useState FilePlan \| null`; `onPlanned={setFilePlan}` | ✓ VERIFIED | Trainer still idle |

gsd-tools `verify.artifacts`: 15/15 PLAN artifact paths exist and are non-stub. `RepoBrowser.tsx` is listed VERIFIED by the existence checker; goal-backward last-wins still fails (table above).

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `index.html` | `public/web-tree-sitter.wasm` | script-src wasm-compile token | ✓ WIRED | `'wasm-unsafe-eval'` present. `wasm.ts` `locateFile` → `/${scriptName}` |
| `src/github/client.ts` | `src/ingestion/upload.ts` | `MAX_BYTES` and `CorpusTooLargeError` before `atob` | ✓ WIRED | Imports `MAX_BYTES`; throws before `atob` when JSON size exceeds |
| `src/ingestion/github.ts` | `src/ingestion/normalize.ts` | `fromGithubBlob` calls `normalize(raw)` | ✓ WIRED | `text: normalize(raw, { tabWidth })`. gsd-tools `verify.key-links` false-negatived on unescaped `normalize(` regex; manual read confirms the call |
| `src/ui/HistoryView.tsx` | `src/ingestion/types.ts` | sourceType github branch uses sourceRef | ✓ WIRED | `sourceType === 'github' ? (sourceRef ?? 'GitHub file')` |
| `src/parse/plan.ts` | `src/parse/utf16.ts` | convert startIndex/endIndex | ✓ WIRED | `utf16ToCodePoint` in `makeUnit` |
| `src/parse/plan.ts` | `src/ingestion/types.ts` | `FilePlan.exercise: Exercise` | ✓ WIRED | |
| `src/ui/RepoBrowser.tsx` | `src/github/client.ts` | loadable click calls `fetchGithubBlob` | ✓ WIRED | |
| `src/ui/RepoBrowser.tsx` | `src/ingestion/github.ts` | `fromGithubBlob(bytes, { owner, repo, path })` | ✓ WIRED | |
| `src/ui/RepoBrowser.tsx` | `src/parse/wasm.ts` | `ensureParser` + `parseSource` then `planUnits` | ✓ WIRED | |
| `src/ui/App.tsx` | `src/ui/RepoBrowser.tsx` | `onPlanned` holds FilePlan; CorpusInput still paste/upload only | ✓ WIRED | |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `src/ingestion/github.ts` | `Exercise.text` / `sourceType` / `sourceRef` | blob `Uint8Array` → BOM/`TextDecoder`/`normalize` | Yes — decode + normalize, not a static `[]` | ✓ FLOWING |
| `src/parse/plan.ts` | `FilePlan.units` | `TsNode` named children + identifier graph | Yes — collected from the tree, Kahn-ordered | ✓ FLOWING |
| `src/ui/RepoBrowser.tsx` | status text | `COPY.*` + `node.path` / `plan.units.length` | Yes — templates, not empty placeholder | ✓ FLOWING |
| `src/ui/App.tsx` | `filePlan` | `onPlanned={setFilePlan}` | Yes — real `FilePlan` held in state. Units are not rendered this phase (intentional; trainer idle) | ✓ FLOWING (held, not displayed) |
| `src/ui/HistoryView.tsx` | `sourceLabel` | `session.exercise.sourceType` / `sourceRef` from Dexie | Yes when a github session exists. Phase 8 does not persist github sessions (Phase 9 SCAF-03) | ✓ FLOWING (label path) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 8 unit + UI tests (114) | `pnpm exec vitest run --project unit src/github/client.test.ts src/github/tree.test.ts src/ingestion/github.test.ts src/parse/plan.test.ts src/parse/utf16.test.ts --project ui src/ui/HistoryView.test.tsx src/ui/RepoBrowser.test.tsx src/ui/App.test.tsx` | 8 files, 114 passed | ✓ PASS |
| Last-wins loadable-vs-loadable | same run, `last-wins overlapping clicks: slow first sha cannot overwrite the second` | pass | ✓ PASS (incomplete vs must-have — blocked second click untested) |
| Fallback on parse reject | same run, `calls onPlanned with fallback and distinct notice when parseSource rejects` | pass | ✓ PASS |
| Callee before caller | same run, `orders callee B before caller A even when A appears first in source` | pass | ✓ PASS |
| Empty github blob | same run, `produces a github Exercise from empty bytes that pass UTF-8 rules` | pass | ✓ PASS |
| Live Language.load under CSP | (no `wasm.test.ts` by plan; happy-dom mocks `parseSource`) | not run | ? SKIP — human |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | — | No `scripts/*/tests/probe-*.sh` and none declared in PLAN/SUMMARY | SKIPPED |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| FILE-01 | 08-01, 08-02, 08-04 | Click TS/JS → blob as corpus, 100 KB + UTF-8, normalized like paste/upload | ✓ SATISFIED | `fetchGithubBlob` + `fromGithubBlob` + size gate. Last-wins hole is FILE-01 concurrency, tracked as gap #30, not absence of the corpus pipeline |
| FILE-02 | 08-02, 08-04 | `sourceType: 'github'` with repo and path in `sourceRef`; History can show origin | ✓ SATISFIED | `fromGithubBlob` + `HistoryView` github branch. Persist of that row is Phase 9 |
| PLAN-01 | 08-03, 08-04 | Non-overlapping syntactic units (functions, import/type blocks; class is one unit; nested stay inside parent) | ✓ SATISFIED | `planUnits` goldens 1–13; UI calls `planUnits` and does not re-split |
| PLAN-02 | 08-03, 08-04 | Units ordered leaves-first by in-file dependencies | ✓ SATISFIED | Kahn + cycle leftovers. REQUIREMENTS wording “User types those units” is the Phase 9 trainer; this phase delivers the ordered `FilePlan` |
| PLAN-03 | 08-03, 08-04 | Whole-file fallback with a notice — never a silent no-op | ✓ SATISFIED | `fallbackPlan` + UI parse-throw path |

No orphaned REQUIREMENTS.md IDs for Phase 8. SCAF-01..05 are Phase 9 (pending).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/ui/RepoBrowser.tsx` | 119-126, 236-238 | Last-wins token skipped for blocked clicks; shared Import/click counter | 🛑 Blocker | Must-have #30. Slower loadable click overwrites blocked status/`onPlanned`. Click during Import can leave Import disabled |
| `src/github/client.ts` | 131-133 | `atob` `DOMException` not mapped | ⚠️ Warning | Malformed blob 200 leaves `Loading {path}…`; `onPlanned` never fires. Not the PLAN-03 parse-fallback path |
| `src/parse/plan.ts` | 53-56 | Top-level `ERROR` named children skipped | ⚠️ Warning | Mixed ERROR + valid children → `fallback: false` with cover holes. Phase 9 would skip those ranges. Only-ERROR still correctly fallbacks |
| `src/parse/plan.ts` | 221-228 | `definedNames` for non-import is `unit.name` only | ⚠️ Warning | `const x = 1` (`other`) does not publish `x`. Identifier-graph must-have still holds for named function/class/type units |
| `src/parse/wasm.ts` | 14-18 | Rejected `Parser.init` cached forever | ⚠️ Warning | First wasm 404/COEP glitch maps every later click to fallback until reload |
| `src/ui/App.tsx` | 66-72 | `handleLoad` does not `setFilePlan(null)` | ℹ️ Info | Stale `data-file-plan` after paste/upload. Phase 9 must not pair the wrong plan with the active exercise |
| production `src/` | — | TBD / FIXME / XXX | none | No debt markers in phase files. `TODO` in `upload.test.ts` is corpus text |

### Human Verification Required

These do not change `gaps_found` (rule 1 wins). They remain after the last-wins fix.

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
**Expected:** Planned N unit(s) from {path} on success; blocked copy for README; trainer idle.
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

### Gaps Summary

The phase goal is almost true: a TS/JS click fetches the blob, builds a github-tagged Exercise, plans non-overlapping leaves-first units (or a labeled whole-file fallback), and does not start the trainer. The blocking gap is last-wins on **all** file clicks. Blocked/commit clicks do not bump `tokenRef`, so an in-flight loadable plan can land after the user has already been told the file is blocked. The same shared counter can leave Import stuck `disabled`. That is FILE-01/PLAN-03 concurrency as written in 08-04, not a missing planner.

**This looks like an incomplete last-wins implementation, not an intentional deviation.** Do not override unless the blocked-click race is explicitly accepted. Fix `RepoBrowser.tsx` token handling, then re-verify.

Confirmation-bias notes (not extra gaps): (1) REQUIREMENTS PLAN-02 says “User types those units” — typing is Phase 9; this phase ships the ordered `FilePlan`. (2) The last-wins test passes but does not click a blocked file second. (3) `atob` failure is an uncovered error path that can stick on Loading….

---

_Verified: 2026-09-21T00:16:06Z_
_Verifier: Claude (gsd-verifier)_
