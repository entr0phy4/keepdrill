---
status: complete
phase: 04-session-persistence-history
source: [04-VERIFICATION.md]
started: 2026-09-08T23:20:00Z
updated: 2026-09-12T19:11:00Z
---

## Current Test

[testing complete]

## Tests

### 1. History list visual check in Chromium (04-02 Task 2)
expected: |
  Run `pnpm dev`, complete two short exercises, open History.
  Rows render as bordered secondary-surface cards, newest-first, each showing relative date +
  WPM + accuracy + source label + language chip + "N chars" + slowest-key chip. The active
  toggle button is surface-filled and bold (NOT green/accent). No WPM or accuracy value is
  colored green or red. The empty state reads "No sessions yet — finish a typing exercise and
  it'll show up here." under an always-present "History" heading.
result: pass

### 2. D-08 caret/IME preservation in Chromium (04-02 Task 3)
expected: |
  Type ~10 characters including one correction (wrong char -> backspace -> right char), click
  "History", click "Trainer", and (if a CJK/pinyin IME is available) test an in-progress IME
  composition across the switch. Caret sits at the exact same character position; per-character
  correct/incorrect coloring is identical; clicking the trainer surface reclaims focus; an IME
  composition begun before the switch resolves correctly after returning. If any of these fail,
  the documented fallback (lift the capture buffer into a React ref that survives a
  CaptureSurface remount, let the trainer unmount) must be applied and re-verified.
result: pass

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
