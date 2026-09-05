---
phase: 02
slug: interactive-typing-trainer
status: verified
threats_open: 0
asvs_level: 1
created: 2026-09-05
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Corpus text (Phase 1, potentially adversarial pasted/uploaded content) -> rendered per-character span layer | Every character of `exercise.text`, including any HTML-looking substrings, is rendered by `CaptureSurface.tsx`'s overlay | Untrusted text -> DOM (React text children only) |
| Native `<textarea>` selection/caret <-> logical `cursor` (`trainer/state.ts`) | Arrow-key/click-driven native selection changes must never let a keystroke land at an unexpected logical position | Browser selection state -> reducer cursor index |
| Script-dispatched synthetic keyboard events -> `handleKeyDown`'s Escape/Restart path | A non-trusted `keydown` must never be able to discard an in-progress session via the Restart callback | Untrusted DOM events -> session-reset action |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Tampering / Elevation of Privilege (XSS) | `src/ui/CaptureSurface.tsx` per-character span rendering | high | mitigate | Every character/glyph renders exclusively as a React text child; no `dangerouslySetInnerHTML`/`innerHTML` anywhere in `src/ui` or `src/trainer` | closed |
| T-02-02 | Information Disclosure | `src/trainer/state.ts`, `src/ui/CaptureSurface.tsx` | low | accept | No network egress introduced — pure in-memory computation only | closed |
| T-02-03 | Denial of Service (resource exhaustion) | `src/ui/CaptureSurface.tsx` per-character span rendering | low | accept | Up to ~100KB corpus rendered as one span per character; accepted for v1 per 02-RESEARCH.md risk assessment | closed |
| T-02-04 | Tampering (native selection drift desyncing logical cursor from visible caret) | `src/ui/CaptureSurface.tsx` caret-resync effect | medium | mitigate | Original `useLayoutEffect([cursor])`-only mitigation was incomplete (02-VERIFICATION.md gap #1 / 02-REVIEW.md WR-1) — **completed by T-02-08** | closed (via T-02-08) |
| T-02-05 | Tampering (focus loss silently breaking capture via Tab) | `src/ui/CaptureSurface.tsx` Tab keydown handler | medium | mitigate | `e.preventDefault()` on Tab, no character insertion, no cursor movement, no new `capture.ts` export — no synthetic-record path exists | closed |
| T-02-06 | Repudiation (Restart silently discarding an in-progress session) | `src/ui/App.tsx` `handleRestart` | low | accept | No confirmation dialog is an explicit UI-SPEC decision — nothing persisted in v1, only an unsaved attempt is discarded | closed |
| T-02-07 | Information Disclosure (focus/visibility timing patterns) | `src/trainer/active-time.ts` | low | accept | Pure in-memory computation, no egress, not displayed to any external party or the user in this phase | closed |
| T-02-08 | Tampering (native selection drift — completes T-02-04) | `src/ui/CaptureSurface.tsx` `onSelect` handler | medium | mitigate | `onSelect={resyncCaret}` on the textarea corrects `selectionStart`/`selectionEnd` back to `cursor` synchronously on every native `select` event, independent of React's render cycle | closed |
| T-02-09 | Tampering / Repudiation (synthetic Escape discarding an in-progress session) | `src/ui/CaptureSurface.tsx` `handleKeyDown` | medium | mitigate | `handleKeyDown` rejects any keydown where `e.isTrusted` is `false` before evaluating Escape/Tab, matching `src/capture/capture.ts`'s T-01-04 convention | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-02-01 | T-02-02 | No network egress in this phase; nothing to disclose | Planner (02-01) | 2026-09-04 |
| R-02-02 | T-02-03 | ~100KB worst-case DOM node count accepted for v1; span-batching is documented future mitigation if measured | Planner (02-01) | 2026-09-04 |
| R-02-03 | T-02-06 | No persistence in v1 (PERS-01/02 deferred to v2) — Restart only discards an unsaved in-progress attempt | Planner (02-02) | 2026-09-04 |
| R-02-04 | T-02-07 | Pure in-memory timing computation, not displayed or transmitted in this phase | Planner (02-02) | 2026-09-04 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-05 | 9 | 9 | 0 | Orchestrator (plan-time register + independent code-review/verifier evidence; ASVS L1 short-circuit — all threats CLOSED with evidence, no auditor spawn required) |

**Evidence basis (independent of PLAN.md's own claims):**
- T-02-01: `02-REVIEW.md` confirms zero `dangerouslySetInnerHTML`/`.innerHTML` matches in `src/ui`/`src/trainer`.
- T-02-04/T-02-08: `02-VERIFICATION.md` re-verification independently reverted the `onSelect` fix to `ca6f44e` and confirmed 3 regression tests fail without it — proving the mitigation is real, not just claimed.
- T-02-09: Same re-verification pass confirmed the untrusted-Escape regression test and the `isTrusted` guard's presence via `grep`.
- T-02-05: `02-REVIEW.md` and executor SUMMARYs confirm `grep -n "recordSyntheticChar"` returns no matches across `src/capture/capture.ts` and `src/ui/CaptureSurface.tsx`.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-05
