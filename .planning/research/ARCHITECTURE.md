# Architecture Research

**Domain:** Local-first browser SPA — adding persistence + cross-session analytics to an existing keystroke-capture typing trainer
**Researched:** 2026-09-05
**Confidence:** HIGH (integration design — grounded directly in the read source of `src/session.ts`, `src/metrics/metrics.ts`, `src/ui/App.tsx`, `src/ui/CaptureSurface.tsx`, `src/capture/types.ts`); MEDIUM (Dexie schema-versioning conventions, raw-vs-aggregate storage pattern — web-sourced)

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────────────┐
│  HOT PATH (unchanged — capture/, trainer/, live rendering)                │
│  ┌──────────────┐   keydown/keyup    ┌──────────────┐                    │
│  │ CaptureSurface│ ─────────────────▶ │  capture.ts  │  (module state:    │
│  │   .tsx        │  beforeinput/input │  getEvents() │   events[],       │
│  │               │ ◀───────────────── │  getCharLog()│   charLog[],      │
│  └──────┬────────┘   trainer/state.ts │  getMarkers()│   markers[])      │
│         │ onComplete(completedAt)      └──────────────┘                    │
├─────────┼───────────────────────────────────────────────────────────────┤
│         ▼           SINGLE INTEGRATION POINT (write)                      │
│  ┌──────────────┐   buildSession()   ┌──────────────┐                    │
│  │   App.tsx     │ ─────────────────▶│  session.ts  │  Session snapshot   │
│  │ handleComplete│                    └──────────────┘  (exercise+raw log)│
│  │               │   computeSessionMetrics()                              │
│  │               │ ─────────────────▶ metrics/metrics.ts (unchanged shape,│
│  │               │                    + symbolAdjustedWpm, v2)            │
│  │               │                                                        │
│  │               │   fire-and-forget, NOT awaited in render path          │
│  │               │ ─────────────────▶ persistence/repository.ts           │
│  └──────┬────────┘                          │                             │
│         │ mounts sibling views              ▼                             │
│         │                            ┌──────────────┐                     │
│         │                            │ persistence/ │  Dexie / IndexedDB  │
│         │                            │   db.ts      │  (platform seam)    │
│         │                            └──────┬───────┘                     │
├─────────┼──────────────────────────────────┼─────────────────────────────┤
│         ▼  NEW READ-SIDE VIEWS (no coupling into the hot path)            │
│  ┌──────────────┐   listSessions()   ┌──────────────┐                    │
│  │ HistoryView   │ ◀──────────────── │ repository.ts │                    │
│  │   .tsx        │                    └──────┬───────┘                    │
│  └──────────────┘                            │ raw Sessions (N)           │
│  ┌──────────────┐                            ▼                            │
│  │ Analytics     │   analytics/analytics.ts (PURE, folds over N sessions)  │
│  │ Dashboard.tsx │   → digraph/trigraph latency, keyboard heatmap,        │
│  │  (+ subviews) │     per-language profile                                │
│  └──────────────┘                                                          │
└───────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|-------------------------|
| `src/capture/capture.ts`, `src/trainer/state.ts`, `src/ui/CaptureSurface.tsx` | Hot-path capture + live rendering | **UNCHANGED.** No new imports, no persistence awareness. This is the boundary that must stay untouched — jitter here is the product's core differentiator. |
| `src/session.ts` (`buildSession`) | Assembles the durable unit-of-record: `Exercise` + raw `events`/`charLog`/`markers` | **UNCHANGED shape.** Already documented in its own header comment as "Phase 4 persists it" — this milestone is that Phase 4. |
| `src/metrics/metrics.ts` | Pure, single-session derived metrics (wpm, accuracy, slowest5) | **MODIFIED** — add `symbolAdjustedWpm`, bump `METRICS_SCHEMA_VERSION` to 2. Still zero DOM access, still re-runnable over `{target, charLog, markers, now}`. |
| `src/metrics/symbol-density.ts` (new) | Pure codepoint → "is this a symbol" classifier + density-weighted WPM formula | New pure module, sibling to `metrics.ts`. No persistence/cross-session data needed — a single-session concern. |
| `src/persistence/db.ts` (new) | Dexie schema definition + version(s) | Platform seam — the only place that imports Dexie. Analogous to `capture/use-capture.ts` and `ingestion/upload.ts` as the "impure edge." |
| `src/persistence/repository.ts` (new) | `saveSession`, `listSessions`, `getSession`, `deleteSession` | Platform seam. Thin wrapper around `db.ts` tables — no business logic, no metric computation. |
| `src/analytics/analytics.ts` (new) | Pure, **cross-session** fold: digraph/trigraph latency, keyboard heatmap aggregation, per-language profile | Analogous to `metrics.ts` but takes `readonly Session[]` (or a lighter `SessionRecord[]` read from persistence) instead of a single session. Zero DOM access, zero import of Dexie. |
| `src/analytics/keyboard-geometry.ts` (new) | Static US-ANSI `code → {row, col}` position table for heatmap rendering | Pure static data, distinct from `platform/layout.ts` (which is a *runtime layout-mismatch warning*, not a position map — do not conflate the two). |
| `src/ui/HistoryView.tsx` (new) | Session list: date, wpm, accuracy, language | Prop-driven, `role="status"`-style dumb component, same convention as `ResultsView.tsx`/`Banners.tsx`. |
| `src/ui/AnalyticsDashboard.tsx` + subviews (new) | Renders `analytics.ts` output | `DigraphLatencyView.tsx`, `KeyboardHeatmap.tsx`, `LanguageProfileView.tsx` as prop-driven leaf components under one dashboard container. |
| `src/ui/App.tsx` | Orchestration | **MODIFIED** — add the persistence write call inside `handleComplete`; add simple view-switch state (Practice / History / Analytics) — no router needed at this scale. |

## Recommended Project Structure

```
src/
├── capture/                 # UNCHANGED — hot path
│   ├── capture.ts
│   ├── types.ts
│   └── use-capture.ts
├── ingestion/                # UNCHANGED
│   ├── normalize.ts
│   ├── upload.ts / paste.ts
│   ├── language-map.ts
│   └── types.ts
├── metrics/                  # MODIFIED — single-session pure metrics
│   ├── metrics.ts            # + symbolAdjustedWpm, METRICS_SCHEMA_VERSION -> 2
│   └── symbol-density.ts     # NEW — pure symbol classifier + density weighting
├── analytics/                 # NEW — cross-session pure fold (sibling to metrics/)
│   ├── analytics.ts           # digraph/trigraph latency, per-language profile
│   ├── heatmap.ts             # keyboard-code latency/error aggregation (or fold into analytics.ts)
│   ├── keyboard-geometry.ts   # static US-ANSI code->{row,col} layout table
│   └── types.ts               # AnalyticsResult, DigraphEntry, HeatmapEntry, LanguageProfile
├── persistence/                # NEW — platform seam (the only Dexie import site)
│   ├── db.ts                   # Dexie schema + version(s)
│   ├── repository.ts           # saveSession/listSessions/getSession/deleteSession
│   └── types.ts                 # StoredSession (persisted shape, schemaVersion-tagged)
├── trainer/                    # UNCHANGED
│   ├── state.ts
│   └── active-time.ts
├── platform/                   # UNCHANGED
│   ├── isolation.ts
│   └── layout.ts
├── session.ts                  # UNCHANGED — buildSession() already anticipates this milestone
└── ui/
    ├── App.tsx                 # MODIFIED — persistence write in handleComplete, view switch
    ├── Banners.tsx              # UNCHANGED
    ├── CaptureSurface.tsx       # UNCHANGED — contract (onComplete) stays identical
    ├── CorpusInput.tsx          # UNCHANGED
    ├── ResultsView.tsx          # MODIFIED — render symbolAdjustedWpm
    ├── HistoryView.tsx          # NEW
    └── AnalyticsDashboard.tsx   # NEW, + DigraphLatencyView.tsx, KeyboardHeatmap.tsx, LanguageProfileView.tsx
```

### Structure Rationale

- **`analytics/` is a new top-level sibling to `metrics/`, not a subfolder of it.** The codebase already draws a hard line at "pure, re-runnable over data, zero DOM access" (see `metrics.ts`'s header comment). `metrics.ts` folds over **one** session's `{target, charLog, markers, now}`; `analytics.ts` folds over **N** sessions. Different arity, different cardinality of inputs, same purity contract — worth a distinct module so a future contributor doesn't have to guess whether a given analytics function needs one session or the whole history.
- **`persistence/` is a new platform seam, isolated the same way `capture/use-capture.ts` isolates the DOM.** Dexie/IndexedDB access must never leak into `analytics.ts` or `metrics.ts` — those stay pure and testable with plain arrays/golden fixtures, exactly like today's `metrics.test.ts`. `repository.ts` is the only file that imports `db.ts`; `db.ts` is the only file that imports Dexie.
- **`symbol-density.ts` lives inside `metrics/`, not `analytics/` or `ingestion/`.** It's consumed only by `metrics.ts` (a single-session WPM variant), has no cross-session or persistence concern, and (unlike `language-map.ts`) classifies *characters*, not *file extensions* — different axis from `ingestion/language-map.ts`, so don't conflate the two despite both being "language-adjacent" lookup tables.
- **`keyboard-geometry.ts` is new, not a reuse of `platform/layout.ts`.** `layout.ts` exists solely to *warn* about a non-ANSI physical layout via the Chromium-only `navigator.keyboard.getLayoutMap()` API — it holds no row/column geometry. The heatmap needs a static `code → {row, col}` table for rendering; that's a different, purely presentational concern and deserves its own file so `layout.ts`'s narrow fingerprinting-safe scope isn't muddied.

## Data Model — what gets persisted per session

**Persist the raw `Session` (source of truth), not just derived metrics — and cache one derived-metrics snapshot alongside it as a read-performance optimization, not as the durable record.**

This directly continues an existing convention already visible in the code, not a new invention:

- `session.ts`'s header comment states outright: *"Phase 3 metrics fold over this; Phase 4 persists it"* — referring to the full `Session` object (`exercise`, `events`, `charLog`, `markers`), not a metrics summary. This milestone **is** that Phase 4.
- `metrics.ts` already carries a `schemaVersion`/`METRICS_SCHEMA_VERSION` field and a header comment forbidding rounding "at this layer" — both signal an existing intent: derived values are meant to be **recomputed from raw data**, not treated as permanently frozen artifacts. A formula fix (e.g. changing `MIN_GAP_MS`/`MAX_GAP_MS`/`MIN_SAMPLES`, or adding symbol-adjusted WPM) should be able to retroactively improve *all* historical sessions the next time they're read, not require a data migration.

Concretely, per completed session, the `persistence/` layer stores:

| Field | Source | Why persisted |
|-------|--------|----------------|
| `id`, `startedAt`, `completedAt` | `App.tsx`'s `loadRef`/`completedAt` | Row identity + ordering for `HistoryView`. |
| `exercise: Exercise` (`text`, `language`, `sourceType`, `sourceRef`) | `session.ts`'s `Session.exercise` | Needed to re-derive metrics (target text) and to bucket by language for the per-language profile. |
| `events: KeystrokeEvent[]` | `session.ts`'s `Session.events` | Needed for the **keyboard heatmap** — heatmap is keyed by physical `KeyboardEvent.code`, which only `events` carries; `charLog` carries logical committed characters (post-IME), not physical keys. |
| `charLog: CommittedChar[]` | `session.ts`'s `Session.charLog` | Needed to re-derive `metrics.ts`'s slowest-5, plus the new digraph/trigraph latency (an extension of the exact same gap-between-consecutive-records logic, generalized from 1-char to 2-/3-char windows). |
| `markers: CaptureMarker[]` | `session.ts`'s `Session.markers` | Needed to re-derive active-elapsed-time (`computeActiveElapsedMs`) if WPM formulas change later. |
| `metricsSnapshot: MetricsResult` (+ its `schemaVersion`) | `computeSessionMetrics()` output at completion time | **Cache only.** Lets `HistoryView` render a list of 100+ sessions without replaying every raw log on every app load. `HistoryView`/`AnalyticsDashboard` compare `metricsSnapshot.schemaVersion` against the current `METRICS_SCHEMA_VERSION`; on mismatch, recompute from the raw fields above (cheap — a single pure fold) rather than trusting the stale cached copy, and optionally rewrite the cache. |

**Do NOT** persist only a metrics summary and discard the raw log — that would make `symbolAdjustedWpm`, digraph/trigraph latency, and the heatmap permanently unavailable for every session recorded before those features shipped (all of v1.0's future self-use history would be dead weight). **Do NOT** treat the raw log as disposable "already summarized, safe to prune" — the schema-versioned-recompute pattern is the whole point of persisting it.

Storage-size sanity check for the "single local user, self-validation" scale (see PROJECT.md success criteria — a month of daily use): a technical-corpus exercise of a few hundred to a couple thousand keystrokes produces an `events`+`charLog` array on the order of a few thousand small objects — low hundreds of KB per session even unindexed. A year of one daily session is on the order of tens of MB, comfortably inside IndexedDB's typical quota. This is not a "prune raw data" problem at this project's scale; revisit only if corpus/session sizes grow by 1–2 orders of magnitude (e.g. multi-hour repo-kata sessions in a later milestone).

## Architectural Patterns

### Pattern 1: Raw-log-as-source-of-truth with schema-versioned derived cache

**What:** Persist the full raw `Session` per completed exercise. Compute and cache a `MetricsResult` (and later an analytics snapshot) alongside it, tagged with the schema version that produced it. On read, compare versions; recompute from the raw fields when stale.
**When to use:** Any time the derivation formula is expected to improve over the product's lifetime (this project's `metrics.ts` already assumes so via `METRICS_SCHEMA_VERSION`).
**Trade-offs:** More storage than aggregates-only; in exchange, every historical session stays fully reprocessable — new analytics features (digraph, heatmap, symbol-adjusted WPM, per-language) apply retroactively to *all* prior self-use data with zero migration, which is exactly what the PROJECT.md success criterion ("a measurable reduction in latency... after one month of use") needs.

```typescript
// persistence/types.ts
export interface StoredSession {
  id: string
  startedAt: number
  completedAt: number
  exercise: Exercise
  events: KeystrokeEvent[]
  charLog: CommittedChar[]
  markers: CaptureMarker[]
  metricsSnapshot: MetricsResult // includes its own schemaVersion
}
```

### Pattern 2: Fire-and-forget write at the single existing completion boundary

**What:** `App.tsx`'s `handleComplete` already computes `MetricsResult` synchronously and calls `setMetrics(result)`. Add exactly one more call — `void saveSession(session, result).catch(...)` — after that, never awaited inside the render path, never blocking `setMetrics`.
**When to use:** Any write that must not delay the results panel appearing (D-05/D-07 already lock "auto-revealed the instant the exercise completes" with no gating).
**Trade-offs:** A failed write (e.g. IndexedDB unavailable in strict-private-browsing Safari/Firefox) must degrade silently to "this session's results are shown but not saved" — surface it as a non-blocking `Banners.tsx`-style notice, never as a blocking error or a retry loop in the hot path.

```typescript
// App.tsx, inside handleComplete — the ONLY write integration point
const handleComplete = (completedAt: number) => {
  const current = loadRef.current
  if (!current) return
  const session = buildSession(current.exercise, current.startedAt)
  const result = computeSessionMetrics(current.exercise.text, session.charLog, session.markers, completedAt)
  setMetrics(result)
  void saveSession({ ...session, completedAt }, result).catch((err) => {
    console.warn('[keebdrill] session not persisted:', err)
    setPersistenceWarning(true) // renders via Banners.tsx-style non-blocking notice
  })
}
```

### Pattern 3: Single-session pure fold vs. cross-session pure fold, kept in separate modules

**What:** `metrics.ts` stays a fold over one `{target, charLog, markers, now}` tuple. `analytics.ts` is a *new*, separate fold over `readonly StoredSession[]` (or a lighter read-projection of it). Both are pure — no DOM, no IndexedDB import — but their cardinality differs, so their tests, golden fixtures, and mental model differ too.
**When to use:** Any metric that inherently needs to compare across sessions (digraph/trigraph latency trend, heatmap, per-language profile) belongs in `analytics.ts`. Any metric fully determined by one session's own log (WPM, accuracy, slowest-5, symbol-adjusted WPM) belongs in `metrics.ts`.
**Trade-offs:** Slight duplication of the "group latency samples, filter by (MIN_GAP_MS, MAX_GAP_MS), require MIN_SAMPLES, take median" logic that `metrics.ts`'s `slowestFive`/`median` already implement — extract that as a small shared internal helper (e.g. `metrics/latency-stats.ts`) imported by both, rather than copy-pasting the filter/median logic into `analytics.ts` wholesale.

```typescript
// analytics/analytics.ts (illustrative shape)
export interface DigraphEntry { pair: string; medianMs: number; sampleCount: number }
export interface HeatmapEntry { code: string; medianMs: number; errorRate: number }
export interface LanguageProfile { language: string; sessionCount: number; avgWpm: number; avgAccuracy: number }

export function computeDigraphLatency(sessions: readonly StoredSession[]): DigraphEntry[] { /* ... */ }
export function computeKeyboardHeatmap(sessions: readonly StoredSession[]): HeatmapEntry[] { /* ... */ }
export function computeLanguageProfile(sessions: readonly StoredSession[]): LanguageProfile[] { /* ... */ }
```

## Data Flow

### Write flow (session completion)

```
User finishes typing (D-07 completion trigger, unchanged)
    ↓
CaptureSurface.tsx: computeTrainerState → completedAt transitions null→non-null
    ↓ onComplete(completedAt)   [UNCHANGED CONTRACT — no new params]
App.tsx: handleComplete(completedAt)
    ↓ buildSession() [session.ts, unchanged]     ↓ computeSessionMetrics() [metrics.ts, +symbolAdjustedWpm]
    ↓                                             ↓
    setMetrics(result)  ← existing, unchanged     saveSession(session, result)  ← NEW, fire-and-forget
                                                      ↓
                                            persistence/repository.ts
                                                      ↓
                                            persistence/db.ts (Dexie) → IndexedDB
```

### Read flow (history / analytics views)

```
User switches to "History" or "Analytics" tab (new App.tsx view-switch state)
    ↓
HistoryView.tsx / AnalyticsDashboard.tsx (mount effect)
    ↓ repository.listSessions()
persistence/repository.ts → Dexie query → StoredSession[]
    ↓
HistoryView: render metricsSnapshot fields directly (or recompute via metrics.ts if schemaVersion stale)
AnalyticsDashboard: analytics.computeDigraphLatency/computeKeyboardHeatmap/computeLanguageProfile(sessions)
    ↓
DigraphLatencyView.tsx / KeyboardHeatmap.tsx / LanguageProfileView.tsx (prop-driven, no direct persistence access)
```

### Key Data Flows

1. **Write-once-per-completion:** exactly one new write call, added at the one place a session is already known to be "done" (`App.tsx`'s `handleComplete`). No other file gains write access to `persistence/`.
2. **Read-is-separate-from-write:** `HistoryView`/`AnalyticsDashboard` never touch `capture.ts`, `CaptureSurface.tsx`, or the live trainer state — they are new, independent leaves fed only by `repository.listSessions()`. This keeps the hot path's zero-persistence-awareness property intact, matching the existing isolation of `capture/` from everything else.
3. **Recompute-over-trust for derived values:** any consumer of a stored `metricsSnapshot` (or, later, an analytics cache) must check its schema version and recompute from the co-stored raw fields on mismatch — never assume a cached derived value is current.

## Scaling Considerations

This is a single-user, local-only, browser-storage system — there is no multi-user scale axis. The template's "0-1k / 1k-100k / 100k+ users" framing does not apply; the relevant axis is **sessions accumulated over the author's own daily use** (PROJECT.md's month-long, then indefinite, self-use).

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Dozens of sessions (first weeks) | No adjustment needed — `analytics.ts` recomputing over the full session list on every dashboard mount is effectively free. |
| Hundreds of sessions (~1 year daily use) | Still fine for `HistoryView` (render `metricsSnapshot` directly, no recompute). `analytics.ts`'s full-history fold may start taking single-digit milliseconds to low tens of ms — acceptable for a dashboard mount, not for anything on the hot path (it never runs there). If it becomes noticeable, memoize the analytics result and only re-fold when `listSessions()`'s count/`id` set changes. |
| Thousands of sessions (multi-year) | Add an incrementally-updated aggregate cache (a `analyticsCache` Dexie table keyed by a rolling "last processed session id") so `analytics.ts` folds only over *new* sessions since the last cache write, merging into the previous aggregate — the classic raw-events-plus-incrementally-refreshed-aggregate pattern. Not needed at this project's current or one-year-out scale; documented here so a future contributor doesn't have to rediscover the option. |

### Scaling Priorities

1. **First and only realistic bottleneck:** `analytics.ts` re-folding the entire session history on every dashboard view, once history is large (see above). Fix: memoize + incremental-aggregate cache, only if/when it's actually felt.
2. There is no second bottleneck at this project's scope — no server, no concurrent writers, no network.

## Anti-Patterns

### Anti-Pattern 1: Persisting only derived metrics and discarding the raw log

**What people do:** Store `{date, wpm, accuracy}` per session and throw away the keystroke log to "save space."
**Why it's wrong:** Every analytics feature this milestone asks for (digraph/trigraph latency, heatmap, per-language profile, symbol-adjusted WPM) needs the raw per-keystroke log. Discarding it after computing today's metrics permanently forfeits the ability to compute tomorrow's metrics on today's sessions — directly undermining the "measure improvement over a month" success criterion, since early sessions would have no raw data to re-derive new metrics from.
**Instead:** Persist the raw `Session` fields (`events`, `charLog`, `markers`, `exercise`) as the durable record; treat any computed `MetricsResult`/analytics snapshot as a disposable, recomputable cache.

### Anti-Pattern 2: Awaiting the persistence write inside `handleComplete` before revealing results

**What people do:** `await saveSession(...)` before calling `setMetrics(result)`, so the results panel only appears after the IndexedDB transaction commits.
**Why it's wrong:** Violates the existing, explicitly-locked UX contract (D-05/D-07: results auto-reveal "the instant the exercise completes," no gating) and makes the UI's responsiveness depend on browser storage I/O, which can stall (large writes, other tabs holding a lock, private-browsing quirks).
**Instead:** `setMetrics(result)` synchronously first; fire the persistence write after, unawaited, with its own error handling that degrades to a non-blocking notice.

### Anti-Pattern 3: Letting `analytics.ts` or `metrics.ts` import Dexie/IndexedDB directly

**What people do:** For convenience, have the pure metrics/analytics module call `db.sessions.toArray()` itself instead of receiving data as a parameter.
**Why it's wrong:** Breaks the exact purity contract `metrics.ts` already documents ("PURE — zero DOM access... re-runnable... safe to call repeatedly (no shared mutable module state)"). It also makes `analytics.test.ts`/`metrics.test.ts`-style golden-fixture unit tests impossible without mocking IndexedDB.
**Instead:** `repository.ts` (the platform seam) fetches `StoredSession[]` and passes it as a plain argument into `analytics.ts`'s pure functions — identical shape to how `App.tsx` already passes `charLog`/`markers` into `computeSessionMetrics` today.

### Anti-Pattern 4: Keying the keyboard heatmap by `CommittedChar.data` instead of `KeystrokeEvent.code`

**What people do:** Reuse `metrics.ts`'s existing per-character latency grouping (keyed by the logical committed character) for the heatmap, since it's "already there."
**Why it's wrong:** A physical-keyboard heatmap needs the physical key (`KeyboardEvent.code`, e.g. `"BracketLeft"`), not the logical character it produced (`"["` vs `"{"` are the same physical key with/without Shift; IME-composed characters have no 1:1 physical key at all). Keying by `data` would visually smear Shift-modified pairs onto the wrong physical key or drop IME-produced characters from the heatmap entirely.
**Instead:** Aggregate heatmap samples from `events` (`KeystrokeEvent.code`), matching `metrics.ts`'s existing warning at the top of the file: "Do NOT group by `KeyboardEvent.code`" is scoped specifically to the *slowest-5 by logical character* feature — the heatmap is the inverse case where `code` grouping is exactly correct, and worth calling out explicitly so the two don't get confused.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Dexie 4.x / IndexedDB | `persistence/db.ts` defines the schema via `Version.stores()`; `persistence/repository.ts` is the only consumer | No dependency currently in `package.json` — this milestone adds `dexie` as the project's first runtime dependency beyond `react`/`react-dom`. Confirmed via `package.json` read: today's `dependencies` are `react`+`react-dom` only. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `CaptureSurface.tsx` ↔ `App.tsx` | `onComplete(completedAt)` callback — **contract unchanged** | Persistence must not add a new parameter or a new callback here; keep the hot-path component ignorant of persistence entirely. |
| `App.tsx` ↔ `persistence/repository.ts` | Direct function call, fire-and-forget on write; awaited on read (mount effect) | Write path never blocks `setMetrics`; read path is only exercised by the new `HistoryView`/`AnalyticsDashboard` views, never by the practice flow. |
| `metrics/metrics.ts` ↔ `analytics/analytics.ts` | Both may import a shared `metrics/latency-stats.ts` helper (median + gap-window filter) | Avoid `analytics.ts` importing `metrics.ts` wholesale or vice versa — keep the single-session/cross-session split clean; share only the small numeric helper, not the top-level fold functions. |
| `persistence/repository.ts` ↔ `analytics.ts` / `metrics.ts` | Plain data in, plain data out (`StoredSession[]` / `MetricsResult`) | No pure module ever imports `persistence/db.ts` or Dexie directly (Anti-Pattern 3). |

## Build Order (phased roadmap)

Dependencies flow strictly downward — persistence must exist before anything cross-session can be built, and symbol-adjusted WPM (single-session) has no persistence dependency at all beyond what Phase 1 already stores.

1. **Phase: Persistence foundation.**
   Add `dexie` dependency. Build `persistence/db.ts` + `persistence/repository.ts` (schema v1: one `sessions` table storing the full `StoredSession` shape from the Data Model section). Wire the single write call into `App.tsx`'s `handleComplete`. Build `HistoryView.tsx` (date/wpm/accuracy list, read-only, rendering `metricsSnapshot` directly). This alone satisfies "persistir cada sesión localmente" and gives the first cross-session signal (a WPM-over-time list) without any new pure-analytics code.
   *Blocks everything below — all cross-session analytics reads from this table.*

2. **Phase: Symbol-adjusted WPM.**
   `metrics/symbol-density.ts` (new pure classifier) + `metrics.ts` extension (`symbolAdjustedWpm`, `METRICS_SCHEMA_VERSION` → 2) + `ResultsView.tsx` display update. No new persistence needed — `exercise.text`/`charLog` are already stored from Phase 1. Confirms the recompute-on-schema-mismatch path works end-to-end on real historical data before building anything more complex on top of it.

3. **Phase: Digraph/trigraph latency.**
   `analytics/analytics.ts` (`computeDigraphLatency`, generalizing `metrics.ts`'s existing single-character gap/filter/median logic to 2-/3-character windows — extract the shared filter+median helper first). `DigraphLatencyView.tsx`. Depends on Phase 1's stored `charLog` per session.

4. **Phase: Keyboard heatmap.**
   `analytics/keyboard-geometry.ts` (static US-ANSI layout table) + `analytics.ts`'s `computeKeyboardHeatmap` (keyed by `events`' `code`, per Anti-Pattern 4) + `KeyboardHeatmap.tsx`. Depends on Phase 1's stored `events` per session (not `charLog` — a distinct raw field, worth confirming it was in fact persisted in Phase 1 and not trimmed for space).

5. **Phase: Per-language profile.**
   `analytics.ts`'s `computeLanguageProfile` (groups already-computed per-session metrics by `exercise.language`) + `LanguageProfileView.tsx`. The lightest of the four analytics features — pure grouping/averaging over data every prior phase already produces — reasonable to sequence last or to fold into the same phase as digraph/heatmap if time-boxing favors one bigger analytics phase over three small ones.

**Suggested phase-merge note for the roadmap author:** phases 3–5 all read the exact same `StoredSession[]` and live in the same `analytics.ts` module; if the milestone favors fewer, larger phases over more, smaller ones, phases 3–5 can be combined into a single "Cross-session analytics" phase without changing any dependency — they only *must* come after Phase 1 (persistence) and are independent of each other and of Phase 2 (symbol-adjusted WPM).

## Sources

- Direct source read (HIGH confidence, first-party): `src/session.ts`, `src/metrics/metrics.ts`, `src/capture/types.ts`, `src/ui/App.tsx`, `src/ui/CaptureSurface.tsx`, `src/ui/ResultsView.tsx`, `src/ingestion/types.ts`, `src/ingestion/language-map.ts`, `src/platform/layout.ts`, `src/trainer/active-time.ts`, `package.json` — all read in full during this research pass.
- [Version.stores() — Dexie.js Documentation](https://dexie.org/docs/Version/Version.stores()) — schema/versioning API shape — MEDIUM
- [Schema and Versioning | dexie/dexie-website | DeepWiki](https://deepwiki.com/dexie/dexie-website/2.3-schema-and-versioning) — multi-version upgrade-function pattern — MEDIUM
- [Optimizing database schema design — Mastering Dexie.js](https://app.studyraid.com/en/read/11356/355143/optimizing-database-schema-design) — avoid indexing large blobs, balance normalization — MEDIUM
- [IndexedDB The Definitive Deep-Dive Guide for Modern Web Applications](https://spaceout.pl/indexeddb-the-definitive-deep-dive-guide-for-modern-web-applications/) — raw-event-log-for-audit + fast-query use cases — MEDIUM
- General web synthesis on raw-events-vs-precomputed-aggregates / incremental-refresh pattern (search aggregation, no single authoritative source) — MEDIUM

---
*Architecture research for: keebdrill v1.1 (persistence + analytics milestone)*
*Researched: 2026-09-05*
