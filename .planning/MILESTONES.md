# Milestones

## v1.1 Persistencia y Analíticas (Shipped: 2026-09-20)

**Delivered:** Completed sessions persist locally to IndexedDB and the user can inspect symbol-adjusted WPM, ranked digraph latency, a US-ANSI keyboard heatmap, and a per-language profile across history.

**Phases completed:** 3 phases, 7 plans, 19 tasks
**Timeline:** 2026-09-05 → 2026-09-20 (~15 days) · 113 files changed, +14580/-1262 · ~5,966 LOC (src/)
**Git range:** `feat(04-01)` → `feat(06-03)`
**Closeout type:** override_closeout
**Known verification overrides:** 1 (see Known Gaps)

**Key accomplishments:**

- Dexie 4 platform seam persisting the full raw Session + cached MetricsResult to IndexedDB on every completion, fire-and-forget from `App.tsx::handleComplete`, with a minimal `useLiveQuery`-bound History view and a dismissible save-failure notice.
- `HistoryRow` expandido a las siete columnas D-11/D-12 (fecha relativa, wpm, accuracy, source, idioma, longitud, tecla más lenta) vía `resolveMetrics`/`relativeTime`/`glyphFor`, estilado según 04-UI-SPEC sin nuevos tokens, con el contrato D-08 hide-not-unmount endurecido y verificado en happy-dom.
- Companion `symbolAdjustedWpm` from a target-only density classifier (`SYMBOL_WEIGHT=2`), schema v2 recompute-on-read, shown as "adj. wpm" on results and `{wpm} / {adj} adj.` in history
- Closed Language `<select>` on the paste path, fed by `PASTE_LANGUAGE_OPTIONS` derived from `EXT_TO_LANG`, with `fromPaste`'s language now a required caller-supplied argument
- Single `gatedMedian` owns the exclusive (25ms, 1000ms) window and both sample gates; `resolveMetrics` moved to `src/metrics/` so analytics never imports `ui/`
- Pure `src/analytics/` folds: ranked digraphs (top 10, n≥5), full US-ANSI heatmap by physical code, and unweighted per-language `resolveMetrics` means — zero DOM, zero Dexie, zero rounding
- Stacked Analytics sibling view: semantic top-10 digraph table, static US-ANSI amber heatmap with on-key ms, and per-language profile including plaintext — hide-not-unmount from a third header item

### Known Gaps

- Phase 5 never produced `05-VERIFICATION.md` (`verification_status: missing`) and its ROADMAP checkbox was never sealed before close, despite `05-UAT.md` complete (10/10) and ANLY-01/02 checked. Accepted as tech debt at milestone close (`override_closeout`).

**What's next:** Trigraph latency (ANLY-06), per-session drill-down (ANLY-07), language-filtered heatmap/digraphs (ANLY-08), auto language detection for paste (ANLY-09) — define via `/gsd-new-milestone`.

---

## v1.0 MVP (Shipped: 2026-09-05)

**Phases completed:** 3 phases, 8 plans, 15 tasks
**Timeline:** 2026-09-03 → 2026-09-05 (~2 days) · 99 files changed, +17026/-20 · ~3,156 LOC (src/)

**Key accomplishments:**

- Vite 8 / React 19 / TS 5.9 SPA that loads pasted text through a pure zero-dependency normalizer (18 golden cases) into an in-memory Exercise, renders it as an inert <pre> preview, and appends every keydown/keyup to an append-only high-resolution KeystrokeEvent[] — served cross-origin-isolated with COOP/COEP verified on the document via `curl -I` against `pnpm preview`.
- Browser File-API upload path (`File.text()` UTF-8) through the same pure `normalize()` into an in-memory `Exercise`, guarded by a pre-read 100 KB cap and a UTF-16-BOM / U+FFFD non-UTF-8 check that surface as fixed inline copy — plus the empty, loading, and last-wins `CorpusInput` states the walking skeleton deferred.
- Completed the append-only capture engine — a seq-keyed committed-character log from `beforeinput`/`input` with IME composition and selective paste/drop blocking, blur/visibility lifecycle markers with down-set clearing, a `queueMicrotask`-deferred timer-resolution measurement tap — and finalized both chrome banners plus the production-host/privacy README.
- Pure `computeTrainerState` reducer + transparent-textarea-over-rendered-layer overlay delivering live per-character correctness coloring, free-correction, backspace, and whitespace glyphs — end-to-end and proven by an automated React-DOM render test.
- Restart button (D-08) with an Escape-key keyboard path, a Tab keydown that fully no-ops instead of stealing focus (D-07 amended), a focus/visibility-aware caret blink, and a pure `computeActiveElapsedMs` toggle-state-machine ready for Phase 3.
- `resyncCaret()` now fires on every native selection-change event (ArrowLeft/Right/Home/End/click) via `onSelect`, not only when `cursor` itself changes — closing 02-VERIFICATION.md's one blocking gap — plus an `isTrusted` guard on `handleKeyDown` matching `capture.ts`'s T-01-04 convention.
- Pure, re-runnable `metrics.ts` engine: net WPM (Monkeytype formula, active-time basis), accuracy (every attempt counted, including corrected-over ones), and five-slowest-keystrokes (median/trimmed, outlier-filtered, 3-sample gate) — auto-revealed in a `ResultsView` panel the instant an exercise completes.
- Found and fixed a critical cross-phase bug during code review: target text was indexed by UTF-16 code unit while the cursor advanced by Unicode code point, desyncing scoring (and potentially making an exercise uncompletable) for any text containing a supplementary-plane character — fixed in `state.ts`, `metrics.ts`, and `CaptureSurface.tsx`, independently re-verified by hand-executing the pre-fix algorithm against new regression tests.

---
