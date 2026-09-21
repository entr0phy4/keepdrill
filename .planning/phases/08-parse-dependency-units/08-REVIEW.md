---
phase: 08-parse-dependency-units
reviewed: 2026-09-21T00:01:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - src/ingestion/github.ts
  - src/ingestion/github.test.ts
  - src/ingestion/types.ts
  - src/github/types.ts
  - src/github/tree.ts
  - src/github/tree.test.ts
  - src/github/client.ts
  - src/github/client.test.ts
  - src/parse/types.ts
  - src/parse/utf16.ts
  - src/parse/utf16.test.ts
  - src/parse/plan.ts
  - src/parse/plan.test.ts
  - src/parse/wasm.ts
  - src/ui/HistoryView.tsx
  - src/ui/HistoryView.test.tsx
  - src/ui/RepoBrowser.tsx
  - src/ui/RepoBrowser.test.tsx
  - src/ui/App.tsx
  - src/ui/App.test.tsx
  - index.html
findings:
  critical: 0
  warning: 5
  info: 2
  total: 7
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-09-21T00:01:00Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Phase 8’s main contracts hold: `fromGithubBlob` reuses the 100 KB / UTF-16 BOM / U+FFFD / `normalize` pipeline; `sourceRef` is `owner/repo:path` with no blob sha; `plan.ts` stays pure (no `web-tree-sitter` import); `wasm.ts` is the sole runtime importer with `locateFile: (scriptName) => \`/${scriptName}\``; CSP is `script-src 'self' 'wasm-unsafe-eval'` without general `'unsafe-eval'`; COEP `require-corp` remains on Vite server/preview; App stores `FilePlan` via `onPlanned={setFilePlan}` and does not call `handleLoad` from a tree click.

The defects that remain are concurrency on the shared Import/click token, untyped blob-decode failures, and planner cover/graph holes that tests built from fixtures do not exercise against mixed ERROR trees or non-function bindings.

## Warnings

### WR-01: Shared last-wins token bricks Import busy and ignores blocked clicks

**File:** `src/ui/RepoBrowser.tsx:120-125`
**Issue:** `tokenRef` is incremented by both `onImport` and loadable `onFileClick`. Two last-wins failures follow.

1. A file click while Import is in flight increments the token, so Import’s `finally` skips `setBusy(false)` (`src/ui/RepoBrowser.tsx:236-238`). The Import button stays disabled until a full reload. The previous tree remains clickable, so this race is reachable after the first successful import.
2. Blocked clicks (non-loadable / `commit`) return before `++tokenRef` (`src/ui/RepoBrowser.tsx:120-123`). A slower in-flight loadable click still matches the token, overwrites the blocked status, and fires `onPlanned` — violating FILE-01 last-wins for “file clicks.”

08-04 explicitly allowed a **second** token ref for clicks. Reusing one counter without isolating Import’s busy flag is what makes both bugs.

**Fix:** Keep Import busy on an import-generation counter (or a dedicated `importTokenRef`). Use a separate `clickTokenRef` for every tree-file click, including blocked ones:

```tsx
const importTokenRef = useRef(0)
const clickTokenRef = useRef(0)

const onFileClick = async (node: FileNode) => {
  const token = ++clickTokenRef.current
  if (node.entryType === 'commit' || !isLoadablePath(node.path)) {
    setStatus({ kind: 'status', text: COPY.blocked })
    return
  }
  // ... abort when clickTokenRef.current !== token
}

const onImport = async () => {
  const token = ++importTokenRef.current
  ++clickTokenRef.current // cancel in-flight click status/onPlanned
  setBusy(true)
  try {
    /* ... */
  } finally {
    if (importTokenRef.current === token) setBusy(false)
  }
}
```

### WR-02: Invalid blob base64 becomes an unhandled rejection on “Loading…”

**File:** `src/github/client.ts:131-133`
**Issue:** `atob(b64)` throws `DOMException` (`InvalidCharacterError`) on malformed content. That is not `TypeError` and is not one of the named GitHub/corpus errors. `onFileClick`’s outer catch rethrows unknown errors (`src/ui/RepoBrowser.tsx:182-183`) from a fire-and-forget `onClick={() => onFileClick(node)}`, so the promise rejects unhandled and the status region stays `Loading {path}…`.

GitHub normally sends wrapped base64, but a 200 with missing/odd `encoding`, truncated `content`, or non-base64 payload takes this path. Size `null` already forces a decode; there is no `encoding === 'base64'` check before `atob`.

**Fix:** Treat decode failure as a typed HTTP/corpus error before it reaches the UI:

```ts
let binary: string
try {
  binary = atob(b64)
} catch {
  throw new GithubHttpError(422)
}
```

In `onFileClick`, map remaining unknown errors to `COPY.otherHttp` instead of rethrowing, so the loading status cannot stick.

### WR-03: Top-level ERROR named children are dropped from the unit cover

**File:** `src/parse/plan.ts:53-56`
**Issue:** `ERROR` siblings are skipped. That is how “only ERROR children → fallback” works (`collected.length === 0`). A mixed program (`ERROR` plus a valid `function_declaration`) therefore returns `fallback: false` with units that **omit** the ERROR span. PLAN-01 requires leftover named children to become `other` so the cover does not have holes; PLAN-03 fallback only applies when the file cannot be split, not when part of it failed to parse.

Phase 9 will type `[start, end)` ranges. Uncovered ERROR text would never be typed, with no fallback notice.

**Fix:** Fallback only when every named child is `ERROR` (or there are none). Otherwise classify `ERROR` as `other` so those ranges stay in the cover:

```ts
const named = root.namedChildren
if (named.length === 0 || named.every((c) => c.type === 'ERROR')) {
  return fallbackPlan(exercise, FALLBACK_NOTICE)
}
// in the loop: do not `continue` on ERROR — fall through to classify → other
```

### WR-04: Identifier graph does not define bindings or import specifiers as specified

**File:** `src/parse/plan.ts:221-228`
**Issue:** RESEARCH Pattern 5 / 08-03 Task 3: a unit defines a **function/class/binding/type** name, and imports define **specifier** names. The implementation diverges in both directions.

1. `definedNames` for non-import units is only `unit.name`. `classify` sets `name` for functions/classes/types and function-valued `const`/`var`, but `const x = 1` is `kind: 'other'` with no name. A later `function a() { return x }` does not depend on that unit; Kahn then orders by `start`, so the function can be typed before the binding (Pattern 5 called this a binding definition).
2. Import units call `walkIdentifiers` on the whole statement, so `import { foo as bar }` publishes both `foo` and `bar`. Specifiers’ local name is `bar` only; `foo` can steal the definition slot from a later `function foo()` via first-wins (`if (!defined.has(name))`).
3. `collectRefs` uses the same walk on the entire subtree, so a parameter or local named like a sibling unit becomes a false `dependsOn` edge.

**Fix:** Collect definitions from `childForFieldName('name')` / `bindingName` on every `lexical_declaration` and `variable_declaration`, not only function-valued ones. For imports, walk `import_specifier` / `namespace_import` / `identifier` default locals (alias field if present). For refs, skip `property_identifier` (already done) and skip identifiers that are the unit’s own binding or formal parameters.

### WR-05: Failed `Parser.init` is cached forever

**File:** `src/parse/wasm.ts:14-18`
**Issue:** `initOnce ??= Parser.init(...)` stores a rejected promise on the first failure (wasm 404, COEP/CORP glitch, instantiate error). Every later `parseSource` awaits that same rejection. `RepoBrowser` maps it to fallback (“Couldn't split {path}”), so the user never retries a recovered asset without a full page reload. `loadDialect` correctly caches only after a successful `Language.load`; `ensureParser` does not.

**Fix:**

```ts
export function ensureParser(): Promise<void> {
  initOnce ??= Parser.init({
    locateFile: (scriptName: string) => `/${scriptName}`,
  }).catch((err: unknown) => {
    initOnce = null
    throw err
  })
  return initOnce
}
```

## Info

### IN-01: Paste/upload load leaves a stale GitHub `FilePlan` in App state

**File:** `src/ui/App.tsx:66-72`
**Issue:** `handleLoad` resets capture, exercise, metrics, and save-failure, but never `setFilePlan(null)`. A GitHub click can leave `data-file-plan="true"` while the user is typing a pasted corpus. Phase 8 holds the plan in memory on purpose and must not start the trainer from a click; Phase 9 will consume `filePlan` and can pair the wrong plan with the active exercise.

**Fix:** Call `setFilePlan(null)` at the start of `handleLoad` (and consider the same on `handleRestart` if a restart should drop a planned GitHub file).

### IN-02: `EmptyRepoError` hides the tree but keeps the previous `importedRef`

**File:** `src/ui/RepoBrowser.tsx:221-224`
**Issue:** Empty-repo handling sets caption + `nodes=[]` + empty-repo status, but does not `setImportedRef(null)`. The tree is hidden so clicks are impossible today; a later change that shows a residual tree would fetch blobs against the previous repo.

**Fix:** `setImportedRef(null)` on `EmptyRepoError` (and on the `entries.length === 0` success path if that import should not reuse the last ref).

---

_Reviewed: 2026-09-21T00:01:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
