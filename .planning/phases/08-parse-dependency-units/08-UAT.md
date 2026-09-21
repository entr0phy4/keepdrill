---
status: testing
phase: 08-parse-dependency-units
source: [08-VERIFICATION.md]
started: 2026-09-21T00:51:51Z
updated: 2026-09-21T00:51:51Z
---

## Current Test

number: 1
name: FILE-01 unclassified specless edge — wasm compile under CSP (backstop / insufficient_spec)
expected: |
  Parser.init instantiates same-origin public/web-tree-sitter.wasm under script-src 'self' 'wasm-unsafe-eval' without a general eval keyword; a .ts click plans units instead of a permanent Loading… or CSP console error
awaiting: user response

## Tests

### 1. FILE-01 unclassified specless edge — wasm compile under CSP (backstop / insufficient_spec)
expected: Parser.init instantiates same-origin public/web-tree-sitter.wasm under script-src 'self' 'wasm-unsafe-eval' without a general eval keyword; a .ts click plans units instead of a permanent Loading… or CSP console error
result: [pending]

### 2. FILE-02 unclassified specless edge — sourceRef shapes beyond owner/repo:path (backstop / insufficient_spec)
expected: No extra sourceRef taxonomy; History still prefers sourceRef for upload and github and never labels github rows Pasted snippet
result: [pending]

### 3. pnpm dev in Chromium — import a small public repo, click a real .ts file, then a .tsx/.js/.jsx file
expected: Status Loading {path}… then Planned N unit(s) from {path}. CaptureSurface stays unmounted. Empty-state still says paste/upload Load exercise. Fallback copy is used only when split fails, and it is not the blocked-file sentence
result: [pending]

### 4. Review flagged must-NOTs in the running app (unverified-prohibition — human review recommended)
expected: No whole-file typing session from a tree click; no general script-src eval; COEP require-corp holds; no CDN wasm; no second fetch module; no Authorization/raw.githubusercontent.com; sourceRef has no blob sha; Dexie still version(1); github rows are not Pasted snippet; COPY has no WASM/tree-sitter/Phase 9 jargon; no innerHTML of blob text; no prefetch on Import; a blocked/commit click is not later overwritten by an in-flight loadable; Import is not left disabled because a file click stole busy generation
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
