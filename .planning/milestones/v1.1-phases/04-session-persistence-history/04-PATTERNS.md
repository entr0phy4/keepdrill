# Phase 4: Session Persistence & History - Pattern Map

**Mapped:** 2026-09-06
**Files analyzed:** 11 (7 new, 4 modified)
**Analogs found:** 10 / 11 (1 partial — no IndexedDB/Dexie code exists yet)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/persistence/db.ts` | config / platform-seam | CRUD (IndexedDB open + schema) | `src/platform/isolation.ts` (module-singleton platform seam) | role-match (no Dexie analog) |
| `src/persistence/repository.ts` | service / platform-seam | CRUD + live-query | `src/capture/capture.ts` (module-level buffers + getters), `src/session.ts` (pure composition wrapper) | role-match |
| `src/persistence/types.ts` | model / types | transform (record shape) | `src/capture/types.ts`, `src/metrics/metrics.ts` (`METRICS_SCHEMA_VERSION` + interface), `src/ingestion/types.ts` | exact |
| `src/persistence/db.test.ts` | test | CRUD round-trip | `src/capture/capture.test.ts` (module-state reset in `beforeEach`), `src/ingestion/upload.test.ts` | role-match |
| `src/persistence/repository.test.ts` | test | CRUD + ordering | `src/metrics/metrics.test.ts` (golden `Case[]` table), `src/capture/capture.test.ts` | role-match |
| `src/ui/HistoryView.tsx` (+ `HistoryRow`) | component | request-response (read via hook) | `src/ui/ResultsView.tsx` (prop-driven `role="status"` list + `glyphFor` chips) | exact |
| `src/ui/SaveFailedNotice.tsx` | component | event-driven (dismiss) | `src/ui/Banners.tsx` (`.banner .banner--warning`, `role="status"`, `.banner-lead`) | exact |
| `src/ui/history-metrics.ts` (optional helper) | utility | transform (recompute-if-stale) | `src/session.ts` (pure composition), `src/metrics/metrics.ts` | role-match |
| `src/ui/App.tsx` | component (integration) | event-driven (completion write + view toggle) | itself — `handleComplete` / `handleLoad` / `handleRestart` existing shape | exact (in-place) |
| `src/test/setup-fake-indexeddb.ts` | config | — | none (new test-infra file) | none |
| `vite.config.ts` | config | — | itself — existing `test.projects` array | exact (in-place) |
| `package.json` | config | — | itself | exact (in-place) |

## Pattern Assignments

### `src/persistence/types.ts` (model, transform)

**Analogs:** `src/metrics/metrics.ts:32-44`, `src/capture/types.ts:5-51`, `src/ingestion/types.ts:1-13`

**Schema-version constant pattern** — copy `metrics.ts:32` exactly:
```typescript
export const METRICS_SCHEMA_VERSION = 1
```
→ new file exports `export const STORED_SESSION_SCHEMA_VERSION = 1` with the same one-line form.

**Interface + doc-comment pattern** — copy the `capture/types.ts` house style: a leading block comment naming the decision ID and reversibility, `/** ... */` on individual fields that carry a clock domain or semantics note. Example to mirror (`capture/types.ts:42-51`):
```typescript
export interface Session {
  exercise: Exercise
  events: readonly KeystrokeEvent[]
  charLog: readonly CommittedChar[]
  markers: readonly CaptureMarker[]
  timingResolutionUs: number
  crossOriginIsolated: boolean
  /** Date.now() wall clock, display only (RESEARCH Open Question 6). */
  startedAt: number
}
```
New `StoredSession` re-uses these exact field names/types (spread to mutable arrays), adds `id?: number`, `schemaVersion: number`, `completedAtTMs: number` (`/** event.timeStamp / tMs domain — NOT wall clock. */`), `metricsSnapshot: MetricsResult`. Import `Exercise` from `../ingestion/types`, the rest from `../capture/types`, `MetricsResult` from `../metrics/metrics` — all `import type`.

**Do NOT** re-export or re-declare `Session`/`Exercise`/`MetricsResult` — reference them by import, same as `session.ts:1-2`.

---

### `src/persistence/db.ts` (config, CRUD — sole Dexie import site, D-03)

**Analog:** `src/platform/isolation.ts:1-13` — the "platform seam, module-singleton, kept out of the hot path" pattern. File-lead comment names the decision (`// Platform seam — ... (D-16).`).

**Pattern to follow:**
- File-lead comment: `// Platform seam — the ONLY module that imports Dexie (D-03). Kept out of the hot path.`
- Single module-level singleton `export const db = new KeebdrillDB()` (mirrors `isolation.ts` module-level `let measuredResolutionUs`, and `capture.ts:9-13` module-level `const buffer = []`).
- `this.version(1).stores({ sessions: '++id, startedAt' })` with a comment stating the D-05 rule verbatim ("a shipped `version(n)` block is never edited; each change is a new `version(n+1).stores().upgrade()`").
- Index string lists ONLY `startedAt` (+ implicit `++id`). Never index `events`/`charLog`/`exercise`/`metricsSnapshot`.

**Imports pattern** (match `session.ts:1-4` ordering — external, then `import type` local):
```typescript
import Dexie, { type Table } from 'dexie'
import type { StoredSession } from './types'
```

---

### `src/persistence/repository.ts` (service, CRUD + live-query)

**Analogs:** `src/capture/capture.ts:9-27` (module-level state + one-shot latch), `src/session.ts:18-28` (thin pure composition wrapper), `src/metrics/metrics.ts` (guard-and-return discipline).

**One-shot side-effect latch** — copy the `capture.ts` / `isolation.ts:13` module-`let` guard idiom for the `navigator.storage.persist()` call:
```typescript
let persistRequested = false
// ... inside saveSession, after a successful add:
if (!persistRequested) {
  persistRequested = true
  void navigator.storage?.persist?.().catch(() => {}) // D-06, best-effort, never blocks
}
```

**Write wrapper** — mirror `session.ts::buildSession` shape (take a plain input value object, return the row; composition only, no DOM). Spread `readonly` arrays to mutable copies on write (`[...input.session.events]`) — the arrays are `Object.freeze`d in `capture.ts:52-53`.

**Stable module-level querier for `useLiveQuery`** (D-09) — a named `export function`, not an arrow passed inline:
```typescript
export function listNewestFirst(): Promise<StoredSession[]> {
  return db.sessions.orderBy('startedAt').reverse().toArray()
}
```

**Error handling:** `saveSession` does NOT catch — it lets Dexie reject so `App.tsx`'s `.catch` (below) drives the notice. Matches `ingestion/` "error-as-typed-class, caught at the UI edge" convention (`ingestion/errors.ts:1-3`) — the seam throws/rejects, the UI edge handles.

---

### `src/ui/HistoryView.tsx` + `HistoryRow` (component, request-response)

**Analog:** `src/ui/ResultsView.tsx:1-55` — near-exact structural twin.

**Copy from `ResultsView`:**

Imports + doc-comment pattern (`ResultsView.tsx:1-20`): leading comment naming decisions + "Math.round() happens ONLY here, at the display layer". Import `glyphFor` from `../trainer/state`.

`role="status"` container pattern (`ResultsView.tsx:24`):
```tsx
<section className="results-panel" role="status" aria-live="polite">
  <h2>Results</h2>
```
→ HistoryView: `<section role="status">` (or per UI-SPEC `<h2>History</h2>` always renders).

Whitespace-glyph chip — copy `ResultsView.tsx:43-48` verbatim logic:
```tsx
<li key={entry.char} className="results-slowest-row">
  <span className="key-chip">
    {entry.char === ' ' || entry.char === '\n' ? glyphFor(entry.char) : entry.char}
  </span>
```

Display-layer rounding — copy `ResultsView.tsx:28-31`:
```tsx
{Math.round(metrics.wpm)} <span className="results-stat-label">wpm</span>
{Math.round(metrics.accuracy * 100)}% <span className="results-stat-label">accuracy</span>
```

Empty-vs-populated branch — copy `ResultsView.tsx:36-51` (`length === 0 ? <p className="text-muted">…</p> : <ol>…</ol>`). Extend to three-way for `useLiveQuery`: `undefined` → loading `<p className="text-muted">`, `[]` → empty state, else `<ol>`.

**`useLiveQuery` binding:**
```tsx
import { useLiveQuery } from 'dexie-react-hooks'
import { listNewestFirst } from '../persistence/repository'
const sessions = useLiveQuery(listNewestFirst) // undefined | StoredSession[]
```
Component imports the querier, NEVER `dexie` or `../persistence/db` (D-03).

**Unicode length** (`exercise.text` char count) — use `Array.from(text).length`, code points, matching `metrics.ts:69` and `state.ts` ("Code-point array, not raw string indexing").

**Rows inert (D-13):** `<li>` with no `onClick`/`href`/`tabIndex`. Only `title={new Date(s.startedAt).toLocaleString()}` on the date span.

---

### `src/ui/SaveFailedNotice.tsx` (component, event-driven)

**Analog:** `src/ui/Banners.tsx:15-37` — exact.

**Copy the banner element pattern** (`Banners.tsx:19-24`):
```tsx
<p className="banner banner--warning" role="status">
  <span className="banner-lead">Heads up</span> — <!-- message -->
</p>
```

**Departures from `Banners.tsx` (per D-16):** add a `<button>` dismiss control. Class `.save-failed-dismiss`, `aria-label="Dismiss notice"`, text glyph `×` (U+00D7). Per UI-SPEC this button is exempt from the 44px floor (same exception class as `.key-chip`). Wrap layout `display: flex; justify-content: space-between`.

**Copy:** lead `Heads up` — body `This session couldn't be saved to your history.` (D-17, single generic message; UI-SPEC Copywriting Contract).

`.banner` / `.banner--warning` / `.banner-lead` CSS already exists in `src/index.css` — no new CSS tokens; add only `.save-failed-dismiss` + `.history-*` rules.

---

### `src/ui/App.tsx` (MODIFIED — integration, event-driven)

**Analog:** its own existing `handleComplete` (`App.tsx:72-78`), `handleLoad` (`:52-65`), `handleRestart` (`:85-99`).

**Fire-and-forget write** — add AFTER the existing `setMetrics(result)` at `App.tsx:77`, never before, never `await`ed:
```typescript
setMetrics(result)
setSaveFailed(false)
void saveSession({ session, completedAt, metricsSnapshot: result }).catch((err) => {
  console.warn('[keebdrill] session not persisted:', err)
  setSaveFailed(true)
})
```

**State:** add `const [saveFailed, setSaveFailed] = useState(false)` next to `const [metrics, setMetrics] = useState<MetricsResult | null>(null)` (`App.tsx:50`).

**Stale-notice clearing** — add `setSaveFailed(false)` alongside the existing `setMetrics(null)` calls at `App.tsx:56` (`handleLoad`) and `App.tsx:90` (`handleRestart`).

**View toggle** — add `const [view, setView] = useState<'trainer' | 'history'>('trainer')`. In the `<header>` (`App.tsx:122-124`) add a `<nav>` with two `<button>`s (`Trainer` / `History`), active one gets `aria-current="page"`.

**Hide, don't unmount (D-08)** — the trainer wrapper at `App.tsx:142` currently `style={{ display: 'grid', gap: 'var(--space-md)' }}`. Toggle the `display` value inline; do NOT wrap in `{view === 'trainer' && …}` and do NOT use `hidden` (defeated by inline display — RESEARCH Pitfall 6):
```tsx
<div style={{ display: view === 'trainer' ? 'grid' : 'none', gap: 'var(--space-md)' }}>
  {/* CaptureSurface key={loadToken} + ResultsView + Restart — unchanged */}
  {metrics !== null && <ResultsView metrics={metrics} />}
  {metrics !== null && saveFailed && <SaveFailedNotice onDismiss={() => setSaveFailed(false)} />}
  <button type="button" className="primary" onClick={handleRestart}>Restart exercise</button>
</div>
{view === 'history' && <HistoryView />}
```
`SaveFailedNotice` renders between `ResultsView` and the Restart button (UI-SPEC layout order).

**Keep** the `firedCompletedAtRef` guard in `CaptureSurface` and the inline-in-`handleComplete` write (do NOT move the write into a `useEffect`) — RESEARCH Pitfall 4 (StrictMode double-write).

---

### `src/ui/history-metrics.ts` (optional utility, transform)

**Analog:** `src/session.ts` (pure composition, lives outside the seam).

Pure `resolveMetrics(s: StoredSession): MetricsResult` — returns `s.metricsSnapshot` when `s.metricsSnapshot.schemaVersion === METRICS_SCHEMA_VERSION`, else `computeSessionMetrics(s.exercise.text, s.charLog, s.markers, s.completedAtTMs)`. Import `computeSessionMetrics` + `METRICS_SCHEMA_VERSION` from `../metrics/metrics`. Lives in `ui/`, NOT `persistence/`, keeping `repository.ts` a thin Dexie wrapper (D-03). Dormant in Phase 4 (`METRICS_SCHEMA_VERSION === 1`).

**`now` MUST come from `completedAtTMs`, never `startedAt`** — `metrics.ts:10-13` header ("Do NOT pass Session.startedAt … as `now`") and RESEARCH Pitfall 2.

---

### Test files (`src/persistence/*.test.ts`)

**Analogs:** `src/capture/capture.test.ts:1-14`, `src/metrics/metrics.test.ts:1-29`, `src/ingestion/upload.test.ts`.

**Vitest imports** — copy `capture.test.ts:1`: `import { beforeEach, describe, it, expect } from 'vitest'`.

**Module-state reset in `beforeEach`** — `capture.test.ts` resets `resetCapture()` between tests; the persistence analog (RESEARCH Code Examples):
```typescript
import { beforeEach } from 'vitest'
import { db } from './db'
beforeEach(async () => { await db.delete(); await db.open() })
```

**Golden `Case[]` table** for round-trip / ordering assertions — copy the `metrics.test.ts:19-29` `interface Case { … }` + `const cases: Case[]` + `it.each` convention (also used in `state.test.ts`, `active-time.test.ts`).

**Round-trip assertion (Pitfall 1):** a test that asserts `StoredSession` preserves `events`, `charLog`, `markers`, `exercise` by value after `saveSession` → `listNewestFirst`.

---

### `src/test/setup-fake-indexeddb.ts` (NEW config — no analog)

One line: `import 'fake-indexeddb/auto'`. No existing `setupFiles` in the repo (`vite.config.ts` has none).

---

### `vite.config.ts` (MODIFIED)

**Analog:** its own `test.projects` array (`vite.config.ts:17-42`).

Follow the existing per-project object shape exactly (`{ test: { name, environment, include, exclude } }`). Add:
- carve `src/persistence/**` out of the `unit` project's `include` (add to its `exclude`, next to `'src/capture/**'`)
- NEW `persistence` project: `environment: 'node'`, `include: ['src/persistence/**/*.test.ts']`, `setupFiles: ['./src/test/setup-fake-indexeddb.ts']`
- add `setupFiles: ['./src/test/setup-fake-indexeddb.ts']` to the existing `ui` project (HistoryView needs the shim)

Leave `server.headers` / `preview.headers` (COOP/COEP) untouched.

---

### `package.json` (MODIFIED)

Add to `dependencies`: `dexie` (`^4.4.4` — pin `.4` to clear the `too-new` legitimacy flag, RESEARCH §Package Legitimacy Audit), `dexie-react-hooks` (`^4.4.0`). Add to `devDependencies`: `fake-indexeddb` (`^6.2.5`). Existing deps use caret ranges (`"react": "^19.2.8"`) — match that style. `packageManager` is `pnpm@11.5.3` → install with `pnpm add`.

## Shared Patterns

### Platform-seam isolation (D-03)
**Source:** `src/platform/isolation.ts:1`, `src/capture/capture.ts:1-8`, `src/session.ts:5-8`
**Apply to:** `persistence/db.ts` (only Dexie import), `persistence/repository.ts` (only imports `db.ts`)
Every existing seam has a file-lead comment naming its boundary and decision ID. `capture.ts:3`: `// The ONLY platform-coupled hot path (D-13).` → `db.ts`: `// The ONLY module that imports Dexie (D-03).` UI components and `metrics.ts` receive plain values, never import the seam's dependency.

### Versioned persisted computation
**Source:** `src/metrics/metrics.ts:32` (`export const METRICS_SCHEMA_VERSION = 1`) + `:39-44` (`schemaVersion` field on the result)
**Apply to:** `persistence/types.ts` (`STORED_SESSION_SCHEMA_VERSION` + `schemaVersion` envelope field), `db.ts` (`version(1)` block discipline, D-05)

### `role="status"`, prop-driven, non-blocking panels
**Source:** `src/ui/Banners.tsx:19` and `src/ui/ResultsView.tsx:24`
```tsx
<p className="banner banner--warning" role="status">
  <span className="banner-lead">Heads up</span> — …
</p>
```
**Apply to:** `SaveFailedNotice.tsx` (+ dismiss button, D-16), `HistoryView.tsx` container. `role="status"` not `role="alert"` (polite). No toast infra.

### Display-layer rounding only
**Source:** `src/metrics/metrics.ts:14-15` ("Do NOT round any number inside this module"), `src/ui/ResultsView.tsx:28,31,47` (`Math.round` at render)
**Apply to:** `HistoryRow` (round wpm/accuracy at render), `history-metrics.ts` (recompute helper never rounds)

### Unicode code-point iteration
**Source:** `src/metrics/metrics.ts:67-69`, `src/trainer/state.ts` ("Code-point array, not raw string indexing")
**Apply to:** `HistoryRow` exercise-length = `Array.from(exercise.text).length`

### `glyphFor` whitespace mapping (do not reimplement)
**Source:** `src/trainer/state.ts:91-95` (` ` → `·`, `\n` → `↵`), consumed by `ResultsView.tsx:2,45`
**Apply to:** `HistoryRow` slowest-key chip

### Clock-domain discipline (RESEARCH Pitfall 2)
**Source:** `src/metrics/metrics.ts:10-13`, `src/capture/types.ts:14,49-50`
**Apply to:** `persistence/types.ts` (name fields `startedAt` = `Date.now()` wall clock / display; `completedAtTMs` = `event.timeStamp` monotonic domain), `history-metrics.ts` (`now` from `completedAtTMs`, never `startedAt`)

### Error-as-typed-class, handled at the UI edge
**Source:** `src/ingestion/errors.ts:1-3`
**Apply to:** `repository.saveSession` rejects (does not swallow); `App.tsx::handleComplete` `.catch` → `setSaveFailed(true)`

### Test conventions
**Source:** `src/capture/capture.test.ts:1` (`import { beforeEach, describe, it, expect } from 'vitest'`), `src/metrics/metrics.test.ts:19-29` (`interface Case` + `const cases: Case[]` + `it.each`), module-state reset in `beforeEach`
**Apply to:** all `src/persistence/*.test.ts`

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/persistence/db.ts` (Dexie subclass specifically) | config | CRUD | No IndexedDB / Dexie / ORM code exists in the repo — this is the first persistence layer. The *seam shape* is analogous to `platform/isolation.ts`, but the Dexie API surface (`version().stores()`, `Table<>`) has no precedent. Planner: use RESEARCH §Pattern 1 + §Code Examples for the Dexie specifics. |
| `src/test/setup-fake-indexeddb.ts` | config | — | No `setupFiles` exists anywhere in the repo yet. Trivial one-liner; no pattern needed. |

## Metadata

**Analog search scope:** `src/` (full tree — 30 files, ~3156 LOC), `vite.config.ts`, `package.json`
**Files scanned:** `src/ui/App.tsx`, `Banners.tsx`, `ResultsView.tsx`, `CaptureSurface.test.tsx`, `src/metrics/metrics.ts`, `metrics.test.ts`, `src/session.ts`, `src/capture/capture.ts`, `capture.test.ts`, `capture/types.ts`, `src/platform/isolation.ts`, `src/ingestion/types.ts`, `errors.ts`, `src/trainer/state.ts`, `vite.config.ts`, `package.json`
**Pattern extraction date:** 2026-09-06
