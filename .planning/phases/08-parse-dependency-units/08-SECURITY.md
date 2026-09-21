---
phase: 08
slug: parse-dependency-units
status: verified
threats_open: 0
asvs_level: 1
created: 2026-09-21
---

# Phase 08 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time. ASVS L1 grep-depth; block_on: high.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| GitHub REST → client | Constructed `/repos/.../git/blobs/{sha}` only | Public blob bytes, size, path |
| Blob bytes → Exercise | Same UTF-8 / 100 KB pipeline as upload | `Exercise.text`, `sourceType: github`, `sourceRef` |
| Tree click → App `onPlanned` | Untrusted blob becomes in-memory `FilePlan`; must not start the trainer | `FilePlan` / status copy |
| Import busy → submit button | Click generation must not disable Import | `setBusy` |
| CSP / COEP | Browser compile of same-origin wasm | `web-tree-sitter.wasm`, grammar wasm |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-08-01 | Denial of service | `fetchGithubBlob` / pre-GET size | high | mitigate | `size` then `byteLength` vs `MAX_BYTES` 100000; throw before `atob`; `node.size` skips GET | closed |
| T-08-02 | Tampering | `fromGithubBlob` | medium | mitigate | BOM + `TextDecoder` + U+FFFD → `NonUtf8Error`; same order as `fromFile` | closed |
| T-08-03 | Tampering | RepoBrowser / plan strings | high | mitigate | React text children only; no `innerHTML` in `src/` | closed |
| T-08-04 | Elevation of privilege | CSP / wasm instantiate | high | mitigate | `script-src 'self' 'wasm-unsafe-eval'`; no general `eval`; `locateFile` → `/${scriptName}` | closed |
| T-08-05 | Tampering | `public/*.wasm` / COEP | high | mitigate | Same-origin wasm under `public/`; `vite.config.ts` still `require-corp`; no CDN | closed |
| T-08-06 | Denial of service | blob cache / click storm | medium | mitigate | sha cache + inflight; last-wins `clickGenRef`; no Import prefetch | closed |
| T-08-07 | Information disclosure | `githubGet` | high | mitigate | Only constructed `/repos/...` URLs + `enc()`; never `fetch(userString)`; no `Authorization` | closed |
| T-08-08 | Denial of service | `onFileClick` → App / `planUnits` | high | mitigate | `onPlanned={setFilePlan}` only; `handleLoad` stays on `CorpusInput`; 100 KB cap | closed |
| T-08-09 | Tampering | `Parser.init` `locateFile` | high | mitigate | Runtime wasm from `public/` under the basename `locateFile` receives | closed |
| T-08-10 | Information disclosure | HistoryView `sourceRef` | low | accept | Path in local IndexedDB only; no new sync | closed |
| T-08-05-01 | Tampering | `onFileClick` → `onPlanned` | high | mitigate | `++clickGenRef` before every `setStatus` including blocked/commit; skip stale `onPlanned` | closed |
| T-08-05-02 | Tampering | `onImport` vs in-flight click | medium | mitigate | `onImport` increments `clickGenRef` at start | closed |
| T-08-05-03 | Denial of service | `onImport` `setBusy` | medium | mitigate | `setBusy(false)` gated on `importGenRef` only | closed |
| T-08-SC | Tampering | npm installs | high | mitigate | 08-01 human-verified pins; later plans installed nothing | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `high` count toward `threats_open`*
*Disposition: mitigate · accept · transfer*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-08-10 | T-08-10 | `sourceRef` path lives in local IndexedDB; README already local-only; no new network sync | plan 08-02 | 2026-09-21 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-21 | 14 | 14 | 0 | gsd-secure-phase (ASVS L1, skip auditor — threats_open 0) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-21
