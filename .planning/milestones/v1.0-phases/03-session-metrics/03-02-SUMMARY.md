---
phase: 03-session-metrics
plan: 02
subsystem: metrics
tags: [metrics, slowest-keys, median, results-panel, ui-polish]
status: complete
dependency-graph:
  requires:
    - src/metrics/metrics.ts (03-01's computeSessionMetrics/replayAttempts/MetricsResult — extended, not replaced)
    - src/ui/ResultsView.tsx (03-01's two-stat markup — extended, not replaced)
    - src/trainer/state.ts (glyphFor, unchanged, reused)
  provides:
    - src/metrics/metrics.ts (SlowestKeyEntry, slowest5 field, median/slowestFive private helpers)
    - src/ui/ResultsView.tsx (slowest-keys list / "not enough data" fallback section)
    - src/index.css (.results-panel/.results-stats/.results-stat/.results-slowest(-list/-row)/.key-chip + results-fade-in keyframes)
  affects: []
tech-stack:
  added: []
  patterns:
    - "Sibling reducer extension: replayAttempts's existing delete/insert loop gained a latencySamplesByChar Map<string, number[]> tracked alongside correctAttempts/incorrectAttempts, without adding a new pass over charLog"
    - "Absolute-threshold trim + median (not percentage trimmed-mean) for small per-character sample counts (n=3-10), matching keybr.com-style per-key latency conventions"
    - "IME multi-codepoint gap attribution: only the last codepoint of a multi-codepoint CommittedChar record receives a latency sample; earlier codepoints in the same record are excluded entirely, never fabricating a gap"
key-files:
  created: []
  modified:
    - src/metrics/metrics.ts
    - src/metrics/metrics.test.ts
    - src/ui/ResultsView.tsx
    - src/index.css
decisions: []
metrics:
  duration: "~20 min"
  completed: 2026-09-05
actuals:
  tokens: 4494
  tasks: 2
  commits: 2
---

# Phase 3 Plan 2: Slowest-5 Keystrokes + Results Panel Visual Polish Summary

Completed Phase 3's metrics engine with the five-slowest-keystrokes computation (D-03/D-04,
METR-03) and applied the full visual/motion polish from `03-UI-SPEC.md` — the results panel
now shows all three metric groups (WPM, accuracy, slowest-5-or-fallback) styled as a bordered
card with reduced-motion-safe fade-in.

## What Was Built

- **`src/metrics/metrics.ts`** — extended `replayAttempts`'s existing delete/insert reducer to
  also accumulate a `latencySamplesByChar: Map<string, number[]>`, tracking `prevTMs` (the
  previous record's `tMs`, of any type) and attaching the inter-record gap only to the *last*
  codepoint of each insert-branch record's `Array.from(rec.data ?? '')` iteration (Pitfall 7 —
  IME multi-codepoint commits never fabricate a gap for earlier codepoints). Added:
  - `SlowestKeyEntry { char, medianMs }` and `slowest5: SlowestKeyEntry[]` on `MetricsResult`
  - `median(samples)` — `noUncheckedIndexedAccess`-safe (guards every indexed read against
    `undefined`, no non-null assertions), returns `0` on an empty array
  - `slowestFive(latencySamplesByChar)` — filters each character's samples to the exclusive
    `(25ms, 1000ms)` window, requires `>= 3` **post-filter** samples (Pitfall 4 — gates on
    survivors, not raw occurrence count), computes the median of survivors, sorts descending,
    caps at 5 entries
  - `computeSessionMetrics` now calls `slowestFive` and includes `slowest5` in its return
- **`src/metrics/metrics.test.ts`** — added `slowest5` expectations to all 6 existing golden
  cases (all empty, since none of those tiny logs produce a qualifying character) plus 5 new
  cases: D-04's exactly-2-vs-exactly-3-post-filter-samples boundary, the outlier filter's
  exact-25ms/exact-1000ms exclusivity (26ms/999ms/500ms survive), a 6-character case proving
  the result is ranked descending and capped at 5 (the 6th, lowest-median character is
  excluded), an IME multi-codepoint case proving only the last codepoint (`'b'`) gets a
  latency sample while the earlier codepoint (`'a'`) gets none, and a `{`-vs-`[` case proving
  distinct grouping by logical character rather than physical key. 13/13 tests pass.
- **`src/ui/ResultsView.tsx`** — imports `glyphFor` from `../trainer/state`; added a
  `results-slowest` section after the stats row rendering either the "Not enough repeated
  characters..." fallback (when `slowest5.length === 0`) or an `<ol>` of ranked
  `{keyChip} {medianMs} ms` rows, substituting `glyphFor(entry.char)` for space/newline
  characters. All chars rendered as plain JSX text children (no `dangerouslySetInnerHTML`).
- **`src/index.css`** — appended `.results-panel` (bordered secondary-surface card, `--space-lg`
  padding/gap), `.results-stats` (1-column, 2-column at `>=640px` reusing the existing
  breakpoint), `.results-stat`, `.results-slowest(-list/-row)`, `.key-chip` (compact
  `<kbd>`-like badge), and a `results-fade-in` keyframes declaration invoked from inside the
  existing `@media (prefers-reduced-motion: no-preference)` block, capped at the existing
  `--motion-duration` (150ms).

## Verification

- `pnpm exec vitest run src/metrics/metrics.test.ts` — 13/13 passing (all golden cases +
  schema-version lock + explicit 5-entry-cap assertion)
- `pnpm exec vitest run src/ui/CaptureSurface.test.tsx` — 13/13 passing unchanged (CSS-only
  Task 2 change did not alter DOM structure or test assertions)
- `pnpm exec vitest run` (whole suite) — 130/130 passing, zero regressions
- `pnpm exec tsc --noEmit -p tsconfig.json` — zero errors
- All plan acceptance-criteria greps pass: `slowestFive` appears 2x (definition + call site) in
  `metrics.ts`, `MIN_SAMPLES = 3` appears exactly once, `glyphFor` appears 3x in
  `ResultsView.tsx`, zero `dangerouslySetInnerHTML` occurrences, `results-panel` appears 2x and
  `results-fade-in` appears exactly 2x (declaration + keyframes) in `index.css`,
  `prefers-reduced-motion` appears 3x (pre-existing block + caret-blink block + this plan's
  fade-in rule)

## Deviations from Plan

None — plan executed exactly as written. No architectural changes, no auth gates, no
out-of-scope discoveries.

## Known Stubs

None.

## Threat Flags

None — the one new security-relevant surface this plan introduces (the slowest-key chip
rendering a character drawn from untrusted corpus content) was already registered in the
plan's own `<threat_model>` (T-03-01) and mitigated exactly as specified: rendered strictly as
a plain JSX text child, verified by the acceptance criteria's negative `dangerouslySetInnerHTML`
grep. T-03-04 (DoS via `median`/`slowestFive` on degenerate input) is likewise mitigated exactly
as specified: `median` guards `samples.length === 0` and every indexed read, and `slowestFive`
never calls `median` below `MIN_SAMPLES`.

## Self-Check: PASSED

- FOUND: src/metrics/metrics.ts (modified)
- FOUND: src/metrics/metrics.test.ts (modified)
- FOUND: src/ui/ResultsView.tsx (modified)
- FOUND: src/index.css (modified)
- FOUND commit: ee542a1
- FOUND commit: 66baa08
