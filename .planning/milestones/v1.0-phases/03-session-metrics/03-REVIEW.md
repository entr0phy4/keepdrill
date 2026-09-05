---
phase: 03-session-metrics
reviewed: 2026-09-05T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/metrics/metrics.ts
  - src/metrics/metrics.test.ts
  - src/ui/ResultsView.tsx
  - src/ui/CaptureSurface.tsx
  - src/ui/CaptureSurface.test.tsx
  - src/ui/App.tsx
  - src/index.css
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
fixed:
  - "CR-01: fixed in a44174c — target text now indexed via Array.from(target) (code points) in state.ts, metrics.ts, and CaptureSurface.tsx; regression tests added in state.test.ts case 10 and metrics.test.ts case 12."
---

# Phase 3: Code Review Report

**Reviewed:** 2026-09-05T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

The core D-01/D-02/D-03/D-04 formulas (`computeWpm`, `computeAccuracy`, `slowestFive`/`median`)
are implemented exactly as specified and locked by the golden-case table: the WPM time basis
correctly flows through `computeActiveElapsedMs(charLog, markers, completedAt)` rather than any
wall-clock read, the accuracy denominator correctly excludes delete-type records and replays
every insert-branch attempt (including corrected-over ones), and the slowest-key outlier filter
and minimum-sample gate are both strictly exclusive/post-filter as required. No XSS risk was
found — every corpus-derived character (stat values, slowest-key chips) is rendered as a plain
JSX text child, never via `dangerouslySetInnerHTML`. Division-by-zero/NaN/Infinity guards for
zero-elapsed-time and zero-attempts are present and correctly ordered.

One correctness defect was found that is severe enough to block: `replayAttempts`'s per-character
scoring indexes the target string by UTF-16 code unit (`target[cursor]`) while advancing `cursor`
by Unicode code point (`Array.from(rec.data ?? '')`), which desyncs permanently — and can make an
exercise mathematically impossible to complete — the moment the target text contains any character
outside the Basic Multilingual Plane (emoji, some math/CJK-extension symbols). This pattern
mirrors an identical limitation in `src/trainer/state.ts` (unmodified by this phase, so the "stuck
exercise, never reaches the results panel" symptom is instantiated there), but `metrics.ts`
faithfully reproduces the same code-point/code-unit mismatch in code that IS part of this phase's
diff, so the metrics engine would misscore this content even if the trainer's completion gate were
fixed independently. `src/ingestion/normalize.ts` confirms this content is never stripped or
filtered ("does not Unicode-normalize... content is typed as-is, nothing parsed or stripped"), so
this is reachable with realistic real-world corpus content (emoji in comments, READMEs, commit-
message conventions), not a contrived edge case.

Two warnings and two info items round out the review — an unstable `onComplete` callback
reference relying entirely on a ref-guard to avoid a double-fire, and an accessibility gap in the
slowest-key chip's glyph substitution for screen-reader users.

## Critical Issues

### CR-01: Code-point vs. UTF-16-code-unit index mismatch permanently desyncs scoring (and can make the exercise unfinishable) for any target text containing a supplementary-plane character

**File:** `src/metrics/metrics.ts:71-96`
**Issue:**
`replayAttempts` iterates each insert-branch record's committed text by Unicode **code point**
(`Array.from(rec.data ?? '')`, `codepoints.forEach((ch, i) => ...)`) and advances `cursor` by 1 per
code point, but compares each code point against `target[cursor]`, which indexes `target` by
**UTF-16 code unit**. For any character in the target text whose code point lies outside the Basic
Multilingual Plane (U+10000+, e.g. most emoji, some mathematical alphanumeric symbols, rarer CJK
extension blocks), `target[cursor]` returns a lone surrogate half (a 1-unit string) while `ch` is
the full 2-unit code point string — they can never be `===` equal, so:
1. Every such character is scored `incorrectAttempts` even when typed correctly, corrupting
   `accuracy`.
2. `cursor` ends up permanently one unit short of `target.length` for every supplementary-plane
   character in the text (`target.length` counts 2 units per such character; `cursor` only counts
   1 per character typed), so `cursor >= target.length` can never become true if the text contains
   at least one such character. Since `computeTrainerState` (`src/trainer/state.ts`, same pattern,
   unmodified by this phase) gates `completedAt` on that exact condition, the exercise never
   completes — `onComplete`/`handleComplete`/`computeSessionMetrics`/`ResultsView` are silently
   unreachable, with no error shown to the user.

`src/ingestion/normalize.ts`'s own test suite explicitly documents that content is "typed as-is,
nothing parsed or stripped," and does not Unicode-normalize, so this is not filtered upstream.
Given the product's stated corpus sources (real Git repos, docs, READMEs, commit history —
CLAUDE.md), emoji and other supplementary-plane characters are a realistic, not contrived, input.

**Fix:** Index by code point on both sides, everywhere `cursor` is used as a target-position index
(this phase's file and its `state.ts` counterpart both need the same fix, since they share the
`cursor`/`target` indexing contract):
```ts
// metrics.ts
function replayAttempts(target: string, charLog: readonly CommittedChar[]) {
  const targetChars = Array.from(target) // code-point array, computed once
  let cursor = 0
  // ...
  const codepoints = Array.from(rec.data ?? '')
  codepoints.forEach((ch, i) => {
    if (cursor >= targetChars.length) return
    if (ch === targetChars[cursor]) {
      correctAttempts += 1
    } else {
      incorrectAttempts += 1
    }
    // ...
    cursor += 1
  })
}
```
The equivalent change is required in `src/trainer/state.ts`'s `computeTrainerState` (and its
`perCharStatus` array, which is currently sized/indexed by `target.length` in UTF-16 units) for the
exercise to ever reach completion for this content — flagging here since `metrics.ts` alone cannot
be fixed in isolation without the two modules diverging on what `cursor` means.

## Warnings

### WR-01: `onComplete`/`handleComplete` is a fresh function reference every render, so the fire-once guard is the *only* thing preventing a double-fire

**File:** `src/ui/App.tsx:72-78`, `src/ui/CaptureSurface.tsx:143-148`
**Issue:** `App.tsx`'s `handleComplete` is declared inline in the component body (not wrapped in
`useCallback`), so it is a new function reference on every render of `App`. `App` re-renders every
`SESSION_REFRESH_MS` (250ms) while an exercise is loaded (the `setTimingResolutionUs`/`sessionRef`
refresh interval), and that new reference is passed straight through as `CaptureSurface`'s
`onComplete` prop, which is a dependency of the completion-detection `useEffect`
(`[completedAt, onComplete]`). That effect therefore re-runs on every 250ms tick, not just on a
genuine `completedAt` transition. Today this is harmless only because `firedCompletedAtRef` blocks
re-invocation — but the effect's own correctness now depends entirely on that ref surviving future
refactors, rather than on a stable dependency array expressing "run only when the exercise
actually completes." A future change to either file (e.g., someone "simplifying" the ref guard
during a refactor, unaware of this coupling) could silently reintroduce a double `computeSessionMetrics`/`setMetrics` call.
**Fix:** Wrap `handleComplete` (and ideally `handleRestart`/`handleLoad`, for consistency) in
`useCallback` in `App.tsx` so the effect's dependency is stable and its re-run condition matches
its actual intent:
```ts
const handleComplete = useCallback((completedAt: number) => {
  const current = loadRef.current
  if (!current) return
  const session = buildSession(current.exercise, current.startedAt)
  const result = computeSessionMetrics(current.exercise.text, session.charLog, session.markers, completedAt)
  setMetrics(result)
}, [])
```

### WR-02: Slowest-key chip's whitespace-glyph substitution is not distinguishable to assistive technology

**File:** `src/ui/ResultsView.tsx:44-46`
**Issue:** When the slowest character is a space or newline, the chip renders `glyphFor(entry.char)`
(`'·'` or `'↵'`) as its only text content, inside a `role="status" aria-live="polite"` region. A
screen reader announces the literal glyph character with no accompanying label — there is nothing
in the announced text (e.g., "· 340 ms") that tells a non-sighted user this row is about the space
bar rather than an interpunct character that happened to appear in the corpus. This is a real
ambiguity, not a hypothetical one: if the corpus itself ever contains a literal `·` or `↵`-rendered
character as an actual target character, the two cases are visually and aurally indistinguishable
in this list.
**Fix:** Add a visually-hidden accessible label alongside the glyph, e.g.:
```tsx
<span className="key-chip">
  {entry.char === ' ' ? (
    <>
      <span aria-hidden="true">{glyphFor(entry.char)}</span>
      <span className="sr-only">space</span>
    </>
  ) : entry.char === '\n' ? (
    <>
      <span aria-hidden="true">{glyphFor(entry.char)}</span>
      <span className="sr-only">newline</span>
    </>
  ) : (
    entry.char
  )}
</span>
```
(with a standard `.sr-only` clip-to-nothing utility class added to `index.css`).

## Info

### IN-01: No golden-case coverage for supplementary-plane characters, out-of-order timestamps, or delete-then-reinsert latency sampling

**File:** `src/metrics/metrics.test.ts`
**Issue:** The golden-case table thoroughly covers the documented pitfalls (1/2/3/4/6/7) but has
no case for: (a) a target/charLog containing a code point outside the BMP (would have caught
CR-01), (b) a charLog with non-monotonically-increasing `tMs` values (defensively excluded today
only because negative gaps fail the `> MIN_GAP_MS` filter, but this is untested), or (c) a
gap sample computed immediately after a delete-then-reinsert correction (the "gap from a delete
record's tMs to the next insert's tMs" path is exercised for accuracy in case 2, but never checked
against `latencySamplesByChar`).
**Fix:** Add golden cases for each, e.g. a case with `target: '\u{1F600}x'` asserting `accuracy`
would currently be miscomputed (a case that should currently fail, documenting CR-01 until fixed).

### IN-02: A character's first occurrence after a different character absorbs a "transition" latency sample that may reflect the previous character's typing pause rather than its own

**File:** `src/metrics/metrics.ts:87-95`
**Issue:** `prevTMs` is updated after every record regardless of the committed character, so the
very first sample recorded for a newly-appearing character is the gap from the *previous, different*
character's commit (or a delete) to this one — e.g. a thinking pause before typing a symbol gets
attributed to that symbol's latency stats, not to whatever was typed immediately before the pause.
This matches the documented D-03 formula ("gap... of any type") and is intentionally tested this
way (case 9), so it is not a deviation from spec, but it does mean the "slowest keys" feature can
report a character as slow due to an unrelated pause before it rather than the character's own
dwell/travel latency. Worth a product note if per-key latency ever needs to be defensible as
"this specific key is physically slow to reach," since today's numbers can be inflated by
whatever preceded them.
**Fix:** No code change required against the current spec; consider documenting this
characteristic in-product (e.g., a tooltip) if user feedback suggests the numbers feel misleading.

---

_Reviewed: 2026-09-05T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
