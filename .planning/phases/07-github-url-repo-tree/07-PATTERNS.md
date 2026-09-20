# Phase 7: GitHub URL & Repo Tree - Pattern Map

**Mapped:** 2026-09-20
**Files analyzed:** 16
**Analogs found:** 14 / 16

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/github/types.ts` | model | transform | `src/ingestion/types.ts` | exact |
| `src/github/errors.ts` | model | request-response | `src/ingestion/errors.ts` | exact |
| `src/github/url.ts` | utility | transform | `src/ingestion/language-map.ts` (`extToLang`) + `src/ingestion/normalize.ts` (PURE header) | role-match |
| `src/github/url.test.ts` | test | transform | `src/ingestion/upload.test.ts` (`extToLang` `it.each`) + `src/ingestion/normalize.test.ts` (golden table) | exact |
| `src/github/tree.ts` | utility | transform | `src/analytics/heatmap.ts` (PURE fold) + `src/ingestion/language-map.ts` (`Set` allowlist) | role-match |
| `src/github/tree.test.ts` | test | transform | `src/ingestion/normalize.test.ts` (golden `Case[]` + `it.each`) | exact |
| `src/github/client.ts` | service | request-response | `src/persistence/db.ts` (sole dirty import) + `src/ingestion/upload.ts` (async + typed throw) | role-match |
| `src/github/client.test.ts` | test | request-response | `src/ingestion/upload.test.ts` (`vi.spyOn`, never-read on reject) | role-match |
| `src/ui/RepoBrowser.tsx` | component | request-response | `src/ui/CorpusInput.tsx` | exact |
| `src/ui/RepoBrowser.test.tsx` | test | request-response | `src/ui/CorpusInput.test.tsx` | exact |
| `src/ui/App.tsx` | component | event-driven | itself — `view` union + hide-not-unmount wrapper | exact (in-place) |
| `src/ui/App.test.tsx` | test | event-driven | itself — D-08 hide-not-unmount + `#corpus-paste` still-mounted | exact (in-place) |
| `index.html` | config | — | itself — CSP `connect-src` meta | exact (in-place) |
| `README.md` | config | — | itself — `## Privacy` (lines 62–75) | exact (in-place) |
| `src/index.css` | config | — | itself — `nav button[aria-current]`, `.preview`, `.save-failed-dismiss`, `.history-list` | exact (in-place) |
| `vite.config.ts` | config | — | itself — `crossOriginIsolation` on `server` **and** `preview` | exact (verify only) |

`src/ui/CorpusInput.tsx` is **unchanged** this phase (Paste-tab contents only). Do not teach it GitHub.

---

## Pattern Assignments

### `src/github/types.ts` (model, transform)

**Analog:** `src/ingestion/types.ts` lines 1–13

**File-lead comment** — named types only, no runtime, no re-export of upstream shapes:

```typescript
// D-11: the loaded exercise, held in memory only (no persistence in Phase 1).

export type SourceType = 'paste' | 'upload'

export interface Exercise {
  /** Normalized, typing-ready text. Never the raw input. */
  text: string
  language: string
  sourceType: SourceType
  sourceRef?: string
}
```

**Copy this for GitHub:** `RepoRef { owner, repo }`, `GitTreeEntry { path, type, sha, size? }`, `RepoTreeResult { owner, repo, defaultBranch, sha, entries, truncated }`, nested `TreeNode` (`kind: 'dir' | 'file'`). Do **not** add `sourceType: 'github'` (CONTEXT: stays `'paste' | 'upload'` until Phase 8). Do **not** import Dexie / React.

---

### `src/github/errors.ts` (model, request-response)

**Analog:** `src/ingestion/errors.ts` lines 1–23 — typed classes next to the domain, **not** in `ui/`.

**File-lead + class shape:**

```typescript
// Ingestion errors are thrown as named classes and caught at the UI edge, where
// each maps to a fixed copy string rendered inline beneath the offending control
// (RESEARCH "Error-as-typed-class + inline render"). No stack trace, no toast.

export class CorpusTooLargeError extends Error {
  readonly sizeBytes: number

  constructor(sizeBytes: number) {
    super(`Corpus file is ${sizeBytes} bytes, over the 100 KB limit`)
    this.name = 'CorpusTooLargeError'
    this.sizeBytes = sizeBytes
  }
}
```

**Copy this for GitHub** (names are discretion; payload fields are load-bearing):

| Class | Extra fields | Thrown when |
|-------|--------------|-------------|
| `InvalidGithubUrlError` | none | parse reject (D-10) — **before** fetch |
| `RepoNotFoundError` | none | HTTP 404 (also private) |
| `EmptyRepoError` | `owner`, `repo`, `defaultBranch` | HTTP 409 on git trees after GET /repos learned `default_branch`; 07-03 captions `{owner}/{repo}@{defaultBranch}` from these fields |
| `RateLimitedError` | `remaining: number`, `resetEpochS?: number` | 429 **or** (403 and `x-ratelimit-remaining === '0'`) |
| `GithubHttpError` | `status: number` | other non-OK (other 403, 5xx) |

Do **not** throw `TruncatedTreeError` — `truncated: true` is a 200 result field (D-15). `TypeError` from `fetch` (CSP/COEP/offline) is **not** wrapped here; UI maps it to unreachable copy.

---

### `src/github/url.ts` (utility, transform)

**Analog:** `src/ingestion/language-map.ts` lines 41–47 (basename/extension parse) + `src/ingestion/normalize.ts` lines 1–12 (PURE, zero I/O).

**Extension / last-dot parse** (`language-map.ts:41-47`) — copy the `dot <= 0` guard; do **not** reuse `EXT_TO_LANG` as the GitHub blocked test:

```typescript
export function extToLang(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  // dot === -1: no extension. dot === 0: a dotfile with no suffix (".gitignore").
  if (dot <= 0) return 'plaintext'
  const ext = fileName.slice(dot).toLowerCase()
  return EXT_TO_LANG[ext] ?? 'plaintext'
}
```

**PURE header** (`normalize.ts:1-6`):

```typescript
// PURE — zero imports. INPUT-03 / D-09. The transform ORDER is load-bearing
```

`parseGithubRef` is PURE: no `fetch`, no DOM. Host allowlist is `github.com` / `www.github.com` only. Extra path (`/blob/...`, `/tree/...`, `/issues/...`) is silently ignored (D-09). gist / GitLab / `raw.githubusercontent.com` throw `InvalidGithubUrlError` (D-10). Implementation shape is in 07-RESEARCH.md Code Examples — no in-repo URL parser exists.

**Do NOT** `fetch(userString)`. Callers pass a `RepoRef`; `client.ts` concatenates `https://api.github.com/repos/${encodeURIComponent(owner)}/...`.

---

### `src/github/url.test.ts` (test, transform)

**Analog:** `src/ingestion/upload.test.ts` lines 103–142 (`it.each` golden map) + `src/ingestion/normalize.test.ts` lines 9–56 (`Case[]` table).

**Golden table + `it.each`:**

```typescript
it.each([
  ['main.ts', 'typescript'],
  ['App.tsx', 'typescript'],
  // ...
])('maps %s -> %s', (name, lang) => {
  expect(extToLang(name)).toBe(lang)
})

it('returns plaintext for a dotfile with no suffix', () => {
  expect(extToLang('.gitignore')).toBe('plaintext')
})
```

**Copy this for URL parse** (07-RESEARCH.md golden cases — must-have):

| Input | Expect |
|-------|--------|
| `owner/repo` | `{ owner, repo }` |
| `https://github.com/owner/repo` (+ `www.`, `.git`, trailing `/`) | ok, strip `.git` |
| `/blob/...`, `/tree/...`, `/issues/...` extra path | still `{ owner, repo }` |
| gist, gitlab, `raw.githubusercontent.com`, missing repo, whitespace | `InvalidGithubUrlError` |

Vitest project: `src/**/*.test.ts` → **unit** / `environment: 'node'` (`vite.config.ts` lines 20–24). Zero network.

---

### `src/github/tree.ts` (utility, transform)

**Analog:** `src/analytics/heatmap.ts` lines 1–12 (PURE fold, zero DOM) + `src/ingestion/language-map.ts` lines 5–8 (allowlist `Set`, **not** `extToLang`).

**PURE fold header** (`heatmap.ts:1-6`):

```typescript
// PURE — zero DOM access, zero IndexedDB imports. This fold groups by
// physical KeystrokeEvent.code ...
```

`foldTree(tree[])` walks every GitHub entry: `type === 'tree'` ensures a dir node; `blob` / `commit` become leaves. Submodule `commit` is a non-TS/JS leaf → blocked notice (07-RESEARCH.md Pitfall 8). Do not fold only `blob` paths (drops submodules); do not also split blob paths into dirs if the `tree` row already created them.

**Loadable allowlist** — copy the `Set` idiom, **not** `EXT_TO_LANG` (`.mjs` maps to javascript there but is **blocked** this phase, D-05):

```typescript
const LOADABLE = new Set(['.ts', '.tsx', '.js', '.jsx'])

export function isLoadablePath(path: string): boolean {
  const base = path.slice(path.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return false
  return LOADABLE.has(base.slice(dot).toLowerCase())
}
```

`.d.ts` → `.ts` (loadable / “not yet”). `.gitignore` (`dot === 0`) → blocked.

---

### `src/github/tree.test.ts` (test, transform)

**Analog:** `src/ingestion/normalize.test.ts` lines 9–56

**Golden `Case[]` + `it.each`:**

```typescript
interface Case {
  n: number
  name: string
  input: string
  expected: string
}

const cases: Case[] = [ /* ... */ ]

describe('normalize() — 18 golden cases (INPUT-03)', () => {
  it.each(cases)('case $n: $name', ({ input, expected }) => {
    expect(normalize(input)).toBe(expected)
  })
})
```

**Must-have fixtures** (inline JSON, no live GitHub): nested `src/App.tsx`, truncated flag ignored by fold (fold still returns entries), `type: commit` leaf, `.mjs` vs `.tsx` via `isLoadablePath`, empty `tree: []`.

---

### `src/github/client.ts` (service, request-response)

**Analog A (platform seam):** `src/persistence/db.ts` lines 1–4 — the ONLY module that may `fetch`.

```typescript
// Platform seam — the ONLY module that imports Dexie (D-03). Kept out of the
// hot path.

import Dexie, { type Table } from 'dexie'
```

Mirror: `client.ts` is the **only** `fetch` in `src/`. Callers see `RepoTreeResult` or a typed Error. Grep target for privacy.

**Analog B (async + typed throw, no UI):** `src/ingestion/upload.ts` lines 9–27, 24–27

```typescript
// Order is load-bearing:
//   1. size cap BEFORE any read — an oversize file is never pulled into memory
// ...
export async function fromFile(file: File, tabWidth = 4): Promise<Exercise> {
  if (file.size > MAX_BYTES) {
    throw new CorpusTooLargeError(file.size)
  }
```

Copy: validate / throw **before** I/O (`parseGithubRef` already ran); map HTTP status to named classes; never catch-and-swallow.

**Analog C (module-level latch / cache):** `src/persistence/repository.ts` lines 5–8, 28–32 + `src/platform/isolation.ts` lines 13, 16–20

```typescript
let persistRequested = false
// ...
if (!persistRequested) {
  persistRequested = true
  void navigator.storage?.persist?.().catch(() => {})
}
```

```typescript
let measuredResolutionUs: number | null = null
```

Copy for GitHub cache: module-level `Map` of in-flight Promises keyed by `${owner}/${repo}` **while the request runs**, then cache by `${owner}/${repo}@${sha}` plus `${owner}/${repo}:${defaultBranch} → sha` so a second Import skips **both** GETs (StrictMode / last-wins must not double-hit).

**No in-repo `fetch` analog.** Copy the RESEARCH `githubGet` shape verbatim:

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

Never set `Authorization`, `X-GitHub-Api-Version`, or `User-Agent`. Always `encodeURIComponent` owner, repo, **and** `default_branch` (slashes in refs). Always `?recursive=1` (any `recursive` query value enables recursion — do not send `recursive=false`). `truncated: true` stays on the result object — do not throw.

---

### `src/github/client.test.ts` (test, request-response)

**Analog:** `src/ingestion/upload.test.ts` lines 1–9, 34–41 — spy the I/O, assert it never ran on early reject.

```typescript
import { describe, expect, it, vi } from 'vitest'

it('rejects a file over 100 KB with CorpusTooLargeError and never reads it', async () => {
  const file = textFile('x', 'huge.txt')
  Object.defineProperty(file, 'size', { value: 100_001 })
  const textSpy = vi.spyOn(file, 'text')

  await expect(fromFile(file)).rejects.toBeInstanceOf(CorpusTooLargeError)
  expect(textSpy).not.toHaveBeenCalled()
})
```

**No analog for `vi.stubGlobal('fetch')`.** Copy 07-RESEARCH.md Vitest block: `beforeEach` stub, `afterEach` `vi.unstubAllGlobals()`, assert `fetch.mock.calls` length (cache hit = 2 not 4), every URL starts with `https://api.github.com/`, headers equal `{ Accept: 'application/vnd.github+json' }` only. Cover 404, 403 `remaining=0`, 429, 409, truncated 200, other 403 → `GithubHttpError`. Zero live `api.github.com`.

Vitest project: **unit** / node (`src/**/*.test.ts`). Do **not** import `client.ts` from UI tests if they can fixture `TreeNode`s.

---

### `src/ui/RepoBrowser.tsx` (component, request-response)

**Analog:** `src/ui/CorpusInput.tsx` — form chrome, `COPY` const, last-wins token, busy-on-button, reserved status row, typed-error → inline copy. **Does not take `onLoad` this phase.**

**Imports pattern** (lines 1–7) — UI imports domain functions + error classes, never the dirty seam if tests fixture nodes (RepoBrowser **does** call `fetchRepoTree`; tests mock the client module):

```typescript
import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Exercise } from '../ingestion/types'
import { fromPaste } from '../ingestion/paste'
import { fromFile, MAX_BYTES } from '../ingestion/upload'
import { CorpusTooLargeError, NonUtf8Error } from '../ingestion/errors'
```

**`COPY` const verbatim from UI-SPEC** (lines 13–23):

```typescript
const COPY = {
  fileLabel: 'Or upload a file',
  cta: 'Load exercise',
  ctaBusy: 'Loading…',
  errTooLarge: 'This file is over 100 KB. ...',
  // ...
} as const
```

RepoBrowser `COPY` keys come from `07-UI-SPEC.md` Copywriting Contract (Import / Importing… / invalid URL / 404 / rate-limit / truncated / blocked / not-yet / empty-repo). Do not paraphrase.

**Last-wins monotonic token** (lines 37–39, 86–109):

```typescript
const loadTokenRef = useRef(0)

const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
  const token = ++loadTokenRef.current
  setFileError(null)
  try {
    const exercise = await fromFile(file)
    if (loadTokenRef.current !== token) return
    onLoad(exercise)
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
}
```

Copy for Import: increment token; `setBusy(true)`; **clear status immediately**; keep previous tree/caption until a new **success** (07-UI-SPEC last-wins). On typed error, write status, do **not** replace tree. `instanceof` map + rethrow unknown. `TypeError` from fetch → unreachable copy (do not echo `"Failed to fetch"`).

**Busy-on-primary-button** (lines 171–174):

```typescript
<button type="button" className="primary" onClick={handleLoad} disabled={busy}>
  {busy ? COPY.ctaBusy : COPY.cta}
</button>
```

**Departure:** Import is `type="submit"` inside `<form onSubmit={(e) => { e.preventDefault(); void onImport() }}>`. URL field stays enabled while busy. `aria-busy` on the form. CorpusInput’s Load path is `type="button"` + click — do not copy that for Import (D-11: Enter in the field submits).

**Reserved status row + WR-05 role split** (lines 152–168):

```typescript
<p
  role={fileError ? 'alert' : 'status'}
  className={fileError ? undefined : 'text-muted'}
  style={{
    margin: 0,
    minHeight: '1.4em',
    color: fileError ? 'var(--color-destructive)' : undefined,
  }}
>
  {fileError ?? (caption && <span className="text-label">{caption}</span>)}
</p>
```

Copy: **one** status `<p>` under the tree. Errors → `role="alert"` + `--color-destructive`. Notices (blocked, not-yet, truncated, empty-repo) → `role="status"` + `text-muted`. Idle empty → keep `role="status"`. **Departure:** `minHeight` is `48px` (`--space-2xl`), not `1.4em` (07-UI-SPEC). Caption `owner/repo@default_branch` is a **separate** muted row above the tree (`minHeight: 1.4em`), not inside this region.

**Layout grid** (lines 113–114): `section` / panel `display: grid; gap: var(--space-md)`. Label `className="text-label"` + `htmlFor`. Input `className="control"`. Primary button wrapped in a single-child `<div>` (not stretched). URL field: `type="text"` (not `url`), `spellCheck={false}`, `autocomplete="off"`. `aria-invalid="true"` only while invalid-URL copy is showing.

**No analog for nested `<details>` tree.** Copy 07-RESEARCH.md Pattern 3 / 07-UI-SPEC tree rows:

```tsx
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

Files: `<li><button type="button">{node.name}</button></li>`. `className={isLoadablePath(node.path) ? undefined : 'text-muted'}`. Folders never muted. React text children only — no `innerHTML` / `dangerouslySetInnerHTML`. No `role="tree"`. No `onLoad` / `handleLoad`. Folder click = native toggle only.

---

### `src/ui/RepoBrowser.test.tsx` (test, request-response)

**Analog:** `src/ui/CorpusInput.test.tsx` lines 1–63 — happy-dom, `createRoot` + `act`, `IS_REACT_ACT_ENVIRONMENT`, controlled-input setter.

```typescript
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => { root.unmount() })
  container.remove()
})
```

**Controlled text field setter** (lines 14–18) — reuse for the URL `<input>` (prototype is `HTMLInputElement`, not `HTMLTextAreaElement`):

```typescript
function setControlledTextareaValue(el: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
```

**Must-have assertions:** invalid URL → `role="alert"`, **zero** `fetchRepoTree` calls; `.mjs` click → blocked copy, no `handleLoad`; `.tsx` click → not-yet copy, distinct from blocked; truncated fixture still renders returned paths; last-wins second Import. Fixture the client — do not hit `api.github.com`.

Vitest project: **ui** / happy-dom (`src/ui/**/*.test.tsx`).

---

### `src/ui/App.tsx` (component, event-driven — MODIFIED)

**Analog:** itself, lines 58–60, 151–181, 194–208.

**View union + three-item header** (do not add a fourth “Repo” item):

```typescript
const [view, setView] = useState<'trainer' | 'history' | 'analytics'>('trainer')
```

```tsx
<nav style={{ display: 'inline-flex', gap: 'var(--space-xs)' }}>
  <button type="button" aria-current={view === 'trainer' ? 'page' : undefined} ...>
    Trainer
  </button>
  {/* History, Analytics — unchanged */}
</nav>
```

**Hide-not-unmount** (lines 194–208) — copy `display` toggle, never `hidden`, never conditional unmount:

```tsx
<div style={{ display: view === 'trainer' ? 'grid' : 'none', gap: 'var(--space-md)' }}>
  <CaptureSurface ... />
</div>
```

**This phase:** wrap `CorpusInput` + `RepoBrowser` in a Trainer-only corpus shell with the **same** `display` idiom. Paste | GitHub tablist: `role="tablist"` `aria-label="Corpus source"`; each panel `role="tabpanel"` `display: grid | none` (D-04 — not a reset). Paste default (`useState('paste')`). `CorpusInput onLoad={handleLoad}` unchanged. `RepoBrowser` has **no** `onLoad`. `handleLoad` itself is untouched.

Today’s always-mounted line 181 (`<CorpusInput onLoad={handleLoad} />`) moves **inside** the shell’s Paste panel.

---

### `src/ui/App.test.tsx` (test, event-driven — MODIFIED)

**Analog:** itself, lines 61–79 (`loadAndCompleteExercise` uses Paste default — still works) and 237–292 (CorpusInput stays mounted on Analytics).

**Stay-mounted assertion** (lines 282–292):

```typescript
act(() => {
  analyticsButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})

const wrapper = captureAreaBefore.closest('div[style]') as HTMLElement
expect(wrapper.style.display).toBe('none')
expect(document.querySelector('#corpus-paste')).not.toBeNull()
```

**Update intent (07-RESEARCH.md Pitfall 7):** `#corpus-paste` still exists under `display:none`. Add: History/Analytics do not show the GitHub URL field (`offsetParent` / wrapper `display`). Corpus shell wrapper `style.display === 'none'` on those views. `loadAndCompleteExercise` keeps querying `#corpus-paste` — Paste is the default tab (D-03). Header still exactly `['Trainer', 'History', 'Analytics']` (lines 119–120).

---

### `index.html` (config — MODIFIED)

**Analog:** itself, lines 7–10

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; connect-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'"
/>
```

**Change `connect-src` to** `'self' https://api.github.com`. Keep `'self'` (Vite HMR). Do **not** add `github.com`, `raw.githubusercontent.com`, or `codeload.github.com`. Do not strip other directives.

---

### `README.md` (config — MODIFIED)

**Analog:** itself, lines 62–68

```markdown
## Privacy

There is still no backend, no network calls, and no analytics. This is
enforced structurally, not just by policy: the app has no `fetch`,
`XMLHttpRequest`, `sendBeacon`, or `WebSocket` calls anywhere in `src/`,
and the HTML document ships a `Content-Security-Policy` meta tag restricting
`connect-src`.
```

**Rewrite that paragraph:** GitHub.com (`api.github.com`) is now allowed egress for **corpus listing only**. Keystroke logs / pasted corpus still never leave the machine. `fetch` exists only in `src/github/client.ts`. Do not claim “no network calls” after this phase.

---

### `src/index.css` (config — MODIFIED)

**Analog:** itself — tab selected state from header nav; tree scroll from `.preview`; 44px exemption from `.save-failed-dismiss`; list reset from `.history-list`. **Zero new color tokens** (07-UI-SPEC.md).

**Selected tab = header nav, not accent** (lines 427–440):

```css
nav button[aria-current='page'] {
  background: var(--color-surface);
  font-weight: 600;
  color: var(--color-text);
}

nav button:not([aria-current='page']) {
  background: transparent;
  font-weight: 400;
  color: var(--color-text-muted);
}
```

Copy keyed on `[aria-selected='true']` / `[aria-selected='false']` for the corpus tablist (same fill/weight/muted). Do **not** paint selected tabs with `--color-accent`.

**Tree overflow** (lines 195–198):

```css
.preview {
  max-height: 40vh;
  overflow: auto;
```

**List reset** (lines 444–450):

```css
.history-list {
  display: grid;
  gap: var(--space-sm);
  list-style: none;
  margin: 0;
  padding: 0;
}
```

Tree: outer `ul` `list-style: none; margin: 0; padding: 0`; nested `ul` `padding-inline-start: var(--space-md)`.

**44px exemption** (lines 417–425):

```css
/* Exempt from the 44px control floor — same exception class as .key-chip */
.save-failed-dismiss {
  background: transparent;
  border: 0;
  min-height: 0;
  padding: var(--space-xs);
```

Tree file `button` / folder `summary`: `min-height: 32px` (`--space-xl`), transparent, no border, `text-align: left`, `width: 100%`. Tabs and Import stay on the 44px floor.

Reuse `.text-label`, `.text-muted`, `.control`, `button.primary` — do not redeclare.

---

### `vite.config.ts` (config — VERIFY ONLY)

**Analog:** itself, lines 4–16. Do **not** edit unless a human-check forces COEP `credentialless` (never strip COEP).

```typescript
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
} as const

export default defineConfig({
  plugins: [react()],
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
```

Both `server.headers` and `preview.headers` must still be present after this phase.

---

## Shared Patterns

### Platform seam (one dirty module)
**Source:** `src/persistence/db.ts` lines 1–4
**Apply to:** `src/github/client.ts` only
`client.ts` is the only `fetch`. Tests never import live `api.github.com`. UI tests fixture tree nodes or mock `fetchRepoTree`.

### Typed error + inline render
**Source:** `src/ingestion/errors.ts` + `src/ui/CorpusInput.tsx` lines 100–108
**Apply to:** `src/github/errors.ts` + `RepoBrowser.tsx` catch
Named classes at the domain edge. UI `instanceof` maps to `COPY.*`. Unknown errors rethrow. No toasts, no overlays, no `"Failed to fetch."`

### Last-wins monotonic token
**Source:** `src/ui/CorpusInput.tsx` lines 37–39, 90–95
**Apply to:** `RepoBrowser` Import
`useRef(0)` increment per attempt; ignore stale results. Second Import of a different repo: last-wins on **success**; errors keep the previous tree.

### Hide-not-unmount
**Source:** `src/ui/App.tsx` lines 194–208
**Apply to:** corpus shell (Trainer vs History/Analytics) **and** Paste vs GitHub panels
`style={{ display: cond ? 'grid' : 'none' }}`. Never `hidden`. Never unmount. Returning to Trainer restores paste text, language, GitHub field, and loaded tree.

### COPY const from UI-SPEC
**Source:** `src/ui/CorpusInput.tsx` lines 13–23
**Apply to:** `RepoBrowser.tsx` (verbatim `07-UI-SPEC.md` table)
Do not invent strings. Blocked ≠ not-yet. No “Phase 8”, no parser/WASM jargon.

### WR-05 status vs alert
**Source:** `src/ui/CorpusInput.tsx` lines 152–168
**Apply to:** RepoBrowser single status region
`role="alert"` + `--color-destructive` for errors (invalid URL, 404, rate-limit, other HTTP, unreachable). `role="status"` + `text-muted` for notices (blocked, not-yet, truncated, empty-repo). Reserved min-height so copy does not reflow.

### Extension allowlist ≠ language map
**Source:** `src/ingestion/language-map.ts` (`EXT_TO_LANG` includes `.mjs` → javascript)
**Apply to:** `isLoadablePath` in `github/tree.ts`
Blocked = not in `{.ts,.tsx,.js,.jsx}`. Do **not** call `extToLang` to decide click behavior.

### Header stays three items
**Source:** `src/ui/App.tsx` lines 151–173 + `App.test.tsx` lines 119–120
**Apply to:** `App.tsx` this phase
`['Trainer', 'History', 'Analytics']`. `aria-current="page"`. No fourth “Repo” view.

### React text nodes only (XSS)
**Source:** every UI leaf (`HistoryView.tsx` `{sourceLabel}`, `CorpusInput` `{COPY.*}`)
**Apply to:** tree `{node.name}`
No `innerHTML`, no `dangerouslySetInnerHTML`, no markdown of README. End-of-phase grep.

### Tokens, no new palette
**Source:** `src/index.css` lines 42–52, 146–175
**Apply to:** all Phase 7 UI
`--color-text`, `--color-text-muted`, `--color-destructive`, `--color-accent` (Import + focus ring only), `.text-label`, `.text-muted`, `.control`, `.primary`.

---

## No Analog Found

| File / concern | Role | Data Flow | Reason |
|----------------|------|-----------|--------|
| Nested `<details>` / `<summary>` tree (inside `RepoBrowser.tsx`) | component | event-driven | No disclosures in `src/`. Use 07-RESEARCH.md Pattern 3 + 07-UI-SPEC.md tree rows. |
| `fetch` + `vi.stubGlobal('fetch')` (`client.ts` / `client.test.ts`) | service / test | request-response | Zero `fetch` in `src/` today (`upload.ts` only mentions fetch in a comment). Seam analog is `db.ts`; I/O-spy analog is `upload.test.ts`. Copy RESEARCH `githubGet` + Vitest stub block. |

Planner should use RESEARCH.md Code Examples for those two; everything else copies an in-repo analog.

---

## Metadata

**Analog search scope:** `src/` (ui, ingestion, persistence, platform, analytics, capture), `index.html`, `README.md`, `vite.config.ts`, `src/index.css`
**Files scanned:** 65 under `src/` plus root HTML/README/Vite config
**Pattern extraction date:** 2026-09-20
**UI contract:** `07-UI-SPEC.md` (approved) owns copy strings, tablist ARIA, 48px status slot, 32px tree-row exemption
