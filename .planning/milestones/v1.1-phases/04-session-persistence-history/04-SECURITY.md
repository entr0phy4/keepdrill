---
phase: 04
slug: session-persistence-history
status: verified
threats_open: 0
asvs_level: 1
created: 2026-09-12
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| completion handler → `persistence/` seam | `App.tsx::handleComplete` passes the app's own `buildSession()` output into `saveSession`; no external/user-supplied JSON crosses here | Raw `Session` (keystroke log, char log, markers) + `MetricsResult` |
| IndexedDB origin store → `HistoryView`/`HistoryRow` render | previously-stored session data (incl. `exercise.text`/`.language`/`.sourceRef`) re-enters the render path on a later app load or live-query tick | Stored `StoredSession` rows |
| `resolveMetrics` recompute path (dormant until Phase 5) | a stored raw log fed back into the pure `computeSessionMetrics` fold on a future `schemaVersion` mismatch | Raw keystroke log → recomputed metrics |
| npm registry → local build | three new third-party packages (`dexie`, `dexie-react-hooks`, `fake-indexeddb`) enter the build | Package code (supply chain) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Tampering / Elevation (stored XSS) | `HistoryRow` rendering `exercise.text`/`.language`/`.sourceRef` | low | mitigate | Rendered only as React text nodes (auto-escaped); no `dangerouslySetInnerHTML`, no HTML parsing of any stored field anywhere in the phase | closed |
| T-04-02 | Info Disclosure | fire-and-forget write `.catch` on quota/private-mode `DOMException`; `resolveMetrics` recompute edge | low | mitigate | `.catch` logs `console.warn` only, UI shows one generic D-17 message (no raw `DOMException`/stack/quota figure); `computeWpm` guards `elapsedMs <= 0 -> 0`, rounding is display-layer only | closed |
| T-04-03 | Denial of Service (self-inflicted, single user) | unbounded IndexedDB growth (D-18 keep-forever) | low | accept | Documented acceptable at single-user daily-use scale (~tens of MB/year); prune/cap policy deliberately deferred (D-18) | closed (accepted) |
| T-04-04 | Tampering | malformed/hand-edited/partial stored record breaking history render | low | mitigate | Explicit `StoredSession` interface; `slowest5[0]` read under `noUncheckedIndexedAccess` guard; empty `slowest5` is a valid row shape (chip omitted), never a render error | closed |
| T-04-05 | Info Disclosure | proprietary code persisted verbatim & unencrypted in IndexedDB | low | accept | Matches existing v1.0 in-memory behaviour and CLAUDE.md local-only model; no new export/sync path added | closed (accepted) |
| T-04-06 | Denial of Service (self-inflicted) | non-virtualized `<ol>` growing unbounded (D-18) | low | accept | Plain list scrolling in normal page flow acceptable at single-user daily-use scale; virtualization/pagination deliberately not added | closed (accepted) |
| T-04-SC | Tampering | `dexie`/`dexie-react-hooks`/`fake-indexeddb` install (supply chain) | medium | mitigate | Package Legitimacy Audit (RESEARCH): `dexie` SUS = patch-recency only (Approved); exact versions pinned (`dexie@4.4.4` clears the "too-new" flag); no `postinstall` in any of the three; `pnpm` install with committed lockfile | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (high) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-04-01 | T-04-03, T-04-06 | Unbounded IndexedDB/list growth (D-18 keep-forever) is deliberate product scope for v1.1 at single-user daily-use scale; a retention cap was explicitly prohibited by the phase plans | Project (04-CONTEXT.md D-18) | 2026-09-12 |
| R-04-02 | T-04-05 | Local-only, unencrypted IndexedDB storage matches the existing v1.0 no-backend/no-sync privacy model; no new export path introduced | Project (CLAUDE.md privacy constraint) | 2026-09-12 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-12 | 7 | 7 | 0 | Orchestrator (register authored at plan-time in 04-01/04-02-PLAN.md; threats_open:0, ASVS L1 — short-circuit per secure-phase workflow, no deeper auditor pass required) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-12
