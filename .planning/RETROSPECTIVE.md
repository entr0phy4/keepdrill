# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-09-05
**Phases:** 3 | **Plans:** 8 | **Sessions:** 2 (spanning 2026-09-03 → 2026-09-05, ~2 days)

### What Was Built
- Phase 1: Corpus input (paste + file upload) through a pure zero-dependency normalizer, plus a high-resolution keystroke/committed-character capture engine (`event.timeStamp`-based, IME-aware, cross-origin-isolated for max timer resolution).
- Phase 2: Interactive typing trainer — live per-character correctness coloring, custom caret, whitespace glyphs, free-correction policy, backspace-to-correct, Restart control (with an Escape-key keyboard path), and honest active-time tracking that excludes blurred/hidden periods.
- Phase 3: Pure, re-runnable metrics engine (net WPM, accuracy, five-slowest-keystrokes via median/outlier-filtered aggregation) with an auto-revealed results panel.

### What Worked
- **Tracer-first planning** (one thin end-to-end slice before expansion tasks) caught real integration issues early in both Phase 2 and Phase 3 rather than at the end.
- **Independent re-verification, not trust-the-summary**: the phase verifier repeatedly caught real gaps the executor's own self-check missed (Phase 2's caret-resync bug) and proved fixes were genuine by reverting them and confirming tests then failed — this pattern should continue.
- **`--auto` mode with autonomous discuss-phase decisions** worked well for a solo-developer project with no ambiguous product vision to negotiate — CONTEXT.md's locked decisions, cross-checked against RESEARCH.md, gave the planner and executor enough to work without re-litigating.
- Gap-closure cycles (plan → verify → execute → re-verify) fully closed both a UI-SPEC contradiction (Phase 2's Tab/Restart conflict) and a code-review-found critical bug (Phase 3's Unicode indexing bug) within the same session, without leaving known defects unshipped.

### What Was Inefficient
- Two subagent rate-limit failures mid-session (planner during Phase 2, UI-researcher during Phase 3) cost real time; both resolved cleanly on retry once the provider's reset window passed, but there was no way to predict the reset time in advance other than checking it against the error message.
- A `general-purpose` agent was used once for a code review instead of the more specific `gsd-code-reviewer` type — functionally fine (the prompt was fully self-contained) but an avoidable inconsistency.

### Patterns Established
- Every pure module in this codebase opens with a header comment: purity statement, governing decision IDs (D-NN), the test file that locks it, and an explicit "do NOT" list. Golden-case tables (`Case` interface + `it.each`) are the universal test convention.
- **Code-point indexing discipline**: any code touching target/exercise text MUST iterate/index via `Array.from(text)` (Unicode code points), never raw string `.length`/`[i]` (UTF-16 code units) — this was violated in 3 files across 2 phases before being caught and fixed; worth a lint rule or explicit checklist item in future phases touching text indexing.
- `onXxx?: (...) => void` optional-callback props are the established pattern for a child component to signal an event upward (`onRestartRequested`, `onComplete`), fired from a dedicated `useEffect`.

### Key Lessons
1. A code-review pass at the tail of every phase (not just at milestone close) catches correctness bugs the plan-checker and phase-verifier's spec-conformance focus can miss — the Unicode indexing bug was invisible to both because the *plans* never specified UTF-16-vs-code-point behavior; only reading the *diff* against real Unicode input surfaced it.
2. When a bug is found that spans multiple already-shipped phases (not just the phase currently in flight), fixing it immediately — with regression tests and independent re-verification — is preferable to deferring it as "someone else's phase's problem." The fix stayed small because it was caught early.
3. UI-SPEC's "UI Considerations" probe (explicit/backstop/unresolved resolution) is worth the overhead — it directly caught the Phase 2 Tab/Restart-reachability contradiction before it became a shipped accessibility regression.

### Cost Observations
- Model mix: 100% claude-sonnet-5 (single-model project, no explicit tiering configured).
- Sessions: 2 (this session picked up mid-Phase-2-planning after a prior session's initial research/context work).
- Notable: heavy subagent parallelization (researcher, pattern-mapper, planner, checker, executor, reviewer, verifier, security-auditor, UI-researcher/checker) kept the orchestrator's own context lean enough to complete all 3 phases plus milestone close in two sessions — the per-phase gate sequence (research → pattern-map → plan → check → execute → review → verify → secure) is repeatable and was followed consistently across all 3 phases.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 2 | 3 | Established the full gate sequence (research → pattern-map → plan → check → execute → review → verify → secure) and the code-point-indexing discipline the hard way. |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|---------------------|
| v1.0 | 132 | not measured (no coverage tool configured) | 0 (zero-runtime-dependency convention maintained throughout) |

### Top Lessons (Verified Across Milestones)

1. Independent re-verification (reverting a fix to prove the regression test would have caught it) is worth the extra agent spawn — it turns "the executor says it's fixed" into a provable claim.
