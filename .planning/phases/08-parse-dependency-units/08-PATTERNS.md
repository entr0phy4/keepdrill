# Phase 8: Parse & Dependency Units - Pattern Map

**Mapped:** 2026-09-20
**Files analyzed:** 25
**Analogs found:** 22 / 25

No `08-CONTEXT.md` — user continued without discuss-phase. File list is from `08-RESEARCH.md` Recommended Project Structure plus implied tests (`App.test.tsx`, `tree.test.ts`) when `onPlanned` / `FileNode.size` land.

`src/ingestion/upload.ts`, `src/ingestion/normalize.ts`, `src/capture/capture.ts`, and `vite.config.ts` stay **unchanged**. Do not teach paste/upload `handleLoad`. Do not strip COEP.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/github/client.ts` | service | request-response | itself — `githubGet` + cache/inflight | exact (in-place) |
| `src/github/client.test.ts` | test | request-response | itself — `vi.stubGlobal('fetch')` + sha cache | exact (in-place) |
| `src/github/types.ts` | model | transform | itself — `FileNode` / `GitTreeEntry.size?` | exact (in-place) |
| `src/github/tree.ts` | utility | transform | itself — `foldTree` FileNode construction | exact (in-place) |
| `src/github/tree.test.ts` | test | transform | itself — golden `Case[]` FileNode shape | exact (in-place) |
| `src/ingestion/types.ts` | model | transform | itself — `SourceType` union | exact (in-place) |
| `src/ingestion/github.ts` | service | transform | `src/ingestion/upload.ts` | exact |
| `src/ingestion/github.test.ts` | test | transform | `src/ingestion/upload.test.ts` | exact |
| `src/parse/types.ts` | model | transform | `src/github/types.ts` + `src/ingestion/types.ts` | role-match |
| `src/parse/utf16.ts` | utility | transform | `src/trainer/state.ts` (`Array.from`) + `src/ingestion/language-map.ts` | role-match |
| `src/parse/plan.ts` | utility | transform | `src/github/tree.ts` (PURE named-child walk) | role-match |
| `src/parse/plan.test.ts` | test | transform | `src/github/tree.test.ts` + `src/ingestion/normalize.test.ts` | exact |
| `src/parse/wasm.ts` | service | file-I/O | `src/persistence/db.ts` + `src/github/client.ts` (sole dirty import) | role-match |
| `src/ui/RepoBrowser.tsx` | component | request-response | itself — `COPY` + last-wins token + typed catch | exact (in-place) |
| `src/ui/RepoBrowser.test.tsx` | test | request-response | itself — `vi.mock('../github/client')` + click/status | exact (in-place) |
| `src/ui/HistoryView.tsx` | component | CRUD | itself — `sourceLabel` ternary | exact (in-place) |
| `src/ui/HistoryView.test.tsx` | test | CRUD | itself — `sourceType: 'upload'` row + `saveSession` | exact (in-place) |
| `src/ui/App.tsx` | component | event-driven | itself — `handleLoad` vs `<RepoBrowser />` | exact (in-place) |
| `src/ui/App.test.tsx` | test | event-driven | itself — GitHub tab hide-not-unmount + `#capture-surface` | exact (in-place) |
| `index.html` | config | — | itself — CSP meta | exact (in-place) |
| `README.md` | config | — | itself — `## Privacy` | exact (in-place) |
| `package.json` | config | — | itself — `dependencies` / `devDependencies` | exact (in-place) |
| `public/web-tree-sitter.wasm` | config | file-I/O | — | none |
| `public/wasm/tree-sitter-typescript.wasm` | config | file-I/O | — | none |
| `public/wasm/tree-sitter-tsx.wasm` | config | file-I/O | — | none |

`src/ingestion/upload.ts` / `fromFile` / `CorpusInput` stay the whole-file trainer path. A GitHub click that calls `handleLoad` ships the happy path the user rejected.

---

## Pattern Assignments

### `src/github/client.ts` (service, request-response)

**Analog:** itself, lines 1–101. Add `fetchGithubBlob` next to `fetchRepoTree`. Still the **only** module that may `fetch`.

**File-lead + sole-fetch contract** (lines 1–3):

```typescript
// Platform seam — the ONLY module that may fetch (GitHub listing). Kept out of
// the hot path. Callers receive RepoTreeResult or a typed Error. TypeError from
// fetch (CSP/COEP/offline) is not wrapped; the UI maps unreachable copy.
```

Update the lead comment to cover listing **and** blob contents. Do not open a second `fetch` module.

**Imports** (lines 5–11) — reuse errors + types; add `MAX_BYTES` / `CorpusTooLargeError` from ingestion:

```typescript
import {
  EmptyRepoError,
  GithubHttpError,
  RateLimitedError,
  RepoNotFoundError,
} from './errors'
import type { GitTreeEntry, RepoRef, RepoTreeResult } from './types'
```

`fetchGithubBlob` also imports `MAX_BYTES` and `CorpusTooLargeError` from `../ingestion/upload` and `../ingestion/errors`. Do not invent a blob-size error class.

**Headers / GET** (lines 21–28) — copy verbatim; do **not** add `X-GitHub-Api-Version` or `Authorization`:

```typescript
function githubGet(path: string): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    headers: { Accept: 'application/vnd.github+json' },
  })
}
```

Blob path: `/repos/${enc(ref.owner)}/${enc(ref.repo)}/git/blobs/${enc(sha)}`. Reuse `enc` (line 30–32).

**Error mapper** (lines 38–50) — reuse `readGithub` as-is (404 → `RepoNotFoundError`, 429 / 403 remaining=0 → `RateLimitedError`, other non-OK → `GithubHttpError`):

```typescript
async function readGithub(res: Response): Promise<unknown> {
  if (res.status === 404) throw new RepoNotFoundError()
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

**Cache + inflight** (lines 13–18, 88–101) — copy the map + last-writer pattern, keyed by **blob sha** (content-addressed; owner/repo is not needed):

```typescript
export function fetchRepoTree(ref: RepoRef): Promise<RepoTreeResult> {
  const key = refKey(ref)
  const cached = cache.get(key)
  if (cached !== undefined && typeof cached !== 'string') {
    return Promise.resolve(cached)
  }
  const existing = inflight.get(key)
  if (existing) return existing
  const pending = loadRepoTree(ref).finally(() => {
    inflight.delete(key)
  })
  inflight.set(key, pending)
  return pending
}
```

`resetGithubCache()` (lines 16–19) must also clear the new blob maps so tests stay isolated.

**Size gate before decode:** `if ((body.size ?? 0) > MAX_BYTES) throw new CorpusTooLargeError(size)` **before** `atob`. Strip newlines then `atob`; re-check `bytes.byteLength`. Shape is in `08-RESEARCH.md` Pattern 1 — no in-repo blob decoder exists.

**Do NOT:** `Accept: application/vnd.github.raw+json`, `raw.githubusercontent.com`, prefetch on Import, a second `fetch` helper.

---

### `src/github/client.test.ts` (test, request-response)

**Analog:** itself, lines 1–185.

**Harness** (lines 11–76) — copy `ACCEPT`, `jsonRes`, `mockedFetch`, `vi.stubGlobal('fetch')`, `resetGithubCache` in `afterEach`. Zero live `api.github.com`.

```typescript
const ACCEPT = { Accept: 'application/vnd.github+json' } as const

function assertListingFetch(call: unknown[]): void {
  const url = String(call[0])
  const init = call[1] as RequestInit
  expect(url.startsWith('https://api.github.com/')).toBe(true)
  expect(init.method).toBe('GET')
  expect(init.mode).toBe('cors')
  expect(init.credentials).toBe('omit')
  expect(init.headers).toEqual(ACCEPT)
}
```

**Cache / inflight assertions to copy** (lines 104–119) — second call of the same sha must not hit `fetch`; overlapping cold calls share one GET:

```typescript
it('does not call fetch again on a second import of the same ref', async () => {
  stubSuccess()
  await fetchRepoTree(REF)
  await fetchRepoTree(REF)
  expect(mockedFetch()).toHaveBeenCalledTimes(2)
})

it('shares one in-flight pair for overlapping cold calls', async () => {
  stubSuccess()
  const [first, second] = await Promise.all([
    fetchRepoTree(REF),
    fetchRepoTree(REF),
  ])
  expect(mockedFetch()).toHaveBeenCalledTimes(2)
  expect(first).toEqual(second)
})
```

For blobs: one GET per unique sha (tree used two GETs because repo+tree). Fixture JSON: `{ content: base64-with-newlines, encoding: 'base64', size, sha }`. Assert wrapped base64 still decodes. Assert `size: 100_001` throws `CorpusTooLargeError` and `atob` is never reached (spy or assert `fetch` returned without decoding by checking the thrown class only — do not decode in the test). Encode `owner`/`repo`/`sha` in the URL (`enc` analog at client.ts:177–184 for slashed branch).

Vitest project: `src/**/*.test.ts` → **unit** / `environment: 'node'`.

---

### `src/github/types.ts` (model, transform)

**Analog:** itself, lines 1–41.

**File-lead** currently says sourceType stays paste|upload until Phase 8 — rewrite that sentence; `SourceType` lives in ingestion, not here.

**`GitTreeEntry.size?` already exists** (lines 10–15). Copy it onto `FileNode` so the UI can refuse oversize **before** GET:

```typescript
export interface FileNode {
  kind: 'file'
  name: string
  path: string
  sha: string
  entryType: 'blob' | 'commit'
}
```

Add `size?: number`. Do not add `content`. Do not import Dexie / React / `web-tree-sitter`.

---

### `src/github/tree.ts` (utility, transform)

**Analog:** itself, lines 1–66.

**PURE header + allowlist** (lines 1–8) — keep `LOADABLE` and `isLoadablePath` unchanged (D-05). Do not switch to `extToLang`.

**FileNode construction** (lines 55–61) — fold `entry.size` through when present:

```typescript
const file: FileNode = {
  kind: 'file',
  name: basename(entry.path),
  path: entry.path,
  sha: entry.sha,
  entryType: entry.type,
}
```

Add `size: entry.size` (omit or `undefined` when GitHub omitted it). Sibling order stays first-seen (lines 50–63). `commit` entries still become file leaves — they stay blocked by `isLoadablePath` / `entryType === 'commit'`.

---

### `src/github/tree.test.ts` (test, transform)

**Analog:** itself, lines 1–176.

Golden `Case[]` FileNode literals currently omit `size` even when the input entry has it (`nestedFixture` line 14: `size: 120`). After `foldTree` copies size, **every expected `FileNode` that had `size` on the entry must include it** or the `toEqual` cases break.

```typescript
{
  kind: 'file',
  name: 'App.tsx',
  path: 'src/App.tsx',
  sha: 'def',
  entryType: 'blob',
}
```

Allowlist `it.each` (lines 164–176) stays: `.mjs`/`.cjs` false; `.ts`/`.tsx`/`.js`/`.jsx` true.

---

### `src/ingestion/types.ts` (model, transform)

**Analog:** itself, lines 1–13.

```typescript
export type SourceType = 'paste' | 'upload'

export interface Exercise {
  /** Normalized, typing-ready text. Never the raw input. */
  text: string
  /** Best-effort. `'plaintext'` for paste (D-11, A11). */
  language: string
  sourceType: SourceType
  /** File name for uploads (D-11). Absent for paste. */
  sourceRef?: string
}
```

Change: `SourceType = 'paste' | 'upload' | 'github'`. Document `sourceRef` for github as `owner/repo:path` (research discretion). **Do not** bump Dexie `version(1)` — `exercise` is an unindexed structured-clone blob (`src/persistence/db.ts` lines 12–19). Additive union is a TypeScript change only.

---

### `src/ingestion/github.ts` (service, transform)

**Analog:** `src/ingestion/upload.ts` lines 1–48. `fromGithubBlob` is `fromFile` without `File.text()`.

**Imports** (upload.ts:1–4):

```typescript
import type { Exercise } from './types'
import { normalize } from './normalize'
import { extToLang } from './language-map'
import { CorpusTooLargeError, NonUtf8Error } from './errors'
```

**Load-bearing order** (upload.ts:8–15, 24–47) — copy this order; only the byte source changes:

```typescript
export async function fromFile(file: File, tabWidth = 4): Promise<Exercise> {
  if (file.size > MAX_BYTES) {
    throw new CorpusTooLargeError(file.size)
  }

  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer())
  if (
    head.length >= 2 &&
    ((head[0] === 0xff && head[1] === 0xfe) || (head[0] === 0xfe && head[1] === 0xff))
  ) {
    throw new NonUtf8Error(file.name)
  }

  const raw = await file.text()
  if (raw.includes('�')) {
    throw new NonUtf8Error(file.name)
  }

  return {
    text: normalize(raw, { tabWidth }),
    language: extToLang(file.name),
    sourceType: 'upload',
    sourceRef: file.name,
  }
}
```

For github: input is already `Uint8Array` (client gated size). Sniff `bytes[0]`/`bytes[1]`. Decode with `new TextDecoder('utf-8').decode(bytes)` — **not** `File.text()`. `NonUtf8Error(meta.path)`. Tag:

```typescript
sourceType: 'github',
sourceRef: `${meta.owner}/${meta.repo}:${meta.path}`,
language: extToLang(meta.path),
```

Reuse exported `MAX_BYTES` from `upload.ts` (lines 20–22) — do not redeclare `100_000`. Function is **sync** (bytes already in memory), like `fromPaste` (`src/ingestion/paste.ts` lines 10–16), not async like `fromFile`.

**Do NOT:** parse AST here, call `fetch`, skip `normalize`, put SHA in `sourceRef`.

---

### `src/ingestion/github.test.ts` (test, transform)

**Analog:** `src/ingestion/upload.test.ts` lines 1–101.

**Golden upload Exercise** (lines 22–32) — copy the equality shape; swap tags:

```typescript
expect(exercise).toEqual({
  text: 'const x = 1\n',
  language: 'typescript',
  sourceType: 'upload',
  sourceRef: 'main.ts',
})
```

Expect `sourceType: 'github'` and `sourceRef: 'o/r:src/main.ts'` (or whatever meta the test passes).

**Cap / never-read** (lines 34–41):

```typescript
it('rejects a file over 100 KB with CorpusTooLargeError and never reads it', async () => {
  const file = textFile('x', 'huge.txt')
  Object.defineProperty(file, 'size', { value: 100_001 })
  const textSpy = vi.spyOn(file, 'text')

  await expect(fromFile(file)).rejects.toBeInstanceOf(CorpusTooLargeError)
  await expect(fromFile(file)).rejects.toMatchObject({ sizeBytes: 100_001 })
  expect(textSpy).not.toHaveBeenCalled()
})
```

For bytes: pass a `Uint8Array` of length `100_001` (or a tiny array with a fake length if you only assert the class — prefer a real `byteLength`). No `File.text` spy; the function must throw before `TextDecoder`.

**BOM / U+FFFD** (lines 51–66) — copy as `bytesFile` → `Uint8Array` of `[0xff, 0xfe, …]` and `'valid then � garbage'`. `toMatchObject({ fileName: meta.path })`.

**Same normalize as paste** (lines 68–74) — `fromGithubBlob(bytes, meta)` text equals `fromPaste(raw, lang)` / `normalize(raw)`.

**Boundary 100_000** (lines 44–49) and empty (lines 81–88) copy. Language from path: `src/foo.ts` → `typescript` via `extToLang` (`language-map.ts` lines 41–47).

Vitest: unit / node. No fetch, no WASM.

---

### `src/parse/types.ts` (model, transform)

**Analog:** `src/github/types.ts` lines 1–41 (named types only, no runtime) + `src/ingestion/types.ts` (domain blob held in memory).

**File-lead** (`github/types.ts:1–3`):

```typescript
// Named types only — no runtime, no Dexie, no React. Loaded GitHub trees
// are held in memory this phase; sourceType stays 'paste' | 'upload' until
// Phase 8 actually builds an Exercise.
```

Copy the “named types only, no Dexie, no React” rule. **Do not** import `web-tree-sitter`. `FilePlan` / `PlanUnit` / structural `TsNode` live here.

`PlanUnit` fields from `08-RESEARCH.md` PLAN-03 fallback: `id`, `kind`, `start`, `end`, `dependsOn`. `FilePlan`: `exercise`, `units`, `fallback`, `notice?`. Indices are **code-point** offsets into `Array.from(exercise.text)`, matching `src/trainer/state.ts` lines 23–31.

`TsNode` is a structural subset (`type`, `startIndex`, `endIndex`, `namedChildren`, optional `childForFieldName`) so tests inject fixtures. Do not re-export `SyntaxNode` from `web-tree-sitter`.

---

### `src/parse/utf16.ts` (utility, transform)

**Analog:** `src/trainer/state.ts` lines 23–31 (code-point vs UTF-16) + `src/ingestion/language-map.ts` / `src/ingestion/normalize.ts` (tiny PURE helper, `// PURE` header).

**Unicode contract** (`trainer/state.ts:23–31`):

```typescript
  // Code-point array, not raw string indexing: `target[i]`/`target.length`
  // are UTF-16-code-unit semantics, but `cursor` below advances one per
  // Unicode code point (via for...of, matching the insert branch's own
  // iteration). Any supplementary-plane character (surrogate pair — most
  // emoji, some math/CJK-extension symbols) desyncs the two if target is
  // indexed directly, corrupting scoring past that character and — since
  // `cursor` could never reach the larger UTF-16 `target.length` — making
  // the exercise permanently uncompletable.
  const targetChars = Array.from(target)
```

**PURE header** (`normalize.ts:1–2` / `url.ts:1–3`):

```typescript
// PURE — zero network, zero DOM. D-09 / D-10. Host allowlist is github.com
```

Implementation shape is research (`utf16ToCodePoint(text, utf16Index) => Array.from(text.slice(0, utf16Index)).length`). Do **not** use `text.length` as a code-point length. Zero imports.

No analog for the helper itself — `state.ts` consumes code points but never converts a tree-sitter UTF-16 index. Tests: supplementary-plane char outside a range and inside a body (`08-RESEARCH.md` Pitfall 4).

---

### `src/parse/plan.ts` (utility, transform)

**Analog:** `src/github/tree.ts` lines 1–66 — PURE walk of a tree, named children only, no DOM/network.

**PURE fold header** (`tree.ts:1–4`):

```typescript
// PURE — zero DOM access, zero network. This fold walks every GitHub tree[]
// entry: type tree ensures a dir; blob and commit become file leaves (Pitfall 8).
```

**Walk named children, not descendants** (`tree.ts:50–63` analog): `foldTree` iterates `entries` once and does not recurse into blob contents. `planUnits` must walk `program.namedChildren` only — a descendant walk of every `function_declaration` overlaps units (PLAN-01 / Pitfall 5).

**Do NOT import `web-tree-sitter`.** Accept `TsNode` + `text`. Convert `startIndex`/`endIndex` through `utf16ToCodePoint` before slicing `Array.from(text)`.

**No analog for Kahn topo / identifier graphs.** Copy RESEARCH Pattern 5 / Code Examples `orderByDeps`. Cycles: leftover units stable-sorted by `start` (same first-seen discipline as `foldTree` sibling order, `tree.ts` comment line 3).

**PLAN-03 fallback analog:** never return empty — `tree.ts` empty input returns `[]` (line 17 + test case 4), which is the **anti-pattern** here. If `units.length === 0` or the caller caught a parse throw, emit one `file` unit covering `[0, Array.from(text).length)`. That fallback lives at the RepoBrowser/wasm edge; `plan.ts` may also return fallback when named children are only `ERROR`.

**Do NOT:** split `method_definition` (PLAN-05), resolve imported modules, walk `property_identifier` as an in-file ref.

---

### `src/parse/plan.test.ts` (test, transform)

**Analog:** `src/github/tree.test.ts` lines 5–162 (golden `Case[]` + `it.each`) and `src/ingestion/normalize.test.ts` lines 9–56.

**Golden table** (`tree.test.ts:5–10, 158–162`):

```typescript
interface Case {
  n: number
  name: string
  input: readonly GitTreeEntry[]
  expected: TreeNode[]
}

describe('foldTree — golden cases (REPO-02)', () => {
  it.each(cases)('case $n: $name', ({ input, expected }) => {
    expect(foldTree(input)).toEqual(expected)
  })
})
```

Inject a `TsNode`-like fixture — **never** `Language.load`. Must-have cases (from RESEARCH): consecutive `import_statement` merge; class = one unit (methods inside); nested function stays in parent (assert non-overlapping `[start,end)`); `const f = () =>` is a function unit; `export function` range includes `export`; empty / only `ERROR` → fallback whole file; identifier edge A-calls-B → B before A; cycle keeps source order; emoji outside/inside a function (utf16).

Vitest: unit / node. Zero WASM.

---

### `src/parse/wasm.ts` (service, file-I/O)

**Analog:** `src/persistence/db.ts` lines 1–23 (sole dirty import, kept off the hot path) + `src/github/client.ts` lines 1–3 (same seam comment).

**Sole-import header** (`db.ts:1–2`):

```typescript
// Platform seam — the ONLY module that imports Dexie (D-03). Kept out of the
// hot path.
```

This file is the **only** importer of `web-tree-sitter`. `plan.ts` must not import it. Callers: `ensureParser()` / `parse(text, dialect)` / `loadDialect`.

**Lazy singleton analog:** `db.ts` constructs once at module scope (`export const db = new KeebdrillDB()`). WASM init is async — use the inflight-promise pattern from `client.ts` lines 88–101 (`initOnce ??= Parser.init(...)`, language `Map` cache like `cache`/`inflight`).

`locateFile: (scriptName) => `/${scriptName}`` so Vite serves `public/web-tree-sitter.wasm`, not a hashed chunk sibling. Grammar paths: `/wasm/tree-sitter-typescript.wasm` and `/wasm/tree-sitter-tsx.wasm`.

Dialect map (research): `.ts`/`.js` → typescript; `.tsx`/`.jsx` → tsx.

**Error handling:** `Language.load` / `parse` throw → caller (RepoBrowser) maps to PLAN-03 fallback. Do not swallow. Do not write a `wasm.test.ts` that boots WASM (RESEARCH anti-pattern).

Wave 0 must pin ABI (`web-tree-sitter@0.27.0` vs `0.25.10`) **before** this file is written against a live `Parser.init`.

---

### `src/ui/RepoBrowser.tsx` (component, request-response)

**Analog:** itself, lines 1–230. Grow `onPlanned?: (plan: FilePlan) => void`. **Never** call `handleLoad` / `onLoad(exercise)`.

**COPY const** (lines 15–32) — replace `notYet`; keep blocked / rate-limit / 404 voice (plain second person, no “WASM” / “tree-sitter” / “Phase 9”):

```typescript
const COPY = {
  // ...
  blocked: "This file can't be split yet. No exercise loaded.",
  notYet:
    'TypeScript/JavaScript files open as scaffolded exercises in the next step. Browsing only for now.',
  emptyRepo: 'This repository has no files on the default branch.',
} as const
```

Reuse corpus error voice from `src/ui/CorpusInput.tsx` lines 14–23 for blob cap / UTF-8:

```typescript
  errTooLarge: 'This file is over 100 KB. Paste a smaller section, or trim the file first.',
  errNonUtf8: "This file isn't UTF-8 text. Save it as UTF-8, or paste the contents instead.",
```

Draft loading / planned N / fallback strings in the same `COPY` object (research Open Question 2). Fallback must be distinct from `COPY.blocked`.

**Last-wins token** (lines 106, 115–117, 125, 134, 145, 163) — reuse `tokenRef` **or** a second ref for blob clicks so a slow first click cannot overwrite a faster second:

```typescript
  const tokenRef = useRef(0)

  const onImport = async () => {
    const token = ++tokenRef.current
    setBusy(true)
    setStatus(null)
    // ...
    const result = await fetchRepoTree(ref)
    if (tokenRef.current !== token) return
```

**Typed catch + inline status** (lines 144–161) — extend with `CorpusTooLargeError` / `NonUtf8Error` the same way `CorpusInput.tsx` lines 100–108 maps them; keep GitHub HTTP / `TypeError` mapping:

```typescript
    } catch (err) {
      if (loadTokenRef.current !== token) return
      if (err instanceof CorpusTooLargeError) {
        setFileError(COPY.errTooLarge)
      } else if (err instanceof NonUtf8Error) {
        setFileError(COPY.errNonUtf8)
      } else {
        throw err
      }
    }
```

Status region already exists (lines 218–227): `role="alert"` for errors, `role="status"` for notices. Loading / planned / fallback go here — **not** the main empty-state hero (research Open Question 3).

**Click policy** (lines 108–113): non-loadable / `entryType === 'commit'` still `COPY.blocked`. Loadable: fetch blob → `fromGithubBlob` → parse/plan → `onPlanned(plan)` even on fallback. Optional pre-GET: if `node.size > MAX_BYTES`, throw/status without `fetchGithubBlob`.

**Tree text:** `node.name` is already a React text child (lines 67, 85). Blob/plan notices stay text nodes. No `innerHTML`.

**Do NOT:** mount `CaptureSurface`, call `handleLoad`, prefetch blobs on Import.

---

### `src/ui/RepoBrowser.test.tsx` (test, request-response)

**Analog:** itself, lines 1–408.

**Mock the client** (lines 13–19) — extend the hoist with `fetchGithubBlob`:

```typescript
const { fetchRepoTree } = vi.hoisted(() => ({
  fetchRepoTree: vi.fn(),
}))

vi.mock('../github/client', () => ({
  fetchRepoTree,
}))
```

Also mock `../parse/wasm` (and/or `../parse/plan`) so UI tests never `Language.load`. Inject a planned `FilePlan` or a throwing parse.

**Locked copy + click** (lines 149–172) — replace the `notYet` expectation with planned/fallback copy. Keep blocked vs loadable distinct:

```typescript
  it('shows blocked copy on README.md click and not-yet copy on App.tsx click', async () => {
    // ...
    expect(statusRegion().textContent).toBe(COPY.notYet)
    expect(COPY.blocked).not.toBe(COPY.notYet)
  })
```

`.mjs` stays blocked (lines 174–187).

**Last-wins overlapping Imports** (lines 282–303) — copy for overlapping **file clicks** (slow blob vs fast blob). Assert `onPlanned` spy is **not** `handleLoad`. Assert `#capture-surface` is absent if rendered inside App; in isolation, assert `onPlanned` called with `FilePlan` and no trainer callback exists.

**Status role** stays `status` for notices, `alert` for 404/rate-limit/too-large (existing lines 160, 234).

Must-have: PLAN-03 — mocked parse throw still calls `onPlanned` with `fallback: true` and status notice; never a silent no-op.

---

### `src/ui/HistoryView.tsx` (component, CRUD)

**Analog:** itself, lines 39–43 — the FILE-02 bug.

```typescript
  const sourceLabel =
    session.exercise.sourceType === 'upload' ? session.exercise.sourceRef ?? 'Uploaded file' : 'Pasted snippet'
```

Change to a three-way: `upload` → `sourceRef ?? 'Uploaded file'`; `github` → `sourceRef ?? 'GitHub file'`; else `'Pasted snippet'`. Prefer showing `sourceRef` for both upload and github (research Code Example). Do not import `dexie` / `../persistence/db` (file-lead lines 8–10).

---

### `src/ui/HistoryView.test.tsx` (test, CRUD)

**Analog:** itself, lines 49, 97–117, 164–188.

**Paste fixture** (line 49):

```typescript
const baseExercise: Exercise = { text: 'const x = 1', language: 'plaintext', sourceType: 'paste' }
```

**Upload row already asserts `sourceRef` text** (lines 167–187: `'second.ts'` / `'first.ts'`). Add a sibling test: `sourceType: 'github'`, `sourceRef: 'o/r:src/App.tsx'` → row contains that string and **does not** contain `'Pasted snippet'`. Reuse `buildInput` / `saveSession` / `waitForLiveQuery`. Dexie `version(1)` already stores the whole `exercise` (`db.test.ts` lines 50–58) — no schema bump needed to persist the new union member.

---

### `src/ui/App.tsx` (component, event-driven)

**Analog:** itself, lines 32–78 and 210–223.

**`handleLoad` stays paste/upload-only** (lines 64–78):

```typescript
  const handleLoad = (loaded: Exercise) => {
    resetCapture() // fresh buffer per exercise
    setExercise(loaded)
    setLoadToken((token) => token + 1)
    // ...
  }
```

**GitHub panel today** (lines 217–223):

```typescript
        <div
          id="corpus-panel-github"
          role="tabpanel"
          style={{ display: corpusTab === 'github' ? 'grid' : 'none' }}
        >
          <RepoBrowser />
        </div>
```

Pass `onPlanned={(plan) => setFilePlan(plan)}` (or equivalent). Hold `FilePlan` in memory. **Do not** feed `plan.exercise` into `handleLoad` this phase. Empty-state hero (lines 226–234) stays “Paste code… Load exercise”. CaptureSurface still keys off `exercise` from paste/upload only (lines 251–257).

Hide-not-unmount (lines 183, 237–241) is unchanged.

---

### `src/ui/App.test.tsx` (test, event-driven)

**Analog:** itself, lines 61–80 (`#capture-surface` appears only after paste Load) and 371–403 (GitHub tab hide-not-unmount).

Paste load **does** mount capture (lines 71–80):

```typescript
  await act(async () => {
    loadButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextFrame()
  })

  const captureArea = container.querySelector<HTMLTextAreaElement>('#capture-surface')!
```

GitHub click must **not** produce `#capture-surface`. Keep Paste/GitHub tab tests (lines 371–403). Mock `fetchGithubBlob` / wasm at the App boundary if the click path is exercised here; otherwise RepoBrowser tests own the click, and App tests only assert `<RepoBrowser>` still does not call `handleLoad` (no capture after switching to GitHub).

---

### `index.html` (config)

**Analog:** itself, lines 7–10.

```html
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; connect-src 'self' https://api.github.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'"
    />
```

Add `script-src 'self' 'wasm-unsafe-eval'` (MDN: wasm compile is a script-src concern and currently falls back to `default-src 'self'`, which blocks `WebAssembly.instantiate`). **Do not** add `'unsafe-eval'`. **Do not** add `raw.githubusercontent.com` to `connect-src`. Keep `connect-src` as-is.

---

### `README.md` (config)

**Analog:** itself, lines 62–73.

```markdown
There is still no backend and no analytics. The only allowed network egress
is `https://api.github.com`, and only for **corpus listing** — fetching a
public repository's default-branch file tree. Keystroke logs and pasted or
uploaded corpus still never leave the machine. The only `fetch` call in
`src/` will live in `src/github/client.ts` (added in a later plan of this
phase).
```

Update “corpus listing” → **corpus listing and blob contents**. Keystroke logs still never leave. Mention same-origin wasm (`public/*.wasm`); wasm is not network egress. Drop the stale “added in a later plan” sentence — `client.ts` already exists.

---

### `package.json` (config)

**Analog:** itself, lines 18–36.

```json
  "dependencies": {
    "dexie": "4.4.4",
    "dexie-react-hooks": "4.4.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
```

After Wave 0 pin: `pnpm add web-tree-sitter@<winner>` (research default `0.27.0`; fallback `0.25.10`). Grammar: `pnpm add -D tree-sitter-typescript@0.23.2` (prefer `--ignore-scripts` if `node-gyp-build` fails). Do **not** add `tree-sitter-javascript` or `tree-sitter-cli` unless the spike requires them. Insert `checkpoint:human-verify` before `pnpm add` (research Package Legitimacy — seam [SUS], human-verify protocol).

---

### `public/web-tree-sitter.wasm` + `public/wasm/*.wasm` (config, file-I/O)

**No source analog.** Closest static file is `public/favicon.svg` (binary asset served same-origin). Copy from `node_modules` after install (`08-RESEARCH.md` Installation). Commit the copies so `pnpm preview` / CI do not depend on postinstall. `locateFile` target names must match the files on disk (`web-tree-sitter@0.27.0` ships `web-tree-sitter.wasm`, not the README’s `tree-sitter.wasm`). COEP `require-corp` in `vite.config.ts` lines 7–10 stays — CDN wasm is forbidden.

---

## Shared Patterns

### Platform seam (sole dirty import)

**Source:** `src/persistence/db.ts` lines 1–2; `src/github/client.ts` lines 1–3, 21–28
**Apply to:** `src/github/client.ts` (still the only `fetch`), `src/parse/wasm.ts` (only `web-tree-sitter` import)

```typescript
// Platform seam — the ONLY module that may fetch (GitHub listing). Kept out of
// the hot path.
```

`ingestion/` and `parse/plan.ts` stay PURE. Do not `fetch` from `parse/` or `ingestion/`.

### Typed error + COPY + inline render

**Source:** `src/ingestion/errors.ts` lines 1–22; `src/ui/CorpusInput.tsx` lines 14–23, 100–108; `src/ui/RepoBrowser.tsx` lines 144–161, 218–227
**Apply to:** blob click path in `RepoBrowser.tsx`

Named classes (`CorpusTooLargeError`, `NonUtf8Error`, `RepoNotFoundError`, `RateLimitedError`, `GithubHttpError`). UI `instanceof` maps to frozen `COPY` strings. `role="alert"` for failures, `role="status"` for notices. No toast, no `err.message` in the DOM (`RepoBrowser.test.tsx` line 270: unreachable copy must not contain `'Failed to fetch'`).

### Last-wins monotonic token

**Source:** `src/ui/RepoBrowser.tsx` lines 106–117; `src/ui/CorpusInput.tsx` lines 37–39, 71–77
**Apply to:** Import **and** blob clicks

```typescript
  const loadTokenRef = useRef(0)
  const token = ++loadTokenRef.current
  // ...
  if (loadTokenRef.current !== token) return
```

### Cache + inflight coalescing

**Source:** `src/github/client.ts` lines 13–18, 88–101; tests at `client.test.ts` lines 104–119
**Apply to:** blob cache keyed by sha

Second click of the same sha = 0 extra GETs. Overlapping clicks share one GET (Pitfall 8 / 60 req/h).

### PURE header + code-point indexing

**Source:** `src/github/tree.ts` lines 1–4; `src/ingestion/normalize.ts` lines 1–6; `src/trainer/state.ts` lines 23–31
**Apply to:** `parse/plan.ts`, `parse/utf16.ts`, `ingestion/github.ts`

`Array.from(text)` for lengths and slices. Tree-sitter `startIndex` is UTF-16 — convert first (Phase 3 uncompletable-exercise bug).

### Fetch test harness

**Source:** `src/github/client.test.ts` lines 11–76
**Apply to:** blob cases in the same file

`vi.stubGlobal('fetch')`, fixture JSON, assert `Accept` / `cors` / `omit`. Zero live GitHub. UI tests `vi.mock('../github/client')` (`RepoBrowser.test.tsx` lines 13–19).

### Hide-not-unmount + trainer stays idle

**Source:** `src/ui/App.tsx` lines 183, 210–223, 237–241
**Apply to:** `onPlanned` wiring

`display` toggle, never unmount CorpusInput / CaptureSurface. GitHub click must not set `exercise` this phase.

### Dexie version(1) stays

**Source:** `src/persistence/db.ts` lines 12–19; `src/persistence/db.test.ts` lines 44–48
**Apply to:** `SourceType` += `'github'`

```typescript
    this.version(1).stores({
      sessions: '++id, startedAt',
    })
```

`exercise` is stored but **not** indexed. No `version(2)`.

### CSP / COEP

**Source:** `index.html` lines 7–10; `vite.config.ts` lines 7–10
**Apply to:** wasm compile

COEP stays `require-corp` on **both** `server` and `preview`. Fix wasm with `'wasm-unsafe-eval'` + same-origin `public/` files — never strip COEP.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `public/web-tree-sitter.wasm` | config | file-I/O | No committed wasm; only `public/favicon.svg`. Copy from `node_modules` after Wave 0 pin (`08-RESEARCH.md` Installation). |
| `public/wasm/tree-sitter-typescript.wasm` | config | file-I/O | Same — grammar wasm is a new static asset class. |
| `public/wasm/tree-sitter-tsx.wasm` | config | file-I/O | Same. |

**Partial gaps inside files that do have role-match analogs:**

| Concern | Use instead |
|---------|-------------|
| Kahn topo / identifier def-use graph in `plan.ts` | `08-RESEARCH.md` Pattern 5 + Code Examples `orderByDeps` — no graph algorithm in-repo |
| `Parser.init` / `Language.load` / `locateFile` in `wasm.ts` | `08-RESEARCH.md` Pattern 3 + binding_web README; seam comment copies `db.ts` / `client.ts` |
| `utf16ToCodePoint` helper | `08-RESEARCH.md` Code Example; Unicode contract copies `trainer/state.ts` `Array.from` |
| GitHub blob JSON (`content` base64, newline wrap, `size` null) | `08-RESEARCH.md` Pattern 1; GET/cache/errors copy `client.ts` |

---

## Metadata

**Analog search scope:** `src/github/`, `src/ingestion/`, `src/parse/` (new), `src/ui/`, `src/persistence/`, `src/trainer/`, `index.html`, `README.md`, `package.json`, `vite.config.ts`, `public/`
**Files scanned:** 75 `src/**/*.{ts,tsx}` plus `index.html`, `README.md`, `package.json`, `vite.config.ts`, `public/favicon.svg`
**Pattern extraction date:** 2026-09-20
**Codegraph:** not indexed (no `.codegraph/`); analogs from direct reads
**Project rules / skills:** none under `.cursor/rules/` or `.cursor/skills/`
