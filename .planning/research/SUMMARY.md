# Project Research Summary

**Project:** keebdrill
**Domain:** Local-first browser SPA — adding session persistence + cross-session code-typing analytics to an existing single-session typing trainer
**Researched:** 2026-09-05
**Confidence:** MEDIUM-HIGH

## Executive Summary

v1.1 adds durable local storage of completed sessions plus four analytics views computed from that history: digraph/trigraph latency, a keyboard heatmap, a per-language profile, and a symbol-density-adjusted WPM. This is narrower than it sounds — v1.0 already assembles everything these features need (`session.ts`'s header comment literally says "Phase 4 persists it"), so the milestone is mostly *plumbing existing data into IndexedDB and folding it across sessions*, not new capture or ingestion work.

The recommended approach: add exactly two new runtime dependencies (Dexie + dexie-react-hooks) for persistence, and hand-roll every analytics computation as pure TypeScript extending the existing `metrics.ts` conventions (outlier-discard-then-median, `MIN_SAMPLES` gating) — no charting/heatmap library earns its weight at this project's fixed-US-ANSI-layout, no-trend-charts scope. Persist the *raw* session (`exercise`, `events`, `charLog`, `markers`), not just derived metrics, and cache one metrics snapshot alongside for fast list rendering — this is what makes every analytics feature retroactively apply to all historical sessions when a formula improves later, which is the whole point of a "measure improvement over a month" success criterion.

The main risk cluster is data-quality, not engineering difficulty: (1) per-language profile is dead on arrival unless the paste-form's `'plaintext'`-only tagging gap is closed with a manual language picker, and (2) cross-session digraph/trigraph rankings will be noise unless the existing single-session sample-size/outlier-gating discipline is generalized and reused rather than reimplemented from scratch. A secondary risk is schema-versioning discipline on the very first Dexie migration, and unbounded raw-log storage growth — both cheap to prevent now, expensive to retrofit later.

## Key Findings

### Recommended Stack

Two new runtime deps only: **Dexie 4.4.5** (IndexedDB wrapper — schema versioning, typed queries) and **dexie-react-hooks 4.4.0** (`useLiveQuery` for a reactive history list). One new dev dep: **fake-indexeddb** (lets the persistence layer run under Vitest's Node environment). Everything else — digraph/trigraph aggregation, the keyboard heatmap, per-language grouping, symbol-density classification — is pure TS with zero new packages; no heatmap or charting library fits this project's fixed 90-key US-ANSI, no-trend-charts scope.

**Core technologies:**
- Dexie 4.4.5: session/keystroke-log persistence + schema migrations — replaces painful raw-IndexedDB boilerplate with a typed, Promise-based API
- dexie-react-hooks 4.4.0: `useLiveQuery()` — reactive history view without hand-rolled refetch wiring
- fake-indexeddb (dev): unit-tests the Dexie layer in Vitest, which has no `indexedDB` global otherwise
- `navigator.storage.persist()` (browser built-in): requests durable storage — mitigates Safari's ~7-day best-effort eviction, which would otherwise silently destroy a user's entire typing history

### Expected Features

**Must have (table stakes):**
- Session persistence (Dexie) storing the full raw session, not just summary numbers
- History list view (date, WPM, accuracy, newest first — no charts)
- Symbol-density-adjusted WPM as a companion metric next to net WPM
- Digraph latency table, accumulated across sessions, reusing the existing sample-gating discipline
- Keyboard heatmap, keyed by physical `KeyboardEvent.code` (a new aggregation axis, distinct from the existing character-keyed slowest-5)
- **Prerequisite fix:** manual language picker/override on the paste form — without it, per-language profile has no real data (paste always tags `'plaintext'` today)
- Per-language profile, once the above gap is closed

**Should have (competitive):**
- Session detail drill-down (re-view a past session's own breakdown) — cheap once raw logs are persisted

**Defer (v2+):**
- Trigraph latency (needs more accumulated data than digraphs to clear a meaningful sample gate)
- Heatmap filtered by language
- Trend/evolution charts over history (explicitly out of scope per PROJECT.md)
- Auto language detection (manual picker is the correct-for-now answer; tree-sitter-based detection is a separate later phase)

### Architecture Approach

Persist the raw `Session` shape as source of truth (a new `persistence/` platform seam — the only module that touches Dexie), cache one schema-versioned `MetricsResult` snapshot alongside for cheap list rendering, and add a new `analytics/` module as a sibling to `metrics/` for cross-session pure folds (digraph/trigraph, heatmap, per-language). `metrics.ts` stays a fold over one session; `analytics.ts` folds over N stored sessions — same purity contract (no DOM, no IndexedDB import), different cardinality. The only write integration point is one new fire-and-forget call inside `App.tsx`'s existing `handleComplete`, after `setMetrics(result)` — never awaited in the render path, never gating the results screen.

**Major components:**
1. `persistence/` (db.ts, repository.ts, types.ts) — the only Dexie import site; schema v1 storing the full `StoredSession`
2. `metrics/symbol-density.ts` — new pure symbol classifier + `metrics.ts` extension for symbol-adjusted WPM (`METRICS_SCHEMA_VERSION` → 2)
3. `analytics/` (analytics.ts, heatmap.ts or folded in, keyboard-geometry.ts, types.ts) — cross-session pure folds for digraph/trigraph, heatmap, per-language
4. `ui/HistoryView.tsx` + `ui/AnalyticsDashboard.tsx` (DigraphLatencyView, KeyboardHeatmap, LanguageProfileView) — new read-only views

### Critical Pitfalls

1. **Silently mixing metrics computed by different formula versions across sessions** — persist raw inputs (not just derived `MetricsResult`) and gate all cross-session aggregation on `schemaVersion` equality; recompute stale rows rather than blending them.
2. **`'plaintext'`-tagged paste sessions polluting per-language profile** — close the paste-tagging gap (manual picker) before or within the per-language-profile phase; treat `'plaintext'` as an explicit "untagged" bucket, never a real language.
3. **Un-gated small-N digraph/trigraph rankings becoming noise** — factor the existing `MIN_SAMPLES`/outlier-window/median logic out of `slowestFive` into a shared utility reused by the new cross-session aggregator; trigraphs need a higher threshold than the single-char gate.
4. **Symbol-adjusted WPM double-counting via backspace-corrected attempts** — apply the symbol-density weighting to the *target exercise's* overall density (one scalar per session), not per-attempt over the replay stream, to avoid rewarding fumbled symbols with inflated weighted-WPM.
5. **Dexie schema-versioning mistakes on the first migration** — establish the "new version block, never edit a shipped one" discipline now, even though v1 is the first schema; unbounded raw-event storage and un-awaited write races at session completion are the other two persistence-phase pitfalls to design against from day one.

## Implications for Roadmap

Based on research, suggested phase structure (dependencies flow strictly downward — persistence must exist before any cross-session analytics; symbol-adjusted WPM has no persistence dependency beyond what the first phase already stores):

### Phase A: Persistence Foundation
**Rationale:** Blocks every other phase — all cross-session analytics reads from this table. Also delivers the milestone's most basic promise ("persist each session locally") standalone.
**Delivers:** `persistence/` platform seam (Dexie schema v1, `StoredSession` storing the full raw session), one write call wired into `App.tsx::handleComplete`, and `HistoryView.tsx` (date/WPM/accuracy list, read-only, rendering the cached `metricsSnapshot`).
**Addresses:** Session persistence + History view (table stakes)
**Avoids:** Persisting only derived metrics (Pitfall 1/Anti-Pattern 1); race conditions on the completion write (Pitfall 8); schema-versioning mistakes (Pitfall 6); unbounded raw-event growth (Pitfall 7 — decide retention policy now)

### Phase B: Symbol-Adjusted WPM
**Rationale:** Zero persistence dependency beyond Phase A's stored fields — the fastest, most self-contained slice, and a good end-to-end validation of the "recompute on schema-version mismatch" path before anything more complex is built on top.
**Delivers:** `metrics/symbol-density.ts` classifier, `metrics.ts` extension (`symbolAdjustedWpm`, schema bump to v2), `ResultsView.tsx` display as a companion metric (never a silent replacement of net WPM).
**Uses:** Existing `metrics.ts` conventions
**Implements:** The target-density weighting approach (not per-attempt) to sidestep the double-counting pitfall

### Phase C: Cross-Session Analytics (digraph/trigraph latency, keyboard heatmap, per-language profile)
**Rationale:** All three read the exact same `StoredSession[]` and live in the same new `analytics.ts` module; research explicitly flags these as independent of each other and mergeable into one phase if the roadmap favors fewer, larger phases. Include the paste-language-picker prerequisite here (or as a small task at the start of this phase) since per-language profile is otherwise dead on arrival.
**Delivers:** Shared filter/gate/median helper extracted from `slowestFive`; `analytics/analytics.ts` (`computeDigraphLatency`, `computeKeyboardHeatmap`, `computeLanguageProfile`); `keyboard-geometry.ts` static US-ANSI layout table; manual paste-language picker; `DigraphLatencyView.tsx`, `KeyboardHeatmap.tsx`, `LanguageProfileView.tsx`.
**Addresses:** Digraph/trigraph latency, keyboard heatmap, per-language profile
**Avoids:** Un-gated small-N rankings (Pitfall 3); `'plaintext'` pollution (Pitfall 4); heatmap keyed by wrong axis (Anti-Pattern 4 — must key by `KeyboardEvent.code`, not committed character)

### Phase Ordering Rationale

- Persistence must come first — every other phase's data model literally does not exist without it.
- Symbol-adjusted WPM has no cross-session dependency, so it can run second (cheapest, fastest feedback loop) or in parallel with early persistence work if the team wants to split effort.
- Digraph/trigraph, heatmap, and per-language profile are mutually independent but all depend on Phase A and share one new module — grouping them avoids three near-identical small phases each re-deriving the same shared latency-stats helper.
- Trigraph latency is deliberately excluded from the v1.1 phase list (research recommends deferring it to a fast-follow once real session volume accumulates enough per-triple samples).

### Research Flags

Phases likely needing deeper research/design discussion during planning:
- **Phase B (Symbol-Adjusted WPM):** The exact weighting formula (which characters count as "symbol," linear vs. non-linear weighting) is a genuine product decision with no external standard — resolve during phase discussion, not as an implementation-time judgment call, per Pitfall 5.
- **Phase C (Cross-Session Analytics):** The digraph/trigraph minimum-sample threshold (likely higher than the existing single-char `MIN_SAMPLES = 3`) needs to be picked empirically or provisionally and revisited once real data accumulates.

Phases with standard patterns (skip research-phase):
- **Phase A (Persistence Foundation):** Dexie's schema-versioning and `useLiveQuery` patterns are well-documented; the data model is already dictated by the existing `Session` shape and `session.ts`'s own forward-looking comment.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Dexie/dexie-react-hooks versions verified via direct npm registry fetch; "hand-roll the heatmap" conclusion is reasoned from absence of a fitting library, not a definitive negative proof |
| Features | MEDIUM-HIGH | Session-history and digraph patterns cross-checked against Monkeytype/Keybr precedent; symbol-adjusted WPM has no external precedent — flagged explicitly as a keebdrill-original design needing a phase-time decision |
| Architecture | HIGH | Integration design grounded in direct reads of `session.ts`, `metrics.ts`, `App.tsx`, `capture/types.ts`, etc. — not inferred from generic patterns |
| Pitfalls | MEDIUM-HIGH | Codebase-grounded findings (schema versioning, clock-domain mixing, sample-gating) are HIGH; general IndexedDB/quota/accessibility claims are MEDIUM (official docs, cross-checked) |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- Exact symbol-adjusted WPM weighting formula: no external standard exists — resolve as a phase-discussion decision (Phase B), not left implicit.
- Digraph/trigraph minimum-sample threshold: pick provisionally, revisit once real accumulated session data is available (Phase C).
- Whether the paste-language-picker should be its own tiny prerequisite phase or a first task inside Phase C is a roadmap-sequencing call, not a research gap — noted above as folded into Phase C.
- Raw-event retention policy (prune vs. keep-forever) is deferred as "not a problem at this project's single-user daily-use scale" — revisit only if storage size becomes visible in practice.

## Sources

### Primary (HIGH confidence)
- Direct source reads: `src/session.ts`, `src/metrics/metrics.ts`, `src/capture/types.ts`, `src/ui/App.tsx`, `src/ui/CaptureSurface.tsx`, `src/ui/ResultsView.tsx`, `src/ingestion/types.ts`, `src/ingestion/language-map.ts`, `src/platform/layout.ts`, `src/trainer/active-time.ts`, `package.json`
- https://www.npmjs.com/package/dexie — v4.4.5 confirmed via direct registry.npmjs.org fetch
- https://www.npmjs.com/package/dexie-react-hooks — v4.4.0 confirmed via direct registry fetch

### Secondary (MEDIUM confidence)
- https://dexie.org/docs/dexie-react-hooks/useLiveQuery() and https://dexie.org/docs/Version/Version.upgrade().html — Dexie schema/hook usage patterns
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria + https://webkit.org/blog/14403/updates-to-storage-policy/ — quota/eviction behavior
- Keystroke-dynamics academic literature (digraph/trigraph latency definitions) — cross-checked across multiple papers
- Competitor feature surveys (Monkeytype, Keybr, 10FastFingers) — session history and digraph presentation conventions

### Tertiary (LOW confidence)
- Existing keyboard-heatmap prior art (several small GitHub projects, all `heatmap.js`-based) — confirms the "wrong abstraction for a discrete key set" conclusion but no single authoritative source

---
*Research completed: 2026-09-05*
*Ready for roadmap: yes*
