# Phase 3: Session Metrics - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-05
**Phase:** 3-session-metrics
**Areas discussed:** Time basis for WPM, Accuracy denominator composition, Slowest-keystroke identity grouping, Minimum sample count for slowest-keys, Results reveal UX, Restart from results

> Ran in `--auto` mode — no user prompts were shown. For every area, Claude selected
> the recommended option and logged it below for review.

---

## Time basis for WPM

| Option | Description | Selected |
|--------|-------------|----------|
| Active elapsed time | `computeActiveElapsedMs` — excludes blurred/hidden periods (Phase 2 D-09) | ✓ |
| Total wall-clock time | Raw `now - startedAt`, includes blurred/hidden periods | |

**Selected:** Active elapsed time via `computeActiveElapsedMs`
**Notes:** Phase 2's D-09 was explicitly built for this ("Phase 2 does not display a running timer — Phase 3 consumes the value directly"). Matches the project's "honest session timing" framing.

---

## Accuracy denominator composition

| Option | Description | Selected |
|--------|-------------|----------|
| Every committed-character attempt | Counts corrected-over characters too, via a fresh replay of `charLog` | ✓ |
| Final per-position state only | Reuses `TrainerState.perCharStatus`'s current-state-only view | |

**Selected:** Every committed-character attempt
**Notes:** ROADMAP's wording — "with corrections in the denominator" — only makes sense if corrections actually inflate the denominator, which requires counting every attempt, not just the final outcome per position.

---

## Slowest-keystroke identity grouping

| Option | Description | Selected |
|--------|-------------|----------|
| Logical character | Group by the committed code point (`CommittedChar.data`) | ✓ |
| Physical key code | Group by `KeyboardEvent.code` | |

**Selected:** Logical character
**Notes:** Matches the project's stated differentiator (symbol/character-level friction in code), and is what a user recognizes in a result ("your slowest key: `{`").

---

## Minimum sample count for slowest-keys

| Option | Description | Selected |
|--------|-------------|----------|
| 3 occurrences | Standard typing-test convention | ✓ |
| 1 occurrence | Any character with at least one sample qualifies | |
| 5 occurrences | Higher bar, fewer false positives but more "not enough data" results | |

**Selected:** 3 occurrences
**Notes:** Below 3 samples, median/trimmed aggregation is statistically meaningless — a single outlier would dominate.

---

## Results reveal UX

| Option | Description | Selected |
|--------|-------------|----------|
| Automatic on completion | Results appear the instant `completedAt` is set | ✓ |
| User-triggered | User clicks a "Show results" button | |

**Selected:** Automatic on completion
**Notes:** All four ROADMAP success criteria are phrased "on completion, user sees..." — a passive reveal, not a triggered one.

---

## Restart from results

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, same Restart control | The existing Phase 2 Restart button/Escape shortcut stays available | ✓ |
| No, separate flow required | Results view has no direct restart path | |

**Selected:** Yes, same Restart control
**Notes:** No reason to remove an already-working, already-tested control; forcing a detour would be pure friction. Nothing is persisted in this phase, so restarting simply discards the just-computed numbers.

---

## Claude's Discretion

- Metric schema versioning: a single integer `schemaVersion` field, bumped only on breaking shape changes.
- Module shape: metrics engine takes primitives (`charLog`, target `text`, `markers`, `now`) as parameters, mirroring `computeTrainerState`/`computeActiveElapsedMs`.
- WPM rounding/display precision: whole number, standard convention.
- Exact "not enough data" wording and number formatting: deferred to the UI-SPEC step.

## Deferred Ideas

- Persistence (PERS-01/02) — explicitly v2.
- Per-digraph/bigram latency, keyboard heatmap, symbol-adjusted WPM, historical progress charts, Symbols drill mode (ANLY-01..05) — explicitly v2.
- Symbol-density-adjusted WPM — out of v1 scope; must be labeled separately from plain net WPM if it ever appears.
