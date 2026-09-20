---
status: complete
phase: 06-cross-session-analytics
source: [06-VERIFICATION.md]
started: 2026-09-20T18:40:00Z
updated: 2026-09-20T18:46:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Chromium light + dark — empty Analytics, then populated after several mixed-language sessions
expected: Empty DB shows page empty copy and no keyboard diagram. After sessions, stacked Slowest digraphs → Keyboard heatmap → Language profile; top-10 table omits thin pairs; sequential amber heatmap with on-key ms (not green/red score colors); language rows include plaintext; no shaming/guilt copy.
result: pass

### 2. Mid-exercise switch to Analytics and back in Chromium
expected: Typed text, per-character status, caret, and IME composition survive the display:none toggle. CorpusInput stays visible on Analytics.
result: pass

### 3. At 320px viewport the keyboard diagram never expands #root horizontally
expected: Overflow is confined to .keyboard-heatmap (overflow-x: auto); the US-ANSI silhouette remains intact after a horizontal scroll.
result: pass

### 4. An unexpectedly long exercise.language string in the language table
expected: The tag wraps or breaks inside its table cell and never causes a page-level horizontal scrollbar.
result: pass

### 5. Every drawn key's label (≤5 chars) plus optional 1–4 digit ms number
expected: Stay inside the 32×48 key box without overflowing into a neighbor.
result: pass

### 6. Subsequent useLiveQuery live updates after the first populated resolve
expected: Do not flash Loading analytics… or unmount sections; only table/heatmap contents update in place.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
