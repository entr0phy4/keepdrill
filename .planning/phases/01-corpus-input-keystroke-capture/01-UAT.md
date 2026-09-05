---
status: testing
phase: 01-corpus-input-keystroke-capture
source: [01-VERIFICATION.md]
started: 2026-09-05T01:33:24Z
updated: 2026-09-05T01:33:24Z
---

## Current Test

number: 1
name: End-to-end paste flow + live session reflection (CR-01 regression)
expected: |
  Preview shows the normalized pasted text; capture textarea has focus without an extra
  click; `window.__keebdrillSession.events`/`.charLog` are non-empty and grow as you keep
  typing (not stuck at `[]`).
awaiting: user response

## Tests

### 1. End-to-end paste flow + live session reflection (CR-01 regression)
expected: |
  `pnpm dev`, paste a short code snippet, click "Load exercise", confirm the preview
  renders inertly and the capture textarea is focused. Type ~10 keystrokes, wait a second,
  then check `window.__keebdrillSession.events.length` and `.charLog.length` in devtools.
  Preview shows the normalized pasted text; capture textarea has focus without an extra
  click; `window.__keebdrillSession.events`/`.charLog` are non-empty and grow as you keep
  typing (not stuck at `[]`).
result: [pending]

### 2. Second-exercise reload does not leak stale state (CR-02 regression)
expected: |
  Load exercise A, type a few characters into the capture textarea, then load exercise B
  (different paste or a file) without refreshing the page. The capture textarea is empty
  and refocused for exercise B — no leftover text from A is visible, and typing in B does
  not misfire a spurious deletion record.
result: [pending]

### 3. Upload states and inline copy
expected: |
  Upload a `.ts` file (should load as `language: 'typescript'`); upload a file over 100 KB;
  upload a UTF-16-encoded file; press "Load exercise" with both paste box and file input
  empty. `.ts` file loads normally with the "Loaded from {filename}" caption; oversize file
  shows "This file is over 100 KB..." inline beneath the file control with no reflow;
  UTF-16 file shows "This file isn't UTF-8 text..."; empty press shows "Nothing to load
  yet..." beneath the (still-enabled) button.
result: [pending]

### 4. Chrome banners and timer-resolution readout
expected: |
  Under normal `pnpm dev` (cross-origin isolated), confirm no warning banner shows and
  "Timer resolution: N µs" reads a small figure (~5 µs). Force a non-isolated response
  (e.g. temporarily comment out the COOP/COEP headers in `vite.config.ts`) and reload —
  confirm the "Heads up" warning banner appears above the "US ANSI" notice with no layout
  shift of the controls below. Type several dozen keystrokes and confirm the readout
  eventually reflects a measured value rather than staying at the static per-browser
  expectation.
result: [pending]

### 5. Paste-blocked flag in the typing surface
expected: |
  Click into the "Type here" capture textarea and paste (Ctrl+V) some text. Separately,
  paste into the "Paste code or text" corpus box. Pasting into the typing surface is
  blocked, shows the inline "Pasting into the typing area is disabled - type the exercise
  to record real keystrokes." message, and the message fades out after ~4 seconds. Pasting
  into the corpus paste box works normally and is unaffected.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
