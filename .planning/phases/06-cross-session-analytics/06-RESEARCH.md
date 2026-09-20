# Phase 6: Cross-Session Analytics - Research

**Researched:** 2026-09-20
**Domain:** Pure cross-session analytics (digraph latency, physical-key heatmap, per-language profile) over persisted Dexie session history in an existing Vite/React/TS SPA
**Confidence:** HIGH (locked decisions + live source of `metrics.ts`, `App.tsx`, `HistoryView.tsx`, `repository.ts`, `StoredSession`; stack is zero-new-deps)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Analytics Placement**
- **D-01:** Analytics is a **third header item** ("Analytics") — a sibling view to Trainer and History. `App.tsx`'s `view` union becomes `'trainer' | 'history' | 'analytics'`. History stays a dedicated list (PERS-02). Chosen over tabs-inside-History and over four sibling header items so the header stays three buttons and History stays a session list. Same hide-not-unmount contract as History (Phase 4 D-08): switching to Analytics hides the trainer subtree, it does not unmount it.
- **D-02:** The Analytics page is **one stacked dashboard** — three sections in this order: **digraph ranking → keyboard heatmap → per-language profile**. Matches ARCHITECTURE.md's `AnalyticsDashboard` + leaf subviews (`DigraphLatencyView`, `KeyboardHeatmap`, `LanguageProfileView`).
- **D-03:** **Scroll only** — no in-page jump links / section index. The page is three blocks; an extra TOC is noise on a 3-item header.
- **D-04:** If `listNewestFirst` returns **zero sessions**, Analytics renders a **single page-level empty state** (same spirit as HistoryView's "No sessions yet…") and **does not mount the three sections**. Per-section empty states exist only when there *are* sessions but a given section has nothing that clears its own gate (e.g. no digraph has 5 samples yet).

**Digraph Ranking + Sample Gate**
- **D-05:** Ranked table of the **top 10 slowest digraphs** (2-character sequences) accumulated across all persisted sessions. Cap at 10 after gating and sorting by median latency descending — more diagnostic than the per-session slowest-5, without dumping every pair that clears the gate.
- **D-06:** A digraph is eligible only with **≥ 5 samples remaining POST-filter**, using the same exclusive `(25ms, 1000ms)` gap window as `metrics.ts::slowestFive`. This is deliberately higher than single-char `MIN_SAMPLES = 3` (STATE.md / PITFALLS.md Pitfall 3). Constant lives as a named export (e.g. `DIGRAPH_MIN_SAMPLES`) so it is a one-line tune.
- **D-07:** Pairs below the gate are **omitted**, not greyed out. If zero pairs clear the gate, the digraph **section** shows its own empty copy ("not enough digraph samples yet" or similar) — the heatmap and language profile still render.
- **D-08:** Each ranking row shows **digraph + median ms + sample count n**. The `n` makes the gate visible so the ranking does not look more confident than it is. Round ms only at the display layer (same rule as ResultsView / HistoryRow).
- **D-09:** Digraph construction reuses the existing consecutive-record gap logic in `metrics.ts` (`replayAttempts` / `slowestFive`), generalized from 1-char to a 2-char window over `charLog` — logical committed characters, not `KeyboardEvent.code`. Factor the shared filter/gate/median helper out of `slowestFive` rather than copy-pasting constants (PITFALLS.md Pitfall 3, ARCHITECTURE.md shared `latency-stats.ts` recommendation).

**Heatmap Visual Language**
- **D-10:** Heatmap is a **static US-ANSI QWERTY diagram** (div-grid / geometry table), never a list. New UI — nothing in `src/ui` is a keyboard layout. Geometry lives in `src/analytics/keyboard-geometry.ts` (pure `code → {row, col}`), **not** a reuse of `platform/layout.ts` (that file is only the runtime layout-mismatch warning).
- **D-11:** Color is driven by **median latency per physical key** (`KeystrokeEvent.code` from persisted `events`), **not** frequency and **not** `CommittedChar.data`. This is the inverse of `slowestFive`'s D-03 ("do NOT group by `KeyboardEvent.code`") — both aggregations read the same session, different axis (ARCHITECTURE.md Anti-Pattern 4).
- **D-12:** Each sampled key shows **color + the numeric median ms on the key** — not color-only, not tooltip-only. PITFALLS.md requires non-color redundancy; matches the visible `n` on the digraph table.
- **D-13:** Keys with fewer than **5 post-filter samples** (same constant as D-06) — or zero samples — stay on the diagram with a **neutral fill and no number**. Do not hide keys (the US-ANSI shape must stay recognizable) and do not invent a "fast" color for unused keys.
- **D-14:** Color scale is **relative** to the min/max median of keys that *do* clear the 5-sample gate in the current history. A fixed ms band would look flat with few sessions. Palette / contrast (including light/dark) is Claude's discretion subject to a UI-SPEC pass (`UI hint: yes` in ROADMAP.md); must not be color-only (D-12 already supplies the number).
- **D-15:** Heatmap is **post-hoc over persisted sessions**, never live during capture (FEATURES.md anti-feature; must not share a render cycle with the hot path).

**Per-Language Profile**
- **D-16:** A **table**, one row per language tag that has ≥ 1 persisted session. Same scan metaphor as the digraph ranking; no card grid.
- **D-17:** Columns: **language + net WPM + symbol-adjusted WPM + accuracy + session count n**. Adj. WPM is the same companion metric already shown in ResultsView / HistoryRow (Phase 5 D-08) — never a replacement. `n` prevents "I'm slow at Rust" from one session looking like a profile.
- **D-18:** Rows sorted by **session count descending**. `plaintext` is not hidden and not specially promoted — it lands wherever its `n` puts it.
- **D-19:** **No session-count gate** — any tag with ≥ 1 session is a row. ANLY-05 does not require a session threshold; hiding a real upload tag (e.g. one `rust` file) is worse than showing `n=1`. The keystroke-level gate (D-06) does **not** apply here.
- **D-20:** `plaintext` / untagged sessions are a **distinct bucket**, never folded into a real language. The tag string is the existing `exercise.language` value (`'plaintext'` from the Phase 5 picker default or from unknown extensions). Display the tag the same way HistoryRow already does (`key-chip` with the raw language string). Do **not** add `languageSource` in this phase (PITFALLS.md optional field) — Phase 5 already closed the paste-plaintext gap; confidence metadata is out of scope.

**Carried Forward (do not relitigate)**
- `analytics.ts` is a **new top-level pure module** (`src/analytics/`), sibling to `metrics/`. It folds over `readonly Session[]` / a read projection of `StoredSession[]`. Zero DOM, zero Dexie import. Repository fetches; analytics receives plain data (Phase 4 D-03, ARCHITECTURE.md Anti-Pattern 3).
- Cross-session aggregation **recomputes from raw `charLog` / `events` / `exercise`**, gating on `schemaVersion` and never blending stale cached `MetricsResult` numbers into aggregates (Phase 4 D-02/D-05, PITFALLS.md Pitfall 1). Language-profile WPM/accuracy should go through `resolveMetrics` (or equivalent) so Phase 5's schema bump to 2 applies retroactively.
- Two clock domains stay separate: `startedAt` (`Date.now()`) is display/sort only; latency samples stay in the `event.timeStamp` / `tMs` domain (PITFALLS.md Pitfall 2).
- Trainer hide-not-unmount (Phase 4 D-08) applies to the Analytics view flip the same way it applies to History.
- History rows stay inert (Phase 4 D-13) — this phase does not add per-session drill-down.
- US ANSI only (PROJECT.md); no new keyboard-layout support.
- Full-history re-fold on dashboard mount is acceptable at current scale; incremental aggregate cache is a later optimization, not this phase (ARCHITECTURE.md scalability notes).

### Claude's Discretion
- Exact empty-state copy (page-level and per-section).
- Heatmap color palette and adjacent-step contrast (subject to UI-SPEC).
- Which US-ANSI keys are drawn (alphanumeric + punctuation vs including modifiers / function row) — geometry table contents, as long as D-10/D-13 hold (recognizable static US-ANSI shape, unused keys present and neutral).
- How a digraph glyph is rendered when it contains whitespace (reuse `glyphFor` or equivalent).
- How per-language WPM/accuracy are aggregated across sessions (mean of per-session `resolveMetrics` values is the obvious default; document the choice in the plan).
- Internal signatures of `computeDigraphLatency` / `computeKeyboardHeatmap` / `computeLanguageProfile` and whether heatmap aggregation lives in `analytics.ts` vs `heatmap.ts`.
- Whether `CorpusInput` stays visible on the Analytics view (it currently stays visible on History — match that unless UI-SPEC says otherwise).
- Test strategy depth beyond the mandatory gate/filter/median golden cases PITFALLS.md requires.

### Deferred Ideas (OUT OF SCOPE)
- **Trigraph latency** — `ANLY-06`, Future Requirements. Needs more accumulated volume than digraphs; do not ship a 3-char ranking in this phase.
- **Per-session drill-down** — `ANLY-07`. History rows stay inert (Phase 4 D-13).
- **Filter heatmap / digraph table by language** — `ANLY-08`. Both features ship unfiltered first.
- **Trend / evolution charts** — PROJECT.md Out of Scope for v1.1.
- **Live heatmap while typing** — FEATURES.md anti-feature (hot-path jitter).
- **Incremental analytics cache / extra Dexie stores** — documented in ARCHITECTURE.md as a later optimization once history is huge; full re-fold on mount is the v1.1 approach.
- **`languageSource` confidence field** — PITFALLS.md suggestion; not needed now that Phase 5 tags paste explicitly.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ANLY-03 | Ranked table of slowest digraphs (2-character sequences) accumulated across persisted sessions, with a minimum-sample gate so sparse/noisy pairs aren't shown as confident results | Extract `latency-stats.ts` from `slowestFive`; `computeDigraphLatency` pools `charLog` gaps across sessions; exclusive `(25ms, 1000ms)` window; `DIGRAPH_MIN_SAMPLES = 5` POST-filter; omit (don't grey) pairs below gate; cap 10; row = pair + median ms + n (§Pattern 1, §Code Examples) |
| ANLY-04 | Keyboard heatmap of which physical keys are slowest, based on median latency accumulated across persisted sessions | Static US-ANSI geometry in `keyboard-geometry.ts` keyed by W3C `KeyboardEvent.code`; `computeKeyboardHeatmap` pools non-repeat keydown→keydown IKI from `events`; same 5-sample gate; relative sequential palette + on-key ms (D-10..D-15, §Pattern 2) |
| ANLY-05 | Per-language profile — WPM and accuracy grouped by tagged language — with untagged/plaintext as its own distinct bucket rather than mixed into a real language | `computeLanguageProfile` groups by `exercise.language` string as-is (`plaintext` is a normal row); unweighted mean of `resolveMetrics()` WPM / adj. WPM / accuracy; sort by session count desc; no keystroke-level gate (D-16..D-20, §Pattern 3) |
</phase_requirements>

## Summary

Phase 6 is a **read-only analytics leaf** over data Phase 4 already persists and Phase 5 already tags. No new runtime packages, no Dexie schema bump, no hot-path changes. The planner's job is to (1) extract the existing filter → gate → median helper out of the private `slowestFive` so digraphs and the heatmap cannot drift from single-char constants, (2) add a pure `src/analytics/` fold over a `StoredSession[]` projection, (3) extend `App.tsx`'s view union with a third hide-not-unmount sibling, and (4) render one stacked dashboard of three prop-driven sections.

The three compute functions are independent of each other and share only the latency helper plus the same `listNewestFirst` input. Digraphs read `charLog` (logical codepoints). The heatmap reads `events[].code` (physical keys) — ARCHITECTURE.md Anti-Pattern 4 is the load-bearing distinction. Language profile reads `exercise.language` plus `resolveMetrics` so schema-v1 snapshots recompute under `METRICS_SCHEMA_VERSION = 2`.

**Primary recommendation:** Zero new npm packages. Extract `src/metrics/latency-stats.ts` and `src/metrics/resolve-metrics.ts`. Add `src/analytics/{types.ts,analytics.ts,heatmap.ts,keyboard-geometry.ts}` as a pure fold. Wire `AnalyticsDashboard` through the existing `useLiveQuery(listNewestFirst)` path. Hand-roll a staggered CSS-grid US-ANSI alphanumeric block; sequential amber heatmap tokens (new, UI-SPEC-owned) plus on-key milliseconds. Do not add Recharts, heatmap.js, react-simple-keyboard, or d3-scale.

## Architectural Responsibility Map

keebdrill is a single-tier local-first browser SPA. The meaningful boundary is the existing **hot-path / pure-core / platform-seam / UI** split, not client/server tiers.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cross-session digraph ranking | Pure-core (`src/analytics/` + `src/metrics/latency-stats.ts`) | UI leaf (`DigraphLatencyView`) | Fold over `charLog`; zero DOM, zero Dexie. UI only rounds and glyphs. |
| Physical-key heatmap aggregation | Pure-core (`src/analytics/heatmap.ts`) | UI leaf (`KeyboardHeatmap`) | Fold over `events[].code`. Geometry is pure data; color interpolation can live in the leaf so the fold stays numeric. |
| US-ANSI key positions | Pure-core (`src/analytics/keyboard-geometry.ts`) | — | Static `code → {row, col, span, label, sampleable}`. Not `platform/layout.ts`. |
| Per-language WPM/accuracy profile | Pure-core (`src/analytics/analytics.ts`) | UI leaf (`LanguageProfileView`) | Group/average already-resolved session metrics. Recompute via `resolveMetrics`, never raw `metricsSnapshot` when stale. |
| Fetch persisted sessions | Platform seam (`persistence/repository.ts`) | UI (`useLiveQuery`) | Same querier as History. Analytics never imports `db.ts` / Dexie. |
| View switch + hide-not-unmount | Browser / Client (`App.tsx`) | — | Extend `view` union; trainer wrapper `display: grid \| none`. |
| Heatmap color tokens / contrast | UI (`src/index.css` + UI-SPEC) | — | New `--heatmap-*` tokens; not accent/destructive score colors. |
| Hot-path capture | **Untouched** (`capture/`, `CaptureSurface`) | — | D-15: heatmap is post-hoc. No new import into the hot path. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| *(none new)* — existing React 19.2.x | `^19.2.8` `[VERIFIED: package.json]` | Dashboard + leaf views | Same prop-driven, `role="status"` convention as `HistoryView` / `ResultsView`. |
| *(none new)* — existing Dexie 4.4.4 | `4.4.4` `[VERIFIED: package.json]` | Read path only | `listNewestFirst` already returns the raw logs analytics needs. **No schema bump.** |
| *(none new)* — existing `dexie-react-hooks` | `4.4.0` `[VERIFIED: package.json]` | `useLiveQuery(listNewestFirst)` | History already uses this; dashboard reuses the identical query. |
| Hand-rolled `src/analytics/` | — | Digraph / heatmap / language folds | STACK.md: no library computes "median latency per ordered pair, pooled across N typing sessions." ~80–120 lines of pure TS. `[CITED: .planning/research/STACK.md]` |
| Hand-rolled US-ANSI geometry + CSS grid | — | Heatmap diagram | STACK.md / FEATURES.md: heatmap.js and `react-simple-keyboard` are the wrong shape of tool (continuous density / interactive virtual keyboard). `[CITED: .planning/research/STACK.md]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing Vitest ~4.1.11 + happy-dom | `[VERIFIED: package.json]` | Unit + UI tests | `src/analytics/*.test.ts` lands in the existing `unit` project automatically (`src/**/*.test.ts` minus capture/persistence). Dashboard tests go in `src/ui/*.test.tsx` (ui + fake-indexeddb). |
| Existing `fake-indexeddb` 6.2.5 | `[VERIFIED: package.json]` | IndexedDB shim for UI tests | Only if the dashboard test mounts `useLiveQuery`. Pure analytics tests take fixture arrays — no IndexedDB. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled CSS-grid keyboard | `react-simple-keyboard` | Interactive input widget with its own event handling. Fought as a read-only overlay; extra bundle; COEP-hostile if it pulls assets. **Rejected** (STACK.md). |
| Hand-rolled sequential color lerp | `d3-scale` + `d3-interpolate` | Disproportionate for a 2–3 stop relative scale. Revisit only if charts ship (out of scope). **Rejected**. |
| Div-grid heatmap | `heatmap.js` / Patrick Wied keyboard heatmap | Continuous x/y Gaussian density, not a discrete 60-key set. **Rejected** (STACK.md / FEATURES.md). |
| Tables only | Recharts / uPlot | Charts are PROJECT.md Out of Scope and FEATURES.md anti-feature for this milestone. **Rejected**. |
| Pooled-sample median | Median-of-per-session-medians | Equal-weights sessions instead of keystrokes; a pair typed 50 times in one session would lose to a 5-sample fluke in another. Pooling matches `slowestFive`. **Rejected** for digraphs/heatmap. Language WPM *does* use per-session mean (different quantity). |

**Installation:**

```bash
# none — no new packages this phase
```

**Version verification:** `package.json` read this session (2026-09-20). Dexie 4.4.4 / dexie-react-hooks 4.4.0 / React 19.2.8 / Vitest ~4.1.11 already installed. No `npm view` required because nothing is added.

## Package Legitimacy Audit

> No external packages are installed this phase.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | No new installs |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
User clicks header "Analytics"
        │
        ▼
App.tsx  view = 'analytics'
  ├── trainer wrapper  display:none   (NOT unmounted — Phase 4 D-08)
  ├── CorpusInput      still mounted  (match History)
  └── AnalyticsDashboard
           │
           │ useLiveQuery(listNewestFirst)     ← same querier as HistoryView
           │ never imports persistence/db or dexie
           ▼
     sessions: undefined | [] | StoredSession[]
           │
           ├── undefined → page "Loading analytics…"  (do not mount sections)
           ├── []        → page empty state           (do not mount sections)
           └── length>0  → three stacked sections, always in this order:
                  │
                  ├─1─ computeDigraphLatency(sessions)
                  │      charLog → consecutive-insert codepoint pairs
                  │      filter (25,1000) → gate n≥5 → median → sort desc → cap 10
                  │         ├── rows.length===0 → DigraphLatencyView empty copy
                  │         └── else            → table (glyph + ms + n)
                  │
                  ├─2─ computeKeyboardHeatmap(sessions) + US_ANSI_GEOMETRY
                  │      events, type==='keydown', !isRepeat, sampleable codes
                  │      IKI = this.tMs − prevSampleableKeydown.tMs
                  │      same filter/gate/median; unused keys stay, neutral, no number
                  │         └── KeyboardHeatmap always mounts the diagram
                  │
                  └─3─ computeLanguageProfile(sessions via resolveMetrics)
                         group by exercise.language (plaintext is a normal key)
                         unweighted mean(wpm, symbolAdjustedWpm, accuracy), n=count
                         sort by n descending
                            └── LanguageProfileView always has ≥1 row if sessions exist
```

### Recommended Project Structure

```
src/
├── metrics/
│   ├── metrics.ts              # MODIFIED — slowestFive calls extracted helper
│   ├── latency-stats.ts        # NEW — MIN_GAP_MS, MAX_GAP_MS, DIGRAPH_MIN_SAMPLES,
│   │                           #        median, gatedMedian (filter→gate→median)
│   ├── resolve-metrics.ts      # NEW — move resolveMetrics out of ui/ so analytics
│   │                           #        does not import from ui/
│   └── symbol-density.ts       # UNCHANGED
├── analytics/                  # NEW — pure, zero DOM, zero Dexie
│   ├── types.ts                # DigraphEntry, HeatmapCell, LanguageProfileRow,
│   │                           # AnalyticsSession (structural projection of StoredSession)
│   ├── analytics.ts            # computeDigraphLatency, computeLanguageProfile
│   ├── heatmap.ts              # computeKeyboardHeatmap (or fold into analytics.ts)
│   └── keyboard-geometry.ts    # US_ANSI_KEYS: code → {row, col, span, label, sampleable}
├── persistence/                # UNCHANGED — dashboard calls listNewestFirst only
├── ui/
│   ├── App.tsx                 # MODIFIED — view union + third nav button + mount dashboard
│   ├── HistoryView.tsx         # UNCHANGED (inert rows)
│   ├── history-metrics.ts      # MODIFIED — re-export resolveMetrics from metrics/
│   ├── AnalyticsDashboard.tsx  # NEW
│   ├── DigraphLatencyView.tsx  # NEW
│   ├── KeyboardHeatmap.tsx     # NEW
│   └── LanguageProfileView.tsx # NEW
└── index.css                   # MODIFIED — heatmap tokens + keyboard grid (UI-SPEC)
```

### Pattern 1: Shared filter → gate → median helper

**What:** Lift the private `MIN_GAP_MS` / `MAX_GAP_MS` / `median` / post-filter gate out of `slowestFive` into `src/metrics/latency-stats.ts`. Single-char `slowestFive` keeps `MIN_SAMPLES = 3`. Digraphs and heatmap pass `DIGRAPH_MIN_SAMPLES = 5`.
**When to use:** Any latency ranking that must stay statistically consistent with METR-03.
**Example:**

```typescript
// src/metrics/latency-stats.ts
// Source: existing src/metrics/metrics.ts:48-50, 112-136 (extracted, not reinvented)

export const MIN_GAP_MS = 25
export const MAX_GAP_MS = 1000
export const CHAR_MIN_SAMPLES = 3      // existing slowestFive gate
export const DIGRAPH_MIN_SAMPLES = 5   // D-06 / D-13 — named export, one-line tune

export function median(samples: readonly number[]): number {
  if (samples.length === 0) return 0
  const sorted = [...samples].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    const lo = sorted[mid - 1]
    const hi = sorted[mid]
    return lo !== undefined && hi !== undefined ? (lo + hi) / 2 : 0
  }
  const value = sorted[mid]
  return value !== undefined ? value : 0
}

export function gatedMedian(
  samples: readonly number[],
  minSamples: number,
): { medianMs: number; sampleCount: number } | null {
  const filtered = samples.filter((gap) => gap > MIN_GAP_MS && gap < MAX_GAP_MS)
  if (filtered.length < minSamples) return null
  return { medianMs: median(filtered), sampleCount: filtered.length }
}
```

`slowestFive` becomes: for each char, `gatedMedian(samples, CHAR_MIN_SAMPLES)`, sort desc, slice 5. Existing `metrics.test.ts` golden cases must stay green — that is the extract's regression net.

### Pattern 2: Two aggregation axes over the same session

**What:** Digraphs group by logical committed codepoint pairs from `charLog`. Heatmap groups by physical `KeystrokeEvent.code` from `events`. Do not share a grouping key.
**When to use:** Always. `{` vs `[` are distinct digraph participants and the same physical `Digit9`/`BracketLeft` key on the heatmap.
**Example:** see §Code Examples (heatmap IKI walk).

### Pattern 3: Dashboard consumes the History read path

**What:** `AnalyticsDashboard` calls `useLiveQuery(listNewestFirst)` exactly like `HistoryView`. Distinguishes `undefined` (loading) from `[]` (empty). Never imports `../persistence/db` or `dexie`.
**When to use:** Any new read-side view over sessions.

### Pattern 4: Hide-not-unmount extends to a three-way view

**What:** `view: 'trainer' | 'history' | 'analytics'`. Trainer wrapper stays `display: view === 'trainer' ? 'grid' : 'none'`. Exactly one nav button has `aria-current="page"`. Existing App.test.tsx "single-active invariant" and D-08 hide-not-unmount tests must be updated to three buttons, not rewritten.
**When to use:** This phase's App.tsx change. No router.

### Anti-Patterns to Avoid

- **Importing Dexie / `db.ts` from `analytics/`:** Breaks purity and golden-fixture tests (ARCHITECTURE.md Anti-Pattern 3).
- **Keying the heatmap by `CommittedChar.data`:** smears Shift-modified pairs onto the wrong physical key (Anti-Pattern 4).
- **Copy-pasting `MIN_GAP_MS` into analytics.ts:** PITFALLS.md Pitfall 3 — the next constant tweak silently desyncs rankings.
- **Blending stale `metricsSnapshot.wpm` into the language profile:** PITFALLS.md Pitfall 1. Always `resolveMetrics`.
- **Using `startedAt` (wall clock) as a latency sample or as `now`:** PITFALLS.md Pitfall 2. Latency is `tMs` / `completedAtTMs` only.
- **Greying sub-threshold digraphs instead of omitting them:** D-07.
- **Hiding unused heatmap keys:** D-13. The US-ANSI shape must remain.
- **Coloring unused keys as "fast":** D-13 / D-14. Neutral fill, no number.
- **Green/red score palette using `--color-accent` / `--color-destructive`:** 03/04/05-UI-SPEC forbid performance-threshold color-coding. Heatmap intensity is diagnostic, not a grade.
- **Mounting heatmap during capture:** FEATURES.md anti-feature; D-15.
- **Adding a charting library:** PROJECT.md Out of Scope.
- **Trigraph ranking, language filter, per-session drill-down:** ANLY-06/07/08 — deferred.
- **`analytics.ts` importing from `src/ui/`:** layering inversion. Move `resolveMetrics` into `src/metrics/`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB read | New query/store | Existing `listNewestFirst` + `useLiveQuery` | Already the History path; a second querier drifts. |
| Median / gap window | New stats helper in analytics/ | Extracted `latency-stats.ts` | Constants and ordering are load-bearing (Pitfall 3). |
| Schema-aware WPM | Ad-hoc `metricsSnapshot.wpm` | `resolveMetrics` (moved to `metrics/`) | Phase 5 schema v2 must apply retroactively. |
| Whitespace digraph glyphs | New glyph map | `glyphFor` from `trainer/state.ts` | Already locked for space=`·`, newline=`↵`. |
| Language vocabulary | New enum | `exercise.language` string as stored | D-20: display the raw tag via `key-chip`, same as HistoryRow. |
| Keyboard `code` strings | Invented aliases (`"A"`, `"oem_4"`) | W3C UI Events `KeyboardEvent.code` values (`"KeyA"`, `"BracketLeft"`) | `[CITED: https://www.w3.org/TR/uievents-code/]` |
| Color-scale library | d3-scale / heatmap.js | ~10-line lerp between two UI-SPEC tokens | STACK.md; discrete ~60 keys, not a continuous field. |
| Router | react-router | Existing `useState` view union | D-01; three buttons, no URLs. |

**Key insight:** The deceptively hard parts (sample gates, clock domains, char-vs-code axes, schema-versioned recompute) already exist in this codebase. Phase 6 fails when it reimplements them, not when it forgets a library.

## Common Pitfalls

### Pitfall 1: Un-gated or pre-filter-gated digraph ranking
**What goes wrong:** Rankings dominated by n=1 flukes (`=>` once at 400ms looks "slowest").
**Why it happens:** Fresh aggregator forgets POST-filter `n ≥ 5` or gates on raw counts (metrics.ts Pitfall 4).
**How to avoid:** `gatedMedian(samples, DIGRAPH_MIN_SAMPLES)` only. Golden fixture: 4 in-window samples → omitted; 5th → appears.
**Warning signs:** Leaderboard changes wildly between sessions; pairs with n=1–2 on screen.

### Pitfall 2: Heatmap IKI includes modifiers or OS-repeat
**What goes wrong:** Every shifted symbol looks fast (gap is Shift→key, ~40ms) and held keys look fast (OS repeat ~30ms).
**Why it happens:** Walking every `keydown` including `ShiftLeft` as `prevTMs`, or not honoring `isRepeat` (already recorded in `capture.ts`).
**How to avoid:** Walk `type === 'keydown' && !isRepeat && geometry.sampleable`. Modifiers are drawn but `sampleable: false` — skip them as both samples **and** as the previous-timestamp anchor, so `Digit1` after `ShiftLeft` measures from the previous *sampleable* keydown.
**Warning signs:** Digit-row keys all ~30–50ms; Space/Backspace "fast" from key-repeat.

### Pitfall 3: Heatmap keyed by character, not `code`
**What goes wrong:** `{` and `[` paint different keys, or Shift+`,` paints Comma as if it were `<`.
**Why it happens:** Reusing `slowestFive`'s grouping because "it's already there" (Anti-Pattern 4).
**How to avoid:** Heatmap reads `events[].code` only. Golden fixture: same `code: 'Digit9'` producing `9` and `(` accumulates on Digit9.

### Pitfall 4: Stale-schema WPM mixed into the language profile
**What goes wrong:** Pre-Phase-5 rows lack `symbolAdjustedWpm` or use schema v1 WPM; averages are silently wrong.
**Why it happens:** Reading `metricsSnapshot` directly is cheaper than `resolveMetrics`.
**How to avoid:** `computeLanguageProfile` calls `resolveMetrics` (or inlines the same `schemaVersion === METRICS_SCHEMA_VERSION` guard with `completedAtTMs` as `now`). Golden: a v1 snapshot fixture recomputes to v2 and contributes `symbolAdjustedWpm`.
**Warning signs:** `adj. wpm` column `undefined`/NaN, or a step-change on the Phase 5 ship date.

### Pitfall 5: `startedAt` leaking into latency
**What goes wrong:** Astronomical WPM or empty heatmaps after reload (wall-clock vs tMs).
**Why it happens:** Cross-session code reaches for "the session timestamp."
**How to avoid:** Digraph/heatmap use only `charLog[].tMs` / `events[].tMs`. Language recompute uses `completedAtTMs`. Never `startedAt`.
**Warning signs:** NaN/Infinity medians; tests that pass only with `Date.now()`-shaped fixtures.

### Pitfall 6: UTF-16 digraph keys
**What goes wrong:** A supplementary-plane character becomes two "characters"; pairs mis-slice.
**Why it happens:** `text[i] + text[i+1]` instead of `Array.from`.
**How to avoid:** Same `Array.from(rec.data ?? '')` walk as `replayAttempts`. Pair key = two codepoints concatenated.
**Warning signs:** Golden IME/multi-codepoint case (metrics.test.ts n=10) fails when extended to pairs.

### Pitfall 7: Delete records forming digraphs
**What goes wrong:** `x⌫a` becomes pair `"xa"` or a pair containing `null`.
**Why it happens:** Sliding window over raw `charLog` records including deletes.
**How to avoid:** On `inputType.startsWith('delete')`, clear the previous-insert codepoint (and still update `prevTMs` so the *next* insert's single-char gap stays consistent with `replayAttempts`). Do not emit a pair across a delete.

### Pitfall 8: Conflating page-empty, section-empty, and loading
**What goes wrong:** "No sessions yet" appears while `useLiveQuery` is still `undefined`, or three empty sections flash on a blank DB.
**Why it happens:** HistoryView already documents this (RESEARCH Pitfall 5 / HistoryView header comment). Easy to regress in a second consumer.
**How to avoid:** Mirror HistoryView's three-way branch. Sections mount only when `sessions.length > 0`.

### Pitfall 9: Heatmap as a gamified green/red score
**What goes wrong:** Violates 03/04/05-UI-SPEC "no performance-threshold color-coding"; fails WCAG 1.4.1 if color is the only cue.
**Why it happens:** Heatmaps default to RdYlGn.
**How to avoid:** Sequential single-hue (amber) relative to current min/max of *gated* keys; persistent ms labels (D-12); unused = `--color-surface`, no number. UI-SPEC owns exact hex and 3:1 adjacent-step / 4.5:1 label contrast in both themes. `[CITED: https://www.w3.org/WAI/WCAG22/Understanding/use-of-color]` `[CITED: https://www.w3.org/WAI/WCAG22/Techniques/general/G14]`

### Pitfall 10: `#root` 45rem vs a 15-key row
**What goes wrong:** Keyboard wraps or overflows the column (`--column-max: 45rem` ≈ 720px).
**Why it happens:** Geometry copied from a full TKL screenshot.
**How to avoid:** Alphanumeric block only (no F-row, no arrows, no numpad). Label-size type on keys. Last-resort `overflow-x: auto` on the diagram — page-level jump nav is still forbidden (D-03).

## Code Examples

Verified patterns from this repo and official `KeyboardEvent.code` values.

### Digraph accumulation (pool across sessions, then gate)

```typescript
// Source: generalization of src/metrics/metrics.ts replayAttempts + slowestFive
// Pair = two Unicode codepoints from consecutive *inserts*; deletes reset the pair window.

import { gatedMedian, DIGRAPH_MIN_SAMPLES } from '../metrics/latency-stats'
import type { AnalyticsSession } from './types'
import type { DigraphEntry } from './types'

export function computeDigraphLatency(sessions: readonly AnalyticsSession[]): DigraphEntry[] {
  const samplesByPair = new Map<string, number[]>()

  for (const session of sessions) {
    let prevTMs: number | null = null
    let prevInsertChar: string | null = null
    for (const rec of session.charLog) {
      if (rec.inputType.startsWith('delete')) {
        if (/* cursor would move */ true) prevInsertChar = null
        prevTMs = rec.tMs
        continue
      }
      const codepoints = Array.from(rec.data ?? '')
      codepoints.forEach((ch, i) => {
        const isLast = i === codepoints.length - 1
        if (isLast && prevInsertChar !== null && prevTMs !== null) {
          const pair = prevInsertChar + ch
          const arr = samplesByPair.get(pair) ?? []
          arr.push(rec.tMs - prevTMs)
          samplesByPair.set(pair, arr)
        }
        prevInsertChar = ch
      })
      prevTMs = rec.tMs
    }
  }

  const eligible: DigraphEntry[] = []
  for (const [pair, samples] of samplesByPair) {
    const gated = gatedMedian(samples, DIGRAPH_MIN_SAMPLES)
    if (gated) eligible.push({ pair, medianMs: gated.medianMs, sampleCount: gated.sampleCount })
  }
  return eligible.sort((a, b) => b.medianMs - a.medianMs).slice(0, 10)
}
```

IME rule (keep): a multi-codepoint insert attributes the gap only to the last codepoint — same as metrics.test.ts case n=10. The first codepoint of that insert still becomes `prevInsertChar` for the *next* record's pair, but does not receive this record's gap.

### Heatmap IKI by physical `code`

```typescript
// Source: D-11 + capture.ts isRepeat + W3C UI Events code values
// https://www.w3.org/TR/uievents-code/
// https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code

import { gatedMedian, DIGRAPH_MIN_SAMPLES } from '../metrics/latency-stats'
import { US_ANSI_KEYS, isSampleable } from './keyboard-geometry'
import type { AnalyticsSession, HeatmapCell } from './types'

export function computeKeyboardHeatmap(sessions: readonly AnalyticsSession[]): HeatmapCell[] {
  const samplesByCode = new Map<string, number[]>()

  for (const session of sessions) {
    let prevTMs: number | null = null
    for (const ev of session.events) {
      if (ev.type !== 'keydown' || ev.isRepeat) continue
      if (!isSampleable(ev.code)) continue // modifiers drawn but never sampled / never anchors
      if (prevTMs !== null) {
        const arr = samplesByCode.get(ev.code) ?? []
        arr.push(ev.tMs - prevTMs)
        samplesByCode.set(ev.code, arr)
      }
      prevTMs = ev.tMs
    }
  }

  return US_ANSI_KEYS.map((key) => {
    const gated = gatedMedian(samplesByCode.get(key.code) ?? [], DIGRAPH_MIN_SAMPLES)
    return {
      code: key.code,
      row: key.row,
      col: key.col,
      span: key.span,
      label: key.label,
      medianMs: gated?.medianMs ?? null, // null → neutral fill, no number (D-13)
      sampleCount: gated?.sampleCount ?? 0,
    }
  })
}
```

Relative color (display layer, not the fold):

```typescript
// Source: D-14 — scale against gated keys only
const sampled = cells.filter((c) => c.medianMs !== null) as Array<HeatmapCell & { medianMs: number }>
const lo = Math.min(...sampled.map((c) => c.medianMs))
const hi = Math.max(...sampled.map((c) => c.medianMs))
const t = hi === lo ? 0.5 : (cell.medianMs - lo) / (hi - lo)
// lerp(--heatmap-lo, --heatmap-hi, t)
```

### Language profile (unweighted mean of resolveMetrics)

```typescript
// Source: D-16..D-20 + src/ui/history-metrics.ts resolveMetrics

import { resolveMetrics } from '../metrics/resolve-metrics'
import type { AnalyticsSession, LanguageProfileRow } from './types'

export function computeLanguageProfile(sessions: readonly AnalyticsSession[]): LanguageProfileRow[] {
  const buckets = new Map<string, { wpm: number[]; adj: number[]; acc: number[] }>()
  for (const s of sessions) {
    const m = resolveMetrics(s) // schema guard; now = s.completedAtTMs
    const lang = s.exercise.language // 'plaintext' is a normal key — never fold
    const b = buckets.get(lang) ?? { wpm: [], adj: [], acc: [] }
    b.wpm.push(m.wpm)
    b.adj.push(m.symbolAdjustedWpm)
    b.acc.push(m.accuracy)
    buckets.set(lang, b)
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  return [...buckets.entries()]
    .map(([language, b]) => ({
      language,
      wpm: mean(b.wpm),
      symbolAdjustedWpm: mean(b.adj),
      accuracy: mean(b.acc),
      sessionCount: b.wpm.length,
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount)
}
```

Document in the plan: this is the **unweighted arithmetic mean of per-session resolved metrics**, not duration-weighted and not a re-fold of raw keystrokes. `n` is the confidence signal (D-17/D-19).

### Geometry table (US 101 alphanumeric block)

```typescript
// Source: https://www.w3.org/TR/uievents-code/  §3.1 Writing System Keys + §3.1.2 Functional Keys
// W3C Recommendation, 22 April 2025. Labels are US-ANSI unshifted glyphs.

export interface KeyGeometry {
  code: string
  row: number // 0 = number row … 4 = space row
  col: number
  span: number
  label: string
  sampleable: boolean
}

// sampleable: letters, digits, punctuation, Space, Enter, Backspace, Tab
// drawn but not sampled: ShiftLeft/Right, Control*, Alt*, Meta*, CapsLock
// omitted entirely: F-row, arrows, nav cluster, numpad, Intl* (not US 101)
```

Canonical codes to include (do not invent names): `Backquote`, `Digit0`–`Digit9`, `Minus`, `Equal`, `Backspace`, `Tab`, `KeyQ`–`KeyP`, `BracketLeft`, `BracketRight`, `Backslash`, `CapsLock`, `KeyA`–`KeyL`, `Semicolon`, `Quote`, `Enter`, `ShiftLeft`, `KeyZ`–`KeyM`, `Comma`, `Period`, `Slash`, `ShiftRight`, `ControlLeft`, `MetaLeft`, `AltLeft`, `Space`, `AltRight`, `MetaRight`, `ControlRight`. `[CITED: https://www.w3.org/TR/uievents-code/]`

### App.tsx view union

```typescript
// Source: src/ui/App.tsx:59 + D-01 / D-08
const [view, setView] = useState<'trainer' | 'history' | 'analytics'>('trainer')

// trainer wrapper — unchanged contract
<div style={{ display: view === 'trainer' ? 'grid' : 'none', gap: 'var(--space-md)' }}>
  {/* CaptureSurface … */}
</div>
{view === 'history' && <HistoryView />}
{view === 'analytics' && <AnalyticsDashboard />}
```

### Digraph glyph at the display layer

```typescript
// Source: src/trainer/state.ts glyphFor + ResultsView.tsx:48
function digraphGlyph(pair: string): string {
  return Array.from(pair).map((ch) => (ch === ' ' || ch === '\n' ? glyphFor(ch) : ch)).join('')
}
```

Round `medianMs` with `Math.round` only in the leaf (ResultsView / HistoryRow convention).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Frequency-colored keyboard heatmaps (Patrick Wied, generic tools) | Latency-colored (median IKI per physical key) | Product differentiator, FEATURES.md 2026-09-05 | Color answers "where am I slow," not "what do I type most" |
| Rainbow / RdYlGn heatmaps | Sequential single-hue + cell labels (WCAG 1.4.1) | WCAG 2.2 Understanding; G14 | Required for this UI, not optional polish |
| Per-session slowest-5 (n≥3, logical char) | Cross-session digraphs (n≥5, 2-char window) + heatmap (n≥5, `code`) | This phase | Two axes; do not collapse them |
| `'plaintext'` as accidental paste default | Phase 5 picker; plaintext remains a visible bucket | Phase 5 / D-20 | Profile is meaningful; do not hide plaintext |
| Charting (Recharts) for analytics | Tables + static diagram | PROJECT.md Out of Scope | No charting dependency this phase |

**Deprecated/outdated:**
- Live-updating heatmap during capture: FEATURES.md anti-feature (hot-path jitter).
- `heatmap.js` for a discrete keyboard: wrong primitive (STACK.md).
- Trigraphs in v1.1: ANLY-06, explicitly deferred.

## Discretion Recommendations (planner: lock these in the plan)

| Topic | Recommendation | Why |
|-------|----------------|-----|
| Page empty copy | `No sessions yet — finish a typing exercise and it'll show up here.` | Match HistoryView; one empty vocabulary. |
| Digraph section empty copy | `Not enough digraph samples yet. Pairs need at least 5 in-window observations across your history.` | Makes the gate visible (D-06/D-07). |
| Heatmap "empty" | Always mount the diagram when sessions exist. If zero keys clear the gate, all-neutral keys + muted caption `No keys have 5 samples yet.` Do **not** replace the diagram with a paragraph (D-13). | Shape must stay recognizable. |
| Language empty | None. ≥1 session ⇒ ≥1 row (D-19). | |
| Heatmap palette | Sequential amber/warm (`--heatmap-lo` / `--heatmap-hi`), unused = `--color-surface`. **Not** accent-green / destructive-red. Dark-theme pair required. UI-SPEC sets hex + contrast. | 03-UI-SPEC no score coloring; WCAG 1.4.1; CVD-safe sequential. |
| Keys drawn | US 101 alphanumeric section (writing-system keys + functional keys of that block). Omit F-row, arrows, nav, numpad, `Intl*`. | Fits `--column-max`; recognizable ANSI; W3C 101 layout. |
| Sampleable set | Letters, digits, punctuation, Space, Enter, Backspace, Tab. Not sampleable (drawn, always neutral): Shift/Ctrl/Alt/Meta/CapsLock. | Avoids Shift-collapse (Pitfall 2) while keeping the frame. |
| Language aggregation | Unweighted mean of per-session `resolveMetrics` values. | CONTEXT's "obvious default"; `n` carries confidence; length-weighting would hide n=1. |
| File split | `computeDigraphLatency` + `computeLanguageProfile` in `analytics.ts`; heatmap in `heatmap.ts`; geometry in `keyboard-geometry.ts`. | Matches ARCHITECTURE.md suggested layout. |
| `CorpusInput` | Stay visible on Analytics (match History). | CONTEXT discretion; no UI-SPEC contradiction yet. |
| `resolveMetrics` home | Move implementation to `src/metrics/resolve-metrics.ts`; `history-metrics.ts` re-exports. | Analytics must not import `ui/`. |
| Tests | Golden unit tests in `src/analytics/*.test.ts` + `src/metrics/latency-stats.test.ts`; extend `App.test.tsx` 3-button invariant + D-08; dashboard loading/empty happy-dom test mirroring HistoryView. | PITFALLS.md mandatory gate/filter/median cases. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Heatmap latency is keydown→keydown IKI (not dwell / not UD flight) | Pattern 2, Pitfall 2 | A dwell heatmap would answer "hold duration" instead of "time to reach this key," mismatching slowestFive's gap semantics. Confirm in plan; cheap to swap the walker if the user disagrees. |
| A2 | Unweighted mean of per-session WPM is the language-profile aggregator | Discretion | Length-weighted mean would change "I'm slow at Rust" for mixed-length histories. CONTEXT already flags this as discretion — document in PLAN.md. |
| A3 | Amber sequential palette (not a third existing token) | Pitfall 9 | UI-SPEC may pick a different hue; tokens are the variable, sequential+labels are not. |

A1–A3 are discretion calls with a recommended default, not unverified library claims. No compliance/retention number in this research is assumed as a legal requirement.

## Open Questions

1. **UI-SPEC exact heatmap hex + whether `#root` max-width needs an analytics exception**
   - What we know: D-14 leaves palette to UI-SPEC; `--column-max: 45rem` may be tight for 15 keys.
   - What's unclear: final contrast-passing hex in both themes; whether the diagram gets `overflow-x: auto`.
   - Recommendation: planner stubs `--heatmap-lo` / `--heatmap-hi` / `--heatmap-key-fg` and `/gsd-ui-phase 6` fills values. Do not block PLAN.md on hex.

2. **Does extracting `resolveMetrics` belong in Wave 0 of this phase?**
   - What we know: it currently lives in `ui/history-metrics.ts` and is pure.
   - What's unclear: none technically — layering says move it.
   - Recommendation: Wave 0 extract + re-export, so analytics never imports `ui/`. Existing `history-metrics.test.ts` keeps passing via re-export.

No knowledge graph was present (`.planning/graphs/graph.json` absent); no semantic-relationship caveats.

## Environment Availability

Step 2.6: this phase is code/config only — no new CLIs, services, or databases.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tests / typecheck | ✓ | v24.16.0 (engines: `^20.19.0 \|\| >=22.12.0`) `[VERIFIED: package.json + node --version]` | — |
| pnpm | scripts | ✓ | 11.5.3 `[VERIFIED: package.json packageManager]` | — |
| Vitest via `pnpm test` | golden + UI tests | ✓ | ~4.1.11 `[VERIFIED: package.json]` | — |
| happy-dom | App/dashboard tests | ✓ | `^20.14.0` | — |
| fake-indexeddb | dashboard `useLiveQuery` tests | ✓ | 6.2.5 | Pure analytics tests need no IDB |
| Playwright | optional E2E | ✗ (not in package.json) | — | happy-dom + existing D-08 test; human Chromium check at end-of-phase |
| IndexedDB (browser) | live query | ✓ (app is browser-only) | — | empty/loading already handled |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** Playwright — not required; `nyquist_validation` is `false`.

## Project Constraints (from .cursor/rules/ and CLAUDE.md)

No `.cursor/rules/` directory exists. Actionable directives from `.claude/CLAUDE.md`:

| Directive | Source | Impact on this phase |
|-----------|--------|----------------------|
| GSD workflow — no direct repo edits outside a GSD command | CLAUDE.md | Execution via `/gsd-execute-phase`, not ad-hoc edits. |
| Vite 8 + React 19 + TS strict SPA, pnpm, **no backend** | CLAUDE.md / STACK.md | Analytics stays client-side over IndexedDB. |
| Privacy: ingested third-party content stays local | CLAUDE.md | Dashboard only reads local Dexie; no export/sync/telemetry. Re-flag if any later phase adds networking. |
| Keystroke timing uses `event.timeStamp` (`tMs`), never `Date.now()` for latency | CLAUDE.md + `metrics.ts` header | Heatmap/digraph samples are tMs gaps; `startedAt` is display-only. |
| Handler stays trivial; metrics post-hoc | CLAUDE.md | D-15: no live heatmap. |
| Discard `event.repeat` | CLAUDE.md + `capture.ts` | Heatmap walker skips `isRepeat`. |
| TS strict + `noUncheckedIndexedAccess` | tsconfig / CLAUDE.md | Guard `slowest5[0]`-style indexed reads; no non-null assertions in the helper extract. |
| No performance-threshold color-coding / gamified framing | 03/04/05-UI-SPEC | Heatmap is sequential diagnostic intensity + numbers, not green/red scores. |
| Develop/benchmark on Chromium | CLAUDE.md | Human visual check of heatmap contrast in Chromium light+dark. |
| COEP `require-corp` | `vite.config.ts` | No third-party heatmap assets/fonts. |

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high` `[VERIFIED: .planning/config.json]`.

This phase adds no network, no auth, no new storage writes, and no new dependencies. Threat surface is **read + render of already-persisted untrusted exercise text and keystroke-derived strings**.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Single-user local tool. |
| V3 Session Management | no | "Session" is a typing exercise, not an auth session. |
| V4 Access Control | no | No multi-user model. Same-origin IndexedDB remains readable by anyone with that browser profile (accepted in 04-SECURITY.md). |
| V5 Input Validation | **yes** | Digraph pairs, key labels, and `exercise.language` render as React text nodes. Never `dangerouslySetInnerHTML`. `glyphFor` maps only `' '` / `'\n'`. Language tags are existing stored strings, not HTML. |
| V6 Cryptography | no | No new secrets; do not add encryption. |
| V7 Error Handling | yes (minor) | Pure folds should not throw on empty arrays (median already guards `length === 0`). Dashboard loading/empty must not surface Dexie internals. |
| V8 Data Protection | yes (minor) | Still local-only. Analytics does not export. Full-history fold in memory is acceptable at current scale (ARCHITECTURE.md). |
| V13 API / Web Service | no | No API. |
| V14 Configuration | yes (minor) | No new env vars, no new origins, no new packages. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored XSS via digraph pair / language tag / key label | Tampering | React text nodes; no HTML concatenation; `glyphFor` is a closed 2-entry map |
| Prototype pollution via aggregating attacker-shaped sessions | Tampering | Input is Dexie rows the app itself wrote (`StoredSession`); no `JSON.parse` of external analytics payloads |
| UI redress / clickjacking of nav | — | Existing COOP/COEP headers unchanged |
| Info disclosure of proprietary pasted code on the analytics page | Info Disclosure | Same local-only model as History; no new exfil path |
| DoS via O(sessions × keystrokes) re-fold | Denial of Service (self) | Accepted at single-user scale (D carried-forward); no incremental cache this phase |

**No `high`-severity findings.** Nothing here should block the phase.

## Sources

### Primary (HIGH confidence)
- Direct source reads this session (2026-09-20): `src/metrics/metrics.ts`, `src/ui/history-metrics.ts`, `src/ui/App.tsx`, `src/ui/HistoryView.tsx`, `src/ui/ResultsView.tsx`, `src/persistence/{types,repository}.ts`, `src/capture/{types,capture}.ts`, `src/trainer/state.ts` (`glyphFor`), `src/ingestion/language-map.ts`, `src/platform/layout.ts`, `src/index.css`, `src/ui/App.test.tsx`, `src/metrics/metrics.test.ts`, `package.json`, `vite.config.ts`, `.planning/config.json`
- `.planning/phases/06-cross-session-analytics/06-CONTEXT.md` — locked D-01..D-20
- `.planning/research/{ARCHITECTURE,PITFALLS,FEATURES,STACK}.md` — v1.1 milestone research
- `.planning/REQUIREMENTS.md` — ANLY-03/04/05; ANLY-06/07/08 future
- W3C UI Events KeyboardEvent code Values, Recommendation 22 April 2025 — [https://www.w3.org/TR/uievents-code/](https://www.w3.org/TR/uievents-code/) `[CITED]`
- MDN `KeyboardEvent.code` — [https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code) `[CITED]`

### Secondary (MEDIUM confidence)
- WAI Understanding SC 1.4.1 Use of Color — [https://www.w3.org/WAI/WCAG22/Understanding/use-of-color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color) `[CITED: WebSearch; WCAG fetch timed out]`
- WAI G14 (text alternative to color) — [https://www.w3.org/WAI/WCAG22/Techniques/general/G14](https://www.w3.org/WAI/WCAG22/Techniques/general/G14) `[CITED: WebSearch]`
- Keystroke-dynamics survey (dwell vs flight/IKI) — PMC 3835878 `[CITED: https://pmc.ncbi.nlm.nih.gov/articles/PMC3835878/]`
- 03/04/05-UI-SPEC.md — no performance-threshold color-coding; History empty/loading; nav `aria-current`

### Tertiary (LOW confidence)
- Context7 MCP was not available this session (`ctx7` CLI absent; `classify-confidence --provider context7` = MEDIUM unverified). Unicode `Array.from` guidance is grounded in **this repo's** `metrics.ts`, not an external docs fetch.
- Accessible-data-visualization secondary blogs (heatmap + cell labels) — used only as corroboration of G14, not as a control.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; versions read from `package.json` this session
- Architecture: HIGH — locked CONTEXT + live modules; seams already proven by HistoryView
- Pitfalls: HIGH for gates/clocks/char-vs-code/schema (in-repo + PITFALLS.md); MEDIUM for heatmap IKI-vs-dwell (discretion A1, literature-backed)

**Research date:** 2026-09-20
**Valid until:** 2026-10-20 (stable domain; no dependency churn)

**Graph:** `.planning/graphs/graph.json` absent — no graph context injected.
**Nyquist:** `workflow.nyquist_validation` is `false` — Validation Architecture section omitted by protocol.
**Runtime State Inventory:** omitted (not a rename/refactor/migration phase).
