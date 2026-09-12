# Phase 5: Symbol-Adjusted WPM & Language Tagging - Pattern Map

**Mapped:** 2026-09-12
**Files analyzed:** 9 (1 new, 8 modified — includes 2 existing test files that must be touched as a side effect of two interface/signature changes)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `src/metrics/symbol-density.ts` | utility (pure classifier + formula) | transform | `src/metrics/metrics.ts` (`computeWpm`/`computeAccuracy`) | exact — same module family, same "pure function, guard-clause, no rounding" contract |
| `src/metrics/metrics.ts` | utility / model (extends `MetricsResult`) | transform | itself (existing `computeSessionMetrics`) — self-modification, not an analog lookup | exact — editing in place |
| `src/ui/ResultsView.tsx` | component (leaf, prop-driven) | request-response (render props → DOM) | itself (existing `.results-stat` block) — self-modification | exact |
| `src/ui/HistoryView.tsx` | component (list row) | CRUD (read-only list render) | itself (existing `HistoryRow` primary line) — self-modification | exact |
| `src/ingestion/paste.ts` | utility (pure transform, signature change) | transform | `src/ingestion/upload.ts` (`fromFile`, sibling ingestion function with the same `Exercise`-shaping contract) | exact — same role, same data flow, same output type |
| `src/ingestion/language-map.ts` | utility / config (new derived export) | transform | itself (existing `EXT_TO_LANG` + `extToLang`) — self-modification | exact |
| `src/ui/CorpusInput.tsx` | component (form / interactive control) | request-response (user input → `Exercise`) | itself (existing paste-textarea / upload-input blocks) — self-modification | exact |
| `src/metrics/metrics.test.ts` | test (golden-case table) | transform (unit test) | itself — extend `Case`/`it.each` table | exact |
| `src/ingestion/upload.test.ts` | test | transform (unit test) | itself — fix one call site (line 71) | exact |
| `src/ui/HistoryView.test.tsx` | test | CRUD (integration test, Dexie-backed) | itself — extend `baseMetrics` literal (lines 51-56) + assertions | exact |
| `src/ui/history-metrics.test.ts` | test | transform (unit test) | itself — extend `baseSnapshot` literal (lines 16-20) | exact |

**No new test file for `symbol-density.ts` has an existing analog to copy structurally beyond `metrics.test.ts`'s own `Case`/`it.each` convention** — see Shared Patterns below; `src/metrics/symbol-density.test.ts` (new) should mirror `metrics.test.ts`'s golden-case table shape exactly, not invent a new test style.

`src/persistence/types.ts` is **not modified** — confirmed by reading the file: `StoredSession.metricsSnapshot: MetricsResult` and `NewSession.metricsSnapshot: MetricsResult` both reference `MetricsResult` by import only (never re-declare its fields), so adding `symbolAdjustedWpm` to the `MetricsResult` interface in `metrics.ts` flows through automatically. Confirmed no local `NewSession`/`StoredSession` object literals for `MetricsResult` exist inside `persistence/`.

## Pattern Assignments

### `src/metrics/symbol-density.ts` (NEW — utility, transform)

**Analog:** `src/metrics/metrics.ts` — specifically `computeWpm`/`computeAccuracy`'s pure-function-with-guard-clause shape (lines 138-147) and the file-header pure-module contract comment (lines 1-16).

**Module-header contract comment pattern** (metrics.ts lines 1-16, to mirror verbatim in spirit):
```typescript
// PURE — zero DOM access, zero non-`import type` runtime imports besides a
// direct call to computeActiveElapsedMs (METR-04). Re-runnable over any
// {target, charLog, markers, now} tuple with no side effects; safe to call
// repeatedly (no shared mutable module state). Golden cases locking these
// formulas live in metrics.test.ts.
// ...
// Do NOT round any number inside this module (Pitfall 5) — round only at the
// display layer (ResultsView.tsx).
```
`symbol-density.ts` should open with an equivalent header: PURE, zero DOM, no `charLog`/`CommittedChar` import (Pitfall 1 in RESEARCH.md — this is the load-bearing constraint), no rounding.

**Guard-clause pattern to copy** (metrics.ts lines 138-147, verbatim):
```typescript
/** Guard elapsedMs <= 0 -> 0 (Pitfall 2) so a degenerate active-time never
 *  renders Infinity/NaN. */
export function computeWpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0
  return correctChars / 5 / (elapsedMs / 60000)
}

/** Guard totalAttempts === 0 -> 1 (a pure-function safety default; the UI
 *  can never actually reach the results panel with zero attempts). */
export function computeAccuracy(correctAttempts: number, totalAttempts: number): number {
  if (totalAttempts === 0) return 1
  return correctAttempts / totalAttempts
}
```
Apply the identical "one-line guard comment + early return" shape to `classifySymbolDensity`'s `codepoints.length === 0 → return 0` guard (RESEARCH.md Pattern 1's zero-length-target case).

**Unicode-safe iteration pattern** (metrics.ts lines 65-70, `replayAttempts`, verbatim):
```typescript
  // Code-point array, not raw string indexing — mirrors state.ts's identical
  // fix: `target[cursor]`/`target.length` are UTF-16-code-unit semantics,
  // but `cursor` advances one per Unicode code point. A supplementary-plane
  // character (surrogate pair) in `target` would otherwise desync the two.
  const targetChars = Array.from(target)
```
`classifySymbolDensity` must open with `const codepoints = Array.from(target)` and carry an equivalent comment — this is the exact established precedent D-02 cites.

**Exports (per RESEARCH.md Pattern 1, exact target shape):**
```typescript
export const SYMBOL_WEIGHT = 2

export function classifySymbolDensity(target: string): number { /* ... */ }
export function computeSymbolAdjustedWpm(wpm: number, symbolDensity: number): number { /* ... */ }
```
`SYMBOL_WEIGHT` as a bare exported `const` mirrors `MIN_GAP_MS`/`MAX_GAP_MS`/`MIN_SAMPLES` in `metrics.ts` (lines 47-49) — module-level tunable constants, not buried magic numbers.

---

### `src/metrics/metrics.ts` (MODIFIED — extends `MetricsResult` + `computeSessionMetrics`)

**Analog:** itself — this is a self-contained, precisely located edit.

**Current exact insertion points (verbatim, current source):**
```typescript
// Line 32
export const METRICS_SCHEMA_VERSION = 1

// Lines 39-44
export interface MetricsResult {
  schemaVersion: number
  wpm: number
  accuracy: number
  slowest5: SlowestKeyEntry[]
}

// Lines 150-166
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

**Target shape** (RESEARCH.md Pattern 2, already fully specified):
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
Note `wpm` is hoisted to a local so it's computed once and reused (avoids calling `computeWpm` twice) — a small deviation from the pre-existing inline-call style, justified because `computeSymbolAdjustedWpm` needs the already-computed value per D-04.

---

### `src/ui/ResultsView.tsx` (MODIFIED — new `.results-stat` block)

**Analog:** itself — existing `.results-stat` / `.results-stat-label` markup (lines 26-33, verbatim):
```typescript
<div className="results-stats">
  <div className="results-stat">
    {Math.round(metrics.wpm)} <span className="results-stat-label">wpm</span>
  </div>
  <div className="results-stat">
    {Math.round(metrics.accuracy * 100)}% <span className="results-stat-label">accuracy</span>
  </div>
</div>
```
**Add (D-09, verbatim label per UI-SPEC Copywriting Contract):**
```typescript
<div className="results-stat">
  {Math.round(metrics.symbolAdjustedWpm)} <span className="results-stat-label">adj. wpm</span>
</div>
```
No new class, no new import. `Math.round()`-at-display-layer convention preserved exactly.

**Companion CSS change required (per 05-UI-SPEC.md, NOT optional — locked by the UI-SPEC pass):** `src/index.css` lines 350-356 —
```css
@media (min-width: 640px) {
  .results-stats {
    grid-template-columns: 1fr 1fr;   /* → change to: 1fr 1fr 1fr */
    column-gap: var(--space-lg);
    row-gap: var(--space-md);
  }
}
```
This one-line value change (not a new selector, not a new token) is in scope for this phase per `05-UI-SPEC.md` §Spacing Scale.

---

### `src/ui/HistoryView.tsx` (MODIFIED — `HistoryRow`'s primary-line WPM span)

**Analog:** itself — existing WPM span inside `.history-row-primary` (lines 48-52, verbatim):
```typescript
<div className="history-row-primary">
  <span title={new Date(session.startedAt).toLocaleString()}>{relativeTime(session.startedAt)}</span>
  <span>
    {Math.round(m.wpm)} <span className="results-stat-label text-muted">wpm</span>
  </span>
  <span>{Math.round(m.accuracy * 100)}%</span>
</div>
```
**Target shape (D-10, UI-SPEC-locked compact pairing, format `"{wpm} / {adj} adj."`):**
```typescript
<span>
  {Math.round(m.wpm)} / {Math.round(m.symbolAdjustedWpm)}{' '}
  <span className="results-stat-label text-muted">adj.</span>
</span>
```
Note per `05-UI-SPEC.md`'s Copywriting Contract, the standalone `wpm` label is **dropped** from this span (replaced by the trailing `adj.` label reading against both numbers) — this is a deliberate locked change, not an oversight; `HistoryView.test.tsx`'s existing assertions `.toContain('62 ')` / `.toContain('wpm')` (lines 111-112) will need updating (see test section below) since the literal string `'wpm'` will no longer appear in this span.

No new class, no new gap token — `.history-row-primary`'s existing `flex-wrap: wrap` (index.css lines 454-461) already absorbs the slightly longer span per UI-SPEC.

---

### `src/ingestion/paste.ts` (MODIFIED — `fromPaste` signature change)

**Analog:** `src/ingestion/upload.ts::fromFile` — same `Exercise`-producing contract, already threads an explicit `language` value (via `extToLang`) rather than hardcoding it. `fromPaste` should converge toward the same "language is an explicit input, not a hardcoded literal" shape `fromFile` already has.

**Current exact source (verbatim):**
```typescript
// D-11 / A11: pasted content is always `language: 'plaintext'`, `sourceType: 'paste'`.
// Content is loaded as-is — normalize() only touches newlines, tabs, per-line
// trailing ASCII whitespace and a leading BOM; it never parses or strips content (D-08).
export function fromPaste(raw: string, tabWidth = 4): Exercise {
  return {
    text: normalize(raw, { tabWidth }),
    language: 'plaintext',
    sourceType: 'paste',
  }
}
```

**Target shape (D-15; per RESEARCH.md Assumption A1, `language` is a required positional parameter — no default — so every call site must be updated explicitly, matching the anti-pattern warning against an optional-with-default param):**
```typescript
// D-15/05-CONTEXT.md: language is now caller-supplied (the paste-form <select>
// in CorpusInput.tsx), not hardcoded. Required (no default) so a future new
// call site can't silently fall back to 'plaintext' unnoticed (RESEARCH.md
// Anti-Patterns / Pitfall 2).
export function fromPaste(raw: string, language: string, tabWidth = 4): Exercise {
  return {
    text: normalize(raw, { tabWidth }),
    language,
    sourceType: 'paste',
  }
}
```
**Two call sites must be updated in the same task** (grep-confirmed, exactly two exist):
1. `src/ui/CorpusInput.tsx:76` — `const exercise = fromPaste(value)` → `fromPaste(value, pasteLanguage)`
2. `src/ingestion/upload.test.ts:71` — `const pasted = fromPaste(raw)` → `fromPaste(raw, 'plaintext')` (test's own intent — CRLF/tab normalize parity — is orthogonal to language; any fixed literal is correct)

---

### `src/ingestion/language-map.ts` (MODIFIED — new `PASTE_LANGUAGE_OPTIONS` export)

**Analog:** itself — existing private `EXT_TO_LANG` map + `extToLang` export (lines 6-35, verbatim):
```typescript
const EXT_TO_LANG: Record<string, string> = {
  '.ts': 'typescript',
  // ... 17 more entries ...
}

export function extToLang(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0) return 'plaintext'
  const ext = fileName.slice(dot).toLowerCase()
  return EXT_TO_LANG[ext] ?? 'plaintext'
}
```
**Add (D-12/Pitfall 5 — computed export, `EXT_TO_LANG` itself stays private):**
```typescript
// D-12: the paste-form <select>'s canonical option list — derived from
// EXT_TO_LANG's own value set so paste and upload can never drift onto two
// different language vocabularies. Does NOT include 'plaintext' — the
// caller (CorpusInput.tsx) is responsible for presenting that as the
// explicit, always-selected default (D-13), keeping "is this the default"
// visible at the call site rather than buried in this module.
export const PASTE_LANGUAGE_OPTIONS: readonly string[] = [...new Set(Object.values(EXT_TO_LANG))].sort()
```
Computed once at module load (top-level `const`), zero runtime cost per render.

---

### `src/ui/CorpusInput.tsx` (MODIFIED — new `<select>` + `handleLoad` wiring)

**Analog:** itself — the existing label+control wrapper pattern used twice already (paste textarea block, lines 112-124; upload input block, lines 126-148), and the existing `useState` declarations (lines 29-33).

**Current exact wrapper shape to reuse verbatim (lines 112-124):**
```typescript
<div style={{ display: 'grid', gap: 'var(--space-xs)' }}>
  <label htmlFor="corpus-paste" className="text-label">
    Paste code or text
  </label>
  <textarea
    id="corpus-paste"
    value={value}
    onChange={(e) => handlePasteChange(e.target.value)}
    placeholder="Paste a snippet, a file's contents, anything you want to drill…"
    rows={8}
    spellCheck={false}
  />
</div>
```

**New state (mirrors existing `useState` block, lines 29-33):**
```typescript
const [pasteLanguage, setPasteLanguage] = useState('plaintext')
```

**New block — insert directly after the paste-textarea `</div>` (line 124) and before the upload block (line 126), per D-11 + 05-UI-SPEC.md's exact insertion point:**
```typescript
<div style={{ display: 'grid', gap: 'var(--space-xs)' }}>
  <label htmlFor="corpus-paste-language" className="text-label">
    Language
  </label>
  <select
    id="corpus-paste-language"
    className="control"
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
Import to add: `import { PASTE_LANGUAGE_OPTIONS } from '../ingestion/language-map'`. Note `className="control"` is required per `05-UI-SPEC.md`'s Spacing Scale section — this is what makes the select inherit the existing `button, .control { ... }` box-model rule (`src/index.css:148-159`) with zero new CSS.

**`handleLoad` call-site change (current exact line 76, verbatim: `const exercise = fromPaste(value)`):**
```typescript
const exercise = fromPaste(value, pasteLanguage)
```

---

## Shared Patterns

### Pure-module contract header comment
**Source:** `src/metrics/metrics.ts` lines 1-16, `src/ui/history-metrics.ts` lines 1-11
**Apply to:** `src/metrics/symbol-density.ts` (new)
```typescript
// PURE — zero DOM access, zero side effects, safe to call repeatedly. Do NOT
// import CommittedChar/CaptureMarker or read charLog (Pitfall 1) — the
// classifier/formula must depend only on `target`, never the attempt
// stream, to avoid double-counting backspace-corrected symbol characters.
// Do NOT round inside this module — round only at the display layer.
```

### Unicode-safe codepoint iteration
**Source:** `src/metrics/metrics.ts` lines 65-70 (`replayAttempts`'s `Array.from(target)`)
**Apply to:** `classifySymbolDensity` in `symbol-density.ts`
```typescript
const codepoints = Array.from(target)
```
Never `target.length` / `target[i]` raw indexing — same rule enforced project-wide (D-02).

### Named module-level tunable constants
**Source:** `src/metrics/metrics.ts` lines 47-49 (`MIN_GAP_MS`, `MAX_GAP_MS`, `MIN_SAMPLES`)
**Apply to:** `SYMBOL_WEIGHT` in `symbol-density.ts` — exported bare `const`, not inlined into the formula, so it is a one-line tune (D-05).

### Display-layer-only rounding
**Source:** `src/ui/ResultsView.tsx` line 27 / `src/ui/HistoryView.tsx` line 51 (`Math.round(...)` at render)
**Apply to:** Every new number surface (`ResultsView`'s "adj. wpm" block, `HistoryRow`'s adjusted-WPM pairing) — `symbol-density.ts`/`metrics.ts` never call `Math.round`.

### Golden-case table testing convention
**Source:** `src/metrics/metrics.test.ts` — `Case` interface (lines 19-27) + `it.each(cases)` (line 220), `char()`/`marker()` fixture builder helpers (lines 11-17)
**Apply to:** `src/metrics/symbol-density.test.ts` (new) for `classifySymbolDensity`/`computeSymbolAdjustedWpm`, AND the mandatory D-07 double-counting golden test (which should live either in `symbol-density.test.ts` as a formula-level case, or in `metrics.test.ts` as a `computeSessionMetrics`-level integration case comparing a clean vs. backspace-corrected `charLog` over identical `target` text — RESEARCH.md Pitfall 4 recommends the `symbolAdjustedWpm / wpm` ratio-equality assertion).

### `<select>`/form-control styling via existing shared class
**Source:** `src/index.css` lines 148-159 (`button, .control { ... }`)
**Apply to:** `CorpusInput.tsx`'s new language `<select>` — `className="control"`, zero new CSS rule.

## Test-File Update Requirements (not new patterns — required fixture edits)

| File | Current (lines) | Required change |
|------|------------------|-------------------|
| `src/metrics/metrics.test.ts` | `Case.expected` (lines 26, `{ wpm, accuracy, slowest5? }`) + schema-version test (lines 229-232, asserts `schemaVersion === 1`) | Update schema-version assertion to `2`; add new golden case(s) exercising `symbolAdjustedWpm`, including the D-07 double-counting regression case |
| `src/ui/HistoryView.test.tsx` | `baseMetrics` literal (lines 51-56) | Add `symbolAdjustedWpm: <value>` field (required by the widened `MetricsResult` interface); update the `'wpm'` text assertions (lines 111-112) since `HistoryRow`'s span text changes per D-10's UI-SPEC-locked format |
| `src/ui/history-metrics.test.ts` | `baseSnapshot` literal (lines 16-20) | Add `symbolAdjustedWpm: <value>` field |
| `src/ingestion/upload.test.ts` | Line 71, `const pasted = fromPaste(raw)` | Update to `fromPaste(raw, 'plaintext')` — required by `fromPaste`'s new signature, or `tsc`/`vitest` fails to compile (Pitfall 2) |

## No Analog Found

None — every file in scope has a strong, exact-role in-codebase analog (either itself, for straightforward extension, or a sibling ingestion function for `paste.ts`/`fromFile`). No file requires falling back to `RESEARCH.md`-only illustrative patterns.

## Metadata

**Analog search scope:** `src/metrics/`, `src/ui/`, `src/ingestion/`, `src/persistence/`, `src/index.css`
**Files scanned:** `metrics.ts`, `metrics.test.ts`, `history-metrics.ts`, `history-metrics.test.ts`, `ResultsView.tsx`, `HistoryView.tsx`, `HistoryView.test.tsx`, `CorpusInput.tsx`, `paste.ts`, `language-map.ts`, `upload.ts`, `upload.test.ts`, `persistence/types.ts`, `index.css` (relevant selectors)
**Pattern extraction date:** 2026-09-12

---
*Patterns for: keebdrill Phase 5 (Symbol-Adjusted WPM & Language Tagging)*
