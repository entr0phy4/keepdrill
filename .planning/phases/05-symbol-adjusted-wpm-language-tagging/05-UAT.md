---
status: complete
phase: 05-symbol-adjusted-wpm-language-tagging
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md]
started: 2026-09-13T19:30:00Z
updated: 2026-09-13T19:33:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Pure classifySymbolDensity/computeSymbolAdjustedWpm module with D-01 buckets, Array.from Unicode safety, empty-target guard, and D-05 linear formula
expected: Pure classifySymbolDensity/computeSymbolAdjustedWpm module with D-01 buckets, Array.from Unicode safety, empty-target guard, and D-05 linear formula
result: pass
source: automated
coverage_id: D1

### 2. computeSessionMetrics returns symbolAdjustedWpm; METRICS_SCHEMA_VERSION is 2 so pre-existing history rows recompute on read
expected: computeSessionMetrics returns symbolAdjustedWpm; METRICS_SCHEMA_VERSION is 2 so pre-existing history rows recompute on read
result: pass
source: automated
coverage_id: D2

### 3. D-07: a backspace-corrected symbol charLog does not inflate symbolAdjustedWpm/wpm versus a clean run of the identical target
expected: D-07: a backspace-corrected symbol charLog does not inflate symbolAdjustedWpm/wpm versus a clean run of the identical target
result: pass
source: automated
coverage_id: D3

### 4. ResultsView adj. wpm third stat
expected: ResultsView shows a third always-visible 'adj. wpm' stat peer-sized to wpm/accuracy; desktop grid is 1fr 1fr 1fr
result: pass
coverage_id: D4

### 5. Every HistoryRow shows both WPM values inline as '{wpm} / {adj} adj.' with no standalone wpm label
expected: Every HistoryRow shows both WPM values inline as '{wpm} / {adj} adj.' with no standalone wpm label
result: pass
source: automated
coverage_id: D5

### 6. PASTE_LANGUAGE_OPTIONS is the single canonical, alphabetized, deduplicated EXT_TO_LANG value set and does not include plaintext; EXT_TO_LANG itself stays private
expected: PASTE_LANGUAGE_OPTIONS is the single canonical, alphabetized, deduplicated EXT_TO_LANG value set and does not include plaintext; EXT_TO_LANG itself stays private
result: pass
source: automated
coverage_id: D1

### 7. fromPaste(raw, language, tabWidth?) requires language with no default and copies it onto Exercise.language; upload.test.ts CRLF/tab parity still passes
expected: fromPaste(raw, language, tabWidth?) requires language with no default and copies it onto Exercise.language; upload.test.ts CRLF/tab parity still passes
result: pass
source: automated
coverage_id: D2

### 8. Paste path shows a Language select defaulting to plaintext, listing PASTE_LANGUAGE_OPTIONS, never blocking Load exercise, and threading the chosen value into fromPaste
expected: Paste path shows a Language <select> defaulting to plaintext, listing PASTE_LANGUAGE_OPTIONS, never blocking Load exercise, and threading the chosen value into fromPaste
result: pass
source: automated
coverage_id: D3

### 9. Upload path is unaffected — fromFile/extToLang still tags by extension even if the paste select is set to another language
expected: Upload path is unaffected — fromFile/extToLang still tags by extension even if the paste select is set to another language
result: pass
source: automated
coverage_id: D4

### 10. Language select does not overflow at 360px
expected: At ≤360px the Language select does not cause horizontal page overflow next to its label (UI-SPEC E3 backstop)
result: pass
coverage_id: D5

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
