---
phase: 06
slug: cross-session-analytics
status: verified
threats_open: 0
asvs_level: 1
created: 2026-09-20
---

# Phase 06 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| `metrics.ts` → `latency-stats.ts` | In-memory numeric samples only; no new external input | `tMs` gap arrays |
| StoredSession (IndexedDB origin) → `resolveMetrics` / analytics folds | Previously persisted local rows re-enter a pure numeric/string fold | `charLog`, `events`, `exercise.language`, `metricsSnapshot` |
| DigraphEntry.pair / HeatmapCell.label / LanguageProfileRow.language → JSX | Untrusted persisted strings re-enter the Analytics dashboard as React text | Digraph pairs, key labels, language tags |
| Header nav click → view union | Trusted UI chrome; no URL / router surface | `'trainer' \| 'history' \| 'analytics'` |
| CaptureSurface hot path | Must remain free of analytics imports (D-15) | none |
| npm/pip/cargo | Not applicable — zero new packages this phase | empty install surface |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-06-01 | Tampering | `gatedMedian` / `median` producing NaN from empty or non-numeric samples | low | mitigate | `median([])` returns 0; `gatedMedian` returns null below the post-filter gate; inputs are app-recorded `tMs` deltas | closed |
| T-06-02 | Tampering | `resolveMetrics` throwing on a malformed `metricsSnapshot.schemaVersion` | low | mitigate | `=== METRICS_SCHEMA_VERSION` cache-hit; any other value including `undefined` falls through to recompute | closed |
| T-06-03 | Info Disclosure | `resolveMetrics` reading `exercise.text` to recompute | low | accept | Same local-only IndexedDB model as History; this phase does not render or export the text | closed (accepted) |
| T-06-04 | Tampering | `computeDigraphLatency` pair strings derived from `charLog.data` | low | mitigate | Pair is two codepoints concatenated; no HTML assembly; 06-03 renders as React text (ASVS V5) | closed |
| T-06-05 | Denial of Service (self) | O(sessions × keystrokes) full-history re-fold | low | accept | Acceptable at single-user scale; incremental cache is deferred | closed (accepted) |
| T-06-06 | Tampering | `computeLanguageProfile` grouping on `exercise.language` | low | mitigate | Language is the stored string as-is; no `eval`; `plaintext` is a distinct key not merged | closed |
| T-06-07 | Tampering | Digraph pair / language tag / key label in JSX | medium | mitigate | React text children only (chip text, table cells, `aria-label` templates). No `innerHTML` / `dangerouslySetInnerHTML`. `glyphFor` is a closed two-entry map. ASVS V5 | closed |
| T-06-08 | Info Disclosure | Analytics page showing pasted corpus-derived digraphs | low | accept | Same local-only IndexedDB model as History; no export, sync, or network | closed (accepted) |
| T-06-09 | Elevation of Privilege / UI redress | Heatmap keys mistaken for buttons | low | mitigate | Keys are inert `div`s, no `tabindex`; figure `role=group`; tables have no row click (D-10) | closed |
| T-06-10 | Denial of Service (self) | Full-history re-fold on dashboard mount | low | accept | CONTEXT carried-forward; live updates replace table contents in place | closed (accepted) |
| T-06-SC | Tampering | npm/pip/cargo installs | low | accept | No new packages; no Recharts / heatmap.js / react-simple-keyboard / d3-scale. CaptureSurface has no analytics import | closed (accepted) |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (high) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-06-01 | T-06-03, T-06-08 | Analytics reads and displays values derived from locally persisted sessions; no export, sync, or network surface is added | Project (06-01/06-03 PLAN threat register) | 2026-09-20 |
| R-06-02 | T-06-05, T-06-10 | Full-history re-fold is acceptable at single-user scale; incremental cache is deferred | Project (06-02/06-03 PLAN threat register) | 2026-09-20 |
| R-06-03 | T-06-SC | Zero new runtime packages this phase; CaptureSurface stays free of analytics imports | Project (06-01/06-02/06-03 PLAN threat register) | 2026-09-20 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-20 | 11 | 11 | 0 | Orchestrator (register authored at plan-time in 06-01/06-02/06-03-PLAN.md; threats_open:0, ASVS L1 — short-circuit per secure-phase workflow, no deeper auditor pass required) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-20
