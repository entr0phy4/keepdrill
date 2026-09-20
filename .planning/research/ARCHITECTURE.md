# Architecture Research

**Domain:** Extending keebdrill's pure-core / platform-seam / hot-path split with GitHub fetch + tree-sitter scaffolding
**Researched:** 2026-09-20
**Confidence:** HIGH for integration shape (grounded in `App.tsx`, `CaptureSurface.tsx`, `trainer/state.ts`, `ingestion/types.ts`); MEDIUM for in-place caret geometry

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  UI  App.tsx  view: trainer | history | analytics   (hide-not-unmount)  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────────┐ │
│  │ CorpusInput  │  │ RepoBrowser  │  │ CaptureSurface + FileScaffold  │ │
│  │ paste/upload │  │ tree + URL   │  │ full file chrome, unit overlay │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────────┬────────────────┘ │
├─────────┴─────────────────┴──────────────────────────┴──────────────────┤
│  PURE CORE (no fetch, no WASM, no DOM)                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │ normalize() │  │ planUnits()  │  │ trainer/    │  │ metrics/     │  │
│  │ paste/upload│  │ ranges+topo  │  │ state.ts    │  │ analytics/   │  │
│  └─────────────┘  └──────▲───────┘  └─────────────┘  └──────────────┘  │
├──────────────────────────┼──────────────────────────────────────────────┤
│  PLATFORM SEAMS                                                         │
│  ┌───────────────────────┴──────────┐  ┌─────────────────────────────┐ │
│  │ github/client.ts  fetch only     │  │ parse/wasm.ts  Parser.init  │ │
│  │ repo + tree + blob               │  │ Language.load public/*.wasm │ │
│  └──────────────────────────────────┘  └──────────────▲──────────────┘ │
│  capture.ts hot path UNCHANGED                        │ AST adapter    │
│  persistence/db.ts UNCHANGED              parse/index.ts (injectable)  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `github/client.ts` | Network: parse URL, `GET` repo, recursive tree, blob; map HTTP errors | Sole module that may `fetch`. Returns plain data. |
| `github/types.ts` | `RepoRef`, `TreeEntry`, `BlobText` | No fetch. |
| `ui/RepoBrowser.tsx` | URL field, tree, blocked-file notice | Calls client; on TS/JS file, asks App to load a github Exercise. |
| `parse/wasm.ts` | `Parser.init` + `Language.load` once | Platform seam. Not imported by unit tests. |
| `parse/index.ts` | `parseToUnits(text, language) -> SyntaxForest` | Injects parser. Tests pass a fake forest. |
| `scaffold/plan.ts` | Pure: forest → `Unit[]` `{id, start, end, kind, dependsOn}` topo-sorted | Golden fixtures. Overlapping ranges forbidden. |
| `ui/FileScaffold.tsx` | Renders full file in three regions (done / current / future); positions CaptureSurface on current unit | New. |
| `CaptureSurface` | **Unchanged contract:** `text` is the current unit string | Remount on unit advance via existing `loadToken` pattern. |
| `ingestion/types.ts` | `SourceType` adds `'github'`; `sourceRef` for `owner/repo@sha:path` | Small type change. |
| `App.tsx` | Owns `exercise`, `curriculum: Unit[]`, `unitIndex`; `handleComplete` either advances unit or persists | Modified. |

## Recommended Project Structure

```
src/
├── github/                 # NEW platform seam (fetch)
│   ├── client.ts           # repo / tree / blob
│   ├── url.ts              # pure URL parse
│   ├── url.test.ts
│   └── types.ts
├── parse/                  # NEW platform seam (WASM) + adapter
│   ├── wasm.ts             # Parser.init / Language.load
│   └── index.ts            # parseSource(text, lang) -> forest
├── scaffold/               # NEW pure core
│   ├── plan.ts             # units + topo sort
│   ├── plan.test.ts        # fixtures, no WASM
│   └── types.ts
├── ingestion/              # MODIFIED
│   ├── types.ts            # SourceType + github Exercise factory
│   ├── github.ts           # fromGithubBlob(raw, meta) -> Exercise via normalize()
│   └── ...existing paste/upload/normalize
├── ui/
│   ├── RepoBrowser.tsx     # NEW
│   ├── FileScaffold.tsx    # NEW
│   ├── CorpusInput.tsx     # unchanged paste/upload
│   ├── CaptureSurface.tsx  # unchanged props; parent supplies unit text
│   └── App.tsx             # MODIFIED — curriculum state
├── capture/                # UNCHANGED hot path
├── trainer/                # UNCHANGED computeTrainerState(unitText)
├── persistence/            # UNCHANGED (Exercise already persisted)
└── analytics/              # UNCHANGED
```

### Structure Rationale

- **`github/` vs `ingestion/`:** Network and CORS live in `github/`. `ingestion/github.ts` only turns decoded text + metadata into an `Exercise` through `normalize()`, matching `fromPaste` / `fromFile`.
- **`parse/` vs `scaffold/`:** WASM is untestable in the unit project (Node, no `public/wasm`). Planner tests feed a hand-built forest.
- **Do not put fetch or Parser inside `trainer/` or `capture/`.**

## Architectural Patterns

### Pattern 1: Platform seam (already the house style)

**What:** One module owns the dirty API (`dexie`, now `fetch` / `web-tree-sitter`). Callers see data types.
**When to use:** Always for GitHub and WASM.
**Trade-offs:** Extra files; tests stay fast and deterministic.

**Example:**
```typescript
// github/client.ts — the only fetch
export async function fetchRepoTree(ref: RepoRef): Promise<TreeEntry[]> { /* ... */ }

// parse/index.ts
export type ParseFn = (text: string, language: 'typescript' | 'tsx' | 'javascript') => Forest
```

### Pattern 2: Curriculum outside CaptureSurface

**What:** `Exercise.text` for a github file is the **full normalized file** (so History can show the source). CaptureSurface receives `unitSlice = text.slice(unit.start, unit.end)` (code-point safe: `Array.from` then slice then join). Completing a unit increments `unitIndex`; remount CaptureSurface (`loadToken++`, `resetCapture()`). Completing the last unit calls existing `handleComplete` / `saveSession`.
**When to use:** Always. Do not teach `computeTrainerState` about ranges.
**Trade-offs:** One session per **file** (metrics span all units' keystroke logs if we *don't* reset capture) vs one session per **unit** (reset capture each time).

**Recommendation:** **One session per file.** Append keystrokes across units (do **not** `resetCapture` between units; only remount the textarea value). `completedAt` of the last unit is session completion. Restart (Escape) restarts the **current unit** only, or the whole file — product decision, default **current unit** so a botched function doesn't wipe the file.

If capture is not reset, `computeTrainerState(unitText)` will desync because charLog contains previous units. So we **must** either:

1. Reset capture per unit and concatenate per-unit logs into the Session at file-complete, or
2. Pass full-file text into computeTrainerState and pre-seed completed ranges (hostile to IME/textarea).

**Pick (1).** `resetCapture()` on unit advance. `App` accumulates `events`/`charLog`/`markers` snapshots per unit into the Session. Existing `buildSession` stays the writer at file-complete. Per-unit WPM can wait.

### Pattern 3: Code-point ranges

**What:** Unit `start`/`end` are code-point indices into normalized `Exercise.text`, never UTF-16. Same lesson as Phase 3.
**When to use:** Always.
**Trade-offs:** tree-sitter `startIndex` is UTF-16 bytes in JS (string index). Convert via a cp-offset table once after parse.

## Data Flow

### Request Flow

```
User pastes URL
    ↓
github/url.parse → RepoRef | error
    ↓
GET /repos/{owner}/{repo} → default_branch
    ↓
GET /git/trees/{branch}?recursive=1 → TreeEntry[] (cache by sha)
    ↓
RepoBrowser renders trie
    ↓
Click file
    ├─ non TS/JS → blocked notice
    └─ TS/JS → GET /git/blobs/{sha} → decode base64 → MAX_BYTES / UTF-8
                    ↓
              normalize() → Exercise { sourceType:'github', text, language, sourceRef }
                    ↓
              parse/wasm → Forest → scaffold/plan → Unit[]
                    ↓
              App sets curriculum[0], CaptureSurface(text=slice(unit0))
                    ↓
              unit complete → next unit (resetCapture, remount)
                    ↓
              last unit → buildSession + saveSession (existing)
```

### State Management

```
App
  exercise: Exercise | null          // full file text for github
  curriculum: Unit[]
  unitIndex: number
  unitLogs: Snapshot[]               // concatenated at file-complete
  loadToken                             // remount CaptureSurface
```

Paste/upload: `curriculum` empty, CaptureSurface gets `exercise.text` as today.

### Key Data Flows

1. **Import repo:** URL → tree cache. No blobs.
2. **Open file:** blob → Exercise → units → unit 0.
3. **Type unit:** identical to today's CaptureSurface path.
4. **Advance:** persist unit snapshot in memory, next slice.
5. **File complete:** flatten snapshots into one Session (or N sessions — see recommendation above: one Session, concatenated logs with unit markers if cheap).

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Solo daily use (this project) | In-memory tree cache; 60 req/h is enough if blob-on-click |
| Huge monorepo tree (`truncated: true`) | Show notice; fetch subdirectory trees on expand (lazy) |
| 100 KB file with hundreds of functions | Planner is O(nodes); fine. Overlay layout is the cost |

### Scaling Priorities

1. **First bottleneck:** Unauthenticated rate limit — cache tree, never prefetch blobs.
2. **Second bottleneck:** Overlay layout for a 2k-line file — virtualize the file chrome later; v2.0 can render the full `<pre>` (100 KB cap bounds it).

## Anti-Patterns

### Anti-Pattern 1: Parser on the hot path

**What people do:** Re-parse on every keystroke to highlight.
**Why it's wrong:** Capture handler must stay a single buffer push; WASM in the rAF loop janks timing.
**Do this instead:** Parse once on load. Trainer coloring stays `computeTrainerState`.

### Anti-Pattern 2: Full-file textarea with caret clamps

**What people do:** One textarea holding the whole file; preventDefault outside the unit.
**Why it's wrong:** Breaks IME/beforeinput; fights capture.ts; Tab/Escape already special-cased.
**Do this instead:** Textarea value === current unit only. File chrome is a separate rendered layer.

### Anti-Pattern 3: Exercise.text = current unit only

**What people do:** Reload Exercise per unit so History shows fragments.
**Why it's wrong:** You lose the file as the thing that was trained.
**Do this instead:** Exercise is the file. Curriculum is App state. Persist file Exercise on the Session.

### Anti-Pattern 4: Fetch from UI components

**What people do:** `RepoBrowser` calls `fetch` inline.
**Why it's wrong:** Untestable; duplicates error mapping; privacy grep becomes meaningless.
**Do this instead:** `github/client.ts` only.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| `api.github.com` | CORS `fetch`, no custom disallowed headers | 60 req/h. `Accept: application/vnd.github+json`. No `X-GitHub-Api-Version`. |
| Same-origin `/tree-sitter.wasm` + grammar wasm | `Parser.init({ locateFile })` | COEP-safe. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `github/client` ↔ `ui/RepoBrowser` | async functions returning data or typed errors | No React Query — one-shot loads. |
| `parse` ↔ `scaffold/plan` | Forest DTO | Tests skip `parse/wasm.ts`. |
| `App` ↔ `CaptureSurface` | `text: string` as today | Unit slice only. |
| `App` ↔ persistence | `saveSession` on file complete | Unchanged repository API. |

## Suggested build order

1. `github/url` + `github/client` + RepoBrowser tree (blocked clicks) — proves CORS+COEP in the real app.
2. Blob → `fromGithubBlob` → can load a TS file as a **whole-file** exercise internally behind a flag, then immediately...
3. `parse/wasm` + `scaffold/plan` with fixtures — do not ship whole-file as the user-visible path.
4. FileScaffold + unit advance + session concat.
5. Error copy: 404, 403 rate limit, truncated tree, parse failure, 0 units (empty/malformed file).

Steps 2–3 can be one phase if granularity stays coarse. Do not ship tree-click → whole file to production; that contradicts the locked UX.

## Sources

- `src/ui/App.tsx`, `CaptureSurface.tsx`, `trainer/state.ts`, `ingestion/types.ts` — HIGH
- GitHub Trees/Blobs REST — HIGH
- web-tree-sitter locateFile / Vite public wasm — HIGH

---
*Architecture research for: GitHub katas + scaffolded trainer*
*Researched: 2026-09-20*
