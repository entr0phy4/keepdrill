# Phase 3: Session Metrics - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning

<domain>
## Phase Boundary

On finishing an exercise, the user sees trustworthy speed (net WPM), accuracy, and
five-slowest-keystroke numbers, computed by a pure, re-runnable metrics engine with
no I/O. This phase adds the metrics engine module and the results display — it does
not add persistence (PERS-*, v2), per-digraph/heatmap analytics (ANLY-*, v2), or any
new capture instrumentation (Phase 1/2's `capture.ts`, `trainer/state.ts`,
`trainer/active-time.ts` are read-only inputs to this phase, never modified).

</domain>

<decisions>
## Implementation Decisions

This ran in `--auto` mode — no user prompts. Every decision below is an
autonomously-selected recommended default, logged for review. All four ROADMAP
success criteria already lock the core formulas precisely (net WPM = correct
chars / 5 / minutes; accuracy = correct keypresses / total keypresses with
corrections in the denominator; slowest-5 via median/trimmed aggregation
discarding >1000ms and <25ms gaps). The gray areas below are the specifics
ROADMAP left open.

### Time basis for WPM

- **D-01:** WPM's "minutes" denominator uses **active elapsed time** —
  `computeActiveElapsedMs` (Phase 2, `src/trainer/active-time.ts`) — not raw
  wall-clock time from first keystroke to completion. Time the window was
  blurred or the tab was hidden is excluded, exactly as Phase 2's D-09 was
  built to support ("Phase 2 does not display a running timer — Phase 3
  consumes the value directly"). **Clarified by research (RESEARCH.md Open
  Question 3):** the `now` argument passed to `computeActiveElapsedMs` at
  completion MUST be `TrainerState.completedAt` — the completing record's own
  `tMs` (already in the `event.timeStamp` clock domain) — never `Date.now()`
  or a freshly-read timestamp (both are the wrong clock domain and/or add
  handler-latency skew; `Session.startedAt` is explicitly `Date.now()`-based
  and display-only per `session.ts`'s own doc comment — never use it for a
  duration calculation). — **Reversibility:** costly — every stored/
  displayed WPM number is defined relative to this time basis; switching to
  wall-clock later changes the meaning of every historical number, not just
  the code path.
  [auto] Time basis — Q: "Active time or total wall-clock time for WPM?" →
  Selected: "Active time via computeActiveElapsedMs" (recommended: this is
  literally what Phase 2 built this function for, and matches the project's
  "honest session timing" framing over Monkeytype's simpler total-time model).

### Accuracy denominator composition

- **D-02:** "Total keypresses" (METR-02's denominator) counts **every
  committed-character attempt** from `charLog` — including characters later
  overwritten by a backspace-and-retype — not just the final per-position
  status from `computeTrainerState`. This requires the metrics engine to
  derive its own attempt-level correct/incorrect stream by replaying `charLog`
  against the target text (mirroring `computeTrainerState`'s reducer logic,
  but preserving every attempt at a position instead of only the latest one),
  since `TrainerState.perCharStatus` deliberately collapses history (Phase
  2's documented behavior: a corrected position "renders with plain correct
  styling — no visual corrected badge"). — **Reversibility:** reversible —
  purely an internal derivation; the public accuracy number's formula doesn't
  change if the internal replay logic is later refactored.
  [auto] Accuracy denominator — Q: "Count every attempt (incl. corrected-over
  ones) or only final per-position state?" → Selected: "Every attempt"
  (recommended: ROADMAP explicitly says "with corrections in the denominator"
  — the only reading that makes "corrections" affect the denominator at all
  is counting every keypress attempt, not just the final outcome per position).
  **Clarified by research (RESEARCH.md Open Question 1, confirms Monkeytype's
  own accuracy formula does NOT count corrections this way — this is a
  deliberate, intentional divergence from Monkeytype for accuracy, even
  though D-01's WPM formula deliberately DOES match Monkeytype):** only
  insert-branch `CommittedChar` records (a real character-vs-target
  comparison) count toward the denominator — a delete-type record itself is
  NOT a separate denominator entry (it has no correctness verdict to score).
  A corrected position already contributes 2 denominator entries (the wrong
  insert + the retyped insert) without needing to additionally score the
  backspace keystroke itself.

### Slowest-keystroke identity grouping

- **D-03:** The "five slowest keystrokes" group latency samples by the
  **logical character committed** (the code point from `CommittedChar.data`),
  not by physical `KeyboardEvent.code`. E.g., `{` and `[` are tracked as
  distinct entries even though they may share a physical key with Shift on
  some layouts; Shift itself is never a trackable entry (it produces no
  `CommittedChar`). — **Reversibility:** reversible — an aggregation-key
  change, not a data-model change; historical raw logs are unaffected.
  [auto] Key identity — Q: "Group by physical key code or logical character?"
  → Selected: "Logical character" (recommended: matches the project's stated
  differentiator — symbol/character-level friction in code, not raw physical
  key hardware — and is what a user recognizes when reading a result like
  "your slowest key: `{`").

### Minimum sample count for slowest-keys

- **D-04:** A character needs **at least 3 occurrences** in the exercise
  before it's eligible for the slowest-5 list. Below 3 total occurrences
  across all typed characters combined (i.e., the exercise itself is too
  short/repetitive to have any qualifying character), the results view shows
  the ROADMAP's specified "not enough data" message instead of a list.
  — **Reversibility:** reversible — a tunable threshold constant.
  [auto] Minimum sample count — Q: "How many occurrences before a character
  qualifies for the slowest-5 list?" → Selected: "3" (recommended: standard
  typing-test convention — below 3 samples, median/trimmed aggregation is
  statistically meaningless and one outlier dominates the number).
  **Clarified by research (RESEARCH.md Open Question 2):** the "3" gates on
  samples remaining AFTER the outlier filter (>1000ms and <25ms gaps
  discarded), not raw pre-filter occurrence count — D-04's own rationale is
  about samples feeding the median, which by definition are post-filter.

### Results reveal UX

- **D-05:** The results view appears **automatically** the instant
  `TrainerState.completedAt` becomes non-null (cursor reaches `text.length`)
  — no separate "show results" action. All four ROADMAP success criteria are
  phrased as "on completion, user sees..." — a passive reveal, not a
  user-triggered one. — **Reversibility:** reversible — a display-trigger
  condition, not a data/formula change.
  [auto] Results reveal — Q: "Auto-show on completion or require a user
  action?" → Selected: "Automatic" (recommended: matches all 4 success
  criteria's "on completion, user sees" phrasing verbatim).

### Restart from results

- **D-06:** The existing Restart control (Phase 2, `App.tsx`'s
  `handleRestart` + Escape shortcut) remains available and functional from
  the results view — restarting resets the trainer to its pre-typing state
  (same content, fresh session) exactly as it does mid-exercise; the metrics
  computed for the just-finished attempt are not persisted anywhere (no
  PERS-* in this phase) and are simply replaced by the next completion's
  numbers. — **Reversibility:** reversible.
  [auto] Post-completion restart — Q: "Can the user restart directly from the
  results view?" → Selected: "Yes, same Restart control" (recommended: no
  reason to remove an already-working, already-tested control; forcing a
  detour would be pure friction).

### Completion signaling mechanism

- **D-07 (added after research):** `CaptureSurface` gains a new
  `onComplete?: (completedAt: number) => void` prop, fired exactly once (via a
  `useEffect` keyed on `completedAt` transitioning from `null` to non-null) —
  mirroring the existing `onRestartRequested` prop pattern from Phase 2.
  `App.tsx`'s existing 250ms `SESSION_REFRESH_MS` polling interval is NOT
  reused for this — it exists for a different purpose (dev-inspection
  polling) and is far too coarse for D-05's "instant" reveal requirement.
  — **Reversibility:** reversible — an additive prop; no existing call site
  changes shape.
  [auto] Completion signaling — Q: "How does App.tsx learn the exercise
  completed, given CaptureSurface has no such callback today?" → Selected:
  "New onComplete callback prop" (recommended by research: verified
  CaptureSurface computes completedAt internally every render but has no way
  to surface it; the existing polling interval is both wrong-purpose and
  too slow).

### Claude's Discretion

- **Metric schema versioning** (METR-04's "the metric schema is versioned"):
  a single integer `schemaVersion` field on the metrics result type, bumped
  only on a breaking shape change (field removed/retyped, not field added).
  No migration machinery needed in v1 (nothing is persisted yet — PERS-* is
  v2) — the version field exists now so v2's persistence layer has a stable
  anchor to migrate from later.
- **Module shape**: the metrics engine takes primitives (`charLog`, target
  `text`, `markers`, `now`) as parameters — the same established pattern as
  `computeTrainerState` and `computeActiveElapsedMs` — not the `Session`
  object wholesale, keeping it independently re-runnable and golden-testable
  per METR-04's own wording.
- **WPM rounding/display precision**: standard typing-test convention (whole
  number, e.g. "62 wpm") unless research surfaces a stronger convention.
- **"Not enough data" wording and exact accuracy/WPM number formatting**:
  left to the UI-SPEC step (this phase's `UI hint: yes` per ROADMAP) rather
  than locked here.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & formulas (locked)
- `.planning/REQUIREMENTS.md` §Metrics (METR-01..04) — the four locked success
  criteria and formulas this phase must satisfy verbatim.
- `.planning/ROADMAP.md` §Phase 3 — goal, success criteria, `Depends on: Phase 2`.

### Data this phase folds over (read, do not modify)
- `src/capture/types.ts` — `CommittedChar`, `CaptureMarker`, `KeystrokeEvent`,
  `Session` (D-12/D-14 — Session was explicitly shaped in Phase 1 for this
  phase to consume).
- `src/session.ts` — `buildSession()`, the live-snapshot composition Phase 3
  reads from (a fresh call is needed at completion time, not a cached one —
  see its own `CR-01` comment on staleness).
- `src/trainer/state.ts` — `computeTrainerState`, `TrainerState`,
  `PerCharStatus`, `glyphFor` (Phase 2). Note its documented limitation: only
  the *current* status per position is retained, not per-attempt history —
  this phase's accuracy engine must re-derive attempt history itself (D-02).
- `src/trainer/active-time.ts` — `computeActiveElapsedMs` (Phase 2, D-09) —
  the exact function this phase's WPM time-basis decision (D-01) consumes.

### Prior phase decisions this phase inherits
- `.planning/phases/01-corpus-input-keystroke-capture/01-CONTEXT.md` — capture
  architecture (D-01 through D-14), especially D-12/D-14 (Session shape) and
  D-07 (`event.timeStamp` as the timing source).
- `.planning/phases/02-interactive-typing-trainer/02-CONTEXT.md` — D-04 (free
  correction), D-09 (active-time toggle-state-machine), D-11 (one-position-
  back delete limitation — relevant to how this phase interprets delete
  records when replaying attempt history).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `computeActiveElapsedMs(charLog, markers, now)` (`src/trainer/active-time.ts`)
  — directly provides the WPM time-basis denominator (D-01). No new
  blur/focus tracking needed.
- `Session` type + `buildSession()` (`src/session.ts`) — already assembles
  exactly the inputs (`charLog`, `markers`, `exercise.text`) this phase's
  metrics engine needs; call `buildSession()` fresh at completion time (its
  own doc comment warns against caching a stale snapshot).
- `computeTrainerState`'s reducer shape (iterate `charLog` once, branch on
  `inputType` starting with `'delete'` vs. a real commit) is the pattern to
  mirror for the attempt-level accuracy replay (D-02) — same golden-case-table
  test convention (`state.test.ts`, `active-time.test.ts`) applies to the new
  metrics module's tests.

### Established Patterns
- Pure modules in this codebase: zero non-`import type` imports, a top-of-file
  header comment stating purity + which decisions (D-NN) govern the logic +
  which test file locks it + an explicit "do NOT" list. Both `state.ts` and
  `active-time.ts` follow this; the metrics module should too.
- Golden-case test tables via `Case`/`it.each`, matching
  `src/ingestion/normalize.test.ts`'s original convention.
- `event.isTrusted` guards on any handler that triggers a side effect
  (established in `capture.ts` T-01-04, extended to `CaptureSurface.tsx` in
  Phase 2's gap closure, T-02-09) — relevant if this phase adds any new
  keydown-triggered action (e.g., a "view results" or "restart" control).

### Integration Points
- Results display likely mounts in `src/ui/App.tsx` alongside/replacing
  `CaptureSurface`, gated on `TrainerState.completedAt !== null` (D-05) —
  mirrors how `App.tsx` already gates the Restart button on `exercise !== null`.
- Metrics computation is triggered once completion is detected — likely a
  `useEffect`/`useMemo` in `App.tsx` keyed on `completedAt`, calling
  `buildSession()` then the new metrics engine — not inside the hot-path
  `CaptureSurface` component.

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond ROADMAP's locked formulas — open to standard
approaches for the results view's visual design (deferred to the UI-SPEC step,
per ROADMAP's `UI hint: yes`).

</specifics>

<deferred>
## Deferred Ideas

- **Persistence** (PERS-01/02: IndexedDB session storage) — explicitly v2 per
  REQUIREMENTS.md and PROJECT.md's Out of Scope list. This phase's metrics are
  computed live and not saved anywhere.
- **Per-digraph/bigram latency table, keyboard heatmap, symbol-adjusted WPM,
  historical progress charts, Symbols drill mode** (ANLY-01..05) — explicitly
  v2. This phase's "five slowest keystrokes" is single-character granularity
  only, not digraph/bigram.
- **Symbol-density-adjusted WPM** — PROJECT.md explicitly flags this as
  out-of-v1-scope; if it appears anywhere it must be labeled separately from
  the plain net WPM this phase computes (already noted in STATE.md
  Blockers/Concerns from Phase 1 planning).

None — discussion stayed within phase scope (no user input this session;
`--auto` mode).

</deferred>

---

*Phase: 3-session-metrics*
*Context gathered: 2026-09-05*
