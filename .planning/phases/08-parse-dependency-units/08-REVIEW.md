---
phase: 08-parse-dependency-units
reviewed: 2026-09-21T00:45:00Z
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
gap_closure:
  plan: 08-05
  files_rereviewed:
    - src/ui/RepoBrowser.tsx
    - src/ui/RepoBrowser.test.tsx
  status: clean
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-09-21T00:45:00Z (08-05 gap-closure pass; original review 2026-09-21T00:01:00Z)
**Depth:** standard
**Files Reviewed:** 21 (08-05 re-reviewed `RepoBrowser.tsx` + `RepoBrowser.test.tsx` only)
**Status:** issues_found (open findings are prior 08-01..04 items; **08-05 is clean**)

## Summary

Phase 8’s main contracts hold: `fromGithubBlob` reuses the 100 KB / UTF-16 BOM / U+FFFD / `normalize` pipeline; `sourceRef` is `owner/repo:path` with no blob sha; `plan.ts` stays pure (no `web-tree-sitter` import); `wasm.ts` is the sole runtime importer with `locateFile: (scriptName) => \`/${scriptName}\``; CSP is `script-src 'self' 'wasm-unsafe-eval'` without general `'unsafe-eval'`; COEP `require-corp` remains on Vite server/preview; App stores `FilePlan` via `onPlanned={setFilePlan}` and does not call `handleLoad` from a tree click.

**08-05** closed the last-wins gap that 08-04 left open (former WR-01): `clickGenRef` bumps on every tree-file click before `setStatus`, including blocked and commit; `importGenRef` isolates Import `setBusy`; a file click cannot skip `setBusy(false)`. No `handleLoad` wiring, no `innerHTML` / `dangerouslySetInnerHTML`, no blob prefetch on Import.

The defects that remain are from 08-01..04 and were not introduced by 08-05: untyped blob-decode failures, planner cover/graph holes, cached `Parser.init` rejection, stale App `filePlan` after paste/upload, and empty-repo `importedRef`.

## 08-05 Gap-closure Findings

**Scope:** last-wins click generation only (`clickGenRef` / `importGenRef`). Advisory. No new Critical, Warning, or Info findings.

**Verified in `src/ui/RepoBrowser.tsx`:**

- `onFileClick` first statement is `const token = ++clickGenRef.current` (line 121) before any `setStatus`, including the commit / `!isLoadablePath` branch that sets `COPY.blocked` and returns (122–125). That path does not touch `importGenRef`.
- Loadable path still gates `MAX_BYTES`, `fetchGithubBlob`, `fromGithubBlob`, `ensureParser` / `parseSource` / `planUnits` / `fallbackPlan`, and calls `onPlanned` only when `clickGenRef.current === token` (140, 160, 170).
- `onImport` uses `const importToken = ++importGenRef.current` (190) and `++clickGenRef.current` (191) before `setBusy(true)` / `setStatus(null)`. Tree/caption/status/catch guards compare `importGenRef` to `importToken`. `finally` calls `setBusy(false)` only when `importGenRef.current === importToken` (239). `onFileClick` never increments `importGenRef`.
- No `handleLoad` import or call. Blob text is React text/`onPlanned` only — no `innerHTML`. Import still calls `fetchRepoTree` only; no `fetchGithubBlob` on submit.

**Verified in `src/ui/RepoBrowser.test.tsx`:**

- Existing loadable-vs-loadable last-wins remains (`slow first sha cannot overwrite the second`).
- New cases: loadable-then-blocked README, loadable-then-commit `mod.ts`, and loadable click during Import re-enables submit when the hung tree resolves.

WR-01 is **resolved** by this plan (see Resolved / stale). Do not re-open it against current `RepoBrowser.tsx`.

## Warnings

### WR-02: Invalid blob base64 becomes an unhandled rejection on “Loading…”

**Status:** still open (08-01..04; not introduced by 08-05)
**File:** `src/github/client.ts:131-133` (UI rethrow: `src/ui/RepoBrowser.tsx:183-184`)
**Issue:** `atob(b64)` throws `DOMException` (`InvalidCharacterError`) on malformed content. That is not `TypeError` and is not one of the named GitHub/corpus errors. `onFileClick`’s outer catch rethrows unknown errors from a fire-and-forget `onClick={() => onFileClick(node)}`, so the promise rejects unhandled and the status region stays `Loading {path}…`.

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

**Status:** still open (08-03; not introduced by 08-05)
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

**Status:** still open (08-03; not introduced by 08-05)
**File:** `src/parse/plan.ts:221-228`
**Issue:** RESEARCH Pattern 5 / 08-03 Task 3: a unit defines a **function/class/binding/type** name, and imports define **specifier** names. The implementation diverges in both directions.

1. `definedNames` for non-import units is only `unit.name`. `classify` sets `name` for functions/classes/types and function-valued `const`/`var`, but `const x = 1` is `kind: 'other'` with no name. A later `function a() { return x }` does not depend on that unit; Kahn then orders by `start`, so the function can be typed before the binding (Pattern 5 called this a binding definition).
2. Import units call `walkIdentifiers` on the whole statement, so `import { foo as bar }` publishes both `foo` and `bar`. Specifiers’ local name is `bar` only; `foo` can steal the definition slot from a later `function foo()` via first-wins (`if (!defined.has(name))`).
3. `collectRefs` uses the same walk on the entire subtree, so a parameter or local named like a sibling unit becomes a false `dependsOn` edge.

**Fix:** Collect definitions from `childForFieldName('name')` / `bindingName` on every `lexical_declaration` and `variable_declaration`, not only function-valued ones. For imports, walk `import_specifier` / `namespace_import` / `identifier` default locals (alias field if present). For refs, skip `property_identifier` (already done) and skip identifiers that are the unit’s own binding or formal parameters.

### WR-05: Failed `Parser.init` is cached forever

**Status:** still open (08-03; not introduced by 08-05)
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

**Status:** still open (08-04; not introduced by 08-05)
**File:** `src/ui/App.tsx:66-72`
**Issue:** `handleLoad` resets capture, exercise, metrics, and save-failure, but never `setFilePlan(null)`. A GitHub click can leave `data-file-plan="true"` while the user is typing a pasted corpus. Phase 8 holds the plan in memory on purpose and must not start the trainer from a click; Phase 9 will consume `filePlan` and can pair the wrong plan with the active exercise.

**Fix:** Call `setFilePlan(null)` at the start of `handleLoad` (and consider the same on `handleRestart` if a restart should drop a planned GitHub file).

### IN-02: `EmptyRepoError` hides the tree but keeps the previous `importedRef`

**Status:** still open (08-04; not introduced by 08-05; line numbers shifted after 08-05)
**File:** `src/ui/RepoBrowser.tsx:223-226`
**Issue:** Empty-repo handling sets caption + `nodes=[]` + empty-repo status, but does not `setImportedRef(null)`. The tree is hidden so clicks are impossible today; a later change that shows a residual tree would fetch blobs against the previous repo.

**Fix:** `setImportedRef(null)` on `EmptyRepoError` (and on the `entries.length === 0` success path if that import should not reuse the last ref).

## Resolved / stale

### WR-01: Shared last-wins token bricks Import busy and ignores blocked clicks — RESOLVED by 08-05

**Was:** `src/ui/RepoBrowser.tsx:120-125` / `:236-238` (08-04 `tokenRef`)
**Now:** stale. Do not re-apply the original fix snippet.

08-05 replaced the shared `tokenRef` with `clickGenRef` (every file click, including blocked/commit, before `setStatus`) and `importGenRef` (`setBusy` only). Tests cover loadable-then-blocked, loadable-then-commit, and a loadable click during Import leaving submit enabled.

---

_Reviewed: 2026-09-21T00:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_08-05 gap-closure: clean (WR-01 resolved; no new findings)_
