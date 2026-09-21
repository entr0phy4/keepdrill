# Phase 9: Scaffolded Trainer - Pattern Map

**Mapped:** 2026-09-20
**Files analyzed:** 12
**Analogs found:** 12 / 12

File list is from `09-RESEARCH.md` Recommended Project Structure + Open Question 3 (add `assembleSessionFromLogs` next to `buildSession`, tested beside it). `09-UI-SPEC.md` COPY/layout contracts bind `FileScaffold.tsx` and `App.tsx` only.

**Do not create or modify:** `src/ui/CaptureSurface.tsx` (props stay `{ text, onRestartRequested, onComplete }`), `src/capture/capture.ts` (D-20), `src/ui/RepoBrowser.tsx`, `src/ui/HistoryView.tsx` (D-21 ternary already landed), `src/parse/types.ts`, `src/parse/plan.ts` (do not recreate as `scaffold/plan.ts`), `src/persistence/*`, `src/github/client.ts`. RESEARCH did not need `src/index.css` — FileScaffold reuses existing classes + inline CSS vars like `App.tsx` / `RepoBrowser.tsx`.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/scaffold/slice.ts` | utility | transform | `src/trainer/state.ts` `Array.from` + `src/parse/utf16.ts` | exact |
| `src/scaffold/slice.test.ts` | test | transform | `src/parse/utf16.test.ts` | exact |
| `src/scaffold/cover.ts` | utility | transform | `src/parse/plan.ts` `fallbackPlan` + `orderByDeps` sort-by-`start` | role-match |
| `src/scaffold/cover.test.ts` | test | transform | `src/parse/plan.test.ts` `CoverCase` tables | role-match |
| `src/scaffold/flatten.ts` | utility | transform | `src/session.ts` `buildSession` + `src/persistence/repository.ts` freeze-copy | role-match |
| `src/scaffold/flatten.test.ts` | test | transform | `src/trainer/state.test.ts` golden `Object.freeze` rows | role-match |
| `src/ui/FileScaffold.tsx` | component | event-driven | `src/ui/CaptureSurface.tsx` overlay split + `src/ui/RepoBrowser.tsx` `COPY`/`role="status"` + `src/ui/ResultsView.tsx` `aria-live` | role-match |
| `src/ui/FileScaffold.test.tsx` | test | event-driven | `src/ui/CaptureSurface.test.tsx` + `src/ui/App.test.tsx` FilePlan fixture | role-match |
| `src/ui/App.tsx` | component | event-driven | itself — `handleLoad` / `handleRestart` / `handleComplete` / `loadToken` | exact (in-place) |
| `src/ui/App.test.tsx` | test | event-driven | itself — invert idle `onPlanned`; reuse persist + trusted-input helpers | exact (in-place) |
| `src/session.ts` | utility | transform | itself — sibling `assembleSessionFromLogs` beside `buildSession` | exact (in-place) |
| `src/session.test.ts` | test | transform | `src/parse/utf16.test.ts` (node `unit` project; no existing `session.test.ts`) | role-match |

---

## Pattern Assignments

### `src/scaffold/slice.ts` (utility, transform)

**Analog:** `src/trainer/state.ts` lines 22–32 (code-point array) and `src/parse/utf16.ts` lines 1–6. `PlanUnit.start`/`end` are exclusive code-point offsets (`src/parse/types.ts` lines 1–3). Never `String.slice` on `exercise.text`.

**Imports pattern** — PURE, zero runtime imports (same file-lead as `utf16.ts` / `plan.ts`):

```typescript
// PURE — zero DOM, zero React, zero WASM. PlanUnit start/end are exclusive
// code-point offsets into Array.from(exercise.text) (parse/types.ts).
```

**Core pattern** (`trainer/state.ts` lines 31–32 + RESEARCH Pattern 1):

```typescript
const targetChars = Array.from(target)
```

```typescript
export function utf16ToCodePoint(text: string, utf16Index: number): number {
  return Array.from(text.slice(0, utf16Index)).length
}
```

Copy this exact slice:

```typescript
export function sliceUnit(text: string, start: number, end: number): string {
  return Array.from(text).slice(start, end).join('')
}
```

**Do not** call `exercise.text.slice(unit.start, unit.end)` — that is UTF-16 (`parse/types.ts` comment; Phase 3 uncompletable-exercise bug).

---

### `src/scaffold/slice.test.ts` (test, transform)

**Analog:** `src/parse/utf16.test.ts` lines 1–34. Node `unit` project. No DOM. Golden supplementary-plane char **inside** a unit and **in a gap**.

**Imports + emoji fixture** (lines 1–5):

```typescript
import { describe, expect, it } from 'vitest'
import { utf16ToCodePoint } from './utf16'

// U+1F600 is one Unicode code point and two UTF-16 code units.
const EMOJI = '😀'
```

**Core pattern** — assert `Array.from` length ≠ `String.length` (lines 28–34):

```typescript
  it('counts an emoji inside a range as the character that shifts a later index', () => {
    const text = `f(${EMOJI})`
    const closeUtf16 = text.indexOf(')')
    expect(utf16ToCodePoint(text, closeUtf16)).toBe(3)
    expect(text.length).toBe(5)
    expect(Array.from(text).length).toBe(4)
  })
```

Slice tests: `sliceUnit('a😀b', 1, 2) === '😀'`; a UTF-16 `String.slice` from the same numbers must **fail** that golden.

---

### `src/scaffold/cover.ts` (utility, transform)

**Analog:** `src/parse/plan.ts` `fallbackPlan` (full-file one unit, no gaps) and `orderByDeps` sort-by-`start`. No existing source-order segmenter — hand-roll `coverFile` from RESEARCH Pattern 2. Do **not** copy `planUnits` / Kahn topo; curriculum order already lives on `FilePlan.units`.

**Imports** — types only (`plan.ts` lines 5–7):

```typescript
import type { Exercise } from '../ingestion/types'
import type { FilePlan, PlanUnit, PlanUnitKind, TsNode } from './types'
import { utf16ToCodePoint } from './utf16'
```

Cover imports `PlanUnit` from `../parse/types` and `sliceUnit` from `./slice`. No WASM, no React.

**Full-cover fallback analog** (`plan.ts` lines 30–38) — one unit `[0, Array.from(text).length)` means cover emits **no gaps**:

```typescript
export function fallbackPlan(exercise: Exercise, notice: string): FilePlan {
  const end = Array.from(exercise.text).length
  return {
    exercise,
    fallback: true,
    notice,
    units: [{ id: 'file', kind: 'file', start: 0, end, dependsOn: [] }],
  }
}
```

**Sort-by-start analog** (`plan.ts` lines 253, 266) — chrome sorts a **copy**; do not mutate `plan.units` (that array is typing/curriculum order):

```typescript
  const ready = units.filter((u) => indeg.get(u.id) === 0).sort((a, b) => a.start - b.start)
  // ...
  const leftover = units.filter((u) => !out.includes(u)).sort((a, b) => a.start - b.start)
```

**Core pattern to implement** (RESEARCH Pattern 2 — no live analog). Segments are states, not three stacked curriculum-order blocks. Classify role from the unit's index in **curriculum** `units` vs `unitIndex`. Fill holes (`start > cursor`) as `{ kind: 'gap' }` so SCAF-01 paints trivia / skipped `ERROR` nodes. `plan.ts` walks named children only and skips `ERROR` (lines 53–56) — those holes are why gaps exist.

Gap role is **not** muted-as-future: render like done (canonical `--color-text`). After last-unit persist, every unit role is `done`.

---

### `src/scaffold/cover.test.ts` (test, transform)

**Analog:** `src/parse/plan.test.ts` lines 1–8 and 55–62 (`CoverCase` table already names this idea). Fixtures are `PlanUnit[]` + text, **not** `planUnits(realTree)`.

**Imports + exercise helper** (lines 1–8):

```typescript
import { describe, expect, it } from 'vitest'
import type { Exercise } from '../ingestion/types'
import { fallbackPlan, planUnits } from './plan'
import type { PlanUnit, PlanUnitKind, TsNode } from './types'

function exercise(text: string): Exercise {
  return { text, language: 'typescript', sourceType: 'paste' }
}
```

Use `sourceType: 'github'` when the fixture represents a GitHub file; cover itself only needs `text` + units.

**Must cover:** two units with a blank line between → one `gap` segment whose slice equals that trivia; fallback 1-unit `[0, len)` → no gaps; leaves-first curriculum (`function b` then `function a`) still emits source-order `a` then `b`; emoji in a gap counted as one code point.

---

### `src/scaffold/flatten.ts` (utility, transform)

**Analog:** `src/session.ts` `buildSession` (live read of the three logs) and `src/persistence/repository.ts` freeze-copy (never mutate frozen rows). After per-unit `resetCapture`, live buffers are the **last unit only** — flatten concatenated snapshots instead of calling `buildSession()`.

**Live-read contract to leave unchanged** (`session.ts` lines 18–28):

```typescript
export function buildSession(exercise: Exercise, startedAt: number): Session {
  return {
    exercise,
    events: getEvents(),
    charLog: getCharLog(),
    markers: getMarkers(),
    timingResolutionUs: probeTimerResolutionUs(), // combined measured+expected (A10)
    crossOriginIsolated: readCrossOriginIsolated(),
    startedAt,
  }
}
```

Flatten only concatenates snapshot arrays. Isolation probes stay in `assembleSessionFromLogs` (`session.ts`), not here.

**Frozen-row copy analog** (`repository.ts` lines 18–22) — `getEvents()` objects are `Object.freeze`d (`capture.ts` lines 46–53). Remap `seq` by spreading to **new** objects:

```typescript
    events: [...input.session.events],
    charLog: [...input.session.charLog],
    markers: [...input.session.markers],
```

**Freeze at push** (`capture.ts` lines 52–53) — do not mutate:

```typescript
  buffer.push(
    Object.freeze({
```

**Core flatten** (RESEARCH Code Examples). Concatenate the three arrays separately; metrics/analytics do not join on `seq` across types (`capture/types.ts` lines 19–21: charLog reconciled by seq **within** a live session). Remap `seq` monotonically so later seq-joins are not confused:

```typescript
function flattenSnapshots(snaps: Snapshot[]): Pick<Session, 'events' | 'charLog' | 'markers'> {
  let seq = 0
  const events = snaps.flatMap((s) => s.events.map((e) => ({ ...e, seq: seq++ })))
  const charLog = snaps.flatMap((s) => s.charLog.map((c) => ({ ...c, seq: seq++ })))
  const markers = snaps.flatMap((s) => s.markers.map((m) => ({ ...m, seq: seq++ })))
  return { events, charLog, markers }
}
```

Unit-separator markers are optional (CONTEXT discretion) — not required for SCAF-03.

---

### `src/scaffold/flatten.test.ts` (test, transform)

**Analog:** `src/trainer/state.test.ts` lines 9–11 (`Object.freeze` row factory) + 2-unit concat assertion.

```typescript
function char(seq: number, inputType: string, data: string | null, tMs: number): CommittedChar {
  return Object.freeze({ seq, inputType, data, tMs })
}
```

**Must cover:** two snapshots concat → `charLog` contains both units' commits; `seq` unique after remap; frozen input objects unchanged (`expect(() => { (e as { seq: number }).seq = 99 }).toThrow` or equal original); a discarded in-progress restart is **not** in the snapshots array (restart never `push`es).

---

### `src/ui/FileScaffold.tsx` (component, event-driven)

**Analog:** `CaptureSurface.tsx` (chrome vs typeable overlay; `glyphFor`; `prefersReducedMotion`; do not grow CaptureSurface props), `RepoBrowser.tsx` (`COPY` const + reserved `role="status"`), `ResultsView.tsx` (`aria-live="polite"` live region). FileScaffold owns landmark + source-order regions and **mounts** CaptureSurface in the current card. It does **not** call persist `onComplete` and does **not** subscribe to rAF (`useCharLogTick` stays inside CaptureSurface only).

**COPY analog** (`RepoBrowser.tsx` lines 21–42; UI-SPEC const-ready). Verbatim from `09-UI-SPEC.md` — do not paraphrase:

```typescript
const COPY = {
  urlLabel: 'GitHub URL or owner/repo',
  // ...
  plannedOne: 'Planned 1 unit from {path}.',
  plannedMany: 'Planned {count} units from {path}.',
  fallback: "Couldn't split {path}. You'll type the whole file as one unit.",
} as const
```

FileScaffold COPY (UI-SPEC):

```typescript
const COPY = {
  landmark: '{n} / {m}',
  landmarkKindName: '{kind} {name}',
} as const

const KIND_LABEL = {
  import: 'import',
  function: 'function',
  class: 'class',
  type: 'type',
  other: '',
  file: 'file',
} as const
```

Landmark line 1: 1-based `n = unitIndex + 1`, spaces around slash (`3 / 12`). Kind `other` is never a visible word. PLAN-03 fallback notice stays in RepoBrowser status — **do not duplicate** on the chrome.

**Landmark live region analog** (`RepoBrowser.tsx` lines 294–304 + `ResultsView.tsx` lines 22–24):

```typescript
      <p
        className={isError ? 'repo-status' : 'repo-status text-muted'}
        role={isError ? 'alert' : 'status'}
        style={{
          margin: 0,
          color: isError ? 'var(--color-destructive)' : undefined,
        }}
      >
        {status?.text ?? ''}
      </p>
```

```typescript
    <section className="results-panel" role="status" aria-live="polite">
```

Landmark: `role="status"` `aria-live="polite"` `aria-atomic="true"` `min-height: 1.4em` (same WR-05 floor as CaptureSurface paste-block lines 228–235). `aria-label` = landmark + subtitle joined by `, `. Reserved height analog (`CaptureSurface.tsx` lines 228–235):

```typescript
      <p
        id="capture-paste-blocked"
        role="status"
        aria-hidden={!pasteBlocked}
        className="text-muted"
        style={{
          margin: 0,
          minHeight: '1.4em',
          opacity: pasteBlocked ? 1 : 0,
          transition: prefersReducedMotion() ? 'none' : 'opacity var(--motion-duration) ease',
        }}
      >
```

**CaptureSurface stays ignorant** (`CaptureSurface.tsx` lines 51–58 — do not grow props):

```typescript
export function CaptureSurface({
  text,
  onRestartRequested,
  onComplete,
}: {
  text: string
  onRestartRequested?: () => void
  onComplete?: (completedAt: number) => void
}) {
```

Mount as today (`App.tsx` lines 255–260) but `text={sliceUnit(...)}` and `key={loadToken}`:

```typescript
          <CaptureSurface
            key={loadToken}
            text={exercise.text}
            onRestartRequested={handleRestart}
            onComplete={handleComplete}
          />
```

**glyphFor static regions** (`CaptureSurface.tsx` lines 180–191 + `trainer/state.ts` lines 91–95). UI-SPEC locks reuse of `glyphFor` + `.ws-glyph` at Body 15/1.5. React text / spans only — **no** `innerHTML` / `dangerouslySetInnerHTML`:

```typescript
  const textChars = Array.from(text)
  const nodes: ReactNode[] = []
  for (let i = 0; i < textChars.length; i++) {
    // ...
    const targetChar = textChars[i] ?? ''
    const isWhitespaceGlyph = targetChar === ' ' || targetChar === '\n'
    nodes.push(
      <span key={i} data-status={perCharStatus[i] ?? 'pending'}>
        {isWhitespaceGlyph ? <span className="ws-glyph">{glyphFor(targetChar)}</span> : targetChar}
      </span>,
    )
  }
```

```typescript
export function glyphFor(char: string): string {
  if (char === ' ') return '·'
  if (char === '\n') return '↵'
  return char
}
```

Static done/future/gap: map code points through `glyphFor` the same way, **without** `data-status` / caret / rAF. Future: `className="text-muted"`. Done/gap: `--color-text`, no extra mute. `user-select: text`. Not `<textarea>`. Clicks do not type.

**prefersReducedMotion analog** (`CaptureSurface.tsx` lines 22–28) — copy the helper into FileScaffold (or extract only if already shared; today it is local). Use it for `scrollIntoView` behavior, not a CSS fade:

```typescript
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
```

**scrollIntoView** — `useLayoutEffect` on `unitIndex` + mount. `block: 'nearest'` (default `'start'` yanks under the header). Spy the method in tests; do not assert `scrollTop`.

```typescript
el.scrollIntoView({
  block: 'nearest',
  inline: 'nearest',
  behavior: prefersReducedMotion() ? 'instant' : 'smooth',
})
```

**Current-card chrome analog** — reuse `.preview` / `.results-panel` tokens, **not** `--color-accent` (`index.css` lines 196–208 and 344–351). Inline or a local class copying:

```css
.preview {
  max-height: 40vh;
  overflow: auto;
  white-space: pre;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: var(--space-md);
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-body-size);
  line-height: var(--text-body-line);
}
```

File chrome wrapper: `max-height: 70vh; overflow: auto` (taller than `.preview`'s 40vh — this **is** the trainer). Static `<pre>`: `white-space: pre-wrap; overflow-wrap: anywhere; tab-size: 4` — match `.trainer-stack` overlay metrics (`index.css` lines 256–268), **not** `.preview`'s `white-space: pre`. Padding `var(--space-md)` on every `<pre>` **and** the current card. Segment stack `gap: 0`. Current card: `data-scaffold-current`. Static: `data-scaffold-role="done" | "future" | "gap"`. Chrome wrapper `aria-label="File"`.

**Layout:** landmark **outside** the scroll container; Restart stays in App **below** FileScaffold (UI-SPEC). After last-unit persist, FileScaffold remains with all segments done static and CaptureSurface unmounted.

Do **not** put `useCharLogTick` / `computeTrainerState` on the file chrome (Pitfall: full-file React reconciliation per keystroke).

---

### `src/ui/FileScaffold.test.tsx` (test, event-driven)

**Analog:** `src/ui/CaptureSurface.test.tsx` lines 1–74 (happy-dom, `createRoot`, `act`, `IS_REACT_ACT_ENVIRONMENT`) and `src/ui/App.test.tsx` FilePlan fixture (lines 482–498). Zero live GitHub. Zero WASM. Spy `scrollIntoView` on the current-card element.

**Bootstrap** (`CaptureSurface.test.tsx` lines 49–74):

```typescript
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  resetCapture()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
})
```

**FilePlan fixture analog** (`App.test.tsx` lines 488–498):

```typescript
      capturedOnPlanned!({
        exercise: {
          text: 'function a() {}\n',
          language: 'typescript',
          sourceType: 'github',
          sourceRef: 'o/r:src/App.tsx',
        },
        units: [{ id: 'file', kind: 'file', start: 0, end: 16, dependsOn: [] }],
        fallback: true,
      })
```

**Must cover:** current region has `#capture-surface`; future/done/gap have **zero** textareas; source order vs curriculum order (leaf-first units still paint top-to-bottom); XSS fixture `'<img src=x onerror=alert(1)>'` appears as characters, no extra `<img>`; `glyphFor` `·` / `↵` in static regions (CaptureSurface.test lines 106–114); `scrollIntoView` called on advance; landmark `1 / 1` for fallback.

**Whitespace glyph analog** (`CaptureSurface.test.tsx` lines 106–114):

```typescript
  it('a space target renders a .ws-glyph middle dot inside its status span', () => {
    // ...
    expect(spaceSpan?.querySelector('.ws-glyph')?.textContent).toBe('·')
```

---

### `src/ui/App.tsx` (component, event-driven)

**Analog:** itself. Two corpus doors: paste `handleLoad` stays whole-file; GitHub `onPlanned` becomes `startScaffold` — **never** `handleLoad(plan.exercise)`.

**Imports to extend** (lines 1–18). Add `getEvents`, `getCharLog`, `getMarkers` from `../capture/capture`; `sliceUnit` from `../scaffold/slice`; `flattenSnapshots` from `../scaffold/flatten`; `assembleSessionFromLogs` from `../session`; `FileScaffold`. Keep `buildSession` for the paste path and the 250ms refresh.

```typescript
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Exercise } from '../ingestion/types'
import type { FilePlan } from '../parse/types'
import type { Session } from '../capture/types'
import { buildSession } from '../session'
import { readCrossOriginIsolated, probeTimerResolutionUs } from '../platform/isolation'
import { resetCapture } from '../capture/capture'
import { computeSessionMetrics } from '../metrics/metrics'
```

**`handleLoad` last-wins vs scaffold** (lines 66–80) — paste/upload keeps this shape **and** clears curriculum / snapshots / `unitIndex` / `filePlan`. `resetCapture()` **before** remount:

```typescript
  const handleLoad = (loaded: Exercise) => {
    resetCapture() // fresh buffer per exercise
    setExercise(loaded)
    setLoadToken((token) => token + 1)
    setMetrics(null) // no stale results panel survives a fresh load
    setSaveFailed(false) // a stale save-failure notice never survives a fresh load
    const startedAt = Date.now()
    loadRef.current = { exercise: loaded, startedAt }
    const session = buildSession(loaded, startedAt)
    sessionRef.current = session
    setTimingResolutionUs(session.timingResolutionUs)
    if (import.meta.env.DEV) {
      window.__keebdrillSession = session
    }
  }
```

`startScaffold(plan)` mirrors that order: discard snapshots, `resetCapture()`, `exercise = plan.exercise` (full file), `curriculum = plan.units`, `unitIndex = 0`, `startedAt = Date.now()` (file-level; survives unit restart), `loadToken++`, `setMetrics(null)`. Fallback `plan.fallback === true` still starts immediately and still mounts FileScaffold.

**Do not reuse `handleRestart` unmodified** (lines 102–122). Today it refreshes `startedAt`, clears metrics, remounts the **same** `exercise.text`. Scaffold branch: `resetCapture()`; `loadToken++`; **keep** `unitIndex`, snapshots, `startedAt`. Paste path keeps today's handler. Escape and Restart share one handler (`CaptureSurface.tsx` lines 122–125 already call `onRestartRequested`).

```typescript
  const handleRestart = () => {
    const current = loadRef.current
    if (!current) return
    resetCapture()
    setLoadToken((token) => token + 1)
    setMetrics(null) // discard the just-computed metrics (D-06)
    setSaveFailed(false)
    const startedAt = Date.now()
    loadRef.current = { exercise: current.exercise, startedAt }
    const session = buildSession(current.exercise, startedAt)
    // ...
  }
```

**`handleComplete` persist analog** (lines 87–100) — last unit only. Paste still uses live `buildSession`. Scaffold last unit: snapshot → flatten → `assembleSessionFromLogs` → `computeSessionMetrics(typedTarget, ...)` **not** `current.exercise.text`. Fire-and-forget `saveSession` unchanged. After persist: keep ResultsView; hide Restart; all FileScaffold segments done; **do not** arm a second `saveSession` (Pitfall 11 option a / UI-SPEC).

```typescript
  const handleComplete = (completedAt: number) => {
    const current = loadRef.current
    if (!current) return
    const session = buildSession(current.exercise, current.startedAt)
    const result = computeSessionMetrics(current.exercise.text, session.charLog, session.markers, completedAt)
    setMetrics(result)
    setSaveFailed(false)
    void saveSession({ session, completedAt, metricsSnapshot: result }).catch((err: unknown) => {
      console.warn('[keebdrill] session not persisted:', err)
      setSaveFailed(true)
    })
  }
```

**Metrics typed-target analog** (`metrics.ts` lines 56–68 and 131–138). `replayAttempts` walks `target` left-to-right. Concatenated logs are **curriculum order**. Persist `Session.exercise` as the full file; pass joined unit slices as `target`:

```typescript
function replayAttempts(
  target: string,
  charLog: readonly CommittedChar[],
): {
  // ...
} {
  const targetChars = Array.from(target)
```

```typescript
export function computeSessionMetrics(
  target: string,
  charLog: readonly CommittedChar[],
  markers: readonly CaptureMarker[],
  now: number,
): MetricsResult {
  const elapsedMs = computeActiveElapsedMs(charLog, markers, now)
  const { correctAttempts, incorrectAttempts, latencySamplesByChar } = replayAttempts(target, charLog)
```

**Trap:** `resolve-metrics.ts` lines 28–30 still recomputes against `exercise.text` on schema mismatch. Do **not** change Dexie. History shows `metricsSnapshot` until a future schema bump.

```typescript
export function resolveMetrics(s: ResolvableSession): MetricsResult {
  if (s.metricsSnapshot.schemaVersion === METRICS_SCHEMA_VERSION) return s.metricsSnapshot
  return computeSessionMetrics(s.exercise.text, s.charLog, s.markers, s.completedAtTMs)
}
```

**Unit advance order** (RESEARCH Pattern 3) — same turn, synchronous. Snapshot frozen getters, `resetCapture()` **before** React commits the next CaptureSurface (Pitfall 5). CaptureSurface `onComplete` fires once per remount (`CaptureSurface.tsx` lines 63–65, 143–148). App wrapper: if `unitIndex < curriculum.length - 1` advance; else last-unit persist. Do **not** pass `handleComplete` as `onComplete` until the last unit.

```typescript
function advanceUnit(): void {
  snapshotsRef.current.push({
    events: getEvents(),
    charLog: getCharLog(),
    markers: getMarkers(),
  })
  resetCapture()
  setUnitIndex((i) => i + 1)
  setLoadToken((t) => t + 1)
}
```

Getters (`capture.ts` lines 222–249):

```typescript
export function getEvents(): readonly KeystrokeEvent[] {
  return Object.freeze(buffer.slice())
}
export function getCharLog(): readonly CommittedChar[] {
  return Object.freeze(charLog.slice())
}
export function getMarkers(): readonly CaptureMarker[] {
  return Object.freeze(markers.slice())
}
export function resetCapture(): void {
  buffer.length = 0
  charLog.length = 0
  markers.length = 0
  // ...
  seq = 0
}
```

**Replace idle `onPlanned`** (line 225):

```typescript
          <RepoBrowser onPlanned={setFilePlan} />
```

becomes `onPlanned={startScaffold}`. Tab Paste|GitHub stays hide-not-unmount (lines 185–227) and does **not** call `startScaffold` / `handleLoad`.

**Trainer subtree hide-not-unmount** (lines 240–254) — FileScaffold lives **inside** this `display` toggle. Never `hidden`. Never unmount on History:

```typescript
        <div style={{ display: view === 'trainer' ? 'grid' : 'none', gap: 'var(--space-md)' }}>
```

**Empty-state COPY** (lines 229–237) — UI-SPEC verbatim (GitHub door must be named once D-07 lands):

```typescript
            <h2>No exercise loaded</h2>
            <p className="text-muted">
              Paste code or text below, or upload a file, then choose{' '}
              <strong>Load exercise</strong> to begin.
            </p>
```

Replace body with:

```typescript
const COPY = {
  emptyHeading: 'No exercise loaded',
  emptyBody:
    'Paste code or text and choose Load exercise, or import a GitHub repo and click a TypeScript or JavaScript file to begin.',
  restartExercise: 'Restart exercise',
  restartUnit: 'Restart unit',
} as const
```

**Restart label branch** (lines 265–267): scaffold in progress → `Restart unit`; paste → `Restart exercise`; after last-unit persist → **hidden** (D-18 / UI-SPEC).

```typescript
          <button type="button" className="primary" onClick={handleRestart}>
            Restart exercise
          </button>
```

**Render split:** curriculum non-null → `FileScaffold` wrapping CaptureSurface on the slice; paste `handleLoad` → CaptureSurface `text={exercise.text}` directly, no FileScaffold. 250ms `buildSession` refresh (lines 128–141) is paste/live-buffer oriented — scaffold persist must not depend on it (last unit reads flattened snapshots). Keep the interval for paste; for scaffold either skip live `buildSession` from incomplete unit buffers or accept `__keebdrillSession` as current-unit-only until flatten.

---

### `src/ui/App.test.tsx` (test, event-driven)

**Analog:** itself. Invert the Phase 8 idle lock. Reuse persist helpers, RepoBrowser mock, trusted `beforeinput`.

**RepoBrowser capture mock** (lines 10–19) — keep; `capturedOnPlanned` now starts the trainer:

```typescript
let capturedOnPlanned: ((plan: FilePlan) => void) | undefined

vi.mock('./RepoBrowser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./RepoBrowser')>()
  function WrappedRepoBrowser(props: { onPlanned?: (plan: FilePlan) => void }) {
    capturedOnPlanned = props.onPlanned
    return actual.RepoBrowser(props)
  }
  return { RepoBrowser: WrappedRepoBrowser }
})
```

**Trusted input + persist path** (lines 25–50, 74–118) — reuse for 2-unit GitHub complete → one `listNewestFirst` row:

```typescript
function trustedInputEvent(type: string, init: InputEventInit = {}): InputEvent {
  const evt = new InputEvent(type, { bubbles: true, cancelable: true, ...init })
  Object.defineProperty(evt, 'isTrusted', { value: true, configurable: true })
  return evt
}
```

```typescript
describe('App — completion persists exactly one row (PERS-01)', () => {
  it('renders the results panel synchronously and writes one row readable via listNewestFirst', async () => {
```

**MUST INVERT** (lines 482–507) — this test **is** the Phase 8 idle success criterion. Rewrite: `onPlanned` mounts `#capture-surface` with the **slice**, not the full file; FileScaffold landmark present; `handleLoad` still whole-file.

```typescript
  it('holds onPlanned FilePlan in memory without starting the trainer', () => {
    act(() => {
      root.render(<App />)
    })
    expect(typeof capturedOnPlanned).toBe('function')

    act(() => {
      capturedOnPlanned!({
        exercise: {
          text: 'function a() {}\n',
          language: 'typescript',
          sourceType: 'github',
          sourceRef: 'o/r:src/App.tsx',
        },
        units: [{ id: 'file', kind: 'file', start: 0, end: 16, dependsOn: [] }],
        fallback: true,
      })
    })

    expect(container.querySelector('#capture-surface')).toBeNull()
    expect(container.textContent).toContain('Paste code')
    expect(container.textContent).toContain('Load exercise')
    expect(container.querySelector('#corpus-panel-github')?.getAttribute('data-file-plan')).toBe(
      'true',
    )
  })
```

**Must add (RESEARCH test strategy):** 2-unit complete → one History row, `exercise.text` full file, `sourceType: 'github'`, `sourceRef` `o/r:…`; Escape after unit 1 started does not put unit 0 slice back; `handleLoad` unmounts FileScaffold / whole-file textarea; fallback 1-unit still has FileScaffold landmark; multi-unit CaptureSurface `text` ≠ full file. Tab switch still does not reset (existing test lines 450–466). Do not rebuild `HistoryView` ternary — App-level persist makes Phase 8 UAT test 2 checkable (`HistoryView.test.tsx` lines 191–215 already pass against `saveSession` fixtures).

**History github analog** (do not copy into HistoryView; use as App persist assertion shape):

```typescript
describe('HistoryView — github source label (FILE-02)', () => {
  it('shows sourceRef for a github row and does not show Pasted snippet', async () => {
    await saveSession(
      buildInput({
        session: {
          exercise: {
            ...baseExercise,
            language: 'typescript',
            sourceType: 'github',
            sourceRef: 'o/r:src/App.tsx',
          },
        },
      }),
    )
```

---

### `src/session.ts` (utility, transform)

**Analog:** itself. Add sibling `assembleSessionFromLogs(...)` so App does not duplicate isolation probes. **Do not change** `buildSession`'s live-read contract (paste path + 250ms refresh).

**Imports** (lines 1–4) — reuse:

```typescript
import type { Exercise } from './ingestion/types'
import type { Session } from './capture/types'
import { getCharLog, getEvents, getMarkers } from './capture/capture'
import { readCrossOriginIsolated, probeTimerResolutionUs } from './platform/isolation'
```

Sibling takes `exercise`, flattened `{ events, charLog, markers }`, file-level `startedAt`. Same field order as `buildSession` (lines 19–27). `exercise` stays the full file (Anti-Pattern 3).

---

### `src/session.test.ts` (test, transform)

**Analog:** `src/parse/utf16.test.ts` (node `unit` project, `describe`/`it`/`expect`, no DOM). There is no existing `session.test.ts`. Prove `assembleSessionFromLogs` copies isolation fields from `probeTimerResolutionUs` / `readCrossOriginIsolated` the same way `buildSession` does, and does **not** call `getEvents()`. Spying capture getters is allowed; do not import `parse/wasm.ts`.

---

## Shared Patterns

### COPY const in the UI file
**Source:** `src/ui/RepoBrowser.tsx` lines 21–42, `src/ui/CorpusInput.tsx` lines 14–23
**Apply to:** `FileScaffold.tsx`, `App.tsx` empty-state / Restart labels
Strings come verbatim from `09-UI-SPEC.md`. No “Phase 9”, WASM, tree-sitter, parser, AST, or “curriculum” in user-visible copy. `{n} / {m}` placeholders like RepoBrowser `{path}` / `{count}`.

### Code-point `Array.from` (never UTF-16 `String.slice`)
**Source:** `src/trainer/state.ts` lines 22–32, `src/parse/types.ts` lines 1–3, `src/parse/utf16.ts` lines 4–6
**Apply to:** `slice.ts`, `cover.ts`, FileScaffold static glyphs, metrics `typedTarget`

### `resetCapture` then remount via `loadToken`
**Source:** `src/ui/App.tsx` lines 36–42, 66–69, 107–111
**Apply to:** `startScaffold`, unit advance, unit restart, paste `handleLoad`
Monotonic token, not content-derived key. Snapshot **then** `resetCapture()` **then** `setUnitIndex` / `setLoadToken` on advance.

### Hide-not-unmount (`display: none`, never `hidden`)
**Source:** `src/ui/App.tsx` lines 185, 215, 240–254
**Apply to:** FileScaffold lives inside the existing trainer `display` toggle. Paste|GitHub tab switch is not a reset (Phase 7 D-04).

### Fire-and-forget persist
**Source:** `src/ui/App.tsx` lines 93–99, `src/persistence/repository.ts` lines 10–16
**Apply to:** last unit only. `setMetrics` first; `void saveSession(...).catch` sets `saveFailed`. One Session per file.

### Frozen capture rows — copy, don't mutate
**Source:** `src/capture/capture.ts` lines 46–53, 222–236; `src/persistence/repository.ts` lines 18–22
**Apply to:** flatten seq remap (`{ ...e, seq }`), `saveSession` spread-copy already handles persist.

### `prefersReducedMotion` via `matchMedia`
**Source:** `src/ui/CaptureSurface.tsx` lines 22–28, 237
**Apply to:** FileScaffold `scrollIntoView` `behavior: 'instant' | 'smooth'`

### `glyphFor` + `.ws-glyph`
**Source:** `src/trainer/state.ts` lines 91–95, `src/ui/CaptureSurface.tsx` lines 187–191, `src/index.css` lines 338–340
**Apply to:** FileScaffold done/future/gap static text. Opacity 0.55 on the glyph only.

### React text children (XSS)
**Source:** CaptureSurface overlay spans; React default escaping
**Apply to:** FileScaffold. Grep `innerHTML` / `dangerouslySetInnerHTML` stays 0. Fixture `'<img src=x onerror=alert(1)>'` is characters.

### Isolation probes live in `session.ts`
**Source:** `src/session.ts` lines 24–25, `src/platform/isolation.ts`
**Apply to:** `assembleSessionFromLogs`. App should not call `probeTimerResolutionUs` / `readCrossOriginIsolated` itself for the scaffold persist path (paste `handleLoad` already goes through `buildSession`).

### FilePlan fixtures, not live parse
**Source:** `src/ui/App.test.tsx` lines 488–498, `src/parse/plan.test.ts` synthetic `TsNode`s
**Apply to:** FileScaffold / App / cover tests. Zero `api.github.com`. Zero `Language.load`.

### CaptureSurface `onComplete` fire-once per remount
**Source:** `src/ui/CaptureSurface.tsx` lines 63–65, 137–148
**Apply to:** App intercepts until last unit; remount on `loadToken` resets `firedCompletedAtRef` so the next slice can complete. Fallback 1-unit: first complete **is** last.

### Last-wins doors
**Source:** `src/ui/App.tsx` `handleLoad`; `src/ui/RepoBrowser.tsx` `clickGenRef` (lines 117–121, 140); `src/ui/CorpusInput.tsx` `loadTokenRef` (lines 37–39)
**Apply to:** new GitHub click replaces in-progress scaffold; paste `handleLoad` clears curriculum; tab switch does not.

### History github `sourceRef` — do not rebuild
**Source:** `src/ui/HistoryView.tsx` lines 42–47
**Apply to:** verification only after SCAF-03 persist. `sourceType === 'github' ? (sourceRef ?? 'GitHub file')`.

```typescript
  const sourceLabel =
    sourceType === 'upload'
      ? (session.exercise.sourceRef ?? 'Uploaded file')
      : sourceType === 'github'
        ? (session.exercise.sourceRef ?? 'GitHub file')
        : 'Pasted snippet'
```

### Current-unit card uses surface+border, not accent
**Source:** `src/index.css` `.preview` / `.results-panel`; 07-UI-SPEC accent reserved list
**Apply to:** FileScaffold current card. Accent stays on Restart / focus ring / textarea border / caret.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/scaffold/cover.ts` `coverFile` algorithm | utility | transform | No source-order unit/gap segmenter exists. Closest pieces: `fallbackPlan` (1-unit full cover) and `sort((a, b) => a.start - b.start)`. Implement RESEARCH Pattern 2 verbatim. |

All **files** still have a role-match analog (table above). The cover **algorithm** is the only green-field logic.

---

## Do Not Touch (explicit)

| File | Why |
|------|-----|
| `src/ui/CaptureSurface.tsx` | D-05/D-20. Props and overlay contract unchanged. Slice-only `text` comes from App/FileScaffold. |
| `src/capture/capture.ts` | D-20. No restore API. Snapshot in App. |
| `src/ui/RepoBrowser.tsx` | `onPlanned(FilePlan)` already; PLAN-03 COPY stays in the tree status region. |
| `src/ui/HistoryView.tsx` | D-21 ternary already maps github → `sourceRef`. |
| `src/parse/plan.ts` / `src/parse/types.ts` | Planner already shipped. Consume `FilePlan`. |
| `src/github/client.ts` | Sole `fetch` module. |
| `src/persistence/*` | Dexie `version(1)`; `exercise` is an unindexed blob. |
| `src/metrics/resolve-metrics.ts` | Document the `exercise.text` fallback trap; do not “fix” it this phase. |

---

## Metadata

**Analog search scope:** `src/ui/`, `src/scaffold/` (new), `src/session.ts`, `src/parse/`, `src/trainer/`, `src/capture/`, `src/metrics/`, `src/persistence/`, `src/index.css`
**Files scanned:** 83 `src/**/*.{ts,tsx}` (31 tests)
**Pattern extraction date:** 2026-09-20
