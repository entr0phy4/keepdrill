# Phase 5: Symbol-Adjusted WPM & Language Tagging - Research

**Researched:** 2026-09-12
**Domain:** Pure single-session metrics extension (symbol classifier + weighting formula) + a small paste-path UI addition (native `<select>`)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Symbol Classifier**
- D-01: A codepoint is classified into exactly one of three buckets: `alnum`
  (`[A-Za-z0-9]`), `whitespace` (space, tab, newline — anything `/\s/` matches), or
  `symbol` (everything else — punctuation, operators, underscore `_`, brackets,
  quotes, etc.). Underscore counts as a **symbol**, not alnum.
- D-02: Classification runs over `Array.from(text)` codepoints (Unicode-safe
  iteration), never raw UTF-16 indexing.
- D-03: Lives in a new pure module `src/metrics/symbol-density.ts`, sibling to
  `metrics.ts` (classifies *characters*, not file extensions — distinct axis from
  `ingestion/language-map.ts`, don't conflate the two).

**Weighting Formula**
- D-04: Symbol-adjusted WPM is a session-level multiplier on the target exercise's
  overall symbol density, applied to the already-computed net `wpm` — NOT a
  per-character reweighting of the attempt stream (avoids double-counting
  backspace-corrected symbol characters).
- D-05: Formula: `symbolDensity = symbolCount / totalCodepoints` (over the target
  exercise text, not the attempt stream). `difficultyMultiplier = 1 + symbolDensity
  * (SYMBOL_WEIGHT - 1)`, `SYMBOL_WEIGHT = 2`. `symbolAdjustedWpm = wpm *
  difficultyMultiplier`. `SYMBOL_WEIGHT` lives as a named constant.
- D-06: `METRICS_SCHEMA_VERSION` bumps 1→2; `MetricsResult` gains
  `symbolAdjustedWpm: number`. The existing recompute-if-stale guard in
  `history-metrics.ts::resolveMetrics` activates on next read for every
  pre-existing session, zero migration.
- D-07: Golden test required — a fixture with backspace-corrected symbol
  characters, asserting `symbolAdjustedWpm` does NOT inflate above a clean run of
  the same target text.

**Display Placement**
- D-08: Symbol-adjusted WPM is a companion metric, always shown next to net WPM,
  never a replacement, never conditionally hidden. Applies identically in
  `ResultsView` and `HistoryRow`.
- D-09: In `ResultsView`, rendered as a second stat block beside the existing
  `wpm`/`accuracy` pair, using the existing `results-stat`/`results-stat-label`
  markup pattern. Label text: `"adj. wpm"`. Rounds only at display layer.
- D-10: In `HistoryRow`, symbol-adjusted WPM is an additional value shown alongside
  the existing WPM column (not replacing it) — exact layout is Claude's discretion.

**Language Picker (Paste Path)**
- D-11: A `<select>` dropdown appears in `CorpusInput`, directly below the paste
  textarea (paste path only — upload is untouched).
- D-12: Option list = `language-map.ts::EXT_TO_LANG` value set, deduplicated and
  alphabetized, plus an explicit `plaintext` option.
- D-13: Default selection is `plaintext` every time the paste form is used — no
  cross-session memory of the last language chosen.
- D-14: The picker is never blocking — "Load exercise" works with the default
  selection untouched.
- D-15: The selected language flows into `fromPaste(raw, language, tabWidth?)` (or
  an equivalent explicit parameter) — `fromPaste` no longer hardcodes
  `language: 'plaintext'`. `fromFile`/`extToLang` (upload path) are unchanged.

### Claude's Discretion
- Exact `HistoryRow` layout for the second WPM number (D-10).
- Exact `<select>` styling/visual treatment for the language picker (subject to a
  UI-SPEC pass, per ROADMAP.md's `UI hint: yes`).
- Internal naming/signature of `fromPaste`'s new parameter and the exact shape of
  `computeSymbolAdjustedWpm`'s pure function signature.
- Whether the language `<select>` options are hardcoded inline or imported from a
  shared constant re-exported by `language-map.ts`.
- Test strategy depth for `symbol-density.ts` and the picker component beyond the
  mandatory D-07 golden test.

### Deferred Ideas (OUT OF SCOPE)
- Auto language detection for paste (heuristic or tree-sitter-based) — `ANLY-09`.
- Remembering the user's last-picked language across sessions (D-13) — cheap
  future addition if the always-`plaintext` default proves annoying.
- Upload-path language override — upload keeps its automatic `extToLang` tagging
  untouched; ANLY-02 only covers paste.
- Tuning `SYMBOL_WEIGHT` (D-05) based on real usage — a one-line change by design,
  revisit once real self-use data exists.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| ANLY-01 | User can see a symbol-density-adjusted WPM shown as a companion metric next to net WPM, on the results screen and in session history | Architecture Patterns 1–4 (symbol-density.ts formula, metrics.ts integration, ResultsView/HistoryRow display); Pitfalls 1, 3, 4 (double-counting guard, MetricsResult fixture drift, golden-test rigor) |
| ANLY-02 | User can pick or confirm the language of a pasted exercise (not just uploads), so pasted sessions are tagged with a real language instead of always defaulting to `'plaintext'` | Architecture Pattern 5 (`<select>` in CorpusInput, `PASTE_LANGUAGE_OPTIONS` export, `fromPaste` signature change); Pitfall 2 (existing `upload.test.ts` call site), Pitfall 5 (`EXT_TO_LANG` export shape) |
</phase_requirements>

## Summary

This phase has no architectural ambiguity left to resolve — `05-CONTEXT.md` already
locked the classifier, formula, display placement, and picker behavior (D-01–D-15),
and `.planning/research/ARCHITECTURE.md`/`PITFALLS.md` (v1.1 milestone research)
already named the exact module (`src/metrics/symbol-density.ts`), the exact schema
bump (`METRICS_SCHEMA_VERSION` 1→2), and the exact double-counting trap to guard
against (Pitfall 5). What remains is grounding those decisions against the **current**
source (line numbers, exact signatures) and resolving the handful of items CONTEXT.md
left as Claude's discretion.

All four discretionary items resolve cleanly from the existing code's own conventions:
(1) `fromPaste`'s new parameter should be a **required** second positional `language:
string` argument — but this breaks one existing call site (`upload.test.ts:71`) that
currently calls `fromPaste(raw)` with no second argument; the plan must update that
call site in the same task that changes the signature. (2) `computeSymbolAdjustedWpm`
should live as a new pure function in `symbol-density.ts` mirroring `computeWpm`'s
existing shape (`(symbolAdjustedCorrectMetric, ...) -> number`) — concretely,
`computeSymbolAdjustedWpm(wpm, symbolDensity): number`, taking the *already-computed*
`wpm` and the target's density, not raw counts, to keep `metrics.ts`'s call site a
one-liner. (3) `HistoryRow`'s second WPM value is best rendered as a compact
`"142 / 178 adj."`-style pairing next to the existing wpm span, not a new grid column
— `history-row-primary` is a flex/inline row today (mirroring `ResultsView`'s "always
visible, never a separate section" intent from D-08). (4) The paste `<select>`'s
option list should be a new named export from `language-map.ts` (e.g.
`PASTE_LANGUAGE_OPTIONS`), not hardcoded in `CorpusInput.tsx` — this is the only way
to satisfy D-12's "one canonical vocabulary" requirement without a second list to
keep in sync, and it costs nothing (one `Object.values(EXT_TO_LANG)` dedupe +
`.sort()` + `'plaintext'` append, computed once at module load).

The one thing this research flags with above-baseline urgency: **`fromPaste` has an
existing call site outside `CorpusInput.tsx`** — `src/ingestion/upload.test.ts:71`
calls `fromPaste(raw)` to cross-check `normalize()` parity against `fromFile()`. The
planner must include updating that call site as an explicit task, not an incidental
side-effect, or the phase will ship with a broken test.

**Primary recommendation:** Implement `symbol-density.ts` and the `metrics.ts`
extension first (fully self-contained, zero UI dependency, golden-test-verifiable in
isolation per D-07) as one plan/task group, then the paste-picker + `fromPaste`
signature change as a second, independent plan/task group — the two decision clusters
(D-01–D-10 vs D-11–D-15) share no code and can be sequenced or parallelized freely.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Symbol classification (`Array.from(text)` codepoint bucketing) | Browser / Client (pure module, no DOM) | — | Runs entirely in-memory over already-loaded `Exercise.text`; no persistence, no network. Same tier as `metrics.ts` today. |
| Symbol-adjusted WPM formula | Browser / Client (pure module) | — | Extends `computeSessionMetrics`, called synchronously in `App.tsx::handleComplete` — same call site, same tier as existing `computeWpm`. |
| Symbol-adjusted WPM display (`ResultsView`, `HistoryRow`) | Browser / Client (React component) | — | Prop-driven leaf render, no new data fetching — `MetricsResult` already flows to both via existing props (`metrics`) / existing `resolveMetrics(session)` call. |
| Schema version bump + recompute-on-stale (`resolveMetrics`) | Browser / Client (pure module) reading from Database / Storage (IndexedDB via Dexie) | Database / Storage | `resolveMetrics` itself stays pure (no Dexie import, confirmed at `src/ui/history-metrics.ts`); it is *fed* stale-schema `StoredSession` rows read from IndexedDB by `HistoryView`'s `useLiveQuery(listNewestFirst)`, but the version-comparison logic runs in the client tier, not the storage tier. |
| Language `<select>` (paste path) | Browser / Client (React component) | — | A new controlled/uncontrolled native form control in `CorpusInput.tsx`; no persistence, no network — the selected value flows into `fromPaste()`'s return value (`Exercise.language`), which is *later* persisted by the existing `App.tsx::handleComplete` → `saveSession()` path, unchanged by this phase. |
| `fromPaste()` signature change | Browser / Client (pure module) | — | `src/ingestion/paste.ts` has zero DOM/IO access today and stays that way — the language value is threaded in as a plain parameter, not read from the DOM inside `paste.ts` itself (that stays `CorpusInput.tsx`'s job, matching the existing `tabWidth` parameter precedent). |

## Standard Stack

No new runtime or dev dependencies. This phase is pure functions (`symbol-density.ts`)
+ a native `<select>` element — confirmed against `.planning/research/STACK.md`'s
"no new runtime deps expected for this phase" note (CONTEXT.md canonical refs) and
against `package.json` (`dexie@4.4.4`, `dexie-react-hooks@4.4.0`, `react@^19.2.8`,
`react-dom@^19.2.8` — no drift, no new packages needed for either the classifier/
formula or the picker).

**Version verification:** N/A — no packages to verify. `npm view dexie version`
confirms `4.4.6` is current upstream (STATE.md's Phase 4 decision to pin `4.4.4`
remains unaffected by this phase; not touched here).

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages. No legitimacy check
required.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  PASTE PATH (CorpusInput.tsx)                                       │
│                                                                       │
│   <textarea> ──(value)──▶  handleLoad()                             │
│   <select language>  ──(selectedLanguage state, NEW)──┐             │
│                                                          ▼             │
│                                    fromPaste(value, selectedLanguage) │
│                                          │ [paste.ts, MODIFIED sig]   │
│                                          ▼                            │
│                                    Exercise { language, ... }         │
│                                          │                            │
│                                          ▼                            │
│                                   onLoad(exercise) → App.tsx          │
│                             (unchanged downstream: buildSession,      │
│                              saveSession — Exercise flows through     │
│                              exactly like today, just with a real     │
│                              language tag instead of hardcoded)       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  METRICS PATH (unchanged call site, extended output)                │
│                                                                       │
│  App.tsx::handleComplete                                             │
│      │                                                                │
│      ▼                                                                │
│  computeSessionMetrics(target, charLog, markers, now)  [metrics.ts]  │
│      │                                                                │
│      ├──▶ replayAttempts() → correctAttempts/incorrectAttempts        │
│      │        (UNCHANGED)                                             │
│      │                                                                │
│      ├──▶ computeWpm(correctAttempts, elapsedMs) → wpm  (UNCHANGED)   │
│      │                                                                │
│      └──▶ NEW: classifySymbolDensity(target)  [symbol-density.ts]     │
│               → symbolDensity: number                                 │
│               │                                                       │
│               ▼                                                       │
│           computeSymbolAdjustedWpm(wpm, symbolDensity)                │
│               [symbol-density.ts]  → symbolAdjustedWpm: number        │
│      │                                                                │
│      ▼                                                                │
│  MetricsResult { schemaVersion: 2, wpm, accuracy, slowest5,           │
│                   symbolAdjustedWpm }         ← NEW FIELD              │
│      │                                                                │
│      ├──▶ setMetrics(result) → ResultsView renders both wpm values    │
│      │        (unchanged flow, NEW stat block)                        │
│      │                                                                │
│      └──▶ saveSession(...) → StoredSession.metricsSnapshot            │
│               (unchanged flow — schemaVersion:2 persisted verbatim)   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  HISTORY READ PATH (recompute-on-stale activates)                    │
│                                                                       │
│  HistoryView → useLiveQuery(listNewestFirst) → StoredSession[]        │
│      │  (some rows have metricsSnapshot.schemaVersion === 1,          │
│      │   persisted before this phase shipped)                         │
│      ▼                                                                │
│  resolveMetrics(session)  [history-metrics.ts, UNCHANGED CODE,        │
│                             now-active branch]                        │
│      │  if snapshot.schemaVersion !== METRICS_SCHEMA_VERSION (now 2): │
│      │      recompute via computeSessionMetrics(...) using stored     │
│      │      exercise.text/charLog/markers/completedAtTMs              │
│      ▼                                                                │
│  MetricsResult (now includes symbolAdjustedWpm even for old rows)     │
│      ▼                                                                │
│  HistoryRow renders both wpm values — NEW markup                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── metrics/
│   ├── metrics.ts             # MODIFIED: +symbolAdjustedWpm field,
│   │                          #   METRICS_SCHEMA_VERSION 1→2, calls
│   │                          #   symbol-density.ts
│   └── symbol-density.ts      # NEW — pure classifier + weighting formula
├── ingestion/
│   ├── paste.ts                # MODIFIED: fromPaste(raw, language, tabWidth?)
│   ├── language-map.ts         # MODIFIED: +PASTE_LANGUAGE_OPTIONS export
│   └── upload.test.ts          # MODIFIED: fromPaste(raw) call site (line 71)
│                                #   must pass a language argument
└── ui/
    ├── ResultsView.tsx          # MODIFIED: +results-stat block, "adj. wpm"
    ├── HistoryView.tsx          # MODIFIED: HistoryRow +second wpm value
    ├── CorpusInput.tsx          # MODIFIED: +<select> below paste textarea,
    │                            #   handleLoad passes selection to fromPaste
    └── history-metrics.ts       # UNCHANGED code, dormant branch now active
```

### Pattern 1: Session-level scalar multiplier (target-density, not attempt-stream)

**What:** `symbolDensity` is computed once from the **target exercise text**
(`Array.from(target)`), never from `charLog`/attempt records. `difficultyMultiplier`
is derived from that single density value. `symbolAdjustedWpm = wpm * multiplier` —
a scalar transform of the already-computed, already-correct `wpm`, not a parallel
per-character accumulation.
**When to use:** Exactly this phase's formula (D-04/D-05). This is the option
`PITFALLS.md` Pitfall 5 explicitly recommends to sidestep double-counting.
**Why it's safe from the double-counting trap:** `wpm` already comes from
`correctAttempts` (which legitimately counts every eventually-correct keystroke,
including corrected-over retries — that's D-02's existing, locked, and *intentional*
behavior for accuracy/WPM). Multiplying that single scalar by a density value that
is 100% independent of the attempt stream (computed only from `target`) means a
session with many backspace-corrected symbol characters gets exactly the same
`difficultyMultiplier` as a clean run of the identical target text — the multiplier
cannot inflate from corrections because it never reads `charLog` at all.

```typescript
// Source: 05-CONTEXT.md D-05, applying metrics.ts's existing computeWpm shape
// symbol-density.ts (illustrative — exact export names are planner/researcher
// discretion per CONTEXT.md, this shape satisfies D-01 through D-07)

export const SYMBOL_WEIGHT = 2

export function classifySymbolDensity(target: string): number {
  const codepoints = Array.from(target)
  if (codepoints.length === 0) return 0
  let symbolCount = 0
  for (const ch of codepoints) {
    if (/\s/.test(ch)) continue // whitespace bucket — not a symbol (D-01)
    if (/[A-Za-z0-9]/.test(ch)) continue // alnum bucket — not a symbol (D-01)
    symbolCount += 1 // everything else, including `_` (D-01)
  }
  return symbolCount / codepoints.length
}

export function computeSymbolAdjustedWpm(wpm: number, symbolDensity: number): number {
  const difficultyMultiplier = 1 + symbolDensity * (SYMBOL_WEIGHT - 1)
  return wpm * difficultyMultiplier
}
```

**Zero-length-target guard:** `metrics.ts` has no existing zero-length-target case
in its golden tests (every case has `target.length >= 1`), but `classifySymbolDensity`
must guard `codepoints.length === 0 → return 0` defensively — an empty exercise text
should never be reachable in practice (paste/upload both reject empty input per
`CorpusInput.tsx`'s `errNothing` check), but the pure function should not divide by
zero if ever called with one. This mirrors `computeWpm`'s own `elapsedMs <= 0 → 0`
defensive-guard convention (metrics.ts:139-141).

### Pattern 2: `metrics.ts` integration point

**What:** `computeSessionMetrics` gains one new local variable and one new
`MetricsResult` field. No change to its existing parameters, no change to
`replayAttempts`/`slowestFive`/`median` — those stay byte-for-byte identical.
**Where exactly (grounded in current source):**

```typescript
// Source: current src/metrics/metrics.ts:150-166 (verbatim, for exact insertion point)
export function computeSessionMetrics(
  target: string,
  charLog: readonly CommittedChar[],
  markers: readonly CaptureMarker[],
  now: number,
): MetricsResult {
  const elapsedMs = computeActiveElapsedMs(charLog, markers, now)
  const { correctAttempts, incorrectAttempts, latencySamplesByChar } = replayAttempts(target, charLog)

  return {
    schemaVersion: METRICS_SCHEMA_VERSION,
    wpm: computeWpm(correctAttempts, elapsedMs),
    accuracy: computeAccuracy(correctAttempts, correctAttempts + incorrectAttempts),
    slowest5: slowestFive(latencySamplesByChar),
  }
}
```

Becomes (illustrative — exact variable names at planner's discretion):

```typescript
import { classifySymbolDensity, computeSymbolAdjustedWpm } from './symbol-density'

export const METRICS_SCHEMA_VERSION = 2 // was 1 — D-06

export interface MetricsResult {
  schemaVersion: number
  wpm: number
  accuracy: number
  slowest5: SlowestKeyEntry[]
  symbolAdjustedWpm: number // NEW — D-06
}

export function computeSessionMetrics(
  target: string,
  charLog: readonly CommittedChar[],
  markers: readonly CaptureMarker[],
  now: number,
): MetricsResult {
  const elapsedMs = computeActiveElapsedMs(charLog, markers, now)
  const { correctAttempts, incorrectAttempts, latencySamplesByChar } = replayAttempts(target, charLog)
  const wpm = computeWpm(correctAttempts, elapsedMs)
  const symbolDensity = classifySymbolDensity(target)

  return {
    schemaVersion: METRICS_SCHEMA_VERSION,
    wpm,
    accuracy: computeAccuracy(correctAttempts, correctAttempts + incorrectAttempts),
    slowest5: slowestFive(latencySamplesByChar),
    symbolAdjustedWpm: computeSymbolAdjustedWpm(wpm, symbolDensity),
  }
}
```

**Note on `classifySymbolDensity(target)` being called once per session, not once
per keystroke:** `target` never changes within a session (it's `Exercise.text`,
fixed at load time), so this is O(target length) work done exactly once per
`computeSessionMetrics` call — the same cost profile as `Array.from(target)` already
paid inside `replayAttempts` (metrics.ts:68). No new performance concern.

### Pattern 3: Display — companion stat block (`ResultsView.tsx`)

**Where exactly (grounded in current source):**

```typescript
// Source: current src/ui/ResultsView.tsx:26-33 (verbatim)
<div className="results-stats">
  <div className="results-stat">
    {Math.round(metrics.wpm)} <span className="results-stat-label">wpm</span>
  </div>
  <div className="results-stat">
    {Math.round(metrics.accuracy * 100)}% <span className="results-stat-label">accuracy</span>
  </div>
</div>
```

Add a third `.results-stat` block (D-09), preserving `Math.round()`-at-display-layer
convention and the existing `results-stat`/`results-stat-label` class names verbatim
(no new CSS class needed for the block itself):

```typescript
<div className="results-stat">
  {Math.round(metrics.symbolAdjustedWpm)} <span className="results-stat-label">adj. wpm</span>
</div>
```

**CSS implication the planner must address:** `.results-stats` is currently a CSS
grid, `1fr` on mobile / `1fr 1fr` at `>= 640px` (`src/index.css:344-356`). Adding a
third block with the existing `1fr 1fr` rule produces an uneven 2-then-1 wrap at
desktop width, which is visually acceptable (matches the existing mobile-stacked
behavior) but worth an explicit UI-SPEC call: either leave the 2-column wrap as-is
(simplest, no CSS change) or bump to `1fr 1fr 1fr` at the existing breakpoint. Per
ROADMAP.md's `UI hint: yes` for this phase, this belongs in a UI-SPEC pass, not a
silent implementation choice — flagged here so the planner routes it there rather
than deciding informally mid-task.

### Pattern 4: Display — `HistoryRow` companion value

**Where exactly (grounded in current source):**

```typescript
// Source: current src/ui/HistoryView.tsx:48-52 (verbatim)
<div className="history-row-primary">
  <span title={new Date(session.startedAt).toLocaleString()}>{relativeTime(session.startedAt)}</span>
  <span>
    {Math.round(m.wpm)} <span className="results-stat-label text-muted">wpm</span>
  </span>
  <span>{Math.round(m.accuracy * 100)}%</span>
</div>
```

Recommended (Claude's discretion resolved, D-10): compact pairing inline in the same
span, avoiding a new grid/flex column in `history-row-primary` (which is currently an
unstyled flex/inline-flow row per its sibling markup, not an explicit grid):

```typescript
<span>
  {Math.round(m.wpm)} <span className="results-stat-label text-muted">wpm</span>
  {' / '}
  {Math.round(m.symbolAdjustedWpm)} <span className="results-stat-label text-muted">adj.</span>
</span>
```

This mirrors D-09's `"adj. wpm"` label vocabulary while fitting the existing dense
row layout without a structural change. `HistoryView.test.tsx`'s existing assertion
`expect(row!.textContent).toContain('62 ')` / `.toContain('wpm')` (lines 111-112)
will keep passing unchanged since this only *appends* text to the same span rather
than replacing it — but the planner should still update the test to assert the new
`symbolAdjustedWpm` value is present, per the "MUST update existing tests" pitfall
below.

### Pattern 5: Language `<select>` in `CorpusInput.tsx`

**Where exactly (insertion point, grounded in current source):** between the paste
`<textarea>` block (`CorpusInput.tsx:112-124`) and the upload `<input type="file">`
block (`CorpusInput.tsx:126-148`) — directly below the paste textarea per D-11.

```typescript
// language-map.ts — NEW export (resolves D-12's "one canonical vocabulary" +
// Claude's-discretion item on hardcoded-vs-shared option list)
export const PASTE_LANGUAGE_OPTIONS: readonly string[] = [
  ...new Set(Object.values(EXT_TO_LANG)),
].sort()
// ^ does NOT include 'plaintext' — CorpusInput.tsx appends/prepends it explicitly
// as the always-present, always-default option (D-13), keeping the "is this the
// default" decision visible at the call site rather than buried in the map module.
```

```typescript
// CorpusInput.tsx — new state + control (illustrative)
const [pasteLanguage, setPasteLanguage] = useState('plaintext')

// ... below the <textarea> block:
<div style={{ display: 'grid', gap: 'var(--space-xs)' }}>
  <label htmlFor="corpus-paste-language" className="text-label">
    Language
  </label>
  <select
    id="corpus-paste-language"
    value={pasteLanguage}
    onChange={(e) => setPasteLanguage(e.target.value)}
  >
    <option value="plaintext">plaintext</option>
    {PASTE_LANGUAGE_OPTIONS.map((lang) => (
      <option key={lang} value={lang}>
        {lang}
      </option>
    ))}
  </select>
</div>
```

```typescript
// handleLoad — Source: current CorpusInput.tsx:76 (verbatim: `const exercise = fromPaste(value)`)
// becomes:
const exercise = fromPaste(value, pasteLanguage)
```

**D-14 (never blocking) is automatically satisfied** by this shape — `pasteLanguage`
defaults to `'plaintext'` on mount and on every fresh component instance, requires
no interaction to have a valid value, and `handleLoad`'s early-return guards
(`errNothing`, `errTooLargePaste`) are entirely unaffected since the select's value
is always defined. **D-13 (no cross-session memory)** is satisfied by using
component-local `useState` with a literal default, not `localStorage`/any persisted
source — the state resets to `'plaintext'` every time `CorpusInput` remounts (it
doesn't currently remount on exercise load — `CorpusInput` is NOT keyed by
`loadToken` per `App.tsx:202`, only `CaptureSurface` is — but nothing about the
picker requires it to reset after "Load exercise"; re-reading D-13, "no cross-session
memory" is naturally satisfied by never persisting the choice anywhere, regardless of
whether the control itself resets between loads. Confirm with a quick test but this
is not expected to need special handling).

### Anti-Patterns to Avoid

- **Applying `SYMBOL_WEIGHT` per-character over `charLog`/attempt records** (Pitfall
  5's core warning) — the formula must read `target` only, never `charLog`.
- **Rounding inside `symbol-density.ts` or `metrics.ts`** — `Math.round()` stays
  display-layer-only (`ResultsView.tsx`/`HistoryView.tsx`), exactly like every other
  metric today.
- **Hardcoding a second language list in `CorpusInput.tsx`** — must import from
  `language-map.ts`, not duplicate `EXT_TO_LANG`'s values inline (D-12).
- **Making `fromPaste`'s `language` parameter optional with a `'plaintext'` default**
  — this would silently mask a missed call site (e.g. `upload.test.ts:71`) instead of
  surfacing a compile error, defeating the purpose of changing the signature at all.
  Make it a required positional parameter; fix every call site explicitly, don't paper
  over it with a default.
- **Persisting the raw UTF-16 `.length` instead of `Array.from(target).length`** for
  the density denominator — every other codepoint-safe function in this codebase
  (`replayAttempts`, `computeTrainerState`) uses `Array.from`; `symbol-density.ts`
  must match (D-02).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unicode-safe character iteration | A regex-based `.split()` or raw `for` loop over `.length` | `Array.from(text)` | Already the established, tested pattern in `metrics.ts`/`state.ts` for exactly this reason (surrogate-pair safety, `computeSessionMetrics` case 12's golden test). |
| Symbol/alnum/whitespace classification | A hand-built character-code range table | `/[A-Za-z0-9]/`/`/\s/` regex tests per codepoint | D-01's classifier is already fully specified as a 3-way regex partition; no library, no Unicode category database needed — the project intentionally scopes to US-ANSI/ASCII-adjacent classification (matches the project's existing "US ANSI only" keyboard-layout constraint). |
| Deduplicating/sorting the language option list | Manually re-typing `EXT_TO_LANG`'s 13 values as a second array | `[...new Set(Object.values(EXT_TO_LANG))].sort()` | One line, zero maintenance burden, can never drift from the source map (D-12's explicit concern). |

**Key insight:** Every "don't hand-roll" item in this phase already has an established
in-repo precedent from Phases 1–4 (`Array.from`, existing regex-adjacent classifier
style is new but trivial, and `EXT_TO_LANG` already exists) — there is no external
library surface to evaluate for this phase at all.

## Runtime State Inventory

**Not applicable — this is not a rename/refactor/migration phase.** New pure module
+ new field + new UI control, no renaming of existing identifiers, no data migration
beyond the already-established schema-version-bump + recompute-on-read pattern
(D-06), which itself requires zero migration code (confirmed: `resolveMetrics` at
`src/ui/history-metrics.ts:19-20` already contains the dormant recompute branch;
bumping `METRICS_SCHEMA_VERSION` to 2 is sufficient to activate it — no new function,
no backfill script, no Dexie schema version bump needed since `StoredSession`'s own
envelope shape, `STORED_SESSION_SCHEMA_VERSION`, does not change).

## Common Pitfalls

### Pitfall 1: Double-counting symbol weight via the attempt stream (PITFALLS.md Pitfall 5)

**What goes wrong:** Weighting `charLog`/attempt records directly (rather than the
target text) inflates `symbolAdjustedWpm` for sessions with many backspace-corrected
symbol characters — a user who fumbles brackets repeatedly would score *higher*
weighted-WPM, the opposite of the intended signal.
**Why it happens:** `replayAttempts` already exposes `correctAttempts` as a natural-
looking "count of correct chars" to weight per-character; it's tempting to iterate
`charLog` a second time applying a symbol weight to each attempt.
**How to avoid:** `classifySymbolDensity` takes ONLY `target: string` as input — it
must never receive or read `charLog`. Verify this in code review: `symbol-density.ts`
should have zero imports of `CommittedChar`/capture types.
**Warning signs:** `symbolAdjustedWpm > wpm * SYMBOL_WEIGHT` for any session (the
theoretical max should be `wpm * SYMBOL_WEIGHT` at 100% symbol density — an attempt-
stream-based implementation could exceed this bound when corrections are involved).

### Pitfall 2: Forgetting the existing `fromPaste` call site in `upload.test.ts`

**What goes wrong:** `src/ingestion/upload.test.ts:71` calls `fromPaste(raw)` with
one argument, to cross-check `normalize()` output parity between the upload and
paste paths (`'normalizes CRLF + tabs identically to fromPaste of the same string'`).
Changing `fromPaste`'s signature to require a `language` parameter breaks this call
at compile time (TypeScript) — `tsc --noEmit` (the `build`/`typecheck` npm scripts)
will fail, and `vitest run` won't even get to run the test.
**Why it happens:** The only *other* call site (`CorpusInput.tsx:76`) is the obvious
one to update; this test file's call is easy to miss since it's testing an unrelated
concern (normalize parity, not language tagging).
**How to avoid:** Grep for `fromPaste(` across the whole repo before considering the
signature-change task complete (this research already did so: exactly two call
sites exist — `CorpusInput.tsx:76` and `upload.test.ts:71` — both must be updated).
Update the test call to `fromPaste(raw, 'plaintext')` (the test's own intent — CRLF/
tab normalization parity — is orthogonal to language, so any fixed literal is fine).
**Warning signs:** `pnpm typecheck` or `pnpm build` failing after the `paste.ts`
signature change, or `pnpm test` failing to even start due to a TS compile error in
`upload.test.ts`.

### Pitfall 3: `MetricsResult` fixture drift across three existing test files

**What goes wrong:** `MetricsResult` is constructed as a literal object in multiple
test files that do NOT go through `computeSessionMetrics` — `src/ui/HistoryView.test.tsx`'s
`baseMetrics` (lines 51-56) and `src/ui/history-metrics.test.ts`'s `baseSnapshot`
(lines 16-20) both hardcode `{ schemaVersion, wpm, accuracy, slowest5 }` literals.
Adding a required `symbolAdjustedWpm: number` field to the `MetricsResult` interface
makes both of these object literals fail TypeScript's excess/missing-property check
at compile time.
**Why it happens:** These fixtures predate the new field and were written against
the 4-field shape; adding a 5th required field to the interface is a breaking change
to every test file that constructs a `MetricsResult` by hand rather than by calling
`computeSessionMetrics`.
**How to avoid:** Grep for `MetricsResult` object-literal construction (not just
`computeSessionMetrics(...)` calls) before considering the type-change task done.
Found in this research: `HistoryView.test.tsx:51-56` (`baseMetrics`) and
`history-metrics.test.ts:16-20` (`baseSnapshot`) both need a `symbolAdjustedWpm`
field added to their literals. `metrics.test.ts`'s own `Case.expected` type
(`{ wpm, accuracy, slowest5? }`, line 26) does NOT need to change since it only
checks `result.wpm`/`result.accuracy`/`result.slowest5` explicitly (lines 221-227)
and does not construct a `MetricsResult` literal itself — but the golden-case table
should still gain new assertions/cases for `symbolAdjustedWpm` per D-07's mandatory
golden test requirement (see next pitfall).
**Warning signs:** `pnpm typecheck` failures pointing at `HistoryView.test.tsx` or
`history-metrics.test.ts` after the `MetricsResult` interface change.

### Pitfall 4: D-07's golden test needs a genuinely double-counting-prone fixture, not just any symbol-containing case

**What goes wrong:** A test that merely asserts "a session with `{}` scores higher
adjusted-WPM than a session with `aa`" would pass even with a buggy per-attempt
implementation — it doesn't specifically exercise the backspace-correction path
Pitfall 5/D-07 is worried about.
**Why it happens:** It's easy to write a "does the formula do something" smoke test
and mistake it for the regression guard D-07 actually requires.
**How to avoid:** The golden fixture must compare two sessions with the **identical
target text** containing symbol characters — one typed cleanly, one with backspace-
corrected retries specifically on symbol characters — and assert `symbolAdjustedWpm`
is **identical** between them for the same elapsed time (or, if elapsed time differs
due to the extra keystrokes of correction, that the *multiplier* is identical and
only the underlying `wpm` differs — i.e., `symbolAdjustedWpm / wpm` is the same
constant regardless of corrections). This directly encodes "the multiplier depends
only on `target`, never on `charLog`" as an executable assertion, matching
`metrics.test.ts`'s existing golden-case style (`it.each` table, `Case` interface).
**Warning signs:** A golden test exists but never actually feeds the formula a
`charLog` with `deleteContentBackward` records on symbol characters.

### Pitfall 5: `EXT_TO_LANG` currently has no exported type/const for its value set

**What goes wrong:** `language-map.ts` only exports `extToLang(fileName: string):
string` today (line 30) — `EXT_TO_LANG` itself (line 6) is a module-private
`const`, not exported. `PASTE_LANGUAGE_OPTIONS` must be added as a **new** export
computed from the private map internally (as shown in Pattern 5 above), not by
exporting `EXT_TO_LANG` itself and computing the value-set in `CorpusInput.tsx` —
the latter would leak the extension-keying concern into the UI layer, which
`05-CONTEXT.md`'s own D-03 language explicitly warns against conflating ("classifies
characters, not file extensions — distinct axis... don't conflate the two" — same
principle applies to keeping `language-map.ts`'s internal map shape private from
`CorpusInput.tsx`).
**How to avoid:** Add the `PASTE_LANGUAGE_OPTIONS` export inside `language-map.ts`
itself (computed once at module load from the already-private `EXT_TO_LANG`);
`CorpusInput.tsx` imports only the finished, ready-to-render array.

## Code Examples

See Pattern 1 (`symbol-density.ts`), Pattern 2 (`metrics.ts` integration), Pattern 3
(`ResultsView.tsx`), Pattern 4 (`HistoryView.tsx`), Pattern 5 (`CorpusInput.tsx` +
`language-map.ts`) above — all code examples are grounded in the actual current
source with exact line-number citations, not generic illustrations.

## State of the Art

Not applicable — no external library/API surface changed since v1.0/v1.1's prior
research passes (2026-09-05). This phase's only "state" is the project's own prior
decisions (D-01 through D-15 in `05-CONTEXT.md`), which this research confirms are
still feasible against the current, unmodified source.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `fromPaste`'s new `language` parameter should be **required** (no default), forcing every call site to be updated explicitly, rather than optional-with-`'plaintext'`-default | Anti-Patterns to Avoid, Pitfall 2 | LOW — this is a type-safety judgment call (Claude's discretion per CONTEXT.md), not a locked decision; if the planner prefers an optional parameter with a default, the two `fromPaste(raw)` call sites (`upload.test.ts:71`, and none other) would still compile without changes, but a future new call site could silently default to `'plaintext'` without the author noticing — the required-parameter approach is recommended but reversible with a one-line signature edit. |
| A2 | `HistoryRow`'s compact `"142 / 178 adj."` pairing (vs. a new grid column) is the better resolution of D-10's discretion, based on `history-row-primary`'s current flex-row markup | Pattern 4 | LOW — purely a layout choice explicitly marked Claude's discretion in CONTEXT.md; either resolution satisfies ANLY-01's success criteria (both values visible), and CONTEXT.md explicitly defers the exact layout to a UI-SPEC pass anyway (ROADMAP.md `UI hint: yes`). |
| A3 | `.results-stats`' existing `1fr 1fr` two-column CSS grid can be left as-is (producing an uneven 2-then-1 wrap with 3 stats) rather than changed to `1fr 1fr 1fr` | Pattern 3 | LOW-MEDIUM — a purely visual outcome, explicitly flagged for the UI-SPEC pass rather than decided here; if left unaddressed the third stat block will still render correctly (grid items wrap), just not evenly. |

**All three assumptions are LOW risk and explicitly reversible** — none block
planning; they are documented so the planner/UI-SPEC pass can confirm or override
them deliberately rather than rediscovering the same fork from scratch.

## Open Questions

1. **Should `CorpusInput`'s new `pasteLanguage` state reset when a *file* is loaded
   via the upload path (i.e., after `handleFileChange` succeeds), or persist its
   current value until the user changes it or reloads the page?**
   - What we know: D-11 scopes the picker to "paste path only — upload is
     untouched." The picker's value is only ever *read* by `handleLoad` (the paste
     button), never by `handleFileChange`.
   - What's unclear: whether a stale non-`'plaintext'` paste-language selection
     lingering in the UI after switching to upload is confusing (the select would
     show, say, `'python'` while the just-loaded exercise is tagged via `extToLang`
     from the uploaded file's extension — a harmless but slightly odd UI state
     since the select's value has no effect on an upload).
   - Recommendation: leave it as component state that only changes on explicit user
     interaction with the select — do not add special reset-on-upload logic. This is
     the simplest behavior, matches D-13's "no surprising side effects" spirit, and
     is trivially revisable if it proves confusing in daily self-use (the exact
     kind of "cheap, reversible follow-up" D-13 itself invokes for the language-
     memory question).

## Environment Availability

**Skipped** — this phase has no external dependencies (tools/services/CLIs/runtimes)
beyond what's already installed and verified working in Phases 1-4 (Node/pnpm/Vite/
Vitest, all confirmed functional by the existing 132+ passing test suite). No new
dependency, no new environment probe needed.

## Security Domain

`security_enforcement` is enabled (`.planning/config.json`, ASVS L1). This phase's
attack surface is minimal — one new client-side pure computation and one new
client-side `<select>` with a fixed, hardcoded option enum.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No auth surface in this project (local-first, no accounts). |
| V3 Session Management | No | N/A. |
| V4 Access Control | No | N/A. |
| V5 Input Validation | Yes (minimal) | The `<select>`'s value is constrained to a fixed, code-defined enum (`PASTE_LANGUAGE_OPTIONS` + `'plaintext'`) rendered as native `<option>` elements — a user cannot submit an arbitrary string through this control (no free-text language field, per D-11's explicit rejection of a free-text alternative). `Exercise.language` therefore remains a closed, trusted string set end-to-end for the paste path, same as it already is for the upload path via `extToLang`. No new validation code is needed beyond "the select only offers these options." |
| V6 Cryptography | No | N/A — no new stored-secret or crypto surface. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| `exercise.language` used as a raw string in later cross-session grouping (Phase 6) without sanitization | Tampering (low severity — self-only local storage, no multi-user boundary) | Already mitigated by construction: with the `<select>` in place, `language` can only ever be one of the fixed enum values (or `'plaintext'`) for paste, and one of `EXT_TO_LANG`'s values (or `'plaintext'`) for upload — never arbitrary user-typed text. No injection-style risk (values are rendered as plain text in `HistoryRow`'s existing `<span className="key-chip">{session.exercise.language}</span>`, React's default JSX escaping applies, no `dangerouslySetInnerHTML` anywhere in this phase). |

No new threats introduced by the symbol-density classifier or weighting formula —
both operate on data (`Exercise.text`) that is already fully in-memory and already
rendered/typed by the user before this phase's code runs; no new trust boundary is
crossed.

## Sources

### Primary (HIGH confidence — direct source read, this session)
- `src/metrics/metrics.ts` (full file) — exact current formulas, exact insertion
  point for the new field/call, existing guard-clause conventions.
- `src/ui/history-metrics.ts` (full file) — confirmed the dormant recompute branch
  and its exact activation condition (`schemaVersion !== METRICS_SCHEMA_VERSION`).
- `src/persistence/types.ts` (full file) — confirmed `StoredSession.metricsSnapshot`
  shape and that `STORED_SESSION_SCHEMA_VERSION` (envelope) is distinct from and
  unaffected by `MetricsResult.schemaVersion` (this phase only bumps the latter).
- `src/ui/ResultsView.tsx`, `src/ui/HistoryView.tsx` (full files) — exact current
  markup for the new stat block / row value insertion points.
- `src/ingestion/language-map.ts`, `src/ingestion/paste.ts`, `src/ingestion/types.ts`
  (full files) — confirmed `EXT_TO_LANG`'s exact 13-value set matches D-12's stated
  list; confirmed `fromPaste`'s exact current signature and its only two call sites.
- `src/ui/CorpusInput.tsx` (full file) — confirmed no existing `<select>` precedent
  in the codebase (this will be the first); confirmed exact `handleLoad` call site.
- `src/trainer/state.ts` (full file) — confirmed `glyphFor` is unrelated to this
  phase's language/symbol concerns (whitespace-glyph mapping only), listed in the
  task brief but not load-bearing for D-01–D-15.
- `src/metrics/metrics.test.ts`, `src/ui/HistoryView.test.tsx`,
  `src/ui/history-metrics.test.ts`, `src/ingestion/upload.test.ts` (full files) —
  confirmed exact existing test fixtures/call sites that break or need extension
  once `MetricsResult`/`fromPaste` signatures change (Pitfalls 2 and 3 above).
- `package.json` — confirmed no dependency drift; `dexie@4.4.4` pinned per Phase 4's
  STATE.md decision, unaffected by this phase.
- Shell: `npm view dexie version` → `4.4.6` (current upstream, informational only,
  not a recommendation to upgrade).

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`,
  `.planning/research/FEATURES.md` (v1.1 milestone research, 2026-09-05) — module
  placement, double-counting pitfall, feature-landscape framing. All claims from
  these documents were re-verified against current source in this pass, not taken
  on faith.

### Tertiary (LOW confidence)
- None — no WebSearch was needed for this phase; it is entirely internal-codebase
  and already-locked-decision grounded.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, fully confirmed against
  `package.json` and `.planning/research/STACK.md`.
- Architecture: HIGH — every integration point cited with exact current line
  numbers; no speculative design remains (CONTEXT.md pre-resolved D-01–D-15).
- Pitfalls: HIGH — the two most consequential pitfalls (existing `fromPaste` test
  call site, existing `MetricsResult` literal fixtures) were found by direct grep
  against the actual current codebase in this session, not inferred generically.

**Research date:** 2026-09-12
**Valid until:** Effectively indefinite for this phase's scope (pure internal
refactor + additive UI, no external API surface to go stale) — re-verify only if
`src/metrics/metrics.ts`, `src/ingestion/paste.ts`, or the two flagged test files
change before this phase is planned/executed.

---
*Research for: keebdrill Phase 5 (Symbol-Adjusted WPM & Language Tagging)*
*Researched: 2026-09-12*
