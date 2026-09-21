---
status: testing
phase: 09-scaffolded-trainer
source: [09-VERIFICATION.md]
started: 2026-09-21T02:35:00Z
updated: 2026-09-21T02:35:00Z
---

## Current Test

number: 1
name: Live GitHub click-to-type
expected: |
  Typing starts on unit 0 immediately; full file visible; future units dimmed; landmark N / M.
awaiting: user response

## Tests

### 1. Live GitHub click-to-type
expected: Typing starts on unit 0 immediately; full file visible; future units dimmed; landmark N / M.
result: [pending]

### 2. Advance then Escape
expected: Instant advance with no Next button; Escape restarts only that unit (landmark stays, prior snapshots kept).
result: [pending]

### 3. Last unit → History
expected: ResultsView appears, Restart is gone, History shows one row with owner/repo:path and not Pasted snippet.
result: [pending]

### 4. Paste exit
expected: After a scaffold is in progress, Paste tab → Load exercise: FileScaffold gone, whole-file trainer, Restart exercise.
result: [pending]

### 5. Glyph columns
expected: Static done/future/gap · and ↵ visually line up with the overlay (same inset as .trainer-stack).
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
