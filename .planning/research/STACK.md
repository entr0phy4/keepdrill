# Stack Research

**Domain:** Local persistence + code-typing analytics (digraph/trigraph latency, keyboard heatmap, per-language profile, symbol-adjusted WPM) for a zero-backend Vite+React+TS SPA
**Researched:** 2026-09-05
**Confidence:** MEDIUM-HIGH

## Context: what v1.0 already has (do not re-add)

keebdrill v1.0 is a Vite 8.2 / React 19.2 / TypeScript 5.9-strict SPA with **zero
runtime dependencies beyond `react`/`react-dom`**. It already has a pure, tested
metrics engine (`src/metrics/metrics.ts`) computing net WPM, accuracy, and
five-slowest-keystrokes from a `KeystrokeEvent[]` log, plus an established
project convention (from prior-phase research, cached) of **discard-outlier
then take the median** for per-key latency aggregation — matching keybr.com's
approach. v1.1 only adds: (1) durable storage of sessions, and (2) four new
*read* analytics computed from data that already exists in the log/session
shape. This materially narrows what needs new dependencies.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Dexie | 4.4.5 (verified via npm registry direct fetch, 2026-09-05) | IndexedDB wrapper — session + keystroke-log persistence, schema versioning | Raw `indexedDB` is a low-level, callback/event-based API with painful cursor/transaction/upgrade-path boilerplate and well-documented cross-browser quirks. Dexie is the de-facto standard wrapper (1000+ npm dependents, actively maintained, used by 100k+ sites per its own docs), gives a typed, Promise-based query API, and — critically for this milestone — a clean `db.version(n).stores({...})` migration path for when the session schema changes in v1.2+. This is the one deliberate exception to the zero-runtime-deps posture; hand-rolling schema migrations on raw IndexedDB is a real source of bugs this project doesn't need to accept. |
| dexie-react-hooks | 4.4.0 (verified via npm registry) | `useLiveQuery()` — reactive binding of IndexedDB queries to React components | Small (a few KB), official Dexie sub-package, single hook. Without it you'd hand-roll `useEffect` + manual re-fetch-on-write for the session-history view, which is exactly the kind of "component re-renders when the DB changes" wiring a maintained hook exists to eliminate. Optional but recommended — the history-list view genuinely benefits from live updates when a new session is saved mid-navigation. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| *(none — hand-rolled)* Digraph/trigraph latency module | — | Extend `src/metrics/metrics.ts` (or a sibling `src/metrics/digraphs.ts`) with pure functions: group consecutive keydown pairs/triples by `(codeA, codeB[, codeC])`, apply the existing outlier-discard-then-median convention, aggregate across sessions from persisted logs | Always for this milestone. This is ~80-120 lines of pure TS reusing the exact pattern already validated in `metrics.ts`. No library computes "median latency per ordered key-pair, aggregated across N typing sessions" — it's domain-specific enough that a stats library would only save you the median calculation itself, which is a 5-line function. |
| *(none — hand-rolled)* Keyboard heatmap layout + color scale | — | A static US-ANSI key-position table (`KeyboardEvent.code` → `{row, col, width}`, ~90 entries, authored once as a constant) rendered as a CSS grid or inline SVG, with a small hand-written linear color interpolation (2–3 color stops, e.g. cool→warm) driven by per-key median latency | Always for this milestone. See "Alternatives Considered" below — every heatmap library found targets continuous x/y density (mouse/gaze tracking), not a fixed discrete key set, and the existing project constraint is US ANSI only (no layout-switching requirement to justify a layout-abstraction library). |
| *(none — hand-rolled)* Per-language profile | — | `groupBy(session.language)` over persisted sessions, reuse `metrics.ts` aggregation per group | Always. Trivial `reduce`/`Map` grouping; the language tag already exists from `src/ingestion/language-map.ts`. No library need. |
| *(none — hand-rolled)* Symbol-density-adjusted WPM | — | A pure classifier function (`isSymbolChar(char): boolean` via a small fixed regex/set of non-alphanumeric, non-whitespace code points) plus a weighted variant of the existing WPM formula | Always. This is the project's core differentiator and its exact weighting is a product decision (e.g. "symbol chars count as 1.5 words" or similar), not something an npm package defines for you — keep it in-house and unit-test it like the rest of `metrics.ts`. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `navigator.storage.persist()` + `navigator.storage.estimate()` (browser built-ins, no package) | Request durable (non-evictable) storage for the IndexedDB origin; report usage vs. quota | Not a library — call these from a small `src/platform/storage.ts` seam (matches the existing platform-seam pattern). Relevant because keebdrill is the *sole* copy of the user's session history (no server to resync from); Safari in particular evicts best-effort storage after ~7 days without user interaction. Call `persist()` once, lazily, e.g. after the first completed session is saved, and surface `estimate()` in a settings/debug view later if quota ever becomes visible to the user. |
| Vitest (existing) + `fake-indexeddb` | Unit-test the Dexie persistence layer without a real browser | `fake-indexeddb` (npm, MIT, actively maintained, the standard IndexedDB shim for Node-based test runners) is the one new **dev**-dependency this milestone needs. Without it, Vitest's Node environment has no `indexedDB` global at all and the persistence layer is untestable in CI; with it, Dexie runs against an in-memory shim transparently. Install as `-D`, import once in a Vitest setup file (`import "fake-indexeddb/auto"`). |

## Installation

```bash
# Core — persistence
pnpm add dexie dexie-react-hooks

# Dev dependencies — testing the persistence layer
pnpm add -D fake-indexeddb
```

No other packages are needed. Digraph/trigraph computation, the keyboard
heatmap, per-language grouping, and symbol-adjusted WPM are all pure TypeScript
extensions of the existing `src/metrics/` module — zero new runtime deps for
any of them.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Dexie 4.x | `idb` (Jake Archibald's minimal Promise wrapper) | If you truly want the thinnest possible wrapper and are willing to hand-roll your own schema-versioning helper and query sugar. `idb` is smaller but Dexie's `useLiveQuery` + typed-table + migration ergonomics are worth the extra ~25 KB for a project that will keep adding session-shaped data over several milestones. |
| Dexie 4.x | `localForage` | If you only ever need a flat key-value store (no compound queries, no indexes, no schema versioning). keebdrill needs to query sessions by date range and aggregate keystroke logs by digraph — that's relational-ish querying Dexie is built for and `localForage` is not. |
| Hand-rolled static keyboard layout + CSS grid | `react-simple-keyboard` (3.8.x) | Only if the product later needs an *interactive* on-screen keyboard (e.g. clicking a key to drill it, or supporting multiple physical layouts via `simple-keyboard-layouts`). Today it's a read-only heatmap over a fixed US-ANSI layout — pulling in a full virtual-keyboard-with-its-own-input-handling library for a static color overlay is the wrong shape of tool and adds real bundle weight for functionality (keyboard-in-keyboard event handling) you'd immediately disable. |
| Hand-rolled linear color interpolation | `d3-scale` + `d3-interpolate` + `d3-scale-chromatic` | Only if the heatmap grows a legend, multiple palettes, or non-linear (log/quantile) color scales the product wants to expose as a setting. For "map median-ms-latency-per-key onto a 3-stop gradient," that's a ~10-line function; importing three d3 sub-packages for it is disproportionate. Revisit if analytics visualization expands to line/trend charts later (out of scope for v1.1 per PROJECT.md). |
| `fake-indexeddb` for tests | Playwright-based E2E for persistence | E2E (already used for capture regression per v1.0's stack notes) is still valuable to *smoke-test* real-browser IndexedDB behavior, but is too slow/heavy to be the primary test loop for schema-migration and query-logic unit tests. Use `fake-indexeddb` + Vitest for the fast inner loop, keep Playwright for one end-to-end "save session, reload, see it in history" smoke test. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Raw `indexedDB` API by hand for this milestone | Callback/event-based, verbose transaction/cursor boilerplate, easy to get upgrade-path (`onupgradeneeded`) subtly wrong, no TypeScript ergonomics | Dexie 4.x |
| `localStorage` for session logs | 5-10 MB origin quota (varies by browser), synchronous API blocks the main thread, string-only values force manual JSON (de)serialization of potentially thousands of keystroke events per session | IndexedDB via Dexie — async, structured-clone storage, much larger practical quota (percentage of free disk) |
| `heatmap.js` (patrick-wied) or similar continuous-density heatmap libraries | Built for x/y point-cloud density (mouse tracking, gaze tracking) with Gaussian-blur radius rendering; a physical keyboard is a small *fixed, discrete* set of ~90 keys, not a continuous field — you'd be faking point coordinates and blur radii to simulate discrete cells the library isn't designed for | A static authored key-position table + CSS grid/SVG with direct per-key color assignment |
| `react-simple-keyboard` for a *read-only* heatmap | It's an interactive virtual keyboard component (its own click/press handling, layout-switching state); using it purely to display colors fights its actual purpose and adds an unused input-handling surface + extra bundle weight | Hand-rolled static SVG/CSS grid (see above) |
| Adding `d3-array` (or any part of d3) for the median/quantile calculation | The project already has a working, tested outlier-discard-then-median convention in the codebase; d3-array's `median`/`quantile` would only replace a 5-line function you already trust and test | Keep the existing hand-rolled median helper; extend it to the digraph/trigraph grouping case |
| Redux / any global state library for the new analytics views | Session history + analytics are fundamentally "query IndexedDB, render result" — `useLiveQuery` + local component state covers it; there is still no more than a handful of pieces of cross-cutting UI state | React state/refs (existing pattern) + `useLiveQuery` where a view needs to react to DB writes |
| Skipping `navigator.storage.persist()` entirely | Silent data loss risk: Safari's best-effort eviction after ~7 days of no interaction with the origin would delete a user's entire typing history with no warning, directly undermining the "measure improvement over a month" success criterion in PROJECT.md | Call `persist()` (fire-and-forget, ignore rejection — it's a best-effort permission request, not a guarantee even when granted) after first session save |

## Stack Patterns by Variant

**If the digraph/trigraph table needs to show trends over many sessions (later milestone, currently out of scope):**
- Only then consider a lightweight charting library (e.g. a minimal `uPlot` for dense time series) — PROJECT.md explicitly defers "rich evolution charts" to a later phase, so do not add charting now.
- Because adding a charting dependency for a feature explicitly out of scope this milestone violates the "only add what's needed now" posture that has kept this project at zero runtime deps through v1.0.

**If session volume grows large enough that IndexedDB read/aggregate latency becomes visible (unlikely at single-user daily-use scale):**
- Consider storing pre-aggregated per-digraph running statistics (count, sum, sum-of-squares or a running median sketch) incrementally on session save, rather than re-scanning all raw keystroke logs on every analytics view render.
- Because re-computing digraph medians over months of raw per-keystroke logs on every page view is the kind of thing that's fine at 100 sessions and sluggish at 5,000 — but do not build this pre-aggregation until profiling shows it's needed; premature for v1.1.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| dexie@4.4.5 | dexie-react-hooks@4.4.0 | Both are published from the same Dexie.js monorepo and kept in lockstep on the 4.4.x line; install both at the same minor version. |
| dexie@4.x | TypeScript 5.9 strict, `noUncheckedIndexedAccess` | Dexie 4's typed-table generics work under strict mode; define an explicit `interface StoredSession { id?: number; ... }` per table rather than relying on inference, matching this project's existing preference for explicit types in `metrics.ts`. |
| dexie@4.x | Vite 8.2.x | Dexie ships ESM + CJS builds and needs no special Vite config; no polyfills required in evergreen-browser targets. |
| `fake-indexeddb@6.x` (current major as of this research) | Vitest 3/4 | Import `fake-indexeddb/auto` in a Vitest `setupFiles` entry so `indexedDB` exists as a global before Dexie modules load; no plugin needed. |
| React 19.2.x | `dexie-react-hooks`'s `useLiveQuery` | Built on `useSyncExternalStore` internally (per Dexie's own docs on the hook's implementation approach), which is exactly the primitive this project already leans on per its own stack notes for imperative/external-store patterns — no friction with React 19's concurrent rendering. |

## Sources

- https://www.npmjs.com/package/dexie — version 4.4.5 confirmed via direct `registry.npmjs.org/dexie/latest` fetch, 2026-09-05 — HIGH (first-party registry, cross-checked with websearch summary)
- https://www.npmjs.com/package/dexie-react-hooks — version 4.4.0 confirmed via direct registry fetch — HIGH
- https://dexie.org/docs/dexie-react-hooks/useLiveQuery() — hook behavior/usage — MEDIUM (official docs, not independently re-verified line-by-line)
- https://dexie.org/docs/StorageManager — Dexie's own guidance on `navigator.storage.persist()`/`estimate()` — MEDIUM
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria — eviction policy, best-effort vs. persistent storage — MEDIUM (MDN, cross-checked against WebKit blog)
- https://webkit.org/blog/14403/updates-to-storage-policy/ — Safari's ~7-day no-interaction eviction policy — MEDIUM
- https://www.npmjs.com/package/react-simple-keyboard — confirms this is an interactive virtual-keyboard input widget, not a heatmap renderer — MEDIUM
- https://www.patrick-wied.at/projects/heatmap-keyboard/ + related GitHub repos (`werifu/keyboard-heatmap`, `gutohertzog/keyboard-heatmap`, `pa7/Keyboard-Heatmap`) — confirms existing keyboard-heatmap prior art is built on `heatmap.js` (continuous x/y density), not discrete per-key coloring — LOW-MEDIUM (multiple independent small projects agree on the same underlying approach, but none is an authoritative/canonical source)
- Keystroke-dynamics literature (ResearchGate: "A Long-Term Trial of Keystroke Profiling Using Digraph, Trigraph and Keyword Latencies"; arXiv keystroke-dynamics survey) — digraph/trigraph latency definitions (key-up-to-key-down interval) — MEDIUM (academic sources, definitions cross-checked across multiple papers)
- Prior-phase cached research (`.planning/research/.cache/5915bb51...json`, this repo, fetched 2026-09-05) — established project convention of outlier-discard-then-median matching keybr.com's per-key latency approach — MEDIUM (already vetted for this codebase in an earlier milestone)

---
*Stack research for: keebdrill v1.1 — local persistence + code-typing analytics*
*Researched: 2026-09-05*
