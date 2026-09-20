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

## Milestone: v1.1 — Persistencia y Analíticas

**Shipped:** 2026-09-20
**Phases:** 3 | **Plans:** 7
**Closeout:** override_closeout (Phase 5 missing `05-VERIFICATION.md`)

### What Was Built
- Phase 4: Dexie 4 persistence seam auto-saving the full raw Session + cached MetricsResult, newest-first History with seven-column rows, dismissible save-failure notice, hide-not-unmount trainer toggle.
- Phase 5: Companion symbol-adjusted WPM (schema v2 recompute-on-read) and a closed Language `<select>` on the paste path so sessions are no longer stuck as plaintext.
- Phase 6: Pure `src/analytics/` folds (ranked digraphs n≥5, US-ANSI heatmap, unweighted per-language profile) plus a stacked Analytics sibling view.

### What Worked
- Seam discipline held: only `persistence/db.ts` imports Dexie; analytics stays pure (zero DOM, zero Dexie, zero rounding) and never imports `ui/`.
- Schema bump + existing `resolveMetrics` recompute-on-read meant Phase 5/6 formulas applied to old history with zero data migration.
- Hide-not-unmount (D-08) extended from History to a third Analytics sibling without losing in-progress capture state.
- Fire-and-forget `saveSession` after `setMetrics` kept PERS-03 literally true — the results screen never waits on IndexedDB.

### What Was Inefficient
- Phase 5 UAT passed 10/10 on 2026-09-13 but `05-VERIFICATION.md` was never written and the ROADMAP checkbox stayed open through Phase 6 close. That forced `override_closeout` instead of `verified_closeout`.
- No `.planning/v1.1-MILESTONE-AUDIT.md` was produced before close.
- Phase 4 `PATTERNS.md` / `REVIEW.md` / `VERIFICATION.md` sat untracked until the archive move.

### Patterns Established
- Isolated platform seam for IndexedDB (`db.ts` / `repository.ts`) matching the Phase 1 pure-core / platform-seam / hot-path split.
- Additive companion metrics (`symbolAdjustedWpm`) — never a silent replacement of a shipped primary field.
- One shared `gatedMedian` owns the exclusive latency window so digraph ranking, heatmap, and slowest-five cannot drift.
- Header view switches are siblings that hide (never unmount) the trainer.

### Key Lessons
1. A completed UAT file is not a substitute for `*-VERIFICATION.md` plus the ROADMAP checkbox — GSD `init.manager` treats missing verification as `phase_complete: false` and blocks verified closeout.
2. Recompute-on-read via a schema version on cached snapshots is cheaper than a Dexie migration when formulas improve.
3. Keep-forever local history (D-18) and unencrypted IndexedDB remain accepted risks; they should stay visible in the next milestone's threat model if anything syncs or exports.

### Cost Observations
- Model mix: not recorded per session (adaptive profile).
- Sessions: work spanned 2026-09-05 → 2026-09-20 (~15 days calendar, not wall-clock agent time).
- Notable: Phase 5/6 plan execution stayed short (~4–8 min per plan) after Phase 4's heavier persistence tracer (~45 + 35 min).

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 2 | 3 | Established the full gate sequence (research → pattern-map → plan → check → execute → review → verify → secure) and the code-point-indexing discipline the hard way. |
| v1.1 | multi-session, 15 calendar days | 3 | Persistence + analytics seams; closeout slipped to override because Phase 5 skipped the verification report. |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|---------------------|
| v1.0 | 132 | not measured (no coverage tool configured) | 0 (zero-runtime-dependency convention maintained throughout) |
| v1.1 | ~140 `it`/`test` blocks in src/ (plus `it.each` goldens) | not measured | Dexie 4.4.4 + dexie-react-hooks isolated to the persistence seam |

### Top Lessons (Verified Across Milestones)

1. Independent re-verification (reverting a fix to prove the regression test would have caught it) is worth the extra agent spawn — it turns "the executor says it's fixed" into a provable claim.
2. UAT complete ≠ phase sealed — missing `VERIFICATION.md` blocks verified milestone closeout even when requirements and tests are green.
