---
phase: 03
slug: session-metrics
status: verified
threats_open: 0
asvs_level: 1
created: 2026-09-05
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Note: plans 03-01 and 03-02 both independently used the ID "T-03-01" — renumbered here as
> T-03-01 (03-01) and T-03-05 (03-02, was T-03-01) to keep phase-level IDs unique.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Pasted/uploaded corpus text -> DOM (stat values + slowest-key chip) | Exercise content (Phase 1) is untrusted; ResultsView renders characters derived from it | Untrusted text -> DOM (React text children only) |
| Completion signal -> metrics computation | `completedAt` is derived purely from `computeTrainerState`'s fold, never a raw forgeable event | Internal state -> pure computation |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Tampering / Info Disclosure (XSS) | `src/ui/ResultsView.tsx` (stat values) | high | mitigate | Every corpus-derived value renders as a plain JSX text child; no `dangerouslySetInnerHTML`/`.innerHTML` | closed |
| T-03-02 | Denial of Service | `src/metrics/metrics.ts` `computeWpm` | low | mitigate | `elapsedMs <= 0` guarded to return `0`, never `Infinity`/`NaN` | closed |
| T-03-03 | Tampering | `src/ui/CaptureSurface.tsx` `onComplete` bridge | low | accept | `completedAt` derived purely from internal state fold, never a raw DOM event | closed |
| T-03-05 | Tampering / Info Disclosure (XSS) | `src/ui/ResultsView.tsx` (slowest-key chip) | high | mitigate | Same plain-JSX-text convention as T-03-01, extended to the chip character | closed |
| T-03-06 | Denial of Service | `src/metrics/metrics.ts` `median`/`slowestFive` | low | mitigate | `median` guards empty/undefined reads (returns `0`); `slowestFive` never calls it below `MIN_SAMPLES` | closed |

*Severity: critical > high > medium > low — only open threats at or above `security_block_on` (high) count toward `threats_open`.*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party).*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-03-01 | T-03-03 | `completedAt` is a pure internal derivation, not an external input a caller could forge | Planner (03-01) | 2026-09-05 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-05 | 5 | 5 | 0 | Orchestrator (plan-time register + independent code-review/verifier evidence; ASVS L1 short-circuit) |

**Evidence basis:** T-03-01/T-03-05 (XSS) confirmed by `03-REVIEW.md`'s explicit grep for `dangerouslySetInnerHTML`/`.innerHTML` (none found) across all 7 reviewed files. T-03-02/T-03-06 (DoS guards) independently confirmed by `03-VERIFICATION.md`'s live test run (132/132 passing) exercising the zero-elapsed and zero-sample guard paths.

**Also resolved this session (not a threat-model item, but security-adjacent):** CR-01, a correctness bug (UTF-16-code-unit vs. Unicode-code-point indexing) found by code review, was fixed in commit `a44174c` and independently re-verified by the phase verifier (hand-executed the pre-fix algorithm to confirm the regression tests would have failed without the fix).

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-05
