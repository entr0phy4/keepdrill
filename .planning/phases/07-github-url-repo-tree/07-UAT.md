---
status: complete
phase: 07-github-url-repo-tree
source: [07-VERIFICATION.md]
started: 2026-09-20T22:35:00Z
updated: 2026-09-20T22:43:00Z
---

## Current Test

[testing complete]

## Tests

### 1. REPO-01 unclassified URL/listing edge not covered by D-09/D-10/D-11
expected: No extra taxonomy appears; unexpected shapes either parse+list like the happy path or fail as InvalidGithubUrlError before network
result: pass

### 2. Live Chromium import of a small public owner/repo
expected: Caption owner/repo@default_branch; top-level folders open; nested closed; expand/collapse works; non-TS/JS shows blocked sentence; TS/JS shows not-yet; trainer still says No exercise loaded
result: pass

### 3. Gist or GitLab URL Import with Network tab
expected: Alert 'Paste a GitHub URL or owner/repo.'; no api.github.com request
result: pass

### 4. History → Analytics → Trainer after a successful import
expected: URL field and tree are not visible on History/Analytics; returning to Trainer keeps GitHub tree and Paste text
result: pass

### 5. Preview COOP/COEP and crossOriginIsolated
expected: Cross-Origin-Opener-Policy: same-origin; Cross-Origin-Embedder-Policy: require-corp; crossOriginIsolated === true. If GitHub listing is blocked, COEP credentialless only — never drop isolation
result: pass

### 6. Flagged must-NOTs in the running app
expected: No typing session from Import or tree click; one 404 string for private and missing; blocked ≠ not-yet; no Phase 8/parser/WASM jargon; no GitHub JSON/IP/stack as copy; no localStorage of last URL or tab
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
