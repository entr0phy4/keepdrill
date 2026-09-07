# Phase 4: Session Persistence & History - Context

**Gathered:** 2026-09-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Every completed typing exercise persists to IndexedDB automatically — no explicit
save action — storing the full raw session (not just summary numbers), and past
sessions are browsable as a newest-first history list. A save failure never
blocks or delays the results screen; the user just sees a small non-blocking
notice.

**In scope:** PERS-01 (auto-persist full raw session, survives reload),
PERS-02 (newest-first history list: date, WPM, accuracy), PERS-03 (non-blocking
save-failure notice).

**Out of scope (own phases / deferred):** symbol-adjusted WPM and paste-language
picker (Phase 5), cross-session digraph/heatmap/per-language analytics (Phase 6),
per-session drill-down re-derived from raw log (ANLY-07, Future Requirements),
trend/evolution charts (PROJECT.md Out of Scope), cross-device sync (no backend
in v1.1).
</domain>

<decisions>
## Implementation Decisions

### Stack & Architecture (locked upstream by research — carried forward, not re-discussed)
- **D-01:** Persistence uses **Dexie 4** + **dexie-react-hooks** (`useLiveQuery`); **fake-indexeddb** as a dev-only dep so the persistence layer runs under Vitest. No other new runtime deps. — **Reversibility:** costly — swapping the IndexedDB wrapper later touches every query site and the schema-migration code.
- **D-02:** Persist the **raw `Session`** (`exercise`, `events`, `charLog`, `markers`, `timingResolutionUs`, `crossOriginIsolated`, `startedAt`) as the source of truth, plus a **cached `MetricsResult` snapshot** alongside for fast list rendering. Never persist only the derived metrics. — **Reversibility:** one-way — dropping raw-log persistence means historical sessions can never be recomputed when a formula improves, which defeats the "measure improvement over a month" goal. This is the whole point of the schema.
- **D-03:** New **`persistence/` platform seam** (`db.ts`, `repository.ts`, `types.ts`) is the **only** module that imports Dexie. Follows the established pure-core / platform-seam / hot-path split (Phase 1). `analytics.ts` (Phase 6) and `metrics.ts` stay pure and never import from `persistence/`.
- **D-04:** The completion write is **fire-and-forget** inside `App.tsx::handleComplete`, called **after** `setMetrics(result)`. Never `await`ed in the render path. The results screen renders immediately regardless of write outcome (PERS-03).
- **D-05:** **Dexie schema-versioning discipline from day one:** each schema change is a new `.version()` block; a shipped version block is never edited. All cross-session aggregation (Phase 6) gates on `schemaVersion` equality and recomputes stale rows rather than blending formula versions.
- **D-06:** Request durable storage via `navigator.storage.persist()` to resist Safari's ~7-day best-effort eviction of the entire history.

### History View Placement
- **D-07:** History is a **separate view**, toggled from a link/button in the app header, switching between the trainer view and a full-page history list. Chosen over an always-visible or collapsible section because Phase 6 analytics views will need the same navigation surface. — **Reversibility:** reversible — it is a conditional render in `App.tsx`, no router.
- **D-08:** Switching to the History view **mid-exercise preserves in-progress trainer state** — the trainer/`CaptureSurface` is hidden, not unmounted, so returning resumes typing with the capture buffer intact. No progress is silently lost and no confirm dialog is shown. — **Reversibility:** costly — depends on how `CaptureSurface`'s `key={loadToken}` remount and the `capture.ts` module buffer lifecycle interact; planner must verify hiding (not unmounting) actually preserves capture state, or adjust the approach.
- **D-09:** The history list **live-updates via `useLiveQuery`** — the just-finished session appears after the fire-and-forget write resolves, with no reload.
- **D-10:** Finishing an exercise does **nothing** to the history view — the app stays on the results screen. The new row is simply present when the user next opens History (no auto-navigation, no flash/highlight).

### History Row Content
- **D-11:** Each row shows: **date**, **WPM**, **accuracy** (required by PERS-02), plus **source label** (filename from `exercise.sourceRef` for uploads, "Pasted snippet" for paste), **language tag** (`exercise.language` — mostly `'plaintext'` until Phase 5), **exercise length** (character or line count of `exercise.text`), and a **slowest-key chip** (`#1` from the cached `MetricsResult.slowest5`, reusing `glyphFor` for whitespace keys as `ResultsView` does).
- **D-12:** **Date format:** relative ("2h ago", "3d ago") with the full absolute timestamp available on hover (`title` attribute). Derived from `startedAt` (`Date.now()` wall clock — the display-only field, per `capture/types.ts`).
- **D-13:** History rows are **inert / read-only** in Phase 4 — no click target, no expansion. Per-session drill-down (re-deriving a past session's own breakdown from its raw log) stays deferred to ANLY-07.
- **D-14:** History list has an explicit **empty state** ("No sessions yet — finish a typing exercise and it'll show up here" or similar).

### Save-Failure Notice
- **D-15:** The "session wasn't saved" notice renders **inline near the results panel**, `role="status"`, matching the existing `Banners.tsx` convention (prop-driven, non-blocking). No toast infrastructure.
- **D-16:** The notice is **manually dismissible** (has an X / close control) — distinct from the existing non-dismissible startup banners.
- **D-17:** **Single generic message** regardless of failure cause — e.g. "This session couldn't be saved to your history." No branching on quota-exceeded vs IndexedDB-unavailable; the cause is rarely actionable by the user.

### Retention & What Persists
- **D-18:** **Keep all sessions and their full raw logs forever** for v1.1. No pruning, no cap. Revisit only if storage size becomes visibly a problem in daily use. Aligns with the retroactive-recompute goal (D-02) and research's "not a problem at single-user daily-use scale" assessment. — **Reversibility:** reversible — adding a prune/cap policy later is a pure addition; no data-shape change.
- **D-19:** **Only completed exercises persist** — a session is written when `CaptureSurface` fires `onComplete` (the whole target typed), which is exactly where metrics compute today. Restarts and abandoned/replaced exercises persist nothing. No partial-session semantics enter the data model.
- **D-20:** A restart-then-finish produces **one history entry per completion** — restarting mid-run just resets capture and writes nothing; each completed run is one row. Finishing the same text twice is two legitimate rows.

### Claude's Discretion
- `StoredSession` record shape and primary-key strategy (auto-increment id vs. `startedAt`-based vs. UUID), index definitions, and the exact `db.ts` / `repository.ts` API surface — planner/researcher decide within D-02/D-03/D-05.
- Exact wording of the empty state and the save-failure message.
- Whether "exercise length" (D-11) is shown as characters or lines.
- Header toggle visual treatment (link, button, tab-like) — subject to a UI-SPEC pass (`/gsd-ui-phase 4`).
- How relative-time strings are computed (hand-rolled vs. `Intl.RelativeTimeFormat`) — no new dep either way.
- Test strategy for the Dexie layer (fake-indexeddb is the agreed harness; coverage depth is planner's call).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v1.1 Milestone Research (primary — read before planning)
- `.planning/research/SUMMARY.md` — the consolidated v1.1 plan: two-new-deps stack, raw-session persistence + cached snapshot model, `persistence/` seam design, the App.tsx write integration point, and the pitfall cluster (schema versioning, un-awaited write race, unbounded storage).
- `.planning/research/ARCHITECTURE.md` — detailed integration design grounded in direct source reads (`session.ts`, `metrics.ts`, `App.tsx`, `capture/types.ts`).
- `.planning/research/PITFALLS.md` — full pitfall list; Phase 4 owns #1 (persist raw not derived), #6 (first Dexie migration discipline), #7 (raw-event storage growth), #8 (un-awaited completion write race).
- `.planning/research/STACK.md` — Dexie 4.4.5 / dexie-react-hooks 4.4.0 / fake-indexeddb version verification and rationale.

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — PERS-01/02/03 (this phase); ANLY-07 (deferred drill-down) in Future Requirements.
- `.planning/ROADMAP.md` §"Phase 4" — goal, success criteria, dependency note (builds on v1.0 Phase 3's session/metrics pipeline).
- `.planning/PROJECT.md` §"Key Decisions" — active-time WPM basis, Unicode-codepoint indexing rule, platform-seam discipline (all constrain how new persistence/UI code is written).

### Existing UI conventions
- `.planning/milestones/v1.0-phases/03-session-metrics/03-UI-SPEC.md` — results-screen display conventions (no threshold color-coding, no gamified framing, `role="status"` prop-driven panels) the history view and save-notice must match.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/session.ts::buildSession(exercise, startedAt)` — already produces the exact `Session` value object to persist; header comment literally says "Phase 4 persists it". `handleComplete` in `App.tsx` already calls it at completion.
- `src/metrics/metrics.ts::computeSessionMetrics(...)` → `MetricsResult` (`schemaVersion`, `wpm`, `accuracy`, `slowest5`) — this is the snapshot to cache alongside the raw session. Already computed in `handleComplete`.
- `src/ui/Banners.tsx` — the prop-driven, `role="status"`, non-blocking banner pattern to mirror for the save-failure notice (D-15).
- `src/ui/ResultsView.tsx` — `role="status"` results panel; uses `glyphFor` from `src/trainer/state.ts` for whitespace key-chips — reuse for the history row's slowest-key chip (D-11).
- `src/ingestion/types.ts::Exercise` — `text`, `language` (`'plaintext'` for paste), `sourceType`, `sourceRef?` (filename for uploads) — the source of the row's source label + language tag.
- `src/capture/types.ts::Session` — the exact shape to persist; `startedAt` is the display-only wall-clock field for the row date (D-12).

### Established Patterns
- Pure-core / platform-seam / hot-path module split (Phase 1 decision, reaffirmed in STATE.md for v1.1) — `persistence/` is a new platform seam; `metrics.ts`/`analytics.ts` stay pure.
- `METRICS_SCHEMA_VERSION` constant + `schemaVersion` field on `MetricsResult` — the precedent for versioned persisted computations; D-05 extends the same idea to the Dexie schema.
- Unicode: iterate/index text by code point (`Array.from`), never raw UTF-16 — applies to any "exercise length in characters" computation (D-11).
- No rounding outside the display layer (`metrics.ts` never rounds; `ResultsView` does) — history rows round at render, same as `ResultsView`.

### Integration Points
- `src/ui/App.tsx::handleComplete(completedAt)` — the single write site: after `setMetrics(result)`, call the fire-and-forget `persistence` write with `{ session, metricsSnapshot: result }` (D-04). A rejected promise sets a piece of state that renders the D-15 notice; it never throws into the render path.
- `src/ui/App.tsx` render — add a header toggle and a conditional branch between the trainer subtree and a new `HistoryView` (D-07), hiding rather than unmounting the trainer (D-08).
- New `src/ui/HistoryView.tsx` — consumes `useLiveQuery` over the `persistence` repository (D-09).
</code_context>

<specifics>
## Specific Ideas

- The save-failure notice should feel like the existing banners — quiet, inline, `role="status"` — not a modal or a loud alert. The one departure from the banner convention is that this one gets a dismiss control (D-16).
- Header toggle is explicitly meant to be the same navigation surface Phase 6's analytics views will hang off — don't build it as a one-off for history only.
- "Keep everything forever" is a deliberate v1.1 choice tied to the month-long improvement-measurement goal, not an oversight — the planner should not add a cap "to be safe".
</specifics>

<deferred>
## Deferred Ideas

- **Per-session drill-down** (click a history row → re-derived slowest-5 / digraph breakdown from that session's raw log) — ANLY-07, already in REQUIREMENTS.md Future Requirements. Rows are inert in Phase 4 (D-13) partly to leave room for this.
- **Retention / prune policy** — revisit only if IndexedDB storage size becomes visible in daily use (D-18). Tracked as a known future knob, not scoped now.
- **Distinguishing save-failure causes** (quota vs. private-mode/unavailable) with tailored messaging — considered and rejected for v1.1 (D-17); could revisit if the generic message proves confusing in practice.
- **Delete / clear-history controls** — not raised as needed for v1.1; note for a later phase if the user wants to curate history.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 4-session-persistence-history*
*Context gathered: 2026-09-06*
