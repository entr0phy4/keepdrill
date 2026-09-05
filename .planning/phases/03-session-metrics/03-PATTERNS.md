# Phase 3: Session Metrics - Pattern Map

**Mapped:** 2026-09-05
**Files analyzed:** 4 (2 new, 2 modified)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/metrics/metrics.ts` | utility (pure computation module) | transform (fold over `charLog`) | `src/trainer/active-time.ts` (secondary: `src/trainer/state.ts`) | exact |
| `src/metrics/metrics.test.ts` | test | transform | `src/trainer/active-time.test.ts` (secondary: `src/trainer/state.test.ts`) | exact |
| `src/ui/ResultsView.tsx` | component | request-response (pure display of a computed result) | `src/ui/Banners.tsx` | role-match |
| `src/ui/CaptureSurface.tsx` (MODIFIED — add `onComplete` prop) | component | event-driven (completion callback) | itself — extend existing `onRestartRequested` prop pattern in the same file | exact (self-analog) |
| `src/ui/App.tsx` (MODIFIED — wire completion → metrics → ResultsView) | component (top-level orchestrator) | event-driven / request-response | itself — extend existing `handleRestart`/`sessionRef` wiring in the same file | exact (self-analog) |

## Pattern Assignments

### `src/metrics/metrics.ts` (utility, transform)

**Analog:** `src/trainer/active-time.ts` (module shape/header/purity convention) + `src/trainer/state.ts` (reducer-over-charLog shape)

**Header/purity comment pattern** (`active-time.ts` lines 1-8):
```typescript
// PURE — zero DOM access, zero runtime imports (only `import type`). D-09.
// Toggle-state-machine over CaptureMarker[] (02-RESEARCH.md Pattern 4,
// verbatim), NOT pair-matching by index — robust to overlapping/duplicate
// blur+hidden pairs and out-of-order/duplicate focus/visible markers, since a
// second "go inactive" marker while already inactive (or a stray "go active"
// marker while already active) is a no-op. Locked by the golden cases in
// active-time.test.ts. Phase 2 does not display this value to the user
// (D-09) — Phase 3 consumes it directly.
```
Copy this exact shape for `metrics.ts`'s header: state which D-NN decisions govern the module (D-01..D-04 per `03-CONTEXT.md`), name the locking test file (`metrics.test.ts`), and state an explicit "do NOT" list (do NOT read `TrainerState.perCharStatus` for accuracy — D-02; do NOT use `Date.now()`/`Session.startedAt` as `now` — Pitfall 1; do NOT round inside this module — Pitfall 5).

**Imports pattern** (`active-time.ts` line 10, `state.ts` line 10):
```typescript
import type { CommittedChar, CaptureMarker } from '../capture/types'
```
`metrics.ts` should import only `import type { CommittedChar, CaptureMarker } from '../capture/types'` and, if the `now` value is threaded via `TrainerState`, `import type { TrainerState } from '../trainer/state'`. Also re-export/import `computeActiveElapsedMs` as a real (non-type) import since it's a function call:
```typescript
import { computeActiveElapsedMs } from '../trainer/active-time'
```

**Core reducer pattern — mirror `state.ts`'s delete/insert branching** (`state.ts` lines 22-61):
```typescript
export function computeTrainerState(target: string, charLog: readonly CommittedChar[]): TrainerState {
  const perCharStatus: PerCharStatus[] = new Array(target.length).fill('pending')
  const wasEverWrong: boolean[] = new Array(target.length).fill(false)
  let cursor = 0
  let completedAt: number | null = null

  for (const rec of charLog) {
    // 1. Delete branch — every delete* inputType moves the cursor back exactly
    //    one position (D-05/D-11), guarded at 0 (idempotent no-op at start).
    if (rec.inputType.startsWith('delete')) {
      if (cursor > 0) {
        cursor -= 1
        perCharStatus[cursor] = 'pending'
      }
      continue
    }
    // 2. Insert branch — iterate rec.data per JS code point (for...of, not
    //    UTF-16 units), so an IME multi-codepoint commit scores every
    //    position in a single record. Stops once the target is exhausted.
    for (const ch of rec.data ?? '') {
      if (cursor >= target.length) break
      if (ch === target[cursor]) {
        perCharStatus[cursor] = 'correct'
      } else {
        perCharStatus[cursor] = 'incorrect'
        wasEverWrong[cursor] = true
      }
      cursor += 1
    }
    if (completedAt === null && cursor >= target.length) {
      completedAt = rec.tMs
    }
  }
  // ... aggregate pass
}
```
The new `replayAttempts()` function (RESEARCH.md Pattern 1) is a sibling reducer with the identical delete/insert split, cursor-tracking, and `rec.data ?? ''` code-point iteration — but instead of writing into `perCharStatus` (which collapses history, per D-02), it accumulates every insert-branch attempt into `correctAttempts`/`incorrectAttempts` counters and a `Map<string, number[]>` of latency gaps keyed by the committed character. Copy the exact `for (const rec of charLog) { if (rec.inputType.startsWith('delete')) {...; continue} for (const ch of rec.data ?? '') {...} }` control flow verbatim — this is the established, tested shape for folding `charLog`.

**Time-basis integration** (`active-time.ts` lines 12-16, function signature convention):
```typescript
export function computeActiveElapsedMs(
  charLog: readonly CommittedChar[],
  markers: readonly CaptureMarker[],
  now: number,
): number {
```
`metrics.ts`'s top-level export should follow the identical primitives-in signature style (per CONTEXT.md's "Module shape" discretion note):
```typescript
export function computeSessionMetrics(
  target: string,
  charLog: readonly CommittedChar[],
  markers: readonly CaptureMarker[],
  now: number,
): MetricsResult {
  const elapsedMs = computeActiveElapsedMs(charLog, markers, now) // D-01
  const { correctAttempts, incorrectAttempts, latencySamplesByChar } = replayAttempts(target, charLog) // D-02
  const wpm = computeWpm(correctAttempts, elapsedMs) // Pitfall 2 guard: elapsedMs <= 0 -> 0
  const accuracy = computeAccuracy(correctAttempts, correctAttempts + incorrectAttempts)
  const slowest5 = slowestFive(latencySamplesByChar) // D-03/D-04, Pattern 2
  return { schemaVersion: 1, wpm, accuracy, slowest5 }
}
```

**Error/edge-case handling pattern** (`active-time.ts` lines 18, 39-43 — guard-and-return-zero convention, not throw/try-catch):
```typescript
const first = charLog[0]
if (first === undefined) return 0 // no keystroke yet — D-09: elapsed is 0
...
if (inactiveSince !== null) {
  totalInactiveMs += Math.max(0, now - inactiveSince)
}
return Math.max(0, now - t0 - totalInactiveMs)
```
This codebase's pure modules never throw — they guard degenerate inputs and return a safe default (`0`, `1`, empty array). Apply the same convention to `computeWpm`'s Pitfall-2 guard (`elapsedMs <= 0 -> return 0`) and `computeAccuracy`'s zero-denominator guard (`totalAttempts === 0 -> return 1`), both already given verbatim in RESEARCH.md's Code Examples section.

---

### `src/metrics/metrics.test.ts` (test, transform)

**Analog:** `src/trainer/active-time.test.ts` (golden-case-table convention, small/self-contained fixture builders) and `src/trainer/state.test.ts` (Case interface + `it.each` shape)

**Golden-case-table pattern** (`state.test.ts` lines 1-26, 103-112):
```typescript
import { describe, it, expect } from 'vitest'
import { computeTrainerState, glyphFor } from './state'
import type { CommittedChar } from '../capture/types'

function char(seq: number, inputType: string, data: string | null, tMs: number): CommittedChar {
  return Object.freeze({ seq, inputType, data, tMs })
}

interface Case {
  n: number
  name: string
  target: string
  charLog: CommittedChar[]
  expected: Partial<{ /* ... */ }>
}

const cases: Case[] = [ /* ... */ ]

describe('computeTrainerState() — golden cases (TYPE-01/02/03)', () => {
  it.each(cases)('case $n: $name', ({ target, charLog, expected }) => {
    const result = computeTrainerState(target, charLog)
    if (expected.perCharStatus !== undefined) expect(result.perCharStatus).toEqual(expected.perCharStatus)
    // ...
  })
})
```
Also mirror `active-time.test.ts`'s small fixture-builder helpers (`char(tMs)`, `marker(kind, tMs)`) — `metrics.test.ts` needs an equivalent `char(seq, inputType, data, tMs)` plus reuse of `active-time.test.ts`'s `marker(kind, tMs)` shape for constructing `CaptureMarker` fixtures, since `computeSessionMetrics` takes both `charLog` and `markers`. Cover at minimum: D-02's corrected-position denominator case (2 attempts for 1 corrected position), D-03's grouping-by-logical-character case (`{` vs `[` as distinct entries), D-04's exactly-2-vs-exactly-3-post-filter-samples boundary, Pitfall 2's zero-elapsed-time WPM guard, and Pitfall 7's multi-codepoint IME record (only the last codepoint gets a latency sample).

---

### `src/ui/ResultsView.tsx` (component, request-response)

**Analog:** `src/ui/Banners.tsx` (small, prop-driven, no-internal-state display component; conditional-render-by-gate convention)

**Full analog structure** (`Banners.tsx`, entire file):
```typescript
interface BannersProps {
  crossOriginIsolated: boolean
  timingResolutionUs: number
}

export function Banners({ crossOriginIsolated, timingResolutionUs }: BannersProps) {
  return (
    <div className="banners" style={{ display: 'grid', gap: 'var(--space-sm)' }}>
      {crossOriginIsolated !== true && (
        <p className="banner banner--warning" role="status">
          ...
        </p>
      )}
      <p className="banner" role="note">
        ...
      </p>
    </div>
  )
}
```
Copy this exact shape for `ResultsView`: a typed props interface taking the already-computed `MetricsResult` (never recomputing metrics itself — pure display, matches `Banners` receiving already-derived `crossOriginIsolated`/`timingResolutionUs` rather than computing them), a single wrapping `<div>`/`<section>` with an inline `style={{ display: 'grid', gap: 'var(--space-...)' }}` (matches UI-SPEC's grid-based internal layout), and conditional-render blocks gated on a boolean (here: `metrics.slowest5.length >= 1` vs. the "not enough data" fallback, mirroring `Banners`' `crossOriginIsolated !== true &&` gate). Per UI-SPEC, add `role="status" aria-live="polite"` on the panel container — same `role="status"` attribute `Banners.tsx`'s warning `<p>` already uses, just lifted to the outer container per this phase's spec.

**Whitespace-glyph reuse for the slowest-key chip** (`state.ts` lines 73-86, `CaptureSurface.tsx` lines 163-169):
```typescript
export function glyphFor(char: string): string {
  if (char === ' ') return '·'
  if (char === '\n') return '↵'
  return char
}
```
and its call site:
```typescript
const isWhitespaceGlyph = targetChar === ' ' || targetChar === '\n'
...
{isWhitespaceGlyph ? <span className="ws-glyph">{glyphFor(targetChar)}</span> : targetChar}
```
UI-SPEC requires a slowest-key entry whose character is space/newline to render via this exact glyph convention — import and reuse `glyphFor` from `src/trainer/state.ts` directly in `ResultsView.tsx` rather than reimplementing the mapping.

**Plain-JSX-text security pattern** (`CaptureSurface.tsx` line 163, matches RESEARCH.md's V5 ASVS note):
```typescript
const targetChar = text[i] ?? ''
...
{targetChar}
```
Render every user-derived character (target text char, slowest-key char) as a plain JSX text child — never `dangerouslySetInnerHTML` — exactly as `CaptureSurface.tsx` already does.

---

### `src/ui/CaptureSurface.tsx` (MODIFIED — add `onComplete` prop) (component, event-driven)

**Analog:** its own existing `onRestartRequested` prop (same file)

**Existing prop pattern to mirror** (`CaptureSurface.tsx` lines 51-57, 108-121):
```typescript
export function CaptureSurface({
  text,
  onRestartRequested,
}: {
  text: string
  onRestartRequested?: () => void
}) {
  ...
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (!e.isTrusted) return
    if (e.key === 'Escape') {
      e.preventDefault()
      onRestartRequested?.()
      return
    }
    ...
  }
```
Add `onComplete?: (completedAt: number) => void` to the same destructured props object, following this exact optional-callback-prop shape. Per D-07/Pattern 3, fire it from a `useEffect` keyed on the locally-computed `completedAt` (from `computeTrainerState(text, getCharLog())`, line 131), guarded with a ref so it fires exactly once per non-null transition:
```typescript
const { perCharStatus, cursor, completedAt } = computeTrainerState(text, getCharLog())
const firedCompletedAtRef = useRef<number | null>(null)
useEffect(() => {
  if (completedAt !== null && firedCompletedAtRef.current !== completedAt) {
    firedCompletedAtRef.current = completedAt
    onComplete?.(completedAt)
  }
}, [completedAt, onComplete])
```
This mirrors the existing `useEffect(() => { ref.current?.focus() }, [])` / `useEffect(() => { document.addEventListener(...) ...}, [])` effect-per-concern style already used in this component (lines 84-106) — one small, single-purpose effect, not folded into the render-body logic.

---

### `src/ui/App.tsx` (MODIFIED — wire completion → metrics → ResultsView) (component, event-driven / request-response)

**Analog:** its own existing `handleRestart` + `sessionRef`/`loadRef` state-lifting pattern (same file)

**State-lifting and fresh-snapshot pattern to mirror** (`App.tsx` lines 45-46, 67-80):
```typescript
const sessionRef = useRef<Session | null>(null)
const loadRef = useRef<{ exercise: Exercise; startedAt: number } | null>(null)

const handleRestart = () => {
  const current = loadRef.current
  if (!current) return
  resetCapture()
  setLoadToken((token) => token + 1)
  const startedAt = Date.now()
  loadRef.current = { exercise: current.exercise, startedAt }
  const session = buildSession(current.exercise, startedAt)
  sessionRef.current = session
  setTimingResolutionUs(session.timingResolutionUs)
  if (import.meta.env.DEV) {
    window.__keebdrillSession = session
  }
}
```
Add a new `handleComplete(completedAt: number)` following the same "grab current loadRef, call `buildSession` fresh (never a cached `sessionRef.current`, per `session.ts`'s own CR-01 comment), then compute a derived result and store it in new state" shape:
```typescript
const [metrics, setMetrics] = useState<MetricsResult | null>(null)

const handleComplete = (completedAt: number) => {
  const current = loadRef.current
  if (!current) return
  const session = buildSession(current.exercise, current.startedAt) // fresh, CR-01
  const result = computeSessionMetrics(current.exercise.text, session.charLog, session.markers, completedAt)
  setMetrics(result)
}
```
Reset `metrics` to `null` inside the existing `handleRestart` (add `setMetrics(null)` alongside its other reset calls) — mirrors D-06's "restarting discards the just-computed metrics."

**Conditional-render-by-gate pattern** (`App.tsx` lines 114-129):
```typescript
{exercise === null ? (
  <section>...</section>
) : (
  <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
    <CaptureSurface key={loadToken} text={exercise.text} onRestartRequested={handleRestart} />
    <button type="button" className="primary" onClick={handleRestart}>
      Restart exercise
    </button>
  </div>
)}
```
Insert `ResultsView` between `CaptureSurface` and the Restart button, gated on `metrics !== null` (matching UI-SPEC's DOM-order requirement and this file's existing `{condition && <X/>}` idiom already used in `Banners`'s gate and this same ternary's null-check):
```typescript
<CaptureSurface key={loadToken} text={exercise.text} onRestartRequested={handleRestart} onComplete={handleComplete} />
{metrics !== null && <ResultsView metrics={metrics} />}
<button type="button" className="primary" onClick={handleRestart}>
  Restart exercise
</button>
```

## Shared Patterns

### Pure-module header/purity convention
**Source:** `src/trainer/active-time.ts` lines 1-8, `src/trainer/state.ts` lines 1-8
**Apply to:** `src/metrics/metrics.ts`
Every pure module in this codebase opens with a comment block stating (1) "PURE — zero DOM access, zero runtime imports (only `import type`)", (2) which D-NN decisions govern the logic, (3) which `.test.ts` file locks it via golden cases, (4) an explicit "do NOT" list of tempting-but-wrong shortcuts. `metrics.ts` must follow this exactly, citing D-01 (active-time basis), D-02 (attempt-replay denominator), D-03 (logical-character grouping), D-04 (min-sample gate), and the "do NOT use `Session.startedAt`/`Date.now()` as `now`" warning from Pitfall 1.

### Guard-and-return-default over throw/try-catch
**Source:** `src/trainer/active-time.ts` lines 18, 39-43
**Apply to:** `src/metrics/metrics.ts`'s `computeWpm`/`computeAccuracy`/`slowestFive` functions
No pure module in this codebase throws on a degenerate input; each guards and returns a safe default (`0` elapsed, and per RESEARCH.md's own code examples, `0` WPM at `elapsedMs <= 0` and `1` (100%) accuracy at `totalAttempts === 0`). Apply uniformly rather than introducing new error-throwing behavior.

### `event.isTrusted` guard on side-effecting handlers
**Source:** `src/ui/CaptureSurface.tsx` line 113 (`if (!e.isTrusted) return`)
**Apply to:** No new keydown handling is added in this phase (UI-SPEC: "this phase adds no new keydown handling"), so this guard is not newly needed — noted here only because RESEARCH.md/CONTEXT.md flag it as an established convention should any future keyboard interaction be added to `ResultsView`.

### Golden-case-table test convention (`Case`/`it.each`)
**Source:** `src/trainer/state.test.ts` lines 13-26, 103-112; `src/trainer/active-time.test.ts` lines 9-16 (fixture builders `char()`/`marker()`)
**Apply to:** `src/metrics/metrics.test.ts`
Define a `Case` interface with `n`, `name`, inputs, and a `Partial<{...}>` `expected` shape; iterate with `it.each(cases)('case $n: $name', ...)`; only assert fields present in `expected` (the `if (expected.X !== undefined) expect(...)` guard pattern). Reuse tiny local fixture-builder functions rather than constructing raw object literals inline.

### Plain-JSX-text rendering (XSS-safety via React's default escaping)
**Source:** `src/ui/CaptureSurface.tsx` line 163-169 (`{targetChar}`, never `dangerouslySetInnerHTML`)
**Apply to:** `src/ui/ResultsView.tsx` — every user-derived character (slowest-key glyph, any target-text-derived display) must render as a plain JSX text child.

### Grid-based inline-style layout with CSS custom-property spacing tokens
**Source:** `src/ui/App.tsx` line 102 (`style={{ display: 'grid', gap: 'var(--space-lg)' }}`), `src/ui/Banners.tsx` line 17 (`style={{ display: 'grid', gap: 'var(--space-sm)' }}`)
**Apply to:** `src/ui/ResultsView.tsx`'s outer container and internal stat-row grid, per UI-SPEC's `--space-lg`/`--space-md`/`--space-xs` gaps — same inline-style-with-CSS-var idiom, no new CSS file/module needed (matches this project's "hand-rolled CSS custom properties, no component library" convention).

## No Analog Found

None — all four files (new module, new test, new component, two modified components) have a strong existing analog in the codebase, either from the `trainer/` pure-module pair (`state.ts`/`active-time.ts`) or from `App.tsx`/`CaptureSurface.tsx`/`Banners.tsx`'s own established patterns (self-analogs for the two modified files).

## Metadata

**Analog search scope:** `src/trainer/`, `src/ui/`, `src/capture/`, `src/session.ts`, `src/ingestion/` (for the test-table convention origin)
**Files scanned:** `state.ts`, `state.test.ts`, `active-time.ts`, `active-time.test.ts`, `capture/types.ts`, `session.ts`, `ui/App.tsx`, `ui/CaptureSurface.tsx`, `ui/Banners.tsx`, `ingestion/normalize.test.ts` (referenced, not re-read this session — confirmed convention via `state.test.ts`'s own comment citing it)
**Pattern extraction date:** 2026-09-05
