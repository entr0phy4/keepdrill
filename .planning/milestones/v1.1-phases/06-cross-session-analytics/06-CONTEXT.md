# Phase 6: Cross-Session Analytics - Context

**Gathered:** 2026-09-13
**Status:** Ready for planning

<domain>
## Phase Boundary

The user can see patterns across their accumulated typing history: a ranked
table of the slowest digraphs, a US-ANSI keyboard heatmap of physical-key
median latency, and a per-language WPM/accuracy profile. All three live on
one Analytics page reached from a third header item; History stays its own
list.

**In scope:** ANLY-03 (ranked slowest-digraph table, minimum-sample gate),
ANLY-04 (keyboard heatmap, median latency, physical keys), ANLY-05
(per-language profile; plaintext as its own bucket).

**Out of scope (own phases / deferred):** trigraph latency (`ANLY-06`),
per-session drill-down (`ANLY-07`), language filter on heatmap/digraph table
(`ANLY-08`), trend/evolution charts (PROJECT.md Out of Scope), live/per-
keystroke heatmap (FEATURES.md anti-feature), cross-device sync.
</domain>

<decisions>
## Implementation Decisions

### Analytics Placement
- **D-01:** Analytics is a **third header item** ("Analytics") — a sibling
  view to Trainer and History. `App.tsx`'s `view` union becomes
  `'trainer' | 'history' | 'analytics'`. History stays a dedicated list
  (PERS-02). Chosen over tabs-inside-History and over four sibling header
  items so the header stays three buttons and History stays a session list.
  Same hide-not-unmount contract as History (Phase 4 D-08): switching to
  Analytics hides the trainer subtree, it does not unmount it.
- **D-02:** The Analytics page is **one stacked dashboard** — three sections
  in this order: **digraph ranking → keyboard heatmap → per-language
  profile**. Matches ARCHITECTURE.md's `AnalyticsDashboard` + leaf
  subviews (`DigraphLatencyView`, `KeyboardHeatmap`, `LanguageProfileView`).
- **D-03:** **Scroll only** — no in-page jump links / section index. The
  page is three blocks; an extra TOC is noise on a 3-item header.
- **D-04:** If `listNewestFirst` returns **zero sessions**, Analytics
  renders a **single page-level empty state** (same spirit as HistoryView's
  "No sessions yet…") and **does not mount the three sections**. Per-section
  empty states exist only when there *are* sessions but a given section has
  nothing that clears its own gate (e.g. no digraph has 5 samples yet).

### Digraph Ranking + Sample Gate
- **D-05:** Ranked table of the **top 10 slowest digraphs** (2-character
  sequences) accumulated across all persisted sessions. Cap at 10 after
  gating and sorting by median latency descending — more diagnostic than
  the per-session slowest-5, without dumping every pair that clears the
  gate.
- **D-06:** A digraph is eligible only with **≥ 5 samples remaining
  POST-filter**, using the same exclusive `(25ms, 1000ms)` gap window as
  `metrics.ts::slowestFive`. This is deliberately higher than single-char
  `MIN_SAMPLES = 3` (STATE.md / PITFALLS.md Pitfall 3). Constant lives as a
  named export (e.g. `DIGRAPH_MIN_SAMPLES`) so it is a one-line tune.
- **D-07:** Pairs below the gate are **omitted**, not greyed out. If zero
  pairs clear the gate, the digraph **section** shows its own empty copy
  ("not enough digraph samples yet" or similar) — the heatmap and language
  profile still render.
- **D-08:** Each ranking row shows **digraph + median ms + sample count
  n**. The `n` makes the gate visible so the ranking does not look more
  confident than it is. Round ms only at the display layer (same rule as
  ResultsView / HistoryRow).
- **D-09:** Digraph construction reuses the existing consecutive-record
  gap logic in `metrics.ts` (`replayAttempts` / `slowestFive`), generalized
  from 1-char to a 2-char window over `charLog` — logical committed
  characters, not `KeyboardEvent.code`. Factor the shared
  filter/gate/median helper out of `slowestFive` rather than copy-pasting
  constants (PITFALLS.md Pitfall 3, ARCHITECTURE.md shared
  `latency-stats.ts` recommendation).

### Heatmap Visual Language
- **D-10:** Heatmap is a **static US-ANSI QWERTY diagram** (div-grid /
  geometry table), never a list. New UI — nothing in `src/ui` is a keyboard
  layout. Geometry lives in `src/analytics/keyboard-geometry.ts` (pure
  `code → {row, col}`), **not** a reuse of `platform/layout.ts` (that file
  is only the runtime layout-mismatch warning).
- **D-11:** Color is driven by **median latency per physical key**
  (`KeystrokeEvent.code` from persisted `events`), **not** frequency and
  **not** `CommittedChar.data`. This is the inverse of `slowestFive`'s D-03
  ("do NOT group by `KeyboardEvent.code`") — both aggregations read the
  same session, different axis (ARCHITECTURE.md Anti-Pattern 4).
- **D-12:** Each sampled key shows **color + the numeric median ms on the
  key** — not color-only, not tooltip-only. PITFALLS.md requires non-color
  redundancy; matches the visible `n` on the digraph table.
- **D-13:** Keys with fewer than **5 post-filter samples** (same constant
  as D-06) — or zero samples — stay on the diagram with a **neutral fill
  and no number**. Do not hide keys (the US-ANSI shape must stay
  recognizable) and do not invent a "fast" color for unused keys.
- **D-14:** Color scale is **relative** to the min/max median of keys that
  *do* clear the 5-sample gate in the current history. A fixed ms band
  would look flat with few sessions. Palette / contrast (including
  light/dark) is Claude's discretion subject to a UI-SPEC pass
  (`UI hint: yes` in ROADMAP.md); must not be color-only (D-12 already
  supplies the number).
- **D-15:** Heatmap is **post-hoc over persisted sessions**, never live
  during capture (FEATURES.md anti-feature; must not share a render cycle
  with the hot path).

### Per-Language Profile
- **D-16:** A **table**, one row per language tag that has ≥ 1 persisted
  session. Same scan metaphor as the digraph ranking; no card grid.
- **D-17:** Columns: **language + net WPM + symbol-adjusted WPM + accuracy
  + session count n**. Adj. WPM is the same companion metric already shown
  in ResultsView / HistoryRow (Phase 5 D-08) — never a replacement. `n`
  prevents "I'm slow at Rust" from one session looking like a profile.
- **D-18:** Rows sorted by **session count descending**. `plaintext` is
  not hidden and not specially promoted — it lands wherever its `n` puts
  it.
- **D-19:** **No session-count gate** — any tag with ≥ 1 session is a
  row. ANLY-05 does not require a session threshold; hiding a real upload
  tag (e.g. one `rust` file) is worse than showing `n=1`. The keystroke-
  level gate (D-06) does **not** apply here.
- **D-20:** `plaintext` / untagged sessions are a **distinct bucket**,
  never folded into a real language. The tag string is the existing
  `exercise.language` value (`'plaintext'` from the Phase 5 picker default
  or from unknown extensions). Display the tag the same way HistoryRow
  already does (`key-chip` with the raw language string). Do **not** add
  `languageSource` in this phase (PITFALLS.md optional field) — Phase 5
  already closed the paste-plaintext gap; confidence metadata is out of
  scope.

### Carried Forward (do not relitigate)
- `analytics.ts` is a **new top-level pure module** (`src/analytics/`),
  sibling to `metrics/`. It folds over `readonly Session[]` / a read
  projection of `StoredSession[]`. Zero DOM, zero Dexie import. Repository
  fetches; analytics receives plain data (Phase 4 D-03, ARCHITECTURE.md
  Anti-Pattern 3).
- Cross-session aggregation **recomputes from raw `charLog` / `events` /
  `exercise`**, gating on `schemaVersion` and never blending stale cached
  `MetricsResult` numbers into aggregates (Phase 4 D-02/D-05, PITFALLS.md
  Pitfall 1). Language-profile WPM/accuracy should go through
  `resolveMetrics` (or equivalent) so Phase 5's schema bump to 2 applies
  retroactively.
- Two clock domains stay separate: `startedAt` (`Date.now()`) is
  display/sort only; latency samples stay in the `event.timeStamp` / `tMs`
  domain (PITFALLS.md Pitfall 2).
- Trainer hide-not-unmount (Phase 4 D-08) applies to the Analytics view
  flip the same way it applies to History.
- History rows stay inert (Phase 4 D-13) — this phase does not add
  per-session drill-down.
- US ANSI only (PROJECT.md); no new keyboard-layout support.
- Full-history re-fold on dashboard mount is acceptable at current scale;
  incremental aggregate cache is a later optimization, not this phase
  (ARCHITECTURE.md scalability notes).

### Claude's Discretion
- Exact empty-state copy (page-level and per-section).
- Heatmap color palette and adjacent-step contrast (subject to UI-SPEC).
- Which US-ANSI keys are drawn (alphanumeric + punctuation vs including
  modifiers / function row) — geometry table contents, as long as D-10/D-13
  hold (recognizable static US-ANSI shape, unused keys present and
  neutral).
- How a digraph glyph is rendered when it contains whitespace (reuse
  `glyphFor` or equivalent).
- How per-language WPM/accuracy are aggregated across sessions (mean of
  per-session `resolveMetrics` values is the obvious default; document the
  choice in the plan).
- Internal signatures of `computeDigraphLatency` /
  `computeKeyboardHeatmap` / `computeLanguageProfile` and whether heatmap
  aggregation lives in `analytics.ts` vs `heatmap.ts`.
- Whether `CorpusInput` stays visible on the Analytics view (it currently
  stays visible on History — match that unless UI-SPEC says otherwise).
- Test strategy depth beyond the mandatory gate/filter/median golden cases
  PITFALLS.md requires.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v1.1 Milestone Research (primary — read before planning)
- `.planning/research/FEATURES.md` — digraph table, latency-not-frequency
  heatmap, per-language profile; anti-features (live heatmap, unfiltered
  pairs, charts).
- `.planning/research/ARCHITECTURE.md` — `src/analytics/` module split,
  `keyboard-geometry.ts` vs `platform/layout.ts`, Anti-Pattern 3 (no Dexie
  in analytics) and Anti-Pattern 4 (heatmap keyed by `code`), suggested
  `AnalyticsDashboard` + leaf views, shared `latency-stats.ts` helper.
- `.planning/research/PITFALLS.md` Pitfall 1 (raw log vs cached metrics),
  Pitfall 2 (clock domains), Pitfall 3 (sample-gate on digraphs — this
  phase's D-06/D-09), heatmap a11y (color + number), "not enough data"
  empty states.
- `.planning/research/STACK.md` — no new charting library expected; confirm
  no Recharts/uPlot drift (charts are out of scope).

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — ANLY-03, ANLY-04, ANLY-05 (this phase);
  ANLY-06/07/08 in Future Requirements, explicitly out of scope here.
- `.planning/ROADMAP.md` §"Phase 6" — goal, success criteria, dependency
  on Phase 4 (persisted history) and Phase 5 (real language tags).
- `.planning/PROJECT.md` §"Key Decisions" — Unicode codepoint-indexing,
  platform-seam discipline, persist-raw-and-recompute, US ANSI only.

### Prior Phase Context (carried forward)
- `.planning/phases/04-session-persistence-history/04-CONTEXT.md` — D-03
  (analytics never imports persistence), D-05 (schema-versioning /
  recompute), D-07/D-08 (header nav + hide-not-unmount), D-13 (inert
  history rows).
- `.planning/phases/05-symbol-adjusted-wpm-language-tagging/05-CONTEXT.md`
  — D-08 (adj. WPM is a companion, always shown), D-12 (canonical language
  vocabulary), `resolveMetrics` / `METRICS_SCHEMA_VERSION = 2`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/metrics/metrics.ts` — `MIN_GAP_MS` / `MAX_GAP_MS` / `MIN_SAMPLES`,
  `replayAttempts`, `slowestFive`, `median`. Extract the filter → gate →
  median helper for both single-char and digraph paths (D-09). Do **not**
  reuse `slowestFive` as-is for the heatmap (wrong key).
- `src/ui/history-metrics.ts::resolveMetrics` — recompute-if-stale; language
  profile must read WPM/accuracy/symbolAdjustedWpm through this (or the same
  rule) so schema v1 snapshots bump to v2.
- `src/persistence/repository.ts::listNewestFirst` + `useLiveQuery` —
  HistoryView's read path; AnalyticsDashboard consumes the same query, never
  imports `db.ts` / Dexie.
- `src/persistence/types.ts::StoredSession` — already has `events`,
  `charLog`, `markers`, `exercise`, `metricsSnapshot`. Heatmap needs
  `events[].code`; digraphs need `charLog`; language profile needs
  `exercise.language` + resolved metrics.
- `src/ui/App.tsx` — `view: 'trainer' | 'history'` and the header `<nav>`
  (D-01 extends this). Trainer wrapper already uses
  `display: view === 'trainer' ? 'grid' : 'none'` (D-08).
- `src/ui/HistoryView.tsx` — empty vs loading vs list (never conflate
  `undefined` and `[]`); language `key-chip`; `Math.round` at render.
- `src/ingestion/language-map.ts::PASTE_LANGUAGE_OPTIONS` + `EXT_TO_LANG`
  — canonical language tag vocabulary for grouping (D-20).
- `src/trainer/state.ts::glyphFor` — whitespace glyphs for digraph cells
  that contain space/newline.
- `src/platform/layout.ts` — **do not reuse** for heatmap geometry.

### Established Patterns
- Pure-core / platform-seam / hot-path split — `analytics/` stays pure;
  `repository.ts` is the only Dexie consumer other modules touch.
- `METRICS_SCHEMA_VERSION` + recompute-on-mismatch — language-profile
  numbers must not trust a stale `metricsSnapshot`.
- Unicode-safe iteration (`Array.from`) for any digraph window over
  committed text.
- No rounding outside the display layer.
- Prop-driven, `role="status"` panels (Banners / Results / History) —
  Analytics empty states should match.

### Integration Points
- `src/ui/App.tsx` — add Analytics to the header nav and view union
  (D-01); render `AnalyticsDashboard` when `view === 'analytics'`; keep
  trainer hidden-not-unmounted.
- `src/persistence/repository.ts` — same `listNewestFirst` (or a thin
  wrapper) feeding the dashboard via `useLiveQuery`.
- New `src/analytics/analytics.ts` (+ optional `heatmap.ts`,
  `keyboard-geometry.ts`, `latency-stats` extract) — the three compute
  functions.
- New `src/ui/AnalyticsDashboard.tsx` and leaf views — mount only the
  sections that have a right to render (D-04 page empty; D-07 section
  empty).

</code_context>

<specifics>
## Specific Ideas

- The Analytics page should feel like a diagnostic instrument, not a
  dashboard product: three stacked sections, no jump nav, no charts, no
  gamified framing — same quiet tone as ResultsView / HistoryView
  (03-UI-SPEC: no threshold color-coding as "score").
- Digraph `n` and heatmap ms-on-key exist so the user can see *how thin*
  the evidence is, not just a colored ranking.
- Page-level empty state when history is empty; section-level empty state
  when history exists but that section's gate is not met. Do not conflate
  the two (mirrors HistoryView's loading-vs-empty discipline).

</specifics>

<deferred>
## Deferred Ideas

- **Trigraph latency** — `ANLY-06`, Future Requirements. Needs more
  accumulated volume than digraphs; do not ship a 3-char ranking in this
  phase.
- **Per-session drill-down** — `ANLY-07`. History rows stay inert
  (Phase 4 D-13).
- **Filter heatmap / digraph table by language** — `ANLY-08`. Both
  features ship unfiltered first.
- **Trend / evolution charts** — PROJECT.md Out of Scope for v1.1.
- **Live heatmap while typing** — FEATURES.md anti-feature (hot-path
  jitter).
- **Incremental analytics cache / extra Dexie stores** — documented in
  ARCHITECTURE.md as a later optimization once history is huge; full
  re-fold on mount is the v1.1 approach.
- **`languageSource` confidence field** — PITFALLS.md suggestion; not
  needed now that Phase 5 tags paste explicitly.

</deferred>

---

*Phase: 6-cross-session-analytics*
*Context gathered: 2026-09-13*
