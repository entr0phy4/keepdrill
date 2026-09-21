---
phase: 09-scaffolded-trainer
reviewed: 2026-09-21T02:20:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/scaffold/slice.ts
  - src/scaffold/slice.test.ts
  - src/scaffold/cover.ts
  - src/scaffold/cover.test.ts
  - src/scaffold/flatten.ts
  - src/scaffold/flatten.test.ts
  - src/session.test.ts
  - src/session.ts
  - src/ui/FileScaffold.tsx
  - src/ui/FileScaffold.test.tsx
  - src/ui/App.tsx
  - src/ui/App.test.tsx
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-09-21T02:20:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the scaffold core (code-point slice, source-order cover, snapshot flatten, `assembleSessionFromLogs`) and the FileScaffold / App curriculum wiring. Unicode slicing, curriculum-vs-source role split, last-wins load, unit-only restart, last-unit persist, and XSS-as-text-nodes are sound. No critical defects. Five warnings: GitHub path never refreshes the timer-resolution banner; current-unit glyphs are double-padded versus static segments; in-flight `saveSession` rejection can attach to a later last-wins load; flattened logs have no unit boundary so slowest-5 / heatmap eat the advance pause; persisted sessions cannot be re-scored correctly if `METRICS_SCHEMA_VERSION` changes.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Scaffold path freezes the timer-resolution banner

**File:** `src/ui/App.tsx:108-122`, `src/ui/App.tsx:202-215`
**Issue:** `startScaffold` never calls `setTimingResolutionUs`, and the 250ms `buildSession` interval bails out whenever `curriculum !== null`. Capture still records measured resolution into `isolation.ts`, and last-unit persist probes it into the stored `Session`, but the visible "Timer resolution: N µs" banner stays at the first-paint (or last paste-session) value for the entire GitHub file. That reopens the Phase 4 WR-01 hole on the new primary path.
**Fix:** Probe on scaffold start and keep the interval running (or probe from the existing capture keydown tap) while a curriculum is active. Do not call `buildSession()` against the live last-unit buffer for persist — only for the banner figure:

```ts
const startScaffold = (plan: FilePlan) => {
  // ...existing reset...
  setTimingResolutionUs(probeTimerResolutionUs())
}

useEffect(() => {
  if (exercise === null) return
  const id = setInterval(() => {
    setTimingResolutionUs(probeTimerResolutionUs())
    if (curriculumRef.current === null) {
      const current = loadRef.current
      if (!current) return
      const session = buildSession(current.exercise, current.startedAt)
      sessionRef.current = session
      if (import.meta.env.DEV) window.__keebdrillSession = session
    }
  }, SESSION_REFRESH_MS)
  return () => clearInterval(id)
}, [exercise])
```

### WR-02: Current-unit glyphs are inset twice versus done/future/gap

**File:** `src/ui/FileScaffold.tsx:58-69`, `src/ui/FileScaffold.tsx:139-169`
**Issue:** Static `<pre>` segments correctly use `padding: var(--space-md)` to match `.trainer-stack > *`. The current card applies that same padding *around* `CaptureSurface`, whose overlay/textarea already have `padding: var(--space-md)` (and a 1px transparent border). Source glyphs in the current unit sit ~16px+1px further in than the static file chrome, so the file does not read as one column.
**Fix:** Do not pad the current card; let `.trainer-stack` own the inset. Keep the surface/border/radius on the wrapper:

```tsx
<div
  key={seg.unit.id}
  ref={currentCardRef}
  data-scaffold-current=""
  style={{
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '6px',
    padding: 0,
  }}
>
```

If the extra 1px card border still shifts the column, use a transparent 1px border on the static `<pre>` as well (same trick `.trainer-stack > *` already uses).

### WR-03: In-flight save failure can attach to a later last-wins load

**File:** `src/ui/App.tsx:155-158`, `src/ui/App.tsx:87-122`
**Issue:** Last-unit (and paste) persist is fire-and-forget. `startScaffold` / `handleLoad` clear `saveFailed` immediately, but a later rejection from the *previous* `saveSession` still calls `setSaveFailed(true)` with no generation token. Clicking another GitHub file (D-10 last-wins) while Dexie is still writing the completed file can show `SaveFailedNotice` on the new exercise even when that write has not failed — or hide a failure that belongs to the abandoned file.
**Fix:** Latch a monotonic persist generation and ignore stale catches:

```ts
const persistGenRef = useRef(0)

// in startScaffold / handleLoad / handleRestart:
persistGenRef.current += 1
setSaveFailed(false)

const gen = persistGenRef.current
void saveSession({ session, completedAt, metricsSnapshot: result }).catch((err: unknown) => {
  console.warn('[keebdrill] session not persisted:', err)
  if (gen === persistGenRef.current) setSaveFailed(true)
})
```

### WR-04: Flattened logs have no unit boundary; first glyph of the next unit eats the advance pause

**File:** `src/scaffold/flatten.ts:15-18`, `src/ui/App.tsx:147-150`
**Issue:** `flattenSnapshots` concatenates `charLog` / `events` in snapshot order with no separator. `replayAttempts` and `computeKeyboardHeatmap` both take `tMs` deltas between consecutive records. The gap between the last commit of unit N and the first commit of unit N+1 includes remount + reading time and is attributed to the first character / key of the next unit. If that gap is inside the exclusive (25ms, 1000ms) gate, it pollutes slowest-5 and the heatmap. `computeActiveElapsedMs` also counts that pause as active time (file-level WPM), which may be acceptable, but the per-glyph attribution is not.
**Fix:** When flattening, drop the first latency sample of each snapshot after the first — cheapest: do not let `replayAttempts` see a cross-snapshot delta. Either insert an explicit unit-separator marker (CONTEXT discretion) and skip gaps after that marker, or flatten with a per-snapshot `prevTMs` reset that analytics can honor. Minimum viable change for metrics computed in `handleComplete`:

```ts
// flattenSnapshots: keep arrays concat, but App can strip the first
// charLog/events row's "incoming" gap by recording snapshot lengths
// and teaching replayAttempts/heatmap to reset prevTMs at those indexes.
```

If you do not want to change metrics modules this phase, splice a no-op boundary into each snapshot after the first (`inputType` that `replayAttempts` ignores and heatmap skips) — do not leave the raw concat as the persisted log.

### WR-05: Persisted scaffold sessions cannot be re-scored against `exercise.text`

**File:** `src/session.ts:33-47`, `src/ui/App.tsx:147-150`
**Issue:** Last-unit metrics correctly use `joinUnitSlices` (curriculum order) while `Session.exercise.text` stays the source-order file. Nothing in the stored row records that typed target. `resolveMetrics` (History / Analytics) recomputes with `s.exercise.text` whenever `metricsSnapshot.schemaVersion !== METRICS_SCHEMA_VERSION`. The next metrics schema bump will silently score leaves-first `charLog` against source-order file text: wrong WPM, accuracy, and slowest-5 for every GitHub row.
**Fix:** Persist the metrics target with the session (additive field on `Session` / `StoredSession`), and pass it into `resolveMetrics`. Until Dexie can change, at least store it on `metricsSnapshot` or a sibling blob so a schema bump does not fall back to `exercise.text`:

```ts
export function assembleSessionFromLogs(
  exercise: Exercise,
  logs: Pick<Session, 'events' | 'charLog' | 'markers'>,
  startedAt: number,
): Session {
  return {
    exercise,
    events: logs.events,
    charLog: logs.charLog,
    markers: logs.markers,
    timingResolutionUs: probeTimerResolutionUs(),
    crossOriginIsolated: readCrossOriginIsolated(),
    startedAt,
  }
}

// App last-unit persist:
const typedTarget = joinUnitSlices(current.exercise.text, units)
const result = computeSessionMetrics(typedTarget, session.charLog, session.markers, completedAt)
```

Wire `resolveMetrics` to prefer a stored `typedTarget` (even if that wiring lands in the next metrics phase — this phase must not persist a row that can only be scored one way).

## Info

### IN-01: Scaffold never updates `sessionRef` / `__keebdrillSession`

**File:** `src/ui/App.tsx:121`, `src/ui/App.tsx:202-203`
**Issue:** `startScaffold` sets `sessionRef.current = null` and the refresh interval is skipped, so a prior paste snapshot can linger on `window.__keebdrillSession` in DEV, and last-unit flatten never writes the assembled session back to the inspection point.
**Fix:** Assign the assembled session at last-unit persist, and clear `window.__keebdrillSession` in `startScaffold`.

### IN-02: Unit restart does not re-run `scrollIntoView`

**File:** `src/ui/FileScaffold.tsx:98-104`
**Issue:** The layout effect depends only on `unitIndex`. Escape / Restart unit bump `loadToken` without changing `unitIndex`, so a user who scrolled the current card off-screen is not brought back.
**Fix:** Add `loadToken` to the effect deps.

### IN-03: `prefers-reduced-motion` is sampled only on `unitIndex` change

**File:** `src/ui/FileScaffold.tsx:22-28`, `src/ui/FileScaffold.tsx:98-104`
**Issue:** `matchMedia` is read inside the effect, not subscribed. Toggling OS reduced-motion between advances keeps the previous `behavior`.
**Fix:** Subscribe to `change` on that media query, or read it at call time *and* depend on a stored `reduce` flag.

---

_Reviewed: 2026-09-21T02:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
