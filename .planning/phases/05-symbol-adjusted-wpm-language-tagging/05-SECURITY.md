---
phase: 05
slug: symbol-adjusted-wpm-language-tagging
status: verified
threats_open: 0
asvs_level: 1
created: 2026-09-13
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| `target` exercise text → `symbol-density.ts` | Already-in-memory, already-typed-by-the-user text; no new external input crosses here | Exercise `target` string |
| `symbol-density.ts` → `metrics.ts` → `ResultsView`/`HistoryRow` | Pure numeric transform rendered as a React text node, never HTML | `symbolAdjustedWpm` number |
| pre-existing `StoredSession` rows (schemaVersion 1) → `resolveMetrics` | Previously-persisted local data re-enters the computation path unchanged in shape | Stale `metricsSnapshot` + raw session log |
| `<select>` user interaction → `Exercise.language` | The only new user-influenced input surface this phase adds | Closed enum value or `'plaintext'` |
| `Exercise.language` → `HistoryRow` language chip | Tagged value re-enters the render path later, unmodified | `Exercise.language` string |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-01 | Tampering | `classifySymbolDensity`/`computeSymbolAdjustedWpm` producing an out-of-bound or NaN value | low | mitigate | `classifySymbolDensity` guards `codepoints.length === 0 → 0`; both functions are total over their typed domains; paste/upload reject empty input upstream | closed |
| T-05-02 | Repudiation / Info Disclosure | `symbolAdjustedWpm` rendered via `{value}` JSX interpolation | low | accept | React default text-node escaping; no `dangerouslySetInnerHTML`; value is always a computed number | closed (accepted) |
| T-05-03 | Denial of Service (self-inflicted) | `classifySymbolDensity` iterating a pathologically large `target` | low | accept | `target` already bounded by Phase 1 `MAX_BYTES`; same `Array.from(target)` cost already paid in `replayAttempts` | closed (accepted) |
| T-05-04 | Tampering | Malformed pre-existing `StoredSession` lacking a valid `metricsSnapshot.schemaVersion` | low | mitigate | `resolveMetrics` `=== METRICS_SCHEMA_VERSION` cache-hit; any other value including `undefined`/malformed falls through to recompute | closed |
| T-05-05 | Tampering | `Exercise.language` used later without sanitization | low | mitigate | Native `<select>` only offers `PASTE_LANGUAGE_OPTIONS` or `'plaintext'`; no free-text field; `CorpusInput` is the only `fromPaste` call site | closed |
| T-05-06 | Tampering | A future `fromPaste` call site silently defaulting to `'plaintext'` | low | mitigate | `language` is a required parameter with no default — a missed call site is a `tsc` error | closed |
| T-05-07 | Info Disclosure | `Exercise.language`/select option text rendered via JSX | low | accept | Plain text nodes (React default escaping); values are fixed enum strings, never user-typed | closed (accepted) |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (high) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-05-01 | T-05-02, T-05-07 | JSX text interpolation of a computed number / closed-enum language label; React escaping is the existing app-wide control, no new HTML sink | Project (05-01/05-02 PLAN threat register) | 2026-09-13 |
| R-05-02 | T-05-03 | Large-target iteration cost is already paid by `replayAttempts`; Phase 1 `MAX_BYTES` remains the size cap | Project (05-01 PLAN threat register) | 2026-09-13 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-13 | 7 | 7 | 0 | Orchestrator (register authored at plan-time in 05-01/05-02-PLAN.md; threats_open:0, ASVS L1 — short-circuit per secure-phase workflow, no deeper auditor pass required) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-13
