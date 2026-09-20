# Phase 5: Symbol-Adjusted WPM & Language Tagging - Context

**Gathered:** 2026-09-12
**Status:** Ready for planning

<domain>
## Phase Boundary

The results screen and history rows show a symbol-density-adjusted WPM as a
companion number next to net WPM (never replacing it), and the paste path gets
a manual language picker so pasted exercises carry a real language tag instead
of always defaulting to `'plaintext'`.

**In scope:** ANLY-01 (symbol-adjusted WPM, results screen + history),
ANLY-02 (paste-only language picker/confirm).

**Out of scope (own phases / deferred):** upload-path language override (upload
already tags via `extToLang` — not part of ANLY-02), auto language detection
(explicitly deferred, `ANLY-09` Future Requirements), digraph/trigraph latency,
keyboard heatmap, per-language profile (Phase 6 — consumes this phase's real
language tags), trend/evolution charts (PROJECT.md Out of Scope).

**Note on discussion process:** The user delegated the gray-area decisions
below to Claude's judgment ("determina la mejor decision para todas las
preguntas del discuss") rather than answering each interactively. Decisions
are grounded in `.planning/research/PITFALLS.md` Pitfall 5 (which explicitly
flags the symbol-adjusted-WPM design as a decision to resolve now, not at
implementation time) and `FEATURES.md`'s anti-features table (manual picker
over auto-detection). Flagged below per-decision for visibility during
planning/review.
</domain>

<decisions>
## Implementation Decisions

### Symbol Classifier
- **D-01:** A codepoint is classified into exactly one of three buckets:
  `alnum` (`[A-Za-z0-9]`), `whitespace` (space, tab, newline — anything
  `/\s/` matches), or `symbol` (everything else — punctuation, operators,
  underscore `_`, brackets, quotes, etc.). Underscore counts as a **symbol**,
  not alnum — it's visually and ergonomically closer to punctuation than to a
  letter/digit on a US-ANSI layout, and this is the simplest classifier that
  satisfies "everything that is not `[A-Za-z0-9]` and not whitespace"
  (research's stated likely definition, `FEATURES.md`). — *Claude's judgment
  call per user delegation; flag for review if it feels wrong in practice.*
- **D-02:** Classification runs over `Array.from(text)` codepoints (Unicode-safe
  iteration), never raw UTF-16 indexing — same rule as every other text-walking
  function in `metrics.ts`/`state.ts`.
- **D-03:** Lives in a new pure module `src/metrics/symbol-density.ts`, sibling
  to `metrics.ts`, per `ARCHITECTURE.md`'s placement recommendation (classifies
  *characters*, not file extensions — distinct axis from
  `ingestion/language-map.ts`, don't conflate the two).

### Weighting Formula
- **D-04:** Symbol-adjusted WPM is a **session-level multiplier on the target
  exercise's overall symbol density**, applied to the already-computed net
  `wpm` — **not** a per-character reweighting of the attempt stream. This is
  option (a) from `PITFALLS.md` Pitfall 5, explicitly recommended there to
  avoid double-counting backspace-corrected symbol characters (a per-attempt
  weighting would inflate the score for users who fumble symbols the most —
  the opposite of the intended signal). — **Reversibility:** the formula
  itself is a pure, isolated function (`computeSymbolAdjustedWpm`) — cheap to
  retune later since Dexie schema versioning (D-05/04-CONTEXT) means every
  historical session recomputes under a new formula version automatically.
- **D-05:** Formula: `symbolDensity = symbolCount / totalCodepoints` (over the
  **target exercise text**, not the attempt stream). `difficultyMultiplier = 1
  + symbolDensity * (SYMBOL_WEIGHT - 1)`, with `SYMBOL_WEIGHT = 2` as the
  initial tunable constant (a fully-symbol exercise doubles WPM; a
  zero-symbol exercise is unchanged from net WPM). `symbolAdjustedWpm = wpm *
  difficultyMultiplier`. Linear in density — the simplest defensible shape
  given no external standard exists (`FEATURES.md`: "must be designed, not
  looked up"). `SYMBOL_WEIGHT` lives as a named constant (like
  `MIN_GAP_MS`/`MIN_SAMPLES` in `metrics.ts`) so it's a one-line tune, not a
  formula rewrite. — *Claude's judgment call on the exact constant; flag for
  review — this is the one number in the whole phase with zero external
  grounding.*
- **D-06:** `METRICS_SCHEMA_VERSION` bumps from 1 → 2 (per `ARCHITECTURE.md`);
  `MetricsResult` gains `symbolAdjustedWpm: number`. The existing
  recompute-if-stale guard in `history-metrics.ts::resolveMetrics` (dormant
  since Phase 4) now activates: every session persisted before this phase
  recomputes symbol-adjusted WPM (and everything else) on next read, with zero
  migration — this is exactly what D-05/04-CONTEXT's schema-versioning
  discipline was built for.
- **D-07:** Golden test required (mirrors `metrics.test.ts`'s existing
  discipline): a fixture with backspace-corrected symbol characters, asserting
  `symbolAdjustedWpm` does NOT inflate above what a clean run of the same
  target text would produce — the double-counting regression `PITFALLS.md`
  warns about.

### Display Placement
- **D-08:** Symbol-adjusted WPM is a **companion metric, always shown next to
  net WPM**, never a replacement and never conditionally hidden — matches the
  Monkeytype raw/net precedent this project explicitly wants to follow
  (`FEATURES.md` Anti-Features: "Show both, side-by-side"). Applies identically
  in `ResultsView` and `HistoryRow` (ANLY-01's own success criteria require
  both surfaces).
- **D-09:** In `ResultsView`, rendered as a second stat block beside the
  existing `wpm`/`accuracy` pair, following the same `results-stat` /
  `results-stat-label` markup pattern already in the component — no new
  visual language. Label text: `"adj. wpm"` (short label under the number,
  matching the existing `wpm`/`accuracy` label style — no gamified framing,
  no color-coding, consistent with the locked `03-UI-SPEC.md` rule carried
  forward). Rounds only at the display layer (`Math.round`), matching
  `ResultsView`'s existing rule that `metrics.ts` never rounds.
- **D-10:** In `HistoryRow`, symbol-adjusted WPM is an additional value shown
  alongside the existing WPM column (not replacing it) — exact layout
  (new column vs. compact "134 / 156 adj." pairing) is Claude's discretion,
  subject to a UI-SPEC pass like Phase 4 had (`UI hint: yes` in ROADMAP.md).

### Language Picker (Paste Path)
- **D-11:** A `<select>` dropdown appears in `CorpusInput`, directly below the
  paste textarea (paste path only — **upload is untouched**, it keeps its
  existing automatic `extToLang` tagging; ANLY-02 only mentions paste).
  Matches `FEATURES.md` Anti-Features' explicit recommendation: "a simple
  manual language picker/override on the paste form... trivial UI, zero
  parsing risk" — chosen over auto-detection (out of scope, `ANLY-09`) and
  over a free-text field (an open text input invites typos/inconsistent
  tagging that would fragment Phase 6's per-language grouping).
- **D-12:** Option list = the existing `language-map.ts::EXT_TO_LANG` value set
  (`typescript`, `javascript`, `python`, `rust`, `go`, `bash`, `sql`, `json`,
  `yaml`, `markdown`, `html`, `css`, `toml`), deduplicated and alphabetized,
  plus an explicit `plaintext` option — so paste and upload share one
  canonical language vocabulary (Phase 6's per-language grouping depends on
  both paths using the same tag strings). Adding a language to this list only
  ever means adding one entry to the existing map's value set, not a second
  list to keep in sync.
- **D-13:** Default selection is **`plaintext`** every time the paste form is
  used — no cross-session memory of the last language chosen. Simplest correct
  behavior for v1.1; "remember last choice" is a cheap, reversible follow-up if
  it proves annoying in daily use, not something to build speculatively now.
  — *Claude's judgment call per user delegation.*
- **D-14:** The picker is **never blocking** — the "Load exercise" button works
  with the default (`plaintext`) selection untouched, exactly like the
  existing paste flow works today with no picker at all. "Pick or confirm"
  (REQUIREMENTS.md wording) means the control is always visible and always
  changeable, not a required modal/step before proceeding.
- **D-15:** The selected language flows into `fromPaste(raw, language, tabWidth?)`
  (or an equivalent explicit parameter) — `fromPaste` no longer hardcodes
  `language: 'plaintext'` (`ingestion/paste.ts` today). `fromFile`/`extToLang`
  (upload path) are unchanged.

### Claude's Discretion
- Exact `HistoryRow` layout for the second WPM number (D-10).
- Exact `<select>` styling/visual treatment for the language picker (subject
  to UI-SPEC pass, per ROADMAP.md's `UI hint: yes`).
- Internal naming/signature of `fromPaste`'s new parameter and the exact shape
  of `computeSymbolAdjustedWpm`'s pure function signature — planner/researcher
  decide within D-01–D-07.
- Whether the language `<select>` options are hardcoded inline or imported
  from a shared constant re-exported by `language-map.ts` (avoiding a second
  hardcoded list) — implementation detail, not a user-facing decision.
- Test strategy depth for `symbol-density.ts` and the picker component beyond
  the mandatory D-07 golden test.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v1.1 Milestone Research (primary — read before planning)
- `.planning/research/FEATURES.md` — symbol-adjusted WPM and per-language
  profile feature landscape; explicitly documents the anti-feature guidance
  (manual picker over auto-detection, companion metric not replacement) this
  phase's decisions are grounded in.
- `.planning/research/ARCHITECTURE.md` — `symbol-density.ts` module placement,
  `METRICS_SCHEMA_VERSION` → 2 bump, `ResultsView`/`HistoryRow` integration
  points, dependency note (Phase 5 has no persistence dependency beyond what
  Phase 1 already stores).
- `.planning/research/PITFALLS.md` Pitfall 5 — the double-counting trap this
  phase's D-04/D-05/D-07 decisions directly resolve; read in full before
  implementing the weighting formula.
- `.planning/research/STACK.md` — no new runtime deps expected for this phase
  (pure functions + a native `<select>`); confirm no drift before planning.

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — ANLY-01 (symbol-adjusted WPM), ANLY-02
  (paste language picker); ANLY-09 (auto-detection) in Future Requirements,
  explicitly out of scope here.
- `.planning/ROADMAP.md` §"Phase 5" — goal, success criteria, dependency on
  Phase 4 (extends the same session/metrics record).
- `.planning/PROJECT.md` §"Key Decisions" — Unicode codepoint-indexing rule,
  platform-seam discipline, "persist raw + cached snapshot, recompute on
  schema mismatch" pattern this phase's D-06 relies on directly.

### Prior Phase Context (carried forward)
- `.planning/phases/04-session-persistence-history/04-CONTEXT.md` — D-02
  (raw Session + cached MetricsResult snapshot), D-05 (schema-versioning
  discipline) — both directly load-bearing for D-06's recompute-on-read path.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/metrics/metrics.ts::computeSessionMetrics` / `MetricsResult` — the
  function and type this phase extends with `symbolAdjustedWpm`; already
  carries the `schemaVersion` precedent this phase's bump relies on.
- `src/ui/history-metrics.ts::resolveMetrics` — the dormant recompute-if-stale
  guard (D-06) that activates the moment `METRICS_SCHEMA_VERSION` changes;
  already reads `s.metricsSnapshot.schemaVersion !== METRICS_SCHEMA_VERSION`.
- `src/ui/ResultsView.tsx` — existing `results-stat`/`results-stat-label`
  markup to mirror for the new stat block (D-09); existing `Math.round`-at-
  display-layer convention.
- `src/ingestion/language-map.ts::EXT_TO_LANG` — the language vocabulary
  source for the picker's option list (D-12); currently only consumed by
  `extToLang` (upload path).
- `src/ingestion/paste.ts::fromPaste` — the function whose hardcoded
  `language: 'plaintext'` (D-15) needs a language parameter.
- `src/ui/CorpusInput.tsx` — owns the paste textarea and `handleLoad`; the
  picker (D-11) mounts here, its selected value threading into the
  `fromPaste` call inside `handleLoad`.
- `src/ui/HistoryView.tsx` / `HistoryRow` (built in Phase 4, `04-02-PLAN.md`)
  — the row component gaining the second WPM value (D-10).

### Established Patterns
- Pure-core / platform-seam / hot-path split (Phase 1, reaffirmed each phase)
  — `symbol-density.ts` and the `metrics.ts` extension stay pure; no DOM, no
  persistence import.
- `METRICS_SCHEMA_VERSION` + recompute-on-mismatch (Phase 3 origin, activated
  by Phase 4's `resolveMetrics`, now actually triggered by this phase) — the
  established mechanism for "a formula changes, all history benefits."
- Unicode-safe iteration (`Array.from`), never raw UTF-16 indexing — applies
  to the symbol classifier exactly as it applies everywhere else in
  `metrics.ts`/`state.ts`.
- No rounding outside the display layer — extends unchanged to
  `symbolAdjustedWpm`.

### Integration Points
- `src/metrics/metrics.ts::computeSessionMetrics` — calls the new
  `symbol-density.ts` classifier/formula and adds `symbolAdjustedWpm` to the
  returned `MetricsResult`.
- `src/ui/ResultsView.tsx` — renders the new stat block (D-09).
- `src/ui/HistoryView.tsx` — renders the new value per row (D-10).
- `src/ui/CorpusInput.tsx::handleLoad` — passes the picker's selected language
  into `fromPaste` (D-15).
- `src/ingestion/paste.ts::fromPaste` — signature change to accept a language
  argument instead of hardcoding `'plaintext'`.

</code_context>

<specifics>
## Specific Ideas

- The symbol-adjusted WPM must never look like a "correction" or a score that
  replaces net WPM — always a second, clearly-labeled companion number, per
  the Monkeytype raw/net precedent this project deliberately follows.
- The language picker should feel as low-friction as picking a file — no
  confirmation dialog, no separate "confirm language" step, just a dropdown
  that defaults sensibly and can be changed before hitting "Load exercise."

</specifics>

<deferred>
## Deferred Ideas

- **Auto language detection for paste** (heuristic or tree-sitter-based) —
  `ANLY-09`, already in REQUIREMENTS.md Future Requirements. The manual
  picker (D-11–D-14) is the deliberate, correct-for-now answer instead.
- **Remembering the user's last-picked language** across sessions (D-13) —
  cheap future addition if the always-`plaintext` default proves annoying in
  daily use; not built speculatively now.
- **Upload-path language override** — upload keeps its automatic
  `extToLang` tagging untouched; ANLY-02 only covers paste. Revisit only if
  extension-based tagging proves wrong often enough to matter.
- **Tuning `SYMBOL_WEIGHT` (D-05) based on real usage** — the constant is a
  one-line change by design; revisit once real self-use data shows whether
  `2` over/under-weights symbol density in practice.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 5-symbol-adjusted-wpm-language-tagging*
*Context gathered: 2026-09-12*
