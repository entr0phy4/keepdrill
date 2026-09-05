# Phase 3: Session Metrics - Research

**Researched:** 2026-09-05
**Domain:** Pure-function typing metrics (WPM/accuracy/latency aggregation) + a React results view, in a browser-only SPA with no backend
**Confidence:** MEDIUM-HIGH

## Summary

This phase adds a single pure module (no I/O, no DOM access) that folds a completed
exercise's `charLog`/`markers`/target `text` into three numbers — net WPM, accuracy,
and the five slowest characters — plus a small results-view React component that shows
them the instant the exercise completes. The formulas themselves are already locked
verbatim in `REQUIREMENTS.md`/`ROADMAP.md` and refined by `03-CONTEXT.md`'s five D-NN
decisions, so there is very little formula ambiguity left to research. What *is* left to
research, and what this document focuses on, is (1) how Monkeytype itself implements
"net WPM" and "accuracy" so the planner can see exactly where keebdrill's chosen
formulas match Monkeytype and where `03-CONTEXT.md`'s D-02 *deliberately diverges* from
it, (2) the correct algorithm shape for "median/trimmed aggregation with outlier
filtering" over very small per-character sample counts, and (3) three concrete
integration gaps found by reading the actual Phase 1/2 source this session: `CaptureSurface`
has no completion callback today, `App.tsx`'s existing session-refresh interval is too
coarse for an "instant" reveal, and the metrics engine's `now` parameter must stay in the
`event.timeStamp` clock domain — never `Date.now()` — or every derived number silently
corrupts.

**Primary recommendation:** Write `src/metrics/metrics.ts` as a single pure module
(zero non-`import type` imports, matching `state.ts`/`active-time.ts`'s established
convention) that (a) replays `charLog` once to produce attempt-level correct/incorrect
counts and per-character latency-gap samples (mirroring `computeTrainerState`'s
reducer shape, not reusing `TrainerState.perCharStatus`, per D-02), (b) hand-rolls a
~10-line median function rather than adding a stats dependency, and (c) is invoked from
`App.tsx` via a new `onComplete` callback added to `CaptureSurface` (mirroring the
existing `onRestartRequested` prop) rather than the existing 250ms `SESSION_REFRESH_MS`
polling interval, which is too coarse for D-05's "instant" reveal requirement.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| METR-01 | Net WPM = correct chars / 5 / minutes, matching Monkeytype's definition | Monkeytype's actual formula confirmed (Sources); active-time basis (D-01) and clock-domain pitfall documented in Common Pitfalls/Code Examples |
| METR-02 | Accuracy = correct keypresses / total keypresses, corrections in the denominator | Monkeytype's own accuracy formula does NOT do this (documented divergence below); attempt-replay reducer shape provided to satisfy D-02's stricter denominator |
| METR-03 | Five slowest keystrokes, gated by minimum sample count, median/trimmed aggregation, outlier gaps (>1000ms, <25ms) discarded, "not enough data" fallback | Algorithm shape (absolute-threshold trim + median, not percentage trimmed-mean) recommended and justified in Architecture Patterns/Common Pitfalls |
| METR-04 | Pure module, no I/O, re-runnable, formulas documented in repo, versioned schema, golden-file tested | Module shape, `schemaVersion` field, and documentation convention (top-of-file header comment, matching `state.ts`/`active-time.ts`) recommended in Architecture Patterns |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Time basis for WPM:** WPM's "minutes" denominator uses **active elapsed
time** — `computeActiveElapsedMs` (Phase 2, `src/trainer/active-time.ts`) — not raw
wall-clock time from first keystroke to completion.

**D-02 — Accuracy denominator composition:** "Total keypresses" (METR-02's
denominator) counts **every committed-character attempt** from `charLog` — including
characters later overwritten by a backspace-and-retype — not just the final
per-position status from `computeTrainerState`. Requires the metrics engine to derive
its own attempt-level correct/incorrect stream by replaying `charLog` against the
target text.

**D-03 — Slowest-keystroke identity grouping:** Group by the **logical character
committed** (the code point from `CommittedChar.data`), not by physical
`KeyboardEvent.code`. Shift itself is never a trackable entry (produces no
`CommittedChar`).

**D-04 — Minimum sample count:** A character needs **at least 3 occurrences** before
it's eligible for the slowest-5 list. Below 3 qualifying occurrences across the whole
exercise, show "not enough data" instead of a list.

**D-05 — Results reveal UX:** The results view appears **automatically** the instant
`TrainerState.completedAt` becomes non-null — no separate "show results" action.

**D-06 — Restart from results:** The existing Restart control (`App.tsx`'s
`handleRestart` + Escape shortcut) remains available and functional from the results
view; metrics for the finished attempt are not persisted anywhere and are simply
replaced by the next completion's numbers.

### Claude's Discretion

- **Metric schema versioning:** a single integer `schemaVersion` field on the metrics
  result type, bumped only on a breaking shape change. No migration machinery needed
  in v1.
- **Module shape:** the metrics engine takes primitives (`charLog`, target `text`,
  `markers`, `now`) as parameters — same pattern as `computeTrainerState` and
  `computeActiveElapsedMs` — not the `Session` object wholesale.
- **WPM rounding/display precision:** standard typing-test convention (whole number,
  e.g. "62 wpm") unless research surfaces a stronger convention.
- **"Not enough data" wording and exact number formatting:** left to the UI-SPEC step.

### Deferred Ideas (OUT OF SCOPE)

- **Persistence** (PERS-01/02) — explicitly v2. This phase's metrics are computed
  live and not saved anywhere.
- **Per-digraph/bigram latency table, keyboard heatmap, symbol-adjusted WPM,
  historical progress charts, Symbols drill mode** (ANLY-01..05) — explicitly v2.
  "Five slowest keystrokes" is single-character granularity only, not digraph/bigram.
- **Symbol-density-adjusted WPM** — explicitly out-of-v1-scope; must be labeled
  separately from plain net WPM if it ever appears.
</user_constraints>

## Architectural Responsibility Map

keebdrill is an intentionally single-tier browser SPA (no backend, no separate
frontend-server tier — locked at Phase 1, D-01 in `01-CONTEXT.md`). Every capability
in this phase therefore lives in the same tier; the table below records that
explicitly so the planner doesn't introduce an unnecessary seam.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Attempt-replay + WPM/accuracy/slowest-5 computation | Browser/Client (pure TS module) | — | No backend exists or is planned for v1; the module runs entirely in-page over an in-memory `charLog` |
| Completion detection (bridging `CaptureSurface` → `App`) | Browser/Client (React state lift) | — | Pure in-memory React state change, no persistence, no network |
| Results display (auto-reveal) | Browser/Client (React component) | — | Same SPA render tree as `CaptureSurface`/`Banners` |

## Standard Stack

**No new packages this phase.** The metrics engine is intentionally hand-rolled to
match the zero-runtime-dependency convention already established twice in this
codebase (`src/trainer/state.ts`, `src/trainer/active-time.ts` — both carry a
"zero non-`import type` imports" header comment). Median/percentile computation for 5
elements or fewer is ~10 lines; pulling in a stats library for this would break that
convention for no benefit. See **Don't Hand-Roll** below for the one place a library
*would* be justified (it isn't needed here).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled median function | `d3-array`'s `median`/`quantile` (already listed as optional in this project's own CLAUDE.md tech-stack doc) | Only worth it if a later phase needs many percentiles/stdev simultaneously (e.g. ANLY-01's per-digraph table, v2). Not justified for a single median over ≤ a few dozen samples per character in v1. |

**Installation:** none required.

## Package Legitimacy Audit

Not applicable — this phase installs no external packages. Skipping the Package
Legitimacy Gate per its own trigger condition ("whenever this phase installs external
packages").

## Architecture Patterns

### System Architecture Diagram

```
CaptureSurface (per-frame tick via useCharLogTick / rAF)
   │  computeTrainerState(text, charLog) → completedAt
   │  (transition: completedAt null → non-null)
   ▼
onComplete(completedAt)  ── NEW callback, mirrors onRestartRequested ──►  App.tsx
                                                                            │
                                                                            │ buildSession(exercise, startedAt)
                                                                            │ — fresh call, per session.ts CR-01
                                                                            ▼
                                                          Session { charLog, markers, exercise.text }
                                                                            │
                                                                            ▼
                                          computeSessionMetrics(text, charLog, markers, now = completedAt)
                                     ┌───────────────────────┼────────────────────────────┐
                                     ▼                       ▼                            ▼
                       replayAttempts(text, charLog)   computeActiveElapsedMs      (same replay's
                       — D-02 reducer: correct/          (charLog, markers, now)     per-char latency
                       incorrect attempt counts +         — Phase 2, D-01 basis       samples, grouped
                       per-char latency-gap samples                                   by CommittedChar.data)
                                     │                       │                            │
                                     ▼                       ▼                            ▼
                          accuracy = correctAttempts  wpm = (correctChars/5)      slowest5 = for each char with
                          / totalAttempts              / (elapsedMs/60000)        ≥3 valid samples: median of
                                                                                   samples in (25ms,1000ms),
                                                                                   ranked desc, top 5
                                     └───────────────────────┼────────────────────────────┘
                                                              ▼
                                            MetricsResult { schemaVersion, wpm, accuracy, slowest5[] }
                                                              │
                                                              ▼
                                              ResultsView (auto-shown on completedAt !== null, D-05)
```

A reader can trace the whole use case: a keystroke commits → `CaptureSurface` detects
`completedAt` → `App` fetches a fresh `Session` → the new pure module folds it into
three numbers → the results view renders them, with Restart still reachable (D-06).

### Recommended Project Structure
```
src/
├── metrics/
│   ├── metrics.ts        # computeSessionMetrics() — the new pure module (METR-04)
│   └── metrics.test.ts   # golden-case table, Case/it.each convention (normalize.test.ts style)
├── ui/
│   ├── App.tsx            # MODIFIED — completion state + onComplete wiring, calls computeSessionMetrics
│   ├── ResultsView.tsx    # NEW — the results display component (UI-SPEC governs its exact shape)
│   └── CaptureSurface.tsx # MODIFIED — gains an onComplete?: (completedAt: number) => void prop
```

### Pattern 1: Attempt-replay reducer (satisfies D-02)
**What:** A second reducer over `charLog`, structurally identical to
`computeTrainerState`'s delete/insert branching (same D-11 one-position-back
semantics for deletes — `state.ts:34-40`), but instead of collapsing history into
`perCharStatus` it accumulates every insert-branch attempt's outcome.
**When to use:** Any time the accuracy denominator must reflect corrections, since
`TrainerState.perCharStatus` "deliberately collapses history" (03-CONTEXT.md, quoting
Phase 2's documented behavior).
**Example:**
```typescript
// Source: derived from D-02 (03-CONTEXT.md) + computeTrainerState's reducer shape
// (src/trainer/state.ts:22-61, read this session). Illustrative — not a verbatim
// external citation.
interface AttemptReplay {
  correctAttempts: number
  incorrectAttempts: number
  /** keyed by the logical character (CommittedChar.data code point, D-03) */
  latencySamplesByChar: Map<string, number[]>
}

function replayAttempts(target: string, charLog: readonly CommittedChar[]): AttemptReplay {
  let cursor = 0
  let correctAttempts = 0
  let incorrectAttempts = 0
  const latencySamplesByChar = new Map<string, number[]>()
  let prevTMs: number | null = null // gap source: previous CommittedChar of ANY type

  for (const rec of charLog) {
    if (rec.inputType.startsWith('delete')) {
      if (cursor > 0) cursor -= 1
      prevTMs = rec.tMs // a delete still marks "last activity" for gap purposes
      continue
    }
    const codepoints = Array.from(rec.data ?? '')
    codepoints.forEach((ch, i) => {
      if (cursor >= target.length) return
      const isCorrect = ch === target[cursor]
      if (isCorrect) correctAttempts += 1
      else incorrectAttempts += 1

      // D-03: group by logical character. Only the LAST codepoint of a
      // multi-codepoint (IME) record gets a gap sample — the earlier
      // codepoints in the same record share one tMs and have no derivable
      // intra-record timing (Pitfall 7 below).
      if (i === codepoints.length - 1 && prevTMs !== null) {
        const gap = rec.tMs - prevTMs
        const arr = latencySamplesByChar.get(ch) ?? []
        arr.push(gap)
        latencySamplesByChar.set(ch, arr)
      }
      cursor += 1
    })
    prevTMs = rec.tMs
  }
  return { correctAttempts, incorrectAttempts, latencySamplesByChar }
}
```

### Pattern 2: Absolute-threshold trim + median (satisfies METR-03)
**What:** Discard gap samples outside `(25ms, 1000ms)` first (the "trim" — an
absolute-threshold trim, not a percentage-based trimmed mean), then take the
**median** of whatever remains. A percentage-based trimmed mean is degenerate at the
sample sizes typical here (n = 3–10 per character; trimming 20% of 3 samples removes
0.6 of a sample, which isn't well-defined) — median needs no such percentage and is
the standard robust statistic used by typing-analytics tools (e.g. keybr.com's
per-key latency) at small n.
**When to use:** METR-03's slowest-5 aggregation, after Pattern 1 has produced
`latencySamplesByChar`.
**Example:**
```typescript
// Source: derived from D-04 (03-CONTEXT.md) + standard small-sample robust-stats
// guidance (see Sources — trimmed-mean degeneracy at low n).
const MIN_GAP_MS = 25
const MAX_GAP_MS = 1000
const MIN_SAMPLES = 3 // D-04

function median(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function slowestFive(latencySamplesByChar: Map<string, number[]>): Array<{ char: string; medianMs: number }> {
  const eligible: Array<{ char: string; medianMs: number }> = []
  for (const [char, samples] of latencySamplesByChar) {
    const filtered = samples.filter((g) => g > MIN_GAP_MS && g < MAX_GAP_MS)
    if (filtered.length < MIN_SAMPLES) continue // D-04 gate — see Pitfall 4 on pre/post-filter count
    eligible.push({ char, medianMs: median(filtered) })
  }
  return eligible.sort((a, b) => b.medianMs - a.medianMs).slice(0, 5)
}
```

### Pattern 3: Completion-bridge via callback prop
**What:** `CaptureSurface` already computes `completedAt` internally
(`computeTrainerState(text, getCharLog())`, `CaptureSurface.tsx:131`) but never
surfaces it to `App.tsx` — there is no `onComplete` prop today (verified by a full
read of `CaptureSurface.tsx` this session — its prop list at lines 51-57 is only
`{ text, onRestartRequested }`). Add `onComplete?: (completedAt: number) => void`,
fired from a `useEffect` keyed on the local `completedAt` value, guarded so it only
fires once per `completedAt` value (a ref comparing against the previous value),
mirroring the existing `onRestartRequested` prop shape already used for the
Escape-key bridge.
**When to use:** D-05's "instant" reveal requirement.
**Example:** see Common Pitfall 6 for why the *existing* `App.tsx` polling interval
is the wrong mechanism to reuse here.

### Pattern 4: Clock-domain-consistent `now`
**What:** Every timestamp already in this codebase (`KeystrokeEvent.tMs`,
`CommittedChar.tMs`, `CaptureMarker.tMs`) is `event.timeStamp`, confirmed by reading
`src/capture/capture.ts` this session — every `tMs` assignment reads `e.timeStamp`
(lines 44, 104, 141, 157/161/168/170: `tMs: e.timeStamp`). This is a *different clock
domain* from `Session.startedAt`, which is explicitly commented `/** Date.now() wall
clock, display only */` (`src/capture/types.ts:49`). `computeActiveElapsedMs`'s `now`
parameter must be in the `event.timeStamp` domain to match `charLog`/`markers` — see
Common Pitfall 1.
**When to use:** Whenever the metrics engine needs "now" at completion time — use
`TrainerState.completedAt` itself (already the completing record's own `tMs`), not a
fresh `Date.now()` or a fresh `performance.now()` read moments later.

### Anti-Patterns to Avoid
- **Reusing `TrainerState.perCharStatus` for accuracy:** collapses corrected-over
  attempts into a single final state, contradicting D-02's explicit requirement.
- **`Date.now()` (or a fresh, later `performance.now()`) as the metrics engine's
  `now`:** wrong clock domain vs. `charLog`/`markers`' `event.timeStamp`-based `tMs`
  values, or adds handler-latency skew — corrupts every derived elapsed-time and WPM
  number. Use `TrainerState.completedAt`.
- **A stats-library dependency for a single median:** breaks the established
  zero-runtime-import pure-module convention for no benefit at this sample size.
- **Polling `App.tsx`'s existing 250ms `SESSION_REFRESH_MS` interval for
  completion detection:** that interval exists for a dev-only inspection point
  (CR-01 in `session.ts`), not sized for D-05's "instant" reveal — see Pitfall 6.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Many simultaneous percentile/stdev stats over large sample sets (a v2 concern, ANLY-01's per-digraph table) | A hand-rolled quantile/stdev library | `d3-array` (already scoped as optional in this project's own tech-stack doc) | Only worth the dependency once sample sizes and stat variety grow past what a single median function covers — not triggered by this phase's METR-03 scope |

**Key insight:** For *this* phase's actual scope (one median per character, ≤ a
handful of samples), hand-rolling is strictly simpler and preserves the codebase's
established zero-dependency pure-module convention. The "don't hand-roll" instinct
applies to *future* analytics phases, not this one.

## Common Pitfalls

### Pitfall 1: Clock-domain mismatch (`Date.now()` vs. `event.timeStamp`)
**What goes wrong:** Passing `Date.now()` (or any value not derived from
`event.timeStamp`) as the metrics engine's `now` parameter into
`computeActiveElapsedMs` produces a nonsensical elapsed time (`event.timeStamp` is
relative to navigation start, not the Unix epoch), which then corrupts every derived
WPM number.
**Why it happens:** `Session.startedAt` sits right next to `charLog`/`markers` in the
same object and IS `Date.now()`-based (`capture/types.ts:49`, "display only") — easy
to reach for by mistake since it's the only other timestamp visible on `Session`.
**How to avoid:** Use `TrainerState.completedAt` (itself a `tMs` from the completing
`CommittedChar` record) as `now`. Verified this session: every `tMs` field in
`capture.ts` is assigned from `e.timeStamp` (lines 44, 104, 141, 157, 161, 168, 170).
**Warning signs:** WPM numbers that are off by many orders of magnitude, or negative/
`NaN` elapsed times in tests.

### Pitfall 2: Divide-by-zero in the WPM formula
**What goes wrong:** If `computeActiveElapsedMs` returns `0` (theoretically possible
in a golden-file test with a contrived `now`), `correctChars / 5 / (elapsedMs / 60000)`
divides by zero, producing `Infinity` or `NaN`.
**Why it happens:** The formula has no natural floor; `computeActiveElapsedMs` only
guarantees `>= 0` (`active-time.ts:43`, `Math.max(0, ...)`), not `> 0`.
**How to avoid:** Guard `elapsedMs === 0` (or below some minimal floor) and return
`0` WPM rather than propagating `Infinity`/`NaN` into the UI.
**Warning signs:** A results view rendering literally "Infinity wpm."

### Pitfall 3: Ambiguous "total keypresses" denominator (delete-type records)
**What goes wrong:** D-02 says every committed-character *attempt* counts, but does
not explicitly say whether delete-type (`inputType.startsWith('delete')`)
`CommittedChar` records themselves count as a "keypress" in the denominator.
Including them roughly doubles the denominator for every corrected character and
changes the accuracy number substantially.
**Why it happens:** `charLog` mixes insert-branch and delete-branch records in one
array (same shape `computeTrainerState` folds over); it's easy to count every record
uniformly without noticing deletes carry no correctness verdict of their own.
**How to avoid:** Recommend counting only insert-branch attempts (each codepoint
compared against the target) in both numerator and denominator; a corrected position
then naturally contributes 2 attempts (1 incorrect + 1 correct) to the denominator,
satisfying "corrections in the denominator" without also counting the backspace
keystroke itself as an unscored "attempt." Flagged as an Open Question for
plan/discuss confirmation — see Open Questions.
**Warning signs:** Accuracy percentages that look implausibly low relative to visibly
clean typing.

### Pitfall 4: Pre-filter vs. post-filter occurrence counting (D-04's "3 occurrences")
**What goes wrong:** D-04 requires "at least 3 occurrences" before a character is
slowest-5-eligible, but doesn't specify whether that count is takenbefore or after
the `>1000ms`/`<25ms` outlier-gap discard. A character could have 5 *raw* occurrences
but only 1 sample survive filtering — computing a "median" of 1 value defeats D-04's
own stated rationale ("below 3 samples ... one outlier dominates the number").
**Why it happens:** The two counts (raw occurrences vs. valid-after-filter samples)
are easy to conflate since they're the same array before/after one `.filter()` call.
**How to avoid:** Recommend gating on the **post-filter** sample count (`filtered.length
>= 3` in Pattern 2's example), since that's the count that actually determines
median robustness. Flagged as an Open Question for plan/discuss confirmation.
**Warning signs:** A "slowest key" entry whose median is suspiciously derived from
only 1–2 real samples.

### Pitfall 5: Median rounding compounding across characters
**What goes wrong:** Rounding each character's median to a whole millisecond (or
worse, to a display string) *before* sorting/ranking can change which 5 characters
make the cut when two medians are close.
**Why it happens:** It's tempting to format-and-round in the same pass that computes
the aggregate, especially since WPM is displayed as a whole number (Discretion note).
**How to avoid:** Keep raw (unrounded) millisecond numbers through sorting/ranking;
round only at the final display-formatting step, and only for the UI layer, not
inside the pure `metrics.ts` module.
**Warning signs:** Golden-file tests that pass with rounded fixtures but fail once
real floating-point gaps are used.

### Pitfall 6: Reusing the existing 250ms session-refresh interval for completion detection
**What goes wrong:** `App.tsx` already re-snapshots `Session` on a `SESSION_REFRESH_MS
= 250` interval (`App.tsx:22,86-99`) for a *different* purpose — keeping a dev-only
`window.__keebdrillSession` inspection point and the timing-resolution banner fresh
(CR-01 in `session.ts`). Wiring completion-triggered metrics computation to that same
interval means the results view can lag the actual completing keystroke by up to
250ms, contradicting D-05's "the instant `completedAt` becomes non-null."
**Why it happens:** It's the only existing polling mechanism in `App.tsx`, so it's
tempting to bolt completion detection onto it rather than adding a new callback.
**How to avoid:** Use Pattern 3 (an `onComplete` callback fired from
`CaptureSurface`'s own per-frame `useCharLogTick`/rAF-driven render, which already
recomputes `computeTrainerState` every animation frame — `CaptureSurface.tsx:80,131`)
instead of the 250ms interval.
**Warning signs:** A visible delay between the last keystroke landing and the results
view appearing, worse on slower devices.

### Pitfall 7: Multi-codepoint (IME) `CommittedChar` records and latency attribution
**What goes wrong:** `computeTrainerState`'s own comment documents that an IME
composition can commit multiple codepoints in a single `CommittedChar` record, all
sharing one `tMs` (`state.ts:42-46`, the `insertFromComposition` case, e.g. `'ab'` in
one record). Naively assigning the same inter-record gap to *every* codepoint in that
record fabricates intra-record timing that was never measured.
**Why it happens:** Pattern 1's replay loop naturally iterates every codepoint of a
record; it's easy to attach the record-level gap to each iteration instead of just
one.
**How to avoid:** Attribute the gap only to the *last* codepoint of a multi-codepoint
record (Pattern 1's example does this via `i === codepoints.length - 1`); exclude the
earlier codepoints in that record from latency sampling entirely rather than
fabricating a zero or split gap for them.
**Warning signs:** Implausibly fast median latencies for characters that are also
common in composed input.

## Code Examples

See Patterns 1–2 above for the attempt-replay reducer and the median-after-trim
aggregation — both are original derivations from this phase's locked decisions and
the existing `computeTrainerState`/`computeActiveElapsedMs` reducer shapes (not
external library citations).

### WPM / accuracy formula functions
```typescript
// Source: derived from METR-01/METR-02 (REQUIREMENTS.md, verbatim-locked formulas)
// + D-01 (active-time basis) + Monkeytype's own net-WPM shape (see Sources).
function computeWpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0 // Pitfall 2
  const minutes = elapsedMs / 60000
  return correctChars / 5 / minutes
}

function computeAccuracy(correctAttempts: number, totalAttempts: number): number {
  if (totalAttempts === 0) return 1 // 100%, matches Monkeytype's own zero-char default
  return correctAttempts / totalAttempts
}
```

## State of the Art

No meaningful "old vs. current approach" churn applies here — WPM/accuracy formulas
for typing tests have been stable industry convention (Monkeytype, TypeRacer,
10FastFingers) for years, and this project's own requirements already lock the exact
formulas to match. The only "state of the art" note worth surfacing: this codebase's
own established convention (pure-module-with-injected-`now`, e.g.
`computeActiveElapsedMs`) already IS the current best practice for testing
time-dependent pure functions in Vitest — dependency injection over `vi.useFakeTimers()`
— so this phase should extend that convention rather than introduce a different one.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Multi-codepoint (IME) `CommittedChar` records should attribute their inter-record latency gap only to the last codepoint, excluding earlier codepoints from sampling entirely | Pattern 1 / Pitfall 7 | Low in practice (US-ANSI code-corpus typing rarely triggers IME composition), but if wrong, slowest-key stats could silently misattribute or undercount gaps for the rare composition case |
| A2 | A hand-rolled median function is sufficient and `d3-array` should NOT be added as a dependency for this phase | Standard Stack / Don't Hand-Roll | Low — reversible; adding the dependency later costs nothing if this phase's hand-rolled version proves insufficient |

**Note:** Pitfalls 1, 3, 4, and 6's specific recommendations are grounded in files
read this session (cited with line numbers) but resolve *interpretation gaps* left
open by `03-CONTEXT.md` rather than claims about external facts — they are listed as
**Open Questions** below (for plan/discuss confirmation) rather than in this
Assumptions Log, since they are recommendations, not unverified factual claims.

## Open Questions (RESOLVED)

All 4 questions below were resolved and locked into `03-CONTEXT.md` (D-01, D-02,
D-04, D-07) after this research completed, then implemented and verified by
the plan-checker against `03-01-PLAN.md`/`03-02-PLAN.md`.

1. **Does "total keypresses" (METR-02's denominator) include delete-type
   (backspace) `CommittedChar` records, or only insert-branch attempts?**
   - What we know: D-02 says "every committed-character attempt ... including
     characters later overwritten by a backspace-and-retype," but `charLog` contains
     both delete-type and insert-type records, and D-02's own wording only clearly
     addresses the insert side.
   - What's unclear: Whether a backspace keystroke itself should also count as one
     denominator entry (with no correctness verdict), on top of the incorrect+correct
     attempt pair it produces.
   - Recommendation: Count only insert-branch attempts (Pitfall 3). This already
     satisfies "corrections in the denominator" because a corrected position
     contributes 2 attempts instead of 1, without needing to score an unscoreable
     delete action.

2. **Does D-04's "at least 3 occurrences" threshold count raw `charLog` occurrences
   of a character, or only samples remaining after the `>1000ms`/`<25ms` outlier
   filter?**
   - What we know: D-04's own stated rationale ("below 3 samples, median/trimmed
     aggregation is statistically meaningless") is about *samples feeding the
     median*, not raw occurrences.
   - What's unclear: `03-CONTEXT.md` doesn't explicitly say pre- vs. post-filter.
   - Recommendation: Gate on post-filter sample count (Pitfall 4).

3. **What exact value should the metrics engine pass as `now` to
   `computeActiveElapsedMs` at exercise completion?**
   - What we know: `computeActiveElapsedMs`'s `now` parameter must be in the same
     clock domain as `charLog`/`markers` (`event.timeStamp`-based), verified this
     session by reading every `tMs` assignment in `capture.ts`.
   - What's unclear: `03-CONTEXT.md` doesn't name a specific value.
   - Recommendation: Use `TrainerState.completedAt` directly (Pattern 4, Pitfall 1)
     — it's already the completing record's own `tMs`, avoiding both the wrong-clock-
     domain trap and any handler-latency skew from a fresh timestamp read later.

4. **How should `App.tsx` learn that the exercise completed, given `CaptureSurface`
   has no such callback today?**
   - What we know: `CaptureSurface.tsx` computes `completedAt` internally every
     render (line 131) but its prop list (lines 51-57) is only `{ text,
     onRestartRequested }` — verified by a full read this session.
   - What's unclear: `03-CONTEXT.md`'s Integration Points note only says the results
     display "likely mounts in `App.tsx` ... gated on `TrainerState.completedAt !==
     null`" without specifying the wiring mechanism.
   - Recommendation: Add an `onComplete?: (completedAt: number) => void` prop to
     `CaptureSurface` (Pattern 3), fired once per completion via a `useEffect`, rather
     than reusing `App.tsx`'s existing 250ms `SESSION_REFRESH_MS` interval (Pitfall 6).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Validation, Sanitization and Encoding | yes | Render all user-derived text (target characters, including the "slowest key" character itself, which comes from pasted/uploaded corpus content per Phase 1's untrusted-input boundary) as plain JSX text children — never `dangerouslySetInnerHTML` — so React's default output-encoding applies. This is already the established pattern (`CaptureSurface.tsx:166-169` renders `{targetChar}` as a JSX child). |
| V2/V3/V4 (Auth, Session, Access Control) | no | No auth, no server-side session, no access-control surface exists in this single-user local SPA (explicitly out of scope, `REQUIREMENTS.md`'s Out of Scope table) |
| V6 Cryptography | no | Nothing in this phase touches cryptographic material |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Reflected/stored XSS via pasted-code corpus content (e.g. a target character like `<` or a slowest-key display literally containing `<script>`-shaped code fragments) | Tampering / Information Disclosure | React's default JSX text-node escaping — never interpolate ingested `text`/`CommittedChar.data` into `dangerouslySetInnerHTML` or raw DOM `innerHTML` writes anywhere in the new results view |

## Sources

### Primary (HIGH confidence)
- `src/capture/capture.ts` (read this session, lines 44, 104, 141, 157, 161, 168, 170) — every `tMs` field is assigned from `e.timeStamp`, confirming the clock domain shared by `KeystrokeEvent`, `CommittedChar`, and `CaptureMarker`
- `src/capture/types.ts` (read this session, line 49) — `Session.startedAt` is explicitly commented `Date.now() wall clock, display only`
- `src/trainer/state.ts`, `src/trainer/active-time.ts`, their `.test.ts` files (read this session) — the pure-module and golden-case-table conventions this phase must mirror
- `src/ui/App.tsx`, `src/ui/CaptureSurface.tsx` (read this session) — confirmed `CaptureSurface` has no completion callback today, and `App.tsx`'s only polling interval is the 250ms `SESSION_REFRESH_MS` (dev-inspection purpose, per its own `CR-01` comment)
- `.planning/phases/03-session-metrics/03-CONTEXT.md`, `.planning/REQUIREMENTS.md` — the locked formulas and D-01..D-06 decisions this research does not re-litigate

### Secondary (MEDIUM confidence)
- [Result Calculation and Display — monkeytypegame/monkeytype DeepWiki](https://deepwiki.com/monkeytypegame/monkeytype/2.1.4-result-calculation-and-display) — WPM = `(correctWordChars + correctSpaces) * 60 / testSeconds / 5`; Raw WPM = `(allCorrectChars + spaces + incorrectChars + extraChars) * 60 / testSeconds / 5`; accuracy = `100 * correctChars / (correctChars + incorrectChars)`, defaulting to 100% at zero characters typed — cited as a documentation summary of `monkeytypegame/monkeytype`'s `frontend/src/ts/test/test-stats.ts`, `calculateWpmAndRaw()`, not fetched directly from the source file (attempted; the file has since moved in a repo restructure and GitHub's code-search API requires authentication this session)
- WebSearch aggregation across TypingMaster/RapidTyping/generic typing-speed sites — corroborates "correct keystrokes / total keystrokes" as the standard accuracy convention, with backspace-counting-in-denominator explicitly noted as varying by tool (not standardized)
- WebSearch aggregation on trimmed-mean/median small-sample robustness — corroborates median over percentage-trimmed-mean at n ≈ 3–10

### Tertiary (LOW confidence)
- None — all findings above were cross-checked across at least two independent sources or verified directly against this repo's source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; convention to preserve is directly observed in the existing codebase
- Architecture (formulas, clock-domain finding, completion-bridge gap): HIGH for the in-repo findings (verified by reading source this session with line citations); MEDIUM for the Monkeytype-formula cross-reference (DeepWiki summary of source, not the raw source file itself)
- Pitfalls: MEDIUM-HIGH — most are direct consequences of verified in-repo facts (clock domain, missing callback, polling interval purpose); the denominator/threshold ambiguities are genuine open interpretation gaps in `03-CONTEXT.md`, correctly flagged as Open Questions rather than asserted as fact

**Research date:** 2026-09-05
**Valid until:** 30 days (stable domain — typing-test formulas and this repo's own established conventions do not move fast)
