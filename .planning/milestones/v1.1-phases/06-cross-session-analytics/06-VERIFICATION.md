---
phase: 06-cross-session-analytics
verified: 2026-09-20T18:40:00Z
status: passed
score: 22/22 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Chromium light + dark — empty Analytics, then populated after several mixed-language sessions"
    expected: "Empty DB shows page empty copy and no keyboard diagram. After sessions, stacked Slowest digraphs → Keyboard heatmap → Language profile; top-10 table omits thin pairs; sequential amber heatmap with on-key ms (not green/red score colors); language rows include plaintext; no shaming/guilt copy."
    why_human: "happy-dom cannot paint sequential amber vs accent/destructive, confirm 06-UI-SPEC contrast, or judge copy tone. 06-03 PLAN end-of-phase human-check items 1–2 plus judgment-tier prohibitions."
  - test: "Mid-exercise switch to Analytics and back in Chromium"
    expected: "Typed text, per-character status, caret, and IME composition survive the display:none toggle. CorpusInput stays visible on Analytics."
    why_human: "happy-dom App.test.tsx D-08 proves node identity and caret index; real uncontrolled-textarea selection/IME needs a browser (same residual as Phase 4)."
  - test: "At 320px viewport the keyboard diagram never expands #root horizontally"
    expected: "Overflow is confined to .keyboard-heatmap (overflow-x: auto); the US-ANSI silhouette remains intact after a horizontal scroll."
    why_human: "verification: backstop — no held-out layout test; happy-dom has no layout engine (insufficient_spec)."
  - test: "An unexpectedly long exercise.language string in the language table"
    expected: "The tag wraps or breaks inside its table cell and never causes a page-level horizontal scrollbar."
    why_human: "verification: backstop — .analytics-table has no overflow-wrap; wrapping is not exercised by tests (insufficient_spec)."
  - test: "Every drawn key's label (≤5 chars) plus optional 1–4 digit ms number"
    expected: "Stay inside the 32×48 key box without overflowing into a neighbor."
    why_human: "verification: backstop — CSS min-width/min-height exist; box overflow is a paint/layout check (insufficient_spec)."
  - test: "Subsequent useLiveQuery live updates after the first populated resolve"
    expected: "Do not flash Loading analytics… or unmount sections; only table/heatmap contents update in place."
    why_human: "verification: backstop — the three-way branch is tested for first paint only, not a later live-query refresh (insufficient_spec)."
---

# Phase 6: Cross-Session Analytics Verification Report

**Phase Goal:** The user can see patterns across their accumulated typing history: which digraphs and physical keys are slowest, and how they perform by language.
**Verified:** 2026-09-20T18:40:00Z
**Status:** passed (UAT 2026-09-20: 6/6 human checks passed)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Roadmap success criteria first, then unique PLAN must-haves. UI-SPEC rows that restate a roadmap SC keep the roadmap wording. Four `verification: backstop` truths have no held-out evidence and are **not** counted in the verified score.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The user can view a ranked table of their slowest digraphs accumulated across all persisted sessions, with digraphs below a minimum-sample threshold excluded from the ranking. | ✓ VERIFIED | `computeDigraphLatency` pools `charLog` into a `Map`, gates with `gatedMedian(samples, DIGRAPH_MIN_SAMPLES)`, omits nulls, sorts median desc, `slice(0, 10)`. Dashboard mounts `DigraphLatencyView` from that fold when `sessions.length > 0`. `analytics.test.ts` 4-vs-5 gate, cap-10 across 11 sessions, empty `[]`. `AnalyticsDashboard.test.tsx` empty-copy vs populated table. |
| 2 | The user can view a keyboard heatmap highlighting which physical keys have the highest median latency across their session history. | ✓ VERIFIED | `computeKeyboardHeatmap` keys IKI by `KeystrokeEvent.code`, returns one cell per `US_ANSI_KEYS`, `medianMs` null below gate. `KeyboardHeatmap` paints relative `--heatmap-lo/--heatmap-hi` mix and on-key `Math.round` ms. `heatmap.test.ts` Digit9 pooling, ShiftLeft non-anchor, below-gate null. `KeyboardHeatmap.test.tsx` figure + sampled vs unused fill. |
| 3 | The user can view a per-language profile showing WPM and accuracy grouped by tagged language, with untagged/plaintext sessions kept in their own distinct bucket rather than mixed into a real language. | ✓ VERIFIED | `computeLanguageProfile` groups on raw `exercise.language`, unweighted mean of `resolveMetrics` wpm / symbolAdjustedWpm / accuracy. `analytics.test.ts` two rust + one plaintext → rust first, plaintext present. `LanguageProfileView` shows verbatim `.key-chip` plus Adj. WPM. |
| 4 | A single exported filter→gate→median helper owns the exclusive (25ms, 1000ms) window so digraph ranking and the heatmap cannot drift from slowestFive | ✓ VERIFIED | Only `src/metrics/latency-stats.ts` defines `MIN_GAP_MS`/`MAX_GAP_MS`. `metrics.ts`, `analytics.ts`, and `heatmap.ts` all call `gatedMedian`. No private `const MIN_GAP_MS` remains in `metrics.ts`. |
| 5 | DIGRAPH_MIN_SAMPLES is a named export equal to 5 | ✓ VERIFIED | `latency-stats.ts` `export const DIGRAPH_MIN_SAMPLES = 5`. `latency-stats.test.ts` asserts the constant. Digraph and heatmap folds import it (not a magic 5). |
| 6 | slowestFive still gates on CHAR_MIN_SAMPLES = 3 and returns at most 5 SlowestKeyEntry values with no sampleCount field | ✓ VERIFIED | `SlowestKeyEntry` is `{ char, medianMs }` only. `slowestFive` pushes `gated.medianMs` and `slice(0, 5)`. `metrics.test.ts` n=7 (3 vs 2 samples), n=9 cap-at-5 still pass. |
| 7 | resolveMetrics lives in src/metrics/ so analytics never imports from src/ui/; HistoryView keeps compiling via a one-line re-export | ✓ VERIFIED | `src/metrics/resolve-metrics.ts` exports the function. `history-metrics.ts` is `export { resolveMetrics } from '../metrics/resolve-metrics'`. `HistoryView.tsx` still imports `./history-metrics`. `analytics/` has zero `../ui/` imports. |
| 8 | resolveMetrics returns the cached snapshot when schemaVersion matches and recomputes with completedAtTMs as now when it mismatches | ✓ VERIFIED | `history-metrics.test.ts` identity-on-match and `computeSessionMetrics(..., 9999)` on mismatch. Language-profile stale-schema case still yields a finite `symbolAdjustedWpm`. |
| 9 | Exclusive window discards 25/1000 and keeps 26/999; gatedMedian of 4 in-window samples with min=5 is null; 5th sample yields `{medianMs, sampleCount}`; median([]) is 0; even-length mean is unrounded | ✓ VERIFIED | `latency-stats.test.ts` golden tables (gated n=1–5, median n=1–3). `metrics.test.ts` n=8 exclusive window still green. No `Math.round` in `latency-stats.ts`. |
| 10 | Digraph pairs are two Unicode codepoints from consecutive inserts (never KeyboardEvent.code); sub-threshold pairs omitted not greyed; each row carries unrounded medianMs + sampleCount | ✓ VERIFIED | Walk uses `Array.from(rec.data ?? '')`. Tests: supplementary-plane one element, `{x` vs `[x`, delete does not span, IME last-codepoint, 4 omitted / 5 present with `sampleCount: 5`. Zero `Math.round` in `analytics.ts`. UI greys nothing — empty copy or table of fold output only. |
| 11 | Heatmap IKI is keydown→keydown among sampleable codes; isRepeat and modifiers are neither samples nor anchors; unused keys stay in the array with medianMs null | ✓ VERIFIED | `heatmap.ts` skips non-keydown, `isRepeat`, `!isSampleable`. Result length === `US_ANSI_KEYS.length`. Tests: Digit9 glyph-independent pooling, ShiftLeft non-anchor (140 not 100), below-gate null, tMs-only. |
| 12 | Language aggregation is the unweighted arithmetic mean of per-session resolveMetrics; plaintext is a normal map key; rows sort by sessionCount desc | ✓ VERIFIED | `analytics.test.ts` rust wpm (40+60)/2 = 50; plaintext not folded; equal-n tie-break python < rust. No sessionCount gate beyond ≥1. |
| 13 | The user can open a third header item labeled Analytics and see a stacked dashboard of slowest digraphs, then the keyboard heatmap, then the per-language profile | ✓ VERIFIED | `App.tsx` view union `'trainer' \| 'history' \| 'analytics'`; third nav button; `{view === 'analytics' && <AnalyticsDashboard />}`. `App.test.tsx` three-button aria-current invariant. Populated dashboard h3 order: Slowest digraphs → Keyboard heatmap → Language profile. |
| 14 | Zero persisted sessions shows the page-level empty copy and does not mount the three sections; undefined is loading, not empty | ✓ VERIFIED | `AnalyticsDashboard.tsx` three-way branch. Tests: first paint `Loading analytics…` without empty copy or section titles; `[]` History-matching empty sentence and no h3s; ≥1 session mounts all three. |
| 15 | When sessions exist, the ranked digraph table shows at most 10 rows of pair + rounded median ms + sample count; zero eligible pairs is section empty copy (heatmap and language still render) | ✓ VERIFIED | Fold caps at 10. `DigraphLatencyView` locked empty paragraph, no `<table>`; populated `analytics-table` headers Digraph / Median / Samples, `glyphFor` chips, `{Math.round} ms`. Dashboard populated case asserts empty digraph copy **and** `.keyboard-heatmap` present. |
| 16 | When sessions exist, a static US-ANSI diagram shows sequential amber intensity plus on-key milliseconds for gated keys; unused keys stay drawn with surface fill and no number; heatmap is not on the capture hot path | ✓ VERIFIED | Keys are `div.kb-key`, no buttons. Relative lerp + ungated caption tested. CSS `--heatmap-lo: #fef3c7` / `--heatmap-hi: #c97116` light, dark overrides present. `CaptureSurface.tsx` has zero analytics/heatmap imports. `overflow-x: auto` is on `.keyboard-heatmap` only. |
| 17 | When sessions exist, a language table shows WPM, adj. WPM, accuracy, and session count per tag, with plaintext as a visible ordinary bucket | ✓ VERIFIED | Headers Language / WPM / Adj. WPM / Accuracy / Sessions. `LanguageProfileView` test: plaintext chip, rounded 62/78/94%/3, rust 90%. No plaintext rewrite. |
| 18 | History rows stay inert; this page adds no per-session drill-down; digraph pairs, key labels, and language tags render as React text nodes | ✓ VERIFIED | `HistoryView` D-13 comment unchanged; no new row click. Digraph/language tables: no `href`/`onClick`/`tabindex`. Heatmap labels/ms are `<span>` text. No `dangerouslySetInnerHTML` in analytics UI. |
| 19 | at 320px viewport the keyboard diagram never expands #root horizontally; overflow is confined to .keyboard-heatmap | ⚠️ UNVERIFIED (insufficient_spec) | CSS `overflow-x: auto` is present on `.keyboard-heatmap`. No layout test. Backstop → human check. |
| 20 | an unexpectedly long exercise.language string wraps or breaks inside its table cell and never causes a page-level horizontal scrollbar | ⚠️ UNVERIFIED (insufficient_spec) | `.analytics-table` has `width: 100%` but no `overflow-wrap`/`word-break` on cells. No wrap test. Backstop → human check. |
| 21 | every drawn key's label (≤ 5 chars) plus optional 1–4 digit ms number stay inside the 32×48 key box without overflowing into a neighbor | ⚠️ UNVERIFIED (insufficient_spec) | `.kb-key` `min-width: 32px; min-height: 48px`. Labels in geometry are ≤5 chars. Box overflow is paint-only. Backstop → human check. |
| 22 | subsequent useLiveQuery live updates do not flash the page-level loading line or unmount sections; only table/heatmap contents update in place | ⚠️ UNVERIFIED (insufficient_spec) | Branch keys on `undefined` vs `[]` vs length. First-resolve tests exist; a second live update is not asserted. Backstop → human check. |

**Score:** 18/22 truths verified (0 present, behavior-unverified; 4 backstop abstentions)

### Required Artifacts

All `gsd_run query verify.artifacts` results passed existence. Substance and wiring checked in source:

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/metrics/latency-stats.ts` | MIN/MAX_GAP, CHAR/DIGRAPH_MIN_SAMPLES, median, gatedMedian | ✓ VERIFIED | Substantive PURE helper; exclusive `>`/`<` filter; no rounding. |
| `src/metrics/metrics.ts` | slowestFive → gatedMedian(CHAR_MIN_SAMPLES) | ✓ VERIFIED | Private window/median deleted; SlowestKeyEntry unchanged. |
| `src/metrics/resolve-metrics.ts` | resolveMetrics + ResolvableSession | ✓ VERIFIED | `completedAtTMs` as now; readonly charLog/markers. |
| `src/ui/history-metrics.ts` | one-line re-export | ✓ VERIFIED | Guard body gone. |
| `src/analytics/types.ts` | AnalyticsSession, DigraphEntry, HeatmapCell, LanguageProfileRow | ✓ VERIFIED | No Dexie `id`. |
| `src/analytics/keyboard-geometry.ts` | US_ANSI_KEYS, isSampleable | ✓ VERIFIED | Alphanumeric block; modifiers `sampleable: false`; no F-row/arrows/numpad/Intl; no `platform/` import. |
| `src/analytics/analytics.ts` | computeDigraphLatency, computeLanguageProfile | ✓ VERIFIED | Pure; gatedMedian + resolveMetrics; no Dexie/ui/db. |
| `src/analytics/heatmap.ts` | computeKeyboardHeatmap | ✓ VERIFIED | No charLog walk; DIGRAPH_MIN_SAMPLES; isRepeat skip. |
| `src/ui/AnalyticsDashboard.tsx` | useLiveQuery(listNewestFirst) three-way branch | ✓ VERIFIED | Querier only; sections only when `length > 0`. |
| `src/ui/DigraphLatencyView.tsx` | semantic analytics-table + glyphFor | ✓ VERIFIED | Not ResultsView `<ol>`. |
| `src/ui/KeyboardHeatmap.tsx` | static US-ANSI grid, relative amber, on-key ms | ✓ VERIFIED | `--kb-fill` color-mix (happy-dom workaround; browsers paint via `background: var(--kb-fill)`). |
| `src/ui/LanguageProfileView.tsx` | language table + key-chip | ✓ VERIFIED | Adj. WPM always shown. |
| `src/ui/App.tsx` | view union + third nav + hide-not-unmount | ✓ VERIFIED | `display: view === 'trainer' ? 'grid' : 'none'`; no `hidden=` attribute. |
| `src/index.css` | heatmap tokens + .analytics-table + .keyboard-heatmap/.kb-key | ✓ VERIFIED | Light+dark tokens; 15-col grid; `--column-max` unchanged at 45rem. |

### Key Link Verification

`gsd-tools query verify.key-links` reported several `verified: false` results from **invalid/over-escaped regex** (`gatedMedian\\(`, `useLiveQuery\\(listNewestFirst\\)`, etc.), not from missing wiring. Manual grep of the named files:

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/metrics/metrics.ts` | `src/metrics/latency-stats.ts` | `gatedMedian(samples, CHAR_MIN_SAMPLES)` | ✓ WIRED | import + `slowestFive` caller. |
| `src/ui/history-metrics.ts` | `src/metrics/resolve-metrics.ts` | `export { resolveMetrics } from '../metrics/resolve-metrics'` | ✓ WIRED | Exact re-export. |
| `src/analytics/analytics.ts` | `src/metrics/latency-stats.ts` | `gatedMedian(..., DIGRAPH_MIN_SAMPLES)` | ✓ WIRED | Digraph fold. |
| `src/analytics/heatmap.ts` | `src/analytics/keyboard-geometry.ts` | `US_ANSI_KEYS` + `isSampleable` | ✓ WIRED | Tool also reported verified. |
| `src/analytics/analytics.ts` | `src/metrics/resolve-metrics.ts` | `resolveMetrics(s)` per session | ✓ WIRED | Language fold. |
| `src/ui/App.tsx` | `src/ui/AnalyticsDashboard.tsx` | `{view === 'analytics' && <AnalyticsDashboard />}` | ✓ WIRED | Tool verified. |
| `src/ui/AnalyticsDashboard.tsx` | `src/persistence/repository.ts` | `useLiveQuery(listNewestFirst)` | ✓ WIRED | Line 14; never `persistence/db`. |
| `src/ui/AnalyticsDashboard.tsx` | `src/analytics/analytics.ts` | `computeDigraphLatency(sessions)` / `computeLanguageProfile(sessions)` | ✓ WIRED | Only on populated branch. |
| `src/ui/AnalyticsDashboard.tsx` | `src/analytics/heatmap.ts` | `computeKeyboardHeatmap(sessions)` | ✓ WIRED | Same populated branch. |
| `src/ui/KeyboardHeatmap.tsx` | `src/index.css` | `--heatmap-lo/--heatmap-hi/--heatmap-key-fg` + `.kb-key` | ✓ WIRED | Tool verified. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `AnalyticsDashboard.tsx` | `sessions` | `useLiveQuery(listNewestFirst)` → `db.sessions.orderBy('startedAt').reverse().toArray()` | Yes — IndexedDB rows; dashboard test `saveSession` then mounts sections | ✓ FLOWING |
| `DigraphLatencyView` | `rows` | `computeDigraphLatency(sessions)` over persisted `charLog` | Yes — fold over live-query sessions, not a hardcoded `[]` at the call site | ✓ FLOWING |
| `KeyboardHeatmap` | `cells` | `computeKeyboardHeatmap(sessions)` over persisted `events` | Yes — full geometry list; medians from IKI samples | ✓ FLOWING |
| `LanguageProfileView` | `rows` | `computeLanguageProfile(sessions)` via `resolveMetrics` | Yes — grouped from `exercise.language` + snapshot/recompute | ✓ FLOWING |

No hollow props: populated branch always passes fold output, never `rows={[]}` / `cells={[]}`.

### Behavioral Spot-Checks

Ran once: `pnpm test --` (vitest collected the workspace; 224/224 passed, including every Phase 6 file).

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| gatedMedian 4-vs-5, exclusive window, DIGRAPH_MIN_SAMPLES=5 | `pnpm test -- src/metrics/latency-stats.test.ts` | included in 224 pass | ✓ PASS |
| METR-03 n=7/8/9 regression after extract | `src/metrics/metrics.test.ts` | included in 224 pass | ✓ PASS |
| resolveMetrics identity vs completedAtTMs recompute | `src/ui/history-metrics.test.ts` | included in 224 pass | ✓ PASS |
| Digraph gate/cap/Unicode/plaintext language mean | `src/analytics/analytics.test.ts` | included in 224 pass | ✓ PASS |
| Heatmap Digit9 / isRepeat / ShiftLeft / below-gate | `src/analytics/heatmap.test.ts` | included in 224 pass | ✓ PASS |
| Dashboard loading/empty/populated + table leaves | `src/ui/AnalyticsDashboard.test.tsx` | included in 224 pass | ✓ PASS |
| Heatmap figure, ungated caption, relative mix | `src/ui/KeyboardHeatmap.test.tsx` | included in 224 pass | ✓ PASS |
| Three nav buttons + Analytics D-08 round-trip | `src/ui/App.test.tsx` | included in 224 pass | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| — | — | No `scripts/*/tests/probe-*.sh` and no probe paths in PLAN/SUMMARY | SKIPPED |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ANLY-03 | 06-01, 06-02, 06-03 | Ranked slowest-digraph table across sessions, minimum-sample gate | ✓ SATISFIED | Truths 1, 4, 5, 9, 10, 15 |
| ANLY-04 | 06-01, 06-02, 06-03 | Keyboard heatmap of physical-key median latency | ✓ SATISFIED | Truths 2, 11, 16 |
| ANLY-05 | 06-01, 06-02, 06-03 | Per-language WPM/accuracy; plaintext its own bucket | ✓ SATISFIED | Truths 3, 7, 8, 12, 17 |

No orphaned Phase 6 IDs. REQUIREMENTS.md maps only ANLY-03/04/05 to this phase; ANLY-06/07/08 remain Future Requirements (trigraph, per-session drill-down, language filter) and are correctly absent.

### Prohibitions

**Test-tier (enforcement evidence present — not flagged):**

- Gap-window numbers live only in `latency-stats.ts`; analytics imports `gatedMedian`.
- No `Math.round` in `latency-stats.ts` / `metrics.ts` / `analytics.ts` / `heatmap.ts`.
- No network/sync/export path added in analytics UI or folds.
- Heatmap does not read `charLog` / glyph; frequency is not the color driver.
- `US_ANSI_KEYS.length` is the heatmap result length; unused keys `medianMs: null`.
- plaintext is a map key; n=1 languages are not hidden; both `wpm` and `symbolAdjustedWpm` exist.
- No trigraph fold. `src/analytics/` has zero `dexie` / `ui/` / `persistence/db` imports.
- Sub-threshold digraphs omitted. CaptureSurface has no heatmap import. No fourth nav item, jump links, charts, or row click.

**Judgment-tier (human review — never a silent pass):**

- MUST NOT use shaming/guilt/loss-aversion copy — locked copy is diagnostic; needs a human read of the painted page.
- MUST NOT paint green/red score palette or make color the only slowness cue — tests assert amber `color-mix` + on-key numbers; sequential amber vs accent/destructive is a visual check.

### Anti-Patterns Found

No `TBD` / `FIXME` / `XXX` debt markers in Phase 6 files. No placeholder/stub returns on user-visible paths.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/index.css` `.analytics-table` | 492–523 | No `overflow-wrap` / `word-break` on language cells | ℹ️ Info | Same concern as backstop truth 20; not a goal blocker |
| `src/ui/KeyboardHeatmap.tsx` | `--kb-fill` | color-mix via custom property | ℹ️ Info | Documented 06-03 deviation so happy-dom can assert fill; browsers still paint `background: var(--kb-fill)` |

`06-01-SUMMARY.md` marks `requirements-completed: [ANLY-03, ANLY-04, ANLY-05]` before the UI existed. That is a SUMMARY overclaim, not a codebase gap — 06-03 ships the surfaces.

### Human Verification Required

Automated checks for inferable truths passed. Four PLAN backstops abstained (honest-verifier / insufficient_spec). 06-03 also queued Chromium visual/D-08 checks at end-of-phase. All six items passed in UAT on 2026-09-20.

### 1. Chromium empty + populated Analytics (light and dark)

**Test:** Run the app, open Analytics with an empty DB; then complete several exercises (mix of paste languages including plaintext) until some pairs and keys clear n=5. Repeat in light and dark `prefers-color-scheme`.
**Expected:** Empty → page empty copy, no diagram. Populated → top-10 (or shorter) digraph table, sequential amber heatmap with numbers, language rows including plaintext. No green/red score colors, no shaming copy.
**Why human:** Paint, contrast, and copy tone are not observable in happy-dom. Covers judgment-tier prohibitions.

### 2. Mid-exercise Analytics round-trip

**Test:** Type mid-exercise, click Analytics, click Trainer.
**Expected:** Same textarea identity, charLog, per-char status, caret; CorpusInput still visible while Analytics is showing.
**Why human:** happy-dom D-08 is necessary but not sufficient for real caret/IME (carried-forward Phase 4 residual).

### 3. 320px heatmap overflow (backstop)

**Test:** Narrow the window toward 320px on a populated Analytics page.
**Expected:** `#root` does not grow a page-level horizontal scrollbar; `.keyboard-heatmap` may scroll; silhouette intact.
**Why human:** Layout backstop; no held-out test.

### 4. Long language tag wrap (backstop)

**Test:** Persist a session whose `exercise.language` is an unusually long string; open Analytics.
**Expected:** Tag wraps/breaks in the cell; no page-level horizontal scrollbar.
**Why human:** Spec is non-inferable from CSS alone; no wrap test.

### 5. Key box overflow (backstop)

**Test:** Inspect sampled keys with 1–4 digit ms (e.g. `Shift` + `1234`).
**Expected:** Label + number stay inside the 32×48 box, no neighbor collision.
**Why human:** Paint overflow; presence of min-height is not proof.

### 6. Live-query refresh does not flash loading (backstop)

**Test:** With Analytics populated, complete another exercise (or otherwise trigger `useLiveQuery` to emit a new array) without leaving the page.
**Expected:** `Loading analytics…` does not reappear; the three sections stay mounted; table/heatmap contents update in place.
**Why human:** First-resolve tests do not cover a subsequent live update.

### Gaps Summary

No implementation gaps on the phase goal. Ranked digraphs, physical-key heatmap, and per-language profile (plaintext distinct) exist, are substantive, are wired from IndexedDB through pure folds into the Analytics sibling view, and have passing unit tests. Human UAT (6/6) closed the four `verification: backstop` truths and the UI-SPEC visual / D-08 / judgment-tier checks. Nothing is deferred to a later milestone phase (Phase 6 is the last v1.1 phase; ANLY-06/07/08 are future requirements, not this phase's missed work).

---

_Verified: 2026-09-20T18:40:00Z_
_Verifier: Claude (gsd-verifier)_
