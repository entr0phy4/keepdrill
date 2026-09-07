# Phase 4: Session Persistence & History - Research

**Researched:** 2026-09-06
**Domain:** Local-first IndexedDB persistence (Dexie) + reactive history view for an existing zero-backend Vite/React/TS keystroke-capture SPA
**Confidence:** HIGH (integration points grounded in direct source reads this session; stack carried forward from verified v1.1 milestone research)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Stack & Architecture (locked upstream by research):**
- **D-01:** Persistence uses **Dexie 4** + **dexie-react-hooks** (`useLiveQuery`); **fake-indexeddb** as a dev-only dep so the persistence layer runs under Vitest. No other new runtime deps. Reversibility: costly.
- **D-02:** Persist the **raw `Session`** (`exercise`, `events`, `charLog`, `markers`, `timingResolutionUs`, `crossOriginIsolated`, `startedAt`) as the source of truth, plus a **cached `MetricsResult` snapshot** alongside for fast list rendering. Never persist only the derived metrics. Reversibility: one-way.
- **D-03:** New **`persistence/` platform seam** (`db.ts`, `repository.ts`, `types.ts`) is the **only** module that imports Dexie. Follows the pure-core / platform-seam / hot-path split. `analytics.ts` (Phase 6) and `metrics.ts` stay pure and never import from `persistence/`.
- **D-04:** The completion write is **fire-and-forget** inside `App.tsx::handleComplete`, called **after** `setMetrics(result)`. Never `await`ed in the render path. Results screen renders immediately regardless of write outcome (PERS-03).
- **D-05:** **Dexie schema-versioning discipline from day one:** each schema change is a new `.version()` block; a shipped version block is never edited. All cross-session aggregation (Phase 6) gates on `schemaVersion` equality and recomputes stale rows.
- **D-06:** Request durable storage via `navigator.storage.persist()` to resist Safari's ~7-day best-effort eviction.

**History View Placement:**
- **D-07:** History is a **separate view**, toggled from a link/button in the app header, switching between the trainer view and a full-page history list. Reversibility: reversible (conditional render in `App.tsx`, no router).
- **D-08:** Switching to History **mid-exercise preserves in-progress trainer state** — the trainer/`CaptureSurface` is hidden, not unmounted. No progress lost, no confirm dialog. Reversibility: costly — planner must verify hiding (not unmounting) actually preserves capture state.
- **D-09:** The history list **live-updates via `useLiveQuery`** — the just-finished session appears after the fire-and-forget write resolves, no reload.
- **D-10:** Finishing an exercise does **nothing** to the history view — stays on results screen. New row is simply present next time History opens (no auto-nav, no flash/highlight).

**History Row Content:**
- **D-11:** Each row shows: **date**, **WPM**, **accuracy** (PERS-02), plus **source label** (filename from `exercise.sourceRef` for uploads, "Pasted snippet" for paste), **language tag** (`exercise.language`), **exercise length** (character or line count of `exercise.text`), and a **slowest-key chip** (`#1` from cached `MetricsResult.slowest5`, reusing `glyphFor` for whitespace keys as `ResultsView` does).
- **D-12:** **Date format:** relative ("2h ago", "3d ago") with full absolute timestamp on hover (`title` attribute). Derived from `startedAt` (`Date.now()` wall clock).
- **D-13:** History rows are **inert / read-only** in Phase 4 — no click target, no expansion. Per-session drill-down deferred to ANLY-07.
- **D-14:** History list has an explicit **empty state**.

**Save-Failure Notice:**
- **D-15:** The notice renders **inline near the results panel**, `role="status"`, matching the existing `Banners.tsx` convention (prop-driven, non-blocking). No toast infrastructure.
- **D-16:** The notice is **manually dismissible** (X / close control) — distinct from the non-dismissible startup banners.
- **D-17:** **Single generic message** regardless of failure cause. No branching on quota-exceeded vs IndexedDB-unavailable.

**Retention & What Persists:**
- **D-18:** **Keep all sessions and their full raw logs forever** for v1.1. No pruning, no cap. Reversibility: reversible.
- **D-19:** **Only completed exercises persist** — a session is written when `CaptureSurface` fires `onComplete`. Restarts and abandoned/replaced exercises persist nothing.
- **D-20:** A restart-then-finish produces **one history entry per completion**. Finishing the same text twice is two legitimate rows.

### Claude's Discretion
- `StoredSession` record shape and primary-key strategy (auto-increment id vs. `startedAt`-based vs. UUID), index definitions, and the exact `db.ts` / `repository.ts` API surface — decide within D-02/D-03/D-05.
- Exact wording of the empty state and the save-failure message.
- Whether "exercise length" (D-11) is shown as characters or lines.
- Header toggle visual treatment (link, button, tab-like) — subject to a UI-SPEC pass (`/gsd-ui-phase 4`).
- How relative-time strings are computed (hand-rolled vs. `Intl.RelativeTimeFormat`) — no new dep either way.
- Test strategy for the Dexie layer (fake-indexeddb is the agreed harness; coverage depth is planner's call).

### Deferred Ideas (OUT OF SCOPE)
- **Per-session drill-down** (click a history row → re-derived breakdown from raw log) — ANLY-07.
- **Retention / prune policy** — revisit only if storage size becomes visible (D-18).
- **Distinguishing save-failure causes** (quota vs. private-mode) with tailored messaging — rejected for v1.1 (D-17).
- **Delete / clear-history controls** — not scoped now.
- Symbol-adjusted WPM, paste-language picker (Phase 5); cross-session digraph/heatmap/per-language analytics (Phase 6); trend/evolution charts; cross-device sync (no backend in v1.1).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERS-01 | Completed session (full raw log, not just summary numbers) auto-saved to IndexedDB with no explicit "save" action, survives page reload | `persistence/` seam (§Standard Stack, §Code Examples); `StoredSession` shape persists `events`/`charLog`/`markers`/`exercise` verbatim from `buildSession()` (§Data Model); fire-and-forget write added to `App.tsx::handleComplete` after `setMetrics` (§Integration Points, Pattern 2) |
| PERS-02 | User can view a list of past sessions (date, WPM, accuracy), newest first | `HistoryView.tsx` bound via `useLiveQuery` to `repository` querier ordered newest-first (§Pattern 3, §Code Examples); row content spec D-11/D-12 mapped to `exercise` + cached `metricsSnapshot` fields (§Data Model) |
| PERS-03 | Non-blocking notice if a session fails to persist; results screen never blocked or delayed by the save | Write is never `await`ed (D-04, Pattern 2, Anti-Pattern 2); `.catch()` sets a dismissible `role="status"` notice near results (§Pattern 4, §Save-Failure Notice); `setMetrics(result)` runs synchronously before the write is fired |
</phase_requirements>

## Summary

This phase is almost entirely plumbing. v1.0 already assembles the exact unit-of-record to persist — `src/session.ts::buildSession()`'s header comment literally reads *"Phase 3 metrics fold over this; Phase 4 persists it"* — and `App.tsx::handleComplete` already builds that `Session` and computes a `MetricsResult` at the one completion boundary. Phase 4 adds: (1) a `persistence/` module wrapping Dexie 4, (2) one fire-and-forget `saveSession(...)` call after the existing `setMetrics(result)`, (3) a `HistoryView` bound to the DB via `useLiveQuery`, (4) a dismissible save-failure notice, and (5) a header toggle that hides — never unmounts — the trainer subtree.

The stack is locked and was verified against the npm registry during the v1.1 milestone research pass (2026-09-05); re-verified this session (2026-09-06): **dexie 4.4.5**, **dexie-react-hooks 4.4.0**, **fake-indexeddb 6.2.5** are all current. `dexie@4.4.5` trips the legitimacy seam's `too-new` heuristic (patch published 2026-08-14) but the 4.x line has shipped since March 2024, downloads are ~2.3M/week, the repo is `github.com/dexie/Dexie.js`, and there is no `postinstall` — this is a false positive on release recency, not a supply-chain signal. Pinning `dexie@4.4.4` (2026-06-16) sidesteps the flag with zero functional difference.

The real risks are small and well-telegraphed: persist the **raw** log not just derived numbers (D-02, or every future analytics feature is dead on arrival for old sessions); keep the two clock domains (`startedAt` wall-clock vs. `charLog`/`markers` `event.timeStamp` tMs) unambiguous in the stored shape (Pitfall 2); establish Dexie version-block discipline now even though v1 is the first schema (Pitfall 6); and verify empirically that hiding the trainer via `display:none` (not a conditional unmount) actually preserves the in-progress capture buffer (D-08 — analysis below says it does, because `CaptureSurface`'s `key={loadToken}` does not change on a view switch and the capture buffer is module-level singleton state untouched by React render).

**Primary recommendation:** Add `dexie` + `dexie-react-hooks` (runtime) and `fake-indexeddb` (dev). Build `src/persistence/{db.ts,repository.ts,types.ts}` as the sole Dexie import site. `StoredSession` = the raw `Session` fields + `metricsSnapshot: MetricsResult` + an explicit `schemaVersion` envelope field, primary key `++id` (auto-increment), one secondary index on `startedAt`. Wire `void saveSession(...).catch(setSaveFailed)` into `handleComplete` after `setMetrics`. Render `HistoryView` from `useLiveQuery(repository.listNewestFirst)`. Toggle views with a `view` state that flips the trainer wrapper's inline `display` between `grid` and `none` — never a `{view === 'trainer' && <trainer/>}` unmount.

## Architectural Responsibility Map

keebdrill is a single-tier local-first browser SPA; the meaningful boundary is the codebase's own **hot-path / pure-core / platform-seam / UI** split (Phase 1 decision, reaffirmed for v1.1 in STATE.md), not client/server tiers.

| Capability | Primary Layer | Secondary Layer | Rationale |
|------------|---------------|-----------------|-----------|
| Durable session storage (write) | Platform seam (`persistence/db.ts` + `repository.ts`) | UI (`App.tsx` fires the call) | Only the seam touches Dexie/IndexedDB (D-03); `App.tsx` owns *when* to write (the existing completion boundary) but not *how* |
| Durable session storage (read / live query) | Platform seam (`repository.ts` querier) | UI (`HistoryView` via `useLiveQuery`) | `useLiveQuery` runs a seam-owned querier; the component never imports Dexie |
| Session assembly (what to persist) | Pure core (`session.ts::buildSession`) | — | UNCHANGED — already produces the exact value object |
| Derived metrics for the row (WPM/accuracy/slowest key) | Pure core (`metrics.ts`) | UI (rounds at render, reads cached snapshot) | `metrics.ts` stays pure; `HistoryView` renders `metricsSnapshot` and recomputes via `computeSessionMetrics` only on `schemaVersion` mismatch |
| Durable-storage permission request | Platform seam (`persistence/`, one call) | — | `navigator.storage.persist()` is an impure browser edge; belongs behind the seam, fired once after first successful save |
| View switching (trainer ↔ history) | UI (`App.tsx` `view` state) | — | Conditional render / visibility toggle only; no router (D-07) |
| In-progress capture buffer preservation across view switch | Hot path (`capture.ts` module state) | UI (`App.tsx` must hide, not unmount) | Buffer is module-level singleton; only `resetCapture()` clears it, and that is called only on load/restart |
| Save-failure surfacing | UI (`App.tsx` state + notice component) | — | `.catch()` → `setSaveFailed(true)` → dismissible `role="status"` notice near results |

## Standard Stack

### Core (new this phase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `dexie` | `4.4.5` (or pin `4.4.4`) | IndexedDB wrapper — typed tables, schema versioning, transactions | De-facto standard IndexedDB wrapper; `db.version(n).stores({...})` migration path is exactly what D-05 needs. `[VERIFIED: npm registry 2026-09-06]` — latest `4.4.5`, 4.x line since 2024-03, ~2.3M weekly downloads, repo `github.com/dexie/Dexie.js`, no `postinstall`. `[CITED: dexie.org/docs]` for API. Flagged `too-new` by legitimacy seam (patch recency only) — see §Package Legitimacy Audit. |
| `dexie-react-hooks` | `4.4.0` | `useLiveQuery()` — reactive binding of a Dexie query to a React component (D-09) | Official Dexie sub-package, published from the same monorepo, built on `useSyncExternalStore` (the primitive this codebase already leans on — see `use-capture.ts`, `CaptureSurface.tsx`). `[VERIFIED: npm registry 2026-09-06]` — latest `4.4.0` (2026-03-26), ~488k weekly downloads, `OK` from legitimacy seam. Peer range: `dexie >=4.2.0-alpha.1 <5.0.0`, `react >=16` — satisfied by dexie 4.4.5 + React 19.2. `[VERIFIED: npm view dexie-react-hooks peerDependencies]` |

### Development (new this phase)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fake-indexeddb` | `6.2.5` | In-memory IndexedDB shim so Dexie runs under Vitest (node + happy-dom environments have no `indexedDB` global) | `import 'fake-indexeddb/auto'` in a Vitest `setupFiles` entry for the persistence + history-view test projects. `[VERIFIED: npm registry 2026-09-06]` — latest `6.2.5` (2025-11-07), ~5.7M weekly downloads, `OK` from legitimacy seam, no `postinstall`. `[CITED: npmjs.com/package/fake-indexeddb]` |

### Not needed / explicitly excluded

| Excluded | Why | Instead |
|----------|-----|---------|
| Any router (`react-router`, TanStack Router) | D-07: "no router" — view switch is a `useState` conditional render | `const [view, setView] = useState<'trainer' \| 'history'>('trainer')` |
| Any toast / notification library | D-15: "No toast infrastructure" — the notice is an inline `role="status"` element | A small `SaveFailedNotice.tsx` reusing `.banner` CSS + a close button |
| State management (Zustand/Redux) | Persistence is "query IndexedDB, render result"; `useLiveQuery` + local state covers it | `useLiveQuery` + `useState` |
| `idb`, `localForage`, raw IndexedDB | D-01 locks Dexie; raw IDB upgrade paths are a known bug source | `dexie` |
| A date library (`date-fns`, `dayjs`, Luxon) | D-12 relative time is one small helper; `Intl.RelativeTimeFormat` is a browser built-in | `Intl.RelativeTimeFormat` or ~15 lines hand-rolled (discretion) |

**Installation:**
```bash
pnpm add dexie@4.4.5 dexie-react-hooks@4.4.0
pnpm add -D fake-indexeddb@6.2.5
```
(Substitute `dexie@4.4.4` if the team prefers to avoid the `too-new` legitimacy flag — no API difference.)

## Package Legitimacy Audit

| Package | Registry | Age (line / patch) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|--------------------|-----------|-------------|---------|-------------|
| `dexie` | npm | 4.x since 2024-03-26 / `4.4.5` 2026-08-14 | ~2.33M/wk | `github.com/dexie/Dexie.js` | **SUS** (`too-new` — patch recency only) | **Approved.** Established package, canonical repo, no `postinstall`. Optionally pin `4.4.4` (2026-06-16) to clear the flag. Planner: add a `checkpoint:human-verify` before install OR pin `4.4.4`. |
| `dexie-react-hooks` | npm | `4.4.0` 2026-03-26 | ~488k/wk | `github.com/dexie/Dexie.js` | **OK** | Approved |
| `fake-indexeddb` | npm | `6.2.5` 2025-11-07 | ~5.70M/wk | `github.com/dumbmatter/fakeIndexedDB` | **OK** | Approved (dev-only) |

**Postinstall check** `[VERIFIED: npm view <pkg> scripts]`: none of the three define a `postinstall` (or any install-lifecycle) script. `dexie` scripts are build/test only; `fake-indexeddb` has a `prepare: husky` (dev-repo only, not run on install-as-dependency).

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `dexie` — recency-of-patch only. Recommended resolution: pin `dexie@4.4.4`, or a one-line `checkpoint:human-verify` task confirming `dexie` on npm before `pnpm add`.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────────┐
  keydown/keyup ───▶│ capture.ts  (module-singleton buffers)           │  HOT PATH
  beforeinput   ───▶│   buffer[] · charLog[] · markers[]               │  (UNCHANGED)
                    │   getEvents() getCharLog() getMarkers()          │
                    │   resetCapture()  ◀── only load / restart clears │
                    └───────────────┬─────────────────────────────────┘
                                    │ (read at completion)
  CaptureSurface.onComplete(completedAt)   [CONTRACT UNCHANGED]
                                    │
                                    ▼
              ┌──────────────────  App.tsx::handleComplete  ──────────────────┐
              │  session = buildSession(exercise, startedAt)   [session.ts]   │
              │  result  = computeSessionMetrics(text, charLog, markers, now) │  [metrics.ts, PURE]
              │  setMetrics(result)          ← SYNC, unchanged, renders ResultsView
              │  setSaveFailed(false)                                          │
              │  void saveSession({session, completedAt, metricsSnapshot:result})
              │        .catch(err => { console.warn(...); setSaveFailed(true) })  ← FIRE-AND-FORGET
              └───────────────────────────────┬──────────────────────────────┘
                                              ▼
                        ┌──────  persistence/  (ONLY Dexie import site, D-03)  ──────┐
                        │  repository.ts  saveSession() / listNewestFirst() / get()  │
                        │       │                                                    │
                        │       ▼                                                    │
                        │  db.ts   new Dexie('keebdrill')                            │
                        │          .version(1).stores({ sessions: '++id, startedAt' })│
                        │          + navigator.storage.persist()  (once, post-save)  │
                        └───────────────────────────────┬───────────────────────────┘
                                                        ▼  IndexedDB  (browser)
                                                        │
   view === 'history' ─────────────────────────────────┐│
                                                       ▼▼
        HistoryView.tsx ── useLiveQuery(repository.listNewestFirst) ──▶ StoredSession[]
             │  per row: relative date (startedAt) · WPM · accuracy · source · lang · length · slowest-key chip
             │  render metricsSnapshot directly; recompute via computeSessionMetrics only if schemaVersion stale
             └─ empty state (D-14)   ·   rows inert / read-only (D-13)

   App.tsx render:  <header> [ Trainer | History ] toggle </header>
                    <div style={{display: view==='trainer' ? 'grid' : 'none'}}> …CaptureSurface key={loadToken}… </div>   ← HIDDEN not unmounted (D-08)
                    {view === 'history' && <HistoryView/>}
```

### Recommended Project Structure

```
src/
├── persistence/              # NEW — platform seam, the ONLY Dexie import site (D-03)
│   ├── db.ts                 # Dexie subclass + version(1).stores(); persist() request
│   ├── repository.ts         # saveSession / listNewestFirst / getSession — thin wrappers
│   └── types.ts              # StoredSession, NewSession, STORED_SESSION_SCHEMA_VERSION
├── ui/
│   ├── App.tsx               # MODIFIED — view state, hide-not-unmount trainer, fire-and-forget write, saveFailed state
│   ├── HistoryView.tsx       # NEW — useLiveQuery list; empty state; inert rows
│   ├── SaveFailedNotice.tsx  # NEW — dismissible role="status" notice (D-15/D-16/D-17)
│   ├── history-metrics.ts    # NEW (optional) — resolveMetrics(stored): recompute-if-stale helper
│   └── (Banners.tsx, ResultsView.tsx, CaptureSurface.tsx UNCHANGED)
├── test/
│   └── setup-fake-indexeddb.ts   # NEW — import 'fake-indexeddb/auto'
├── session.ts                # UNCHANGED
├── capture/ trainer/ metrics/ ingestion/ platform/   # UNCHANGED
```

### Pattern 1: `persistence/` as the sole Dexie boundary (D-03)

**What:** `db.ts` is the only file that imports `dexie`. `repository.ts` imports `db.ts`. Everything else (UI, `metrics.ts`, future `analytics.ts`) receives plain `StoredSession[]` / `MetricsResult` values as arguments or hook results.
**When to use:** Always — mirrors how `capture/use-capture.ts` isolates DOM event wiring and `platform/isolation.ts` isolates `crossOriginIsolated`.
**Example:**
```typescript
// src/persistence/db.ts   — Source: recommended (Dexie API per dexie.org/docs/Tutorial/Design)
import Dexie, { type Table } from 'dexie'
import type { StoredSession } from './types'

class KeebdrillDB extends Dexie {
  sessions!: Table<StoredSession, number> // <row type, primary-key type>

  constructor() {
    super('keebdrill')
    // D-05: version(1) is the FIRST and FINAL definition of the v1 schema.
    // Any future change = a NEW db.version(2).stores({...}).upgrade(tx => ...) block.
    // NEVER edit this line after it ships. Only indexed fields are listed here;
    // events/charLog/markers/exercise/metricsSnapshot are stored but NOT indexed.
    this.version(1).stores({
      sessions: '++id, startedAt',
    })
  }
}

export const db = new KeebdrillDB()
```

### Pattern 2: Fire-and-forget write at the one existing completion boundary (D-04, PERS-03)

**What:** `handleComplete` already calls `setMetrics(result)` synchronously. Add exactly one unawaited `saveSession(...)` after it, with a `.catch` that flips a `saveFailed` state. Never `await`. Never gate `setMetrics`.
**When to use:** The single write site. No other file gets write access to `persistence/`.
**Example** (the current `handleComplete`, verbatim, with the additions marked):
```typescript
// src/ui/App.tsx — CURRENT (lines 72-78), verbatim:
const handleComplete = (completedAt: number) => {
  const current = loadRef.current
  if (!current) return
  const session = buildSession(current.exercise, current.startedAt)
  const result = computeSessionMetrics(current.exercise.text, session.charLog, session.markers, completedAt)
  setMetrics(result)
  // + ADD:
  setSaveFailed(false)
  void saveSession({ session, completedAt, metricsSnapshot: result }).catch((err) => {
    console.warn('[keebdrill] session not persisted:', err)
    setSaveFailed(true)
  })
}
```
Also add `setSaveFailed(false)` alongside the existing `setMetrics(null)` in `handleLoad` (line 55) and `handleRestart` (line 90) so a stale notice never survives a fresh load/restart.

### Pattern 3: `useLiveQuery` bound to a seam-owned querier (D-09)

**What:** `HistoryView` calls `useLiveQuery` with a **stable module-level function** exported from `repository.ts`. Dexie's live-query machinery tracks which tables/ranges the querier read and re-runs it after any matching write — so the just-saved session appears with no reload.
**When to use:** The history list, and any future analytics view that reads the DB.
**Gotcha:** `useLiveQuery` returns `undefined` on the first render (before the promise resolves). `HistoryView` must treat `undefined` = loading, `[]` = empty state (D-14), `[...]` = rows. Do not conflate `undefined` and `[]`.
**Example:**
```typescript
// src/persistence/repository.ts — Source: recommended (Dexie query API per dexie.org/docs/Collection/Collection.reverse())
import { db } from './db'
import type { StoredSession, NewSession } from './types'
import { STORED_SESSION_SCHEMA_VERSION } from './types'

let persistRequested = false

export async function saveSession(input: NewSession): Promise<number> {
  const row: StoredSession = {
    schemaVersion: STORED_SESSION_SCHEMA_VERSION,
    startedAt: input.session.startedAt,
    completedAtTMs: input.completedAt, // event.timeStamp domain — see Pitfall 2
    exercise: input.session.exercise,
    events: [...input.session.events],
    charLog: [...input.session.charLog],
    markers: [...input.session.markers],
    timingResolutionUs: input.session.timingResolutionUs,
    crossOriginIsolated: input.session.crossOriginIsolated,
    metricsSnapshot: input.metricsSnapshot,
  }
  const id = await db.sessions.add(row)
  if (!persistRequested) {
    persistRequested = true
    void navigator.storage?.persist?.().catch(() => {}) // D-06, best-effort, never blocks
  }
  return id
}

// Stable reference for useLiveQuery — newest first (D-12: "newest-first").
export function listNewestFirst(): Promise<StoredSession[]> {
  return db.sessions.orderBy('startedAt').reverse().toArray()
}
```
```typescript
// src/ui/HistoryView.tsx
import { useLiveQuery } from 'dexie-react-hooks'
import { listNewestFirst } from '../persistence/repository'

export function HistoryView() {
  const sessions = useLiveQuery(listNewestFirst) // undefined | StoredSession[]
  if (sessions === undefined) return <p className="text-muted">Loading history…</p>
  if (sessions.length === 0) return <p className="text-muted">No sessions yet — finish a typing exercise and it&rsquo;ll show up here.</p>
  return (
    <ol /* inert rows, D-13 */>
      {sessions.map((s) => <HistoryRow key={s.id} session={s} />)}
    </ol>
  )
}
```

### Pattern 4: Hide, don't unmount, the trainer subtree (D-08)

**What:** The view toggle changes an inline `display` style on the trainer wrapper `<div>`; it does **not** wrap the trainer in `{view === 'trainer' && ...}`.
**Why this preserves in-progress state** (verified against source this session):
- `CaptureSurface` is keyed `key={loadToken}` (`App.tsx:144`). `loadToken` is bumped **only** in `handleLoad` (`:54`) and `handleRestart` (`:89`). A view switch does not touch it → **same component instance survives**, including its `firedCompletedAtRef`, `isActive`, `pasteBlocked` state and the uncontrolled `<textarea>` DOM node (with its `.value`).
- The typed-so-far progress lives in `capture.ts`'s **module-level** `buffer` / `charLog` / `markers` arrays (`capture.ts:9-11`), which React render never touches. They are cleared **only** by `resetCapture()` (`capture.ts:240`), called only from `handleLoad`/`handleRestart` (`App.tsx:53`, `:88`). The trainer view re-derives everything from `getCharLog()` on each render (`CaptureSurface.tsx:136`).
- `useCapture`'s `useLayoutEffect` listener binding (`use-capture.ts:34-43`) stays active because the component is not unmounted — no re-attach, no `detachCapture()`.
- A `display:none` textarea cannot receive keyboard events, so no stray keystrokes are captured while History is showing; `window` blur/focus/`visibilitychange` markers may still fire (harmless).
**Implementation note:** the trainer wrapper currently carries inline `style={{ display: 'grid', gap: 'var(--space-md)' }}` (`App.tsx:142`). The HTML `hidden` attribute would be overridden by that inline `display` — so toggle `display` directly:
```tsx
<div style={{ display: view === 'trainer' ? 'grid' : 'none', gap: 'var(--space-md)' }}>
  {/* CaptureSurface + ResultsView + Restart button — unchanged */}
</div>
{view === 'history' && <HistoryView />}
```
**Planner must add a verification task:** load an exercise, type a few chars, switch to History, switch back — assert the caret position and per-char coloring are intact (analog of `CaptureSurface.test.tsx`'s `RestartHarness`, but with a `view` toggle that does *not* bump the key). If hiding proves insufficient in practice, the fallback is lifting the capture buffer into a ref that survives remount — but analysis says hiding is sufficient.

### Anti-Patterns to Avoid

- **Persisting only `{date, wpm, accuracy}` and discarding the raw log.** Breaks D-02 and makes Phase 5/6 analytics permanently unavailable for every session recorded before those phases. Persist `events`/`charLog`/`markers`/`exercise`; treat `metricsSnapshot` as a disposable cache.
- **`await saveSession(...)` before `setMetrics(result)`** (or anywhere in the render path). Violates D-04/PERS-03 — the results screen must not wait on IndexedDB I/O.
- **Importing `dexie` or `persistence/db` into `HistoryView`, `metrics.ts`, or a future `analytics.ts`.** Breaks D-03. The querier lives in `repository.ts`; the component imports the querier.
- **Editing `db.version(1).stores(...)` in a later phase.** Breaks D-05 / Pitfall 6. Add a new `db.version(2)` block with an `upgrade()` function.
- **Conditionally unmounting the trainer on view switch** (`{view === 'trainer' && <trainer/>}`). Risks losing the uncontrolled `<textarea>` node and caret/IME state (D-08).
- **Indexing large blobs.** Do not put `events`, `charLog`, `exercise`, or `metricsSnapshot` in the Dexie `stores()` index string — index only `startedAt` (and the implicit `++id`).
- **Treating `useLiveQuery`'s initial `undefined` as an empty list.** Show a loading state, not the D-14 empty state, until the first resolve.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB open / upgrade / transaction lifecycle | A raw `indexedDB.open` + `onupgradeneeded` wrapper | `dexie` | Callback-based, cross-browser quirks, easy to get upgrade path subtly wrong (Pitfall 6) |
| "Re-render when the DB changes" wiring | `useEffect` + manual refetch-on-write + event bus | `dexie-react-hooks` `useLiveQuery` | Purpose-built, `useSyncExternalStore`-based, tracks query dependencies automatically (D-09) |
| IndexedDB in unit tests | A hand-mocked `indexedDB` global | `fake-indexeddb/auto` | Full spec-compliant in-memory implementation; the standard shim |
| Relative time strings | A large date library | `Intl.RelativeTimeFormat` (built-in) or ~15 lines | D-12 needs one small function; no dep either way (discretion) |
| Durable-storage request | Custom quota monitoring | `navigator.storage.persist()` fire-and-forget | One call; best-effort by design (D-06) |

**Key insight:** every piece of genuinely hard logic in this phase (schema migration, reactive queries, transaction atomicity, IDB test doubles) is exactly what Dexie + its ecosystem exist to provide. The only hand-written code is the `StoredSession` shape, the ~6-line repository wrappers, and the presentational `HistoryView` / `SaveFailedNotice`.

## Data Model

### `StoredSession` (recommended shape)

Persist every field of the in-memory `Session` (`src/capture/types.ts:42-51`, quoted verbatim below) plus the cached metrics snapshot and an envelope schema version.

`Session` interface `[VERIFIED: src/capture/types.ts:42-51]`:
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

`MetricsResult` interface `[VERIFIED: src/metrics/metrics.ts:39-44]`:
```typescript
export interface MetricsResult {
  schemaVersion: number
  wpm: number
  accuracy: number
  slowest5: SlowestKeyEntry[]
}
```
`SlowestKeyEntry` `[VERIFIED: src/metrics/metrics.ts:34-37]`: `{ char: string; medianMs: number }`.
`METRICS_SCHEMA_VERSION` `[VERIFIED: src/metrics/metrics.ts:32]`: `export const METRICS_SCHEMA_VERSION = 1`.

`Exercise` interface `[VERIFIED: src/ingestion/types.ts:5-13]`:
```typescript
export interface Exercise {
  /** Normalized, typing-ready text. Never the raw input. */
  text: string
  /** Best-effort. `'plaintext'` for paste (D-11, A11). */
  language: string
  sourceType: SourceType          // 'paste' | 'upload'  [VERIFIED: src/ingestion/types.ts:3]
  /** File name for uploads (D-11). Absent for paste. */
  sourceRef?: string
}
```

`KeystrokeEvent` `[VERIFIED: src/capture/types.ts:5-17]`: `{ seq, type: 'keydown'|'keyup', key, code, ctrl, alt, shift, meta, tMs, isRepeat }`.
`CommittedChar` `[VERIFIED: src/capture/types.ts:22-27]`: `{ seq, inputType, data: string|null, tMs }`.
`CaptureMarker` `[VERIFIED: src/capture/types.ts:32-36]`: `{ seq, kind: 'blur'|'focus'|'hidden'|'visible', tMs }`.

**Recommended `persistence/types.ts`:**
```typescript
export const STORED_SESSION_SCHEMA_VERSION = 1 // envelope version; bump when the RECORD SHAPE changes (Phase 5 adds fields)

export interface StoredSession {
  id?: number                     // auto-increment PK (Dexie fills on add)
  schemaVersion: number           // = STORED_SESSION_SCHEMA_VERSION at write time (D-05)
  startedAt: number               // Session.startedAt — Date.now() WALL CLOCK, indexed, ordering + D-12 display
  completedAtTMs: number          // handleComplete(completedAt) — event.timeStamp / tMs DOMAIN (Pitfall 2), for recompute
  exercise: Exercise
  events: KeystrokeEvent[]
  charLog: CommittedChar[]
  markers: CaptureMarker[]
  timingResolutionUs: number
  crossOriginIsolated: boolean
  metricsSnapshot: MetricsResult  // cache; has its own metricsSnapshot.schemaVersion (METRICS_SCHEMA_VERSION)
}

export interface NewSession {
  session: Session
  completedAt: number             // the tMs value CaptureSurface passed to onComplete
  metricsSnapshot: MetricsResult
}
```

### Field decisions (Claude's Discretion, resolved with rationale)

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| Primary key | `++id` auto-increment | Dexie-idiomatic; gives a stable React `key`; `id` insertion order == completion order; no collision risk. `startedAt` alone risks a tie on a fast restart-then-refinish (D-20 allows two rows same text). |
| Indexes | `startedAt` only (plus implicit `++id`) | Only field queried (newest-first ordering). Never index blob fields. |
| Newest-first ordering | `db.sessions.orderBy('startedAt').reverse()` | D-12 "newest-first"; `startedAt` is the displayed date so ordering matches what the user sees. `orderBy('id').reverse()` is the tie-safe alternative if two rows ever share a `startedAt` ms. |
| Store `completedAtTMs`? | Yes, explicitly named | Needed as `now` for recompute (Pitfall 2). Alternative: omit it and re-derive via `computeTrainerState(exercise.text, charLog).completedAt` on read — also fine, slightly more work. Never store a bare `completedAt` next to wall-clock `startedAt`. |
| Envelope `schemaVersion` field | Include it | Cheap; Phase 5 adds fields to the record and will want to detect old rows without a full Dexie `upgrade()` for additive changes. Mirrors the existing `METRICS_SCHEMA_VERSION` precedent. |
| `events` retention | Persist in full, forever (D-18) | Phase 6 heatmap needs `KeystrokeEvent.code`, only on `events`. Size is ~hundreds of KB/session, ~tens of MB/year at daily use — not a problem at this scale. |
| `readonly` arrays → Dexie | Spread-copy (`[...session.events]`) on write | `Session`'s arrays are `readonly` (TS) and frozen (`Object.freeze`, `capture.ts`); structured clone handles frozen objects fine, but a mutable copy keeps the stored type clean. |

### Recompute-on-stale-schema (D-05) — wire it now, dormant until Phase 5

`HistoryView` renders `metricsSnapshot` directly. Guard it:
```typescript
// src/ui/history-metrics.ts
import { computeSessionMetrics, METRICS_SCHEMA_VERSION, type MetricsResult } from '../metrics/metrics'
import { computeTrainerState } from '../trainer/state'
import type { StoredSession } from '../persistence/types'

export function resolveMetrics(s: StoredSession): MetricsResult {
  if (s.metricsSnapshot.schemaVersion === METRICS_SCHEMA_VERSION) return s.metricsSnapshot
  const now = s.completedAtTMs // or: computeTrainerState(s.exercise.text, s.charLog).completedAt ?? 0
  return computeSessionMetrics(s.exercise.text, s.charLog, s.markers, now)
}
```
In Phase 4, `METRICS_SCHEMA_VERSION === 1` and nothing bumps it, so this always returns the cache. Phase 5's bump to 2 makes it "just work" for old rows. `metrics.ts` and `trainer/state.ts` stay pure; this helper lives in `ui/`, not `persistence/` (keeps `repository.ts` a thin Dexie wrapper — D-03).

## Common Pitfalls

### Pitfall 1: Persisting derived metrics as the source of truth
**What goes wrong:** Store `{wpm, accuracy}` and drop the log; Phase 5/6 analytics can never be computed for pre-existing sessions.
**Why it happens:** It's the cheap path and the history list only needs the summary.
**How to avoid:** D-02 — persist the raw `Session` fields; `metricsSnapshot` is a cache. Verification: a test asserts `StoredSession` round-trips `events`, `charLog`, `markers`, `exercise` byte-for-value.
**Warning signs:** `StoredSession` has no `charLog`/`events` field.

### Pitfall 2: Clock-domain mix — `startedAt` (wall clock) vs. `tMs` (`event.timeStamp`)
**What goes wrong:** `Session.startedAt` is `Date.now()` wall-clock `[VERIFIED: src/capture/types.ts:49-50]`; all latency math (`computeSessionMetrics`'s `now`, `computeActiveElapsedMs`) is in the monotonic `event.timeStamp` domain. `metrics.ts`'s own header calls this "Pitfall 1" `[VERIFIED: src/metrics/metrics.ts:10-13]`: *"Do NOT pass Session.startedAt … as `now`"*. Once multiple sessions sit in one record read by history/analytics code, it becomes easy to feed a wall-clock field into a recomputation.
**Why it happens:** Cross-session code needs `startedAt` (to sort/display by date) and per-session recompute needs a `tMs` value — two timestamps side by side in one row.
**How to avoid:** Name the fields unambiguously (`startedAt` = wall clock, `completedAtTMs` = tMs domain). Any recompute derives `now` from `completedAtTMs` or from `computeTrainerState(text, charLog).completedAt` — never from `startedAt`. Add a golden test: recompute from a stored fixture == the original in-session `MetricsResult`.
**Warning signs:** Historical WPM values that are `Infinity`/`NaN` or suspiciously near-zero elapsed time after a reload.

### Pitfall 3: Dexie version-block discipline on the first schema
**What goes wrong:** Later, someone edits `version(1).stores(...)` in place instead of adding `version(2)`; Dexie only runs upgrade logic when `oldVersion < newVersion`, so returning users silently keep the stale shape.
**Why it happens:** The discipline is easy to forget under solo/rapid iteration when v1 is the only version.
**How to avoid:** A code comment on `version(1)` stating the rule (see Pattern 1). A migration test harness now — even trivial (seed rows, assert `db.verno === 1`, round-trip) — so the pattern exists before Phase 5 needs it. To delete a store in a future version, Dexie needs an explicit `null` schema entry, not omission.
**Warning signs:** A schema change works on a fresh DB but errors for anyone with existing data.

### Pitfall 4: Double-write on completion (StrictMode / re-render)
**What goes wrong:** `handleComplete` fires twice → two rows for one run (violates D-20).
**Why it happens:** `App` runs under `<StrictMode>` `[VERIFIED: src/main.tsx:11-13]`; `onComplete` prop identity changes every render, so `CaptureSurface`'s completion `useEffect` (deps `[completedAt, onComplete]`) re-runs.
**How it's already handled:** `CaptureSurface` guards with `firedCompletedAtRef` — fires `onComplete` at most once per distinct `completedAt` `[VERIFIED: src/ui/CaptureSurface.tsx:143-148]`, and `CaptureSurface.test.tsx` locks this ("onComplete fires exactly once for the same completedAt"). StrictMode's mount-time effect double-invoke happens long before completion (nothing typed yet).
**How to avoid regressions:** Do not remove the ref guard. Do not move the write into a `useEffect` in `App`. Keep it inline in `handleComplete`, which only runs on the real completion callback.
**Warning signs:** Two adjacent history rows with identical `startedAt` and identical metrics.

### Pitfall 5: Treating `useLiveQuery`'s first-render `undefined` as empty
**What goes wrong:** The D-14 empty state flashes on every History open before data loads.
**How to avoid:** `sessions === undefined` → loading; `sessions.length === 0` → empty state; else rows. (See Pattern 3.)

### Pitfall 6: `hidden` attribute defeated by inline `display`
**What goes wrong:** Adding `hidden={view !== 'trainer'}` to the trainer wrapper does nothing because the element already has inline `style={{ display: 'grid' }}` (`App.tsx:142`), which wins over the UA `hidden` rule.
**How to avoid:** Toggle the inline `display` value directly (Pattern 4).

### Pitfall 7: Quota / private-mode write failure surfacing as an unhandled rejection
**What goes wrong:** In strict private-browsing (some Safari/Firefox configs) `db.sessions.add` rejects; without a `.catch` it's an unhandled promise rejection and the user gets no notice.
**How to avoid:** The `.catch(err => setSaveFailed(true))` in Pattern 2 is mandatory (PERS-03, D-15). Single generic message (D-17). The results screen already rendered (D-04), so this is purely additive UI.

## Runtime State Inventory

> This is an additive greenfield feature (new module, new table, new views) — not a rename/refactor/migration of existing runtime state. This section is included for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None exists yet.** This phase *creates* the first IndexedDB database (`keebdrill`, object store `sessions`). No prior persisted state to migrate. `[VERIFIED: package.json:18-21 — only react/react-dom deps; no persistence layer]` | Create schema `version(1)` (D-05) |
| Live service config | None — no backend, no external services (local-first SPA) | None |
| OS-registered state | None | None |
| Secrets/env vars | None — no new env vars; `vite.config.ts` COOP/COEP headers unchanged | None |
| Build artifacts | `pnpm-lock.yaml` changes (3 new packages). No compiled artifacts. Vitest `test.projects` config gains a setup file / project entry for `fake-indexeddb`. | `pnpm install`; update `vite.config.ts` test config |

**The canonical question — "after every file is updated, what runtime systems still have old state?":** Nothing. There is no pre-existing persisted state. The only forward concern is D-05: once real users have a `version(1)` DB on disk, Phase 5's record-shape change must be a `version(2)` block, never an edit to `version(1)`.

## Code Examples

### Vitest setup for the Dexie layer (fake-indexeddb)

Current `vite.config.ts` `test.projects` `[VERIFIED: vite.config.ts:19-46]` has three projects: `unit` (`environment: 'node'`, `include: ['src/**/*.test.ts']`, `exclude: ['src/capture/**']`), `dom` (happy-dom, `src/capture/**`), `ui` (happy-dom, `src/ui/**/*.test.tsx`). There are **no `setupFiles` anywhere** `[VERIFIED: grep for setupFiles/fake-indexeddb returned nothing]`.

`src/persistence/*.test.ts` matches the `unit` project (node env, no `indexedDB` global). `src/ui/HistoryView.test.tsx` matches `ui` (happy-dom, also no `indexedDB`). Both need the shim.

```typescript
// src/test/setup-fake-indexeddb.ts
import 'fake-indexeddb/auto' // registers indexedDB, IDBKeyRange, IDBFactory, … as globals
```

Recommended `vite.config.ts` change — add a dedicated `persistence` project and a setup file to `ui`:
```typescript
test: {
  projects: [
    { test: { name: 'unit', environment: 'node',
              include: ['src/**/*.test.ts'],
              exclude: ['src/capture/**', 'src/persistence/**'] } },      // carve out persistence
    { test: { name: 'persistence', environment: 'node',
              include: ['src/persistence/**/*.test.ts'],
              setupFiles: ['./src/test/setup-fake-indexeddb.ts'] } },      // NEW
    { test: { name: 'dom', environment: 'happy-dom', include: ['src/capture/**/*.test.ts'] } },
    { test: { name: 'ui', environment: 'happy-dom',
              include: ['src/ui/**/*.test.tsx'],
              setupFiles: ['./src/test/setup-fake-indexeddb.ts'] } },      // NEW — HistoryView needs it
  ],
},
```

Per-test isolation (Dexie caches the open connection; fake-indexeddb persists in-memory across tests in a file):
```typescript
import { beforeEach } from 'vitest'
import { db } from './db'

beforeEach(async () => {
  await db.delete()  // drop the in-memory DB
  await db.open()    // reopen fresh at version(1)
})
```
Or reset the whole factory: `import { IDBFactory } from 'fake-indexeddb'; globalThis.indexedDB = new IDBFactory()` before re-opening.

### `HistoryRow` — D-11 / D-12 field derivation

```typescript
import { glyphFor } from '../trainer/state'          // reuse — [VERIFIED: src/trainer/state.ts:91-95]
import { resolveMetrics } from './history-metrics'
import type { StoredSession } from '../persistence/types'

function HistoryRow({ session }: { session: StoredSession }) {
  const m = resolveMetrics(session)
  const sourceLabel = session.exercise.sourceType === 'upload'
    ? (session.exercise.sourceRef ?? 'Uploaded file')
    : 'Pasted snippet'                                                  // D-11
  const lengthChars = Array.from(session.exercise.text).length          // code points, per project Unicode rule
  const slowest = m.slowest5[0]                                         // may be undefined for a short exercise
  return (
    <li /* inert — no onClick, D-13 */>
      <span title={new Date(session.startedAt).toLocaleString()}>{relativeTime(session.startedAt)}</span>
      <span>{Math.round(m.wpm)} wpm</span>
      <span>{Math.round(m.accuracy * 100)}%</span>
      <span>{sourceLabel}</span>
      <span>{session.exercise.language}</span>
      <span>{lengthChars} chars</span>
      {slowest && (
        <span className="key-chip">
          {slowest.char === ' ' || slowest.char === '\n' ? glyphFor(slowest.char) : slowest.char}
        </span>
      )}
    </li>
  )
}
```
`glyphFor` `[VERIFIED: src/trainer/state.ts:91-95]`: `char === ' '` → `'·'`, `char === '\n'` → `'↵'`, else the char. Rounding at the display layer only, matching `ResultsView` `[VERIFIED: src/ui/ResultsView.tsx:28-31, 47]`.

### Relative time (no dependency — discretion)

```typescript
const RTF = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000_000], ['month', 2_592_000_000], ['day', 86_400_000],
  ['hour', 3_600_000], ['minute', 60_000], ['second', 1000],
]
export function relativeTime(startedAt: number, now = Date.now()): string {
  const diff = startedAt - now
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms || unit === 'second') return RTF.format(Math.round(diff / ms), unit)
  }
  return 'just now'
}
```

### Save-failure notice (D-15 / D-16 / D-17)

Mirror `Banners.tsx` (`role="status"`, `.banner` CSS) `[VERIFIED: src/ui/Banners.tsx:15-37]` but add a close button. `.banner` / `.banner--warning` classes already exist `[VERIFIED: src/index.css:202-219]`.
```tsx
export function SaveFailedNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <p className="banner banner--warning" role="status">
      <span className="banner-lead">Heads up</span> — This session couldn&rsquo;t be saved to your history.
      <button type="button" onClick={onDismiss} aria-label="Dismiss">×</button>
    </p>
  )
}
```
Render in `App.tsx` near `ResultsView`: `{metrics !== null && saveFailed && <SaveFailedNotice onDismiss={() => setSaveFailed(false)} />}`. Exact copy + layout are a `/gsd-ui-phase 4` concern.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw `indexedDB` + `onupgradeneeded` | Dexie 4 typed tables + `version().stores()` | Dexie 4 GA 2024-03 | Migration path is a first-class API (D-05) |
| `useEffect` + manual refetch for reactive DB reads | `useLiveQuery` (built on `useSyncExternalStore`) | dexie-react-hooks 1.x+ | Zero refetch wiring; React 19 concurrent-safe |
| Best-effort storage (silent LRU eviction) | `navigator.storage.persist()` request | Storage Standard, broad support 2023+ | Resists Safari's ~7-day eviction (D-06) |
| `localStorage` for structured data | IndexedDB via Dexie | — | Async, no main-thread block, large quota, structured clone |

**Deprecated/outdated:** nothing in this stack is deprecated. `dexie` 3.x → 4.x changed some TS generics (define explicit `interface StoredSession` rather than relying on inference — which this plan does).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Hiding the trainer via inline `display:none` (component instance retained via unchanged `key={loadToken}`) fully preserves in-progress capture state (D-08) | Pattern 4 | LOW-MEDIUM — analysis is grounded in source reads, but happy-dom lacks a layout engine; a real-browser check is warranted. Fallback: lift capture buffer to a ref. Planner must add the verification task. |
| A2 | `navigator.storage.persist()` is safe to call fire-and-forget with no user-visible prompt disruption on the target (Chromium) browser | Pattern 3, D-06 | LOW — Chromium grants heuristically without a prompt; Firefox may prompt once. Worst case: a one-time permission prompt. `[CITED: dexie.org/docs/StorageManager, MDN Storage API]` |
| A3 | `useLiveQuery` correctly tracks a querier imported from another module (`repository.listNewestFirst`) and re-runs it after `saveSession` writes | Pattern 3, D-09 | LOW — this is the documented primary usage pattern. `[CITED: dexie.org/docs/dexie-react-hooks/useLiveQuery()]` — not re-verified against a running instance this session. |
| A4 | `fake-indexeddb@6` `auto` import provides everything Dexie 4.4.5 needs under Vitest node + happy-dom environments | §Code Examples, D-01 | LOW — standard combination, verified in prior milestone research; not executed this session. |
| A5 | Structured-clone serialization of the frozen `KeystrokeEvent`/`CommittedChar`/`CaptureMarker` objects into IndexedDB is lossless (no functions/symbols/cycles in those shapes) | §Data Model | LOW — the shapes are plain data `[VERIFIED: src/capture/types.ts:5-36]`; `Object.freeze` objects are cloneable. |
| A6 | `dexie@4.4.5` is legitimate despite the `too-new` seam verdict | §Package Legitimacy Audit | LOW — established package, canonical repo, no postinstall; mitigation (pin `4.4.4`) is trivial. |
| A7 | `completedAtTMs` (the value passed to `onComplete`) equals `computeTrainerState(text, charLog).completedAt` and is a valid `now` for `computeSessionMetrics` on recompute | §Data Model, Pitfall 2 | LOW — `CaptureSurface` derives it exactly that way `[VERIFIED: src/ui/CaptureSurface.tsx:136-148]`. |

**These `[ASSUMED]`/low-confidence items should be confirmed during `/gsd-discuss-phase` review or by a spike before they become locked plan decisions — especially A1 (D-08 preservation).**

## Open Questions

1. **Does `display:none` on the trainer wrapper preserve caret/IME/selection state in a real browser (D-08)?**
   - What we know: `key={loadToken}` is unchanged on view switch → same component instance; capture buffer is module-singleton, untouched by render; trainer view re-derives from `getCharLog()`.
   - What's unclear: subtle uncontrolled-`<textarea>` selection/IME behavior after being `display:none` and shown again, in Chromium/Firefox/Safari. happy-dom can't test this.
   - Recommendation: planner adds an explicit manual/Playwright verification task (type → switch to History → switch back → assert caret index + coloring). If it fails, lift the capture buffer into a ref that survives remount and allow the trainer to unmount.

2. **Primary key: `++id` vs. `startedAt` vs. UUID (Claude's Discretion)?**
   - Recommendation: `++id`. Rationale in §Data Model. Confirm during planning; low-stakes and reversible only via a `version(2)` migration, so worth getting right now.

3. **Store `completedAtTMs` or re-derive it on read?**
   - Both work. Storing is simpler and one number; re-deriving avoids any clock-domain field in the record entirely (Pitfall 2 purist stance). Recommendation: store it, explicitly named, with a comment. Planner's call.

4. **`schemaVersion` envelope field — include now or wait for Phase 5?**
   - Recommendation: include now (cheap, and Phase 5 adds record fields). If the team prefers YAGNI, Dexie's own `db.verno` + `metricsSnapshot.schemaVersion` are enough for Phase 4 alone.

5. **Exercise length as characters or lines (D-11, Claude's Discretion)?**
   - Recommendation: characters via `Array.from(text).length` (consistent with the codebase's code-point rule). Lines (`text.split('\n').length`) is also acceptable and arguably more meaningful for code. UI-SPEC decides.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build / test / install | ✓ | `^20.19.0 \|\| >=22.12.0` required `[VERIFIED: package.json:7-9]` | — |
| pnpm | Package install (D-01) | ✓ | `pnpm@11.5.3` declared `[VERIFIED: package.json:6]` | — |
| npm registry (`dexie`, `dexie-react-hooks`, `fake-indexeddb`) | D-01 | ✓ | 4.4.5 / 4.4.0 / 6.2.5 `[VERIFIED: npm view, 2026-09-06]` | — (all present, legitimacy checked) |
| IndexedDB (browser runtime) | PERS-01 | ✓ (all evergreen browsers; app is browser-only) | — | PERS-03 notice covers the private-mode/quota failure case at runtime |
| `navigator.storage.persist()` | D-06 | ✓ (Storage Standard, evergreen) | — | Best-effort by design; rejection is ignored |
| Vitest + happy-dom | Test the layer | ✓ | vitest `~4.1.11`, happy-dom `^20.14.0` `[VERIFIED: package.json:27,31]` | — |
| Playwright | Optional E2E "save → reload → see in history" smoke | ✗ — not in `package.json`; no e2e harness configured | — | Manual UAT check, or a happy-dom + fake-indexeddb integration test standing in for the reload (recreate `db` instance, re-query) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Playwright (not installed) — use a happy-dom integration test that simulates "reload" by dropping and reopening the Dexie connection, plus a manual UAT step. `nyquist_validation` is `false` in config, so a full requirement→automated-test matrix is not mandated this phase.

## Project Constraints (from CLAUDE.md)

| Directive | Source | Impact on this phase |
|-----------|--------|----------------------|
| GSD Workflow Enforcement — no direct repo edits outside a GSD command | `.claude/CLAUDE.md` | Planning/execution proceeds via `/gsd-plan-phase 4` etc. |
| Tech stack: Vite 8 + React 19.2 + TS strict, pnpm, **no backend** for v1 | CLAUDE.md "Constraints" / "Recommended Stack" | Persistence is IndexedDB (Dexie), not a server. D-01 already aligns. |
| Persist to the browser with **Dexie 4 (IndexedDB)** | CLAUDE.md "TL;DR Recommendation" | Directly satisfied by D-01. |
| Privacy: ingested third-party content stays local | CLAUDE.md "Constraints" | IndexedDB satisfies "stays local" **only while no export/sync/telemetry path exists**. Persisting pasted third-party code verbatim is acceptable under this constraint; flag again if any later phase adds networking. Add a one-line note to project docs/README. |
| Keystroke timing uses `event.timeStamp` (`tMs`), never `Date.now()` for latency | CLAUDE.md "Keystroke capture" + `metrics.ts` header | Reinforces Pitfall 2 — `startedAt` (wall clock) must never enter recompute math. |
| TS strict + `noUncheckedIndexedAccess` | CLAUDE.md / `tsconfig.json` `[VERIFIED: tsconfig.json:19-21]` | `slowest5[0]` is `T \| undefined` — guard it (see `HistoryRow`). Define explicit `interface StoredSession`, don't rely on Dexie inference. |
| Develop/benchmark on Chromium; Firefox "also works" | CLAUDE.md "What NOT to Use" | The D-08 real-browser verification (Open Question 1) should target Chromium first. |
| No performance-threshold color-coding / gamified framing | 03-UI-SPEC (canonical ref), CLAUDE.md ethos | History rows and the save notice: neutral presentation, no red/green WPM coloring. |

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high` `[VERIFIED: .planning/config.json workflow block]`.

### Applicable ASVS Categories (L1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V1 Architecture | yes (minor) | Trust boundary unchanged — all code + data stay client-side in one origin. Document that "stays local" depends on no export/sync path (CLAUDE.md privacy constraint). |
| V2 Authentication | no | Single-user local tool, no accounts. |
| V3 Session Management | no | No server sessions; "session" here is a typing exercise, not an auth session. |
| V4 Access Control | no | No multi-user model. Note (informational): same-origin, same browser profile can read this IndexedDB — out of scope for a personal tool, worth one README line if ever shared. |
| V5 Validation / Sanitization / Encoding | **yes** | Exercise text is rendered by React (auto-escaped — no `dangerouslySetInnerHTML` anywhere). Stored data is read back and rendered the same way. `exercise.language` / `sourceRef` are rendered as text nodes. No `eval`, no dynamic `import()`, no HTML injection surface. Dexie queries are parameterized by design (no query-string concatenation). |
| V6 Cryptography | no | No secrets, no PII, no crypto requirement. Session data is the user's own keystroke timings — not sensitive beyond the existing privacy constraint. Do not add encryption (no key management story, no threat that warrants it). |
| V7 Error Handling / Logging | yes (minor) | The write `.catch` logs `console.warn` with the error and shows a **generic** user message (D-17) — do not surface raw `DOMException` details in the UI. No logging of exercise content. |
| V8 Data Protection | yes (minor) | D-18 keeps all raw logs forever. If a repo/file the user typed was proprietary, its text now lives in IndexedDB indefinitely. This matches the existing v1.0 behavior (the log already existed in memory) and the CLAUDE.md privacy model (local-only). No new exposure. A future "clear history" control (deferred) is the mitigation if desired. |
| V11 Business Logic | yes (minor) | D-19/D-20: exactly one row per completion. The `firedCompletedAtRef` guard + inline write (not a `useEffect`) prevent duplicate/replay writes (Pitfall 4). |
| V12 Files / Resources | no | No file upload in this phase (uploads are Phase 1; this phase only reads `exercise.sourceRef` as a string). |
| V13 API / Web Service | no | No API. |
| V14 Configuration | yes (minor) | `vite.config.ts` COOP/COEP headers unchanged. No new env vars, no new external origins, no CDN. New deps vetted (§Package Legitimacy Audit). |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation | Status this phase |
|---------|--------|---------------------|-------------------|
| Stored XSS via persisted exercise text rendered in `HistoryView` | Tampering / Elevation | React text-node rendering (auto-escape); never `dangerouslySetInnerHTML` | Safe by construction — keep it that way; do not add raw-HTML rendering of stored fields |
| Supply-chain: malicious/typosquatted `dexie*` package | Tampering | Legitimacy audit + pin exact versions + no `postinstall` | Done (§Package Legitimacy Audit); `dexie` SUS is recency-only |
| Prototype pollution via `db.sessions.add` of an attacker-shaped object | Tampering | Input is the app's own `buildSession()` output, not external JSON; explicit typed shape | Not reachable — no external data path into `saveSession` |
| Unhandled promise rejection on quota/private-mode failure leaking a stack to console/UI | Info Disclosure (minor) | `.catch` → generic message (D-17), `console.warn` only | Pattern 2 / Pitfall 7 |
| DoS via unbounded IndexedDB growth (D-18 keep-forever) | Denial of Service (self-inflicted, single user) | Documented as acceptable at single-user daily-use scale; prune policy deferred | Accepted (D-18); revisit if storage becomes visibly large |
| Sensitive data at rest (proprietary code in IndexedDB, unencrypted) | Info Disclosure | Local-only origin storage; matches existing privacy model; no new export path | No new exposure vs. v1.0 |

**No `high`-severity findings.** Nothing here should block the phase. The one item worth a sentence in project docs: IndexedDB persistence satisfies "third-party content stays local" only as long as no export/sync/telemetry code path is ever added — re-flag this in any future phase that touches networking.

## Sources

### Primary (HIGH confidence — direct source reads, this session, 2026-09-06)
- `src/ui/App.tsx` (full) — `handleComplete`/`handleLoad`/`handleRestart`, `loadToken` / `key={loadToken}`, render structure, StrictMode-hosted
- `src/session.ts` (full) — `buildSession(exercise, startedAt)`, "Phase 4 persists it", live-snapshot contract
- `src/capture/types.ts` (full) — `Session`, `KeystrokeEvent`, `CommittedChar`, `CaptureMarker` shapes; `startedAt` = wall clock
- `src/capture/capture.ts` (full) — module-singleton `buffer`/`charLog`/`markers`, `resetCapture()`, `getEvents/getCharLog/getMarkers`, `Object.freeze` discipline
- `src/capture/use-capture.ts` (full) — `useLayoutEffect` attach/detach, `useSyncExternalStore`
- `src/ui/CaptureSurface.tsx` (full) — `key`-driven remount, `firedCompletedAtRef` one-shot completion, `computeTrainerState` re-derive per render
- `src/metrics/metrics.ts` (full) — `MetricsResult`/`SlowestKeyEntry`/`METRICS_SCHEMA_VERSION`, clock-domain warning, `computeSessionMetrics` signature, `MIN_SAMPLES`
- `src/trainer/state.ts` (full) — `computeTrainerState` returns `completedAt` (tMs), `glyphFor`
- `src/ui/Banners.tsx`, `src/ui/ResultsView.tsx` (full) — `role="status"` prop-driven convention, display-layer rounding, `glyphFor` reuse
- `src/ingestion/types.ts` (full) — `Exercise` (`text`/`language`/`sourceType`/`sourceRef?`)
- `src/main.tsx` — `<StrictMode>` wraps `<App/>`
- `package.json`, `tsconfig.json`, `vite.config.ts` — deps, strict flags, `test.projects` config (no `setupFiles`)
- `src/ui/CaptureSurface.test.tsx` — existing test patterns (`RestartHarness`, `MetricsHarness`, happy-dom + `act`), `resetCapture` in `beforeEach`
- `src/index.css` (banner / results-panel / key-chip rules)
- `.planning/config.json` — `nyquist_validation: false`, `security_enforcement: true`, ASVS L1

### Primary (HIGH confidence — verified this session)
- `npm view dexie / dexie-react-hooks / fake-indexeddb` (versions, dates, repos, `scripts`) — 2026-09-06
- `gsd-tools query package-legitimacy check` — dexie SUS(too-new), dexie-react-hooks OK, fake-indexeddb OK
- `npm view dexie-react-hooks peerDependencies` → `dexie >=4.2.0-alpha.1 <5.0.0`, `react >=16`
- `npm view dexie versions` / `time` → 4.x line since 2024-03-26; 4.4.5 = 2026-08-14; 4.4.4 = 2026-06-16

### Secondary (MEDIUM confidence — carried forward from v1.1 milestone research, re-read this session)
- `.planning/research/STACK.md` — Dexie 4.4.5 / dexie-react-hooks 4.4.0 / fake-indexeddb rationale, "hand-roll everything else"
- `.planning/research/ARCHITECTURE.md` — `persistence/` seam design, raw-log-as-source-of-truth + schema-versioned cache pattern, fire-and-forget write, data-model table
- `.planning/research/PITFALLS.md` — Pitfalls #1 (formula versions), #2 (clock domain), #6 (first Dexie migration), #7 (raw-event growth), #8 (completion-write race)
- `.planning/research/SUMMARY.md` — milestone framing
- `.planning/phases/04-session-persistence-history/04-CONTEXT.md` — D-01..D-20
- `.planning/milestones/v1.0-phases/03-session-metrics/03-UI-SPEC.md` — display conventions (no threshold coloring, `role="status"`, `.preview`/`.banner` card treatment)

### Tertiary (LOW confidence — training knowledge, cited not verified this session)
- `dexie.org/docs` — `version().stores()`, `Collection.reverse()`, `useLiveQuery()` semantics, `StorageManager` guidance
- MDN Storage API — `navigator.storage.persist()` / `estimate()`, quota/eviction (LRU, best-effort vs. persistent)
- WebKit blog — Safari ~7-day no-interaction eviction

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — three packages, versions verified against npm registry twice (milestone research + this session), legitimacy-checked, peer ranges confirmed
- Architecture / integration points: HIGH — every integration point (`handleComplete`, `key={loadToken}`, capture-buffer lifecycle, `firedCompletedAtRef`, `computeTrainerState.completedAt`) read from source this session
- D-08 hide-not-unmount: MEDIUM-HIGH — mechanism is sound from source reads, but a real-browser check is recommended (Open Question 1 / A1)
- Pitfalls: HIGH for codebase-grounded ones (clock domain, migration discipline, double-write); MEDIUM for general IndexedDB quota/eviction
- Test setup: MEDIUM-HIGH — `vite.config.ts` structure verified; `fake-indexeddb` integration is the standard pattern but not executed this session

**Research date:** 2026-09-06
**Valid until:** ~2026-10-06 (stable stack; re-check `dexie` patch version at install time)
