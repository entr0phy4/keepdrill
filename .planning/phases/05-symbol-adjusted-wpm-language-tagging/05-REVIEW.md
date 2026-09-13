---
phase: 05-symbol-adjusted-wpm-language-tagging
reviewed: 2026-09-13T19:20:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src/metrics/symbol-density.ts
  - src/metrics/symbol-density.test.ts
  - src/metrics/metrics.ts
  - src/metrics/metrics.test.ts
  - src/ui/ResultsView.tsx
  - src/ui/HistoryView.tsx
  - src/index.css
  - src/ui/HistoryView.test.tsx
  - src/ui/history-metrics.test.ts
  - src/persistence/repository.test.ts
  - src/persistence/db.test.ts
  - src/ingestion/language-map.test.ts
  - src/ingestion/paste.test.ts
  - src/ui/CorpusInput.test.tsx
  - src/ingestion/language-map.ts
  - src/ingestion/paste.ts
  - src/ingestion/upload.test.ts
  - src/ui/CorpusInput.tsx
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-09-13T19:20:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

Reviewed the symbol-adjusted WPM cluster (`symbol-density.ts` wired through `computeSessionMetrics` into `ResultsView` / `HistoryRow`) and the paste-language cluster (`PASTE_LANGUAGE_OPTIONS`, required `fromPaste` language, `CorpusInput` `<select>`). The formula is a pure target-only multiplier (`SYMBOL_WEIGHT = 2`), `METRICS_SCHEMA_VERSION` is `2`, D-07 compares a clean vs backspace-corrected symbol log, and the upload path still tags via `extToLang` without reading the picker.

No Critical issues (no injection surface, no secrets, no attempt-stream double-counting in production code). Two Warnings: the ASCII-only classifier disagrees with itself across Unicode normalization forms and inflates adj. WPM on non-English letters; History display assumes `symbolAdjustedWpm` is always a finite number, but no test mounts a real pre-v2 snapshot that lacks the field. Four Info items are quality/coverage nits.

## Warnings

### WR-01: ASCII-only classifier + code-point walk splits NFC/NFD of the same grapheme

**File:** `src/metrics/symbol-density.ts:31-35`
**Issue:** `classifySymbolDensity` buckets with `/[A-Za-z0-9]/` then `/\s/`, else symbol, over `Array.from(target)` code points. Two correctness problems follow for real corpus this project claims to drill (technical docs, non-English comments):

1. Letters outside ASCII (`ñ`, `é`, `ß`, CJK, Greek) are symbols, so a prose-heavy comment block inflates `symbolAdjustedWpm` even though the user typed letters, not punctuation.
2. Ingestion explicitly does **not** Unicode-normalize (`normalize.ts`: "Do NOT Unicode-normalize (NFC/NFD)"). The same visual `é` therefore yields different densities: NFC `U+00E9` is one symbol (density 1); NFD `e` + combining acute is alnum + symbol (density 0.5). Clipboard source can change adj. WPM for identical-looking exercises.

D-01 locked `[A-Za-z0-9]`, and CONTEXT asked to flag that judgment if it felt wrong in practice. The NFD split is an unhandled edge case D-01 did not call out. `symbol-density.test.ts` never covers a non-ASCII letter or a decomposed grapheme.

**Fix:** Treat Unicode letters/numbers as alnum (keep `_` as symbol) and classify after NFC so one grapheme cannot land in two buckets:

```ts
export function classifySymbolDensity(target: string): number {
  const codepoints = Array.from(target.normalize('NFC'))
  if (codepoints.length === 0) return 0

  let symbolCount = 0
  for (const ch of codepoints) {
    if (/^[\p{L}\p{N}]$/u.test(ch)) continue
    if (/^\s$/u.test(ch)) continue
    symbolCount += 1
  }
  return symbolCount / codepoints.length
}
```

Add golden cases: `'café'` (NFC) density 0; `'cafe\u0301'` after NFC matches; `'a_b'` still `1/3`; `'🎉{'` still `1`. This amends D-01 — confirm before landing if ASCII-only was intentional for US-ANSI symbol training.

### WR-02: History can render `NaN` if a cached snapshot lacks `symbolAdjustedWpm`; D-06's real v1 row shape is untested

**File:** `src/ui/HistoryView.tsx:50-52`, `src/ui/history-metrics.test.ts:40-59`, `src/ui/HistoryView.test.tsx:51-57`
**Issue:** `HistoryRow` always does `Math.round(m.symbolAdjustedWpm)` with no finite-number check. `resolveMetrics` cache-hits on `schemaVersion === METRICS_SCHEMA_VERSION` and returns the stored object as-is — it does not check that `symbolAdjustedWpm` exists. Pre-phase-5 IndexedDB rows are `schemaVersion: 1` **and omit the field**. Production is currently saved by the bump to `2` (mismatch → recompute). That is the only guard.

Tests added this phase never construct that row shape:

- `HistoryView.test.tsx` fixtures set `schemaVersion: METRICS_SCHEMA_VERSION` **and** `symbolAdjustedWpm: 78`, so they only exercise the cache-hit happy path.
- `history-metrics.test.ts` stale case uses `schemaVersion: METRICS_SCHEMA_VERSION + 1` (i.e. 3), still spreading a snapshot that already has `symbolAdjustedWpm`. It never uses `schemaVersion: 1` without the field.

If the bump is reverted, compared with `>=`, or a hand-edited/partial row has version 2 without the field, React will render `NaN` on every affected history row. `Math.round(undefined)` is `NaN`.

**Fix:** Treat a snapshot as stale unless the new field is a finite number, and lock it with a v1-shaped fixture:

```ts
// src/ui/history-metrics.ts
export function resolveMetrics(s: StoredSession): MetricsResult {
  const snap = s.metricsSnapshot
  if (
    snap.schemaVersion === METRICS_SCHEMA_VERSION &&
    Number.isFinite(snap.symbolAdjustedWpm)
  ) {
    return snap
  }
  return computeSessionMetrics(s.exercise.text, s.charLog, s.markers, s.completedAtTMs)
}
```

```ts
it('recomputes symbolAdjustedWpm for a pre-v2 snapshot that lacks the field', () => {
  const stale = makeStoredSession({
    metricsSnapshot: {
      schemaVersion: 1,
      wpm: 42,
      accuracy: 0.9,
      slowest5: [],
    } as unknown as MetricsResult,
  })
  const result = resolveMetrics(stale)
  expect(Number.isFinite(result.symbolAdjustedWpm)).toBe(true)
  expect(result.schemaVersion).toBe(METRICS_SCHEMA_VERSION)
})
```

Optionally render `Number.isFinite(m.symbolAdjustedWpm) ? Math.round(m.symbolAdjustedWpm) : Math.round(m.wpm)` in `HistoryRow` so a bad cache cannot print `NaN`.

## Info

### IN-01: `.results-stat-label` is still undefined in CSS

**File:** `src/ui/ResultsView.tsx:34`, `src/ui/HistoryView.tsx:52`, `src/index.css`
**Issue:** Phase 4 already noted this class is applied but never defined. This phase added a third Results label (`adj. wpm`) and the History `adj.` label through the same class. UI-SPEC required Label role (13/600/1.4); only `.text-muted` on History actually changes appearance. Results labels inherit body 15/400, matching existing `wpm`/`accuracy` peers but not the stated Label role.
**Fix:** Point `.results-stat-label` at the existing `.text-label` metrics (or compose `text-label text-muted`) so the class is not a no-op.

### IN-02: `fromPaste` language is an unconstrained `string`

**File:** `src/ingestion/paste.ts:10-14`, `src/ui/CorpusInput.tsx:31,136`
**Issue:** D-11 rejected a free-text field specifically so typos would not fragment Phase 6 per-language grouping. The `<select>` is closed, but `fromPaste(raw, language: string)` copies any string through, and `useState('plaintext')` is inferred as `string` rather than `'plaintext' | (typeof PASTE_LANGUAGE_OPTIONS)[number]`. A future call site can tag `'Python'` / `''` / `'ts'` as distinct languages.
**Fix:** Export a union (or `as const` on the options array plus `'plaintext'`) and type the parameter and `pasteLanguage` state with it. Keep the parameter required (D-15).

### IN-03: No unit test that ResultsView renders the third stat

**File:** `src/ui/ResultsView.tsx:33-35`
**Issue:** History pairing is asserted in `HistoryView.test.tsx`. There is no `ResultsView` test file; nothing fails if the `adj. wpm` block is removed. 05-01-SUMMARY already deferred this to human verify.
**Fix:** A shallow/render test that `ResultsView` output contains `adj. wpm` and the rounded `symbolAdjustedWpm` value.

### IN-04: Language `<select>` stays enabled while paste load is `busy`

**File:** `src/ui/CorpusInput.tsx:71-78,132-136`
**Issue:** `handleLoad` closes over `pasteLanguage` at click time, then runs `fromPaste` on the next animation frame. The Load button disables via `busy`; the select does not. For a large paste, the user can change the visible language after click while the in-flight load still tags the click-time value.
**Fix:** `disabled={busy}` on the select (same as the button), or capture `const language = pasteLanguage` before `setBusy(true)` and pass that local into the rAF callback (already true via closure — disabling is the UX fix).

---

_Reviewed: 2026-09-13T19:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
