# Phase 9: Scaffolded Trainer - Research

**Researched:** 2026-09-20
**Domain:** In-place GitHub file chrome + unit curriculum over unchanged CaptureSurface/capture.ts
**Confidence:** HIGH (codebase seams + locked CONTEXT; metrics-target split is the one non-obvious product rule)

Context7 MCP/CLI were unavailable this session (research-plan requested `context7`). Official MDN / React pages were fetched via WebFetch. The classify-confidence seam rates `webfetch` LOW even with `--verified`; claims that cite those pages or live keebdrill source are still treated as authoritative because they *are* the primary sources.

No new packages this phase. Graph (`.planning/graphs/graph.json`) is absent — no graphify context.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

User delegated all gray areas ("decide tu todo"). Locked to the v2.0
research recommendations so planner/executor do not re-ask.

### File chrome layout
- **D-01:** File chrome is a **stacked document-order** layout: completed
  units (static), current unit (existing `CaptureSurface`), future units
  (static, dimmed). The three regions appear in source order so the file
  still reads top-to-bottom. This is "in the file," not a disconnected
  drill pane.
- **D-02:** **Never** put `Exercise.text` (the full file) into
  `CaptureSurface`. Textarea value === current unit slice only. No
  pixel-perfect transparent overlay of a slice inside a full-file
  textarea (PITFALLS Pitfall 6; FEATURES anti-feature cloze/overlay).
- **D-03:** Done and future regions render **canonical source** slices
  from `Exercise.text` (always the real file), never the user's typed
  buffer. Free-correction errors do not rewrite the file chrome.
- **D-04:** Future units: `text-muted`, readable, `user-select` allowed,
  **not** a textarea. Clicks on future/done text do not type. Current
  unit keeps today's CaptureSurface coloring, custom caret, paste-block.
- **D-05:** New `src/ui/FileScaffold.tsx` owns the three regions and the
  N/M landmark. `CaptureSurface` props stay `{ text, onRestartRequested,
  onComplete }`. Do not teach CaptureSurface about GitHub, units, or
  `FilePlan`.
- **D-06:** Render with React text nodes / `textContent` / existing
  `glyphFor` if reused for whitespace. **No** `innerHTML`,
  `dangerouslySetInnerHTML`, or syntax highlighter.

### Click-to-type handoff
- **D-07:** **Immediate start.** When `RepoBrowser` calls `onPlanned(plan)`,
  App starts the scaffolded session on **unit 0**. No extra Start button,
  no plan-preview step. Click file → type.
- **D-08:** Do **not** call paste-style `handleLoad(plan.exercise)` for
  GitHub — that ships whole-file typing. Add a distinct `startScaffold(plan)`
  that sets `exercise` = full file, curriculum = `plan.units`, `unitIndex`
  = 0, and passes the code-point slice of unit 0 into CaptureSurface.
- **D-09:** Fallback (`plan.fallback === true`, one whole-file unit) still
  starts immediately and still uses FileScaffold. The PLAN-03 notice stays
  in the existing RepoBrowser status region. No silent no-op.
- **D-10:** **Last-wins.** A new GitHub file click replaces an in-progress
  scaffold (discard unit snapshots, `resetCapture`, remount). Paste/upload
  `handleLoad` also last-wins: clear curriculum / scaffold mode, whole-file
  CaptureSurface as today. Switching Paste | GitHub tabs does **not** reset
  (Phase 7 D-04); only an actual load/plan start does.
- **D-11:** The tree remains browseable while typing. Hide-not-unmount of
  the trainer subtree (Phase 4 D-08) is unchanged.

### Unit-complete feel
- **D-12:** **Instant advance.** Completing the current unit snapshots
  that unit's capture log, `resetCapture()`, bumps `loadToken`, remounts
  CaptureSurface on the next slice. No "unit complete" interstitial, no
  Next button.
- **D-13:** Landmark: **"N / M"** plus `kind`/`name` when present.
  Highlight the current region with existing palette (no new colors unless
  UI-SPEC). `scrollIntoView` on the current unit block at start and on
  each advance; honor `prefers-reduced-motion` (same idea as CaptureSurface
  paste-block fade).
- **D-14:** Last unit complete → existing `handleComplete` / `ResultsView`
  / fire-and-forget `saveSession`. **One Session per file.** Concatenate
  per-unit snapshots into that Session. `Exercise.text` stays the full
  file. Per-unit WPM UI is out of scope.
- **D-15:** On unit **advance** (not restart): snapshot
  `getEvents` / `getCharLog` / `getMarkers`, then `resetCapture()`. On
  file complete: flatten snapshots, then existing `buildSession` writer.
  Never leave previous-unit charLog painted on the next slice.

### Restart chrome
- **D-16:** Escape **and** the Restart button restart the **current unit
  only** (SCAF-04). They share one handler. Do not reset `unitIndex` to 0.
  Do not discard concatenated snapshots of completed units.
- **D-17:** Unit restart: drop only the current unit's in-progress capture
  buffer and remount that slice. Keep file-level `startedAt` (the file
  attempt continues; botched-unit time stays in the clock; botched
  keystrokes are not in the log).
- **D-18:** **No whole-file restart control** this phase. Abandon by
  loading another GitHub file or a paste/upload exercise (D-10).

### Slice + capture contract
- **D-19:** Unit `start`/`end` are exclusive **code-point** offsets into
  `Array.from(exercise.text)` (Phase 3 / `parse/types.ts`). Slice with
  `Array.from` → slice → join. Never UTF-16 `String.slice` on the file.
- **D-20:** Do **not** modify `src/capture/capture.ts` unless a bug is
  proven. Curriculum lives in App (and FileScaffold). Paste/upload path
  (`fromPaste` / `fromFile` / `handleLoad`) stays whole-file (SCAF-05).

### History github label (carried UAT)
- **D-21:** `HistoryView` already maps `sourceType === 'github'` to
  `sourceRef` (`owner/repo:path`). Do not rebuild that ternary. After
  SCAF-03 persist, the skipped Phase 8 UAT test 2 (github History row)
  becomes checkable — include it in this phase's verification.

### Carried forward (do not relitigate)
- Click-to-type-whole-file is never the happy path.
- Cloze / hidden future units rejected (REQUIREMENTS Out of Scope).
- Parser already shipped (Phase 8). This phase consumes `FilePlan`.
- `src/github/client.ts` remains the only `fetch` module.
- COEP `require-corp` stays. No Octokit, no PAT, no Monaco.
- Header stays Trainer | History | Analytics.
- Inline status/errors; no toasts.
- Third-party corpus stays local.

### Claude's Discretion
- Exact COPY: N/M landmark, Restart button label (may stay "Restart
  exercise" or become "Restart unit" in UI-SPEC), idle empty-state
  mentioning GitHub files, any FileScaffold landmark phrasing. No
  "Phase 9", WASM, or tree-sitter jargon in UI copy.
- Whether future/done regions use a `<pre>` of raw text or reuse
  `glyphFor` whitespace glyphs. Current unit must keep CaptureSurface.
- Optional unit-separator markers in concatenated Session logs
  (nice-to-have; not required for SCAF-03).
- Internal names: `startScaffold`, `curriculum` vs `units`, snapshot
  type name.
- UI-SPEC pass (`UI hint: yes` on ROADMAP). Planner should expect a
  UI-SPEC or equivalent copy/layout contract before execution.
- Test fixtures beyond: 2-unit advance → one History row; Escape does
  not wipe unit 0 after unit 1 started; paste `handleLoad` exits
  scaffold; fallback one-unit still FileScaffold; no CaptureSurface
  with full file on a multi-unit plan.

### Deferred Ideas (OUT OF SCOPE)
- Per-unit History rows / per-function WPM (FEATURES "Add After Validation").
- Whole-file restart control (abandon via new load only).
- Pixel-perfect caret-inside-full-file overlay.
- Syntax highlighting of done/future regions.
- Cloze / hidden future units (explicitly rejected).
- PLAN-04/05, REPO-05/06.

None of these were requested as this-phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCAF-01 | User sees the full file, including future units; only the current unit is typeable | `FileScaffold` source-order segments + gap fill; `CaptureSurface text={slice(unit)}` only; future/done are static React text, not textareas |
| SCAF-02 | Completing the current unit advances to the next until the file is done | App intercepts `onComplete` until last unit; snapshot → `resetCapture` → `loadToken++` → remount next slice; no interstitial |
| SCAF-03 | Last unit → existing results + one persisted session for the whole file (`Exercise.text` full file) | Flatten snapshots into one `Session`; `exercise` stays the file; metrics replay target = **curriculum-order concat of unit slices** (not source-order file) |
| SCAF-04 | Escape restarts the current unit, not the entire file | Shared handler with Restart; do not zero `unitIndex`; do not drop completed snapshots; do not refresh `startedAt` |
| SCAF-05 | Paste/upload stay whole-file | `handleLoad` clears curriculum and mounts `CaptureSurface` on `exercise.text` as today; never `handleLoad(plan.exercise)` for GitHub |
</phase_requirements>

## Project Constraints (from .cursor/rules/)

No `.cursor/rules/` or project skills directory exists. Follow existing house style: platform seam (`capture.ts` / `github/client.ts` / `parse/wasm.ts` untouched this phase), `COPY` const in the UI file, hide-not-unmount (`display:none`, never `hidden`), React text nodes only, Vitest + happy-dom, zero live GitHub, zero WASM in unit tests, FilePlan fixtures.

## Summary

Phase 9 is a **curriculum + chrome** change, not a capture rewrite. `FilePlan` already sits idle in App (`onPlanned={setFilePlan}`). The trainer still mounts `CaptureSurface` only after paste/upload `handleLoad`, with `text={exercise.text}`. Wiring GitHub through `handleLoad` would ship whole-file typing — the happy path the user rejected. The new path is `startScaffold(plan)`: keep `exercise` as the full file, store `plan.units` as curriculum, put **only** the current unit's code-point slice into CaptureSurface, wrap that surface in `FileScaffold` so the rest of the file stays visible.

Two implementation facts dominate planning:

1. **Document order ≠ curriculum order.** Units are leaves-first (`parse/plan.ts` Kahn topo). File chrome must still read as the source file: render segments sorted by `start`, classify each unit as done/current/future from `unitIndex` in **curriculum** order. A leaf at the bottom of the file is typeable while imports above it are still dimmed future units.

2. **`computeSessionMetrics(exercise.text, concatenatedCharLog)` is wrong** for a multi-unit GitHub file. Metrics replay is a left-to-right cursor over `target` (`src/metrics/metrics.ts` `replayAttempts`). Concatenated logs are in **dependency/typing order**, not source order. Persist `Exercise.text` as the full file (D-14 / Anti-Pattern 3). Compute WPM/accuracy against the joined unit slices in curriculum order. `metricsSnapshot` is what History shows until a future schema bump; `resolveMetrics` fallback still replays `exercise.text` — document that trap, do not change Dexie.

**Primary recommendation:** Add `FileScaffold` + a tiny pure `src/scaffold/` (slice, source-order cover, snapshot flatten). Change App: `onPlanned={startScaffold}`, intercept `onComplete` for non-last units, narrow Restart/Escape to the current unit, clear curriculum on paste `handleLoad`. Do not touch `capture.ts`. Invert the Phase 8 App test that asserts `onPlanned` leaves the trainer idle.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File chrome (done / current / future) | Browser / Client | — | DOM layout; no server |
| Current-unit typing + capture | Browser / Client | — | Existing CaptureSurface + `capture.ts` hot path |
| Curriculum / unitIndex / snapshots | Browser / Client (App state) | — | PATTERN 2: curriculum outside CaptureSurface |
| Code-point slice | Browser / Client (pure) | — | Same `Array.from` contract as `trainer/state.ts` |
| Unit advance + remount | Browser / Client | — | `loadToken` already remounts CaptureSurface |
| File-complete persist | Browser / Client | Database / Storage (Dexie) | Existing `saveSession`; one row; `exercise` unindexed blob |
| History github `sourceRef` label | Browser / Client | Database / Storage | Already in `HistoryView`; becomes UAT-checkable after persist |
| Paste/upload whole-file | Browser / Client | — | Unchanged `handleLoad` |
| WASM / GitHub fetch | — | already shipped | Do not re-enter `parse/wasm.ts` or `github/client.ts` |

This app has **no API / Backend tier**. Do not invent a proxy.

## Standard Stack

This phase installs **zero** new runtime or test packages. Reuse what is already in `package.json` (verified this session).

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React + React DOM | **19.2.8** (`package.json`) | FileScaffold + App state | Already the UI runtime. Text children escape; do not add a highlighter. |
| Existing CaptureSurface overlay | `src/ui/CaptureSurface.tsx` | Current-unit input host | Locked 1:1 overlay contract (D-02/D-05). |
| Existing capture API | `resetCapture`, `getEvents`, `getCharLog`, `getMarkers` | Snapshot + reset per unit | D-20: do not rewrite the hot path. |
| Existing session writer | `buildSession` + `saveSession` | File-complete persist | Paste path unchanged; scaffold flatten then assemble a `Session`. |
| Existing metrics | `computeSessionMetrics` | Results + snapshot | Pure fold; **pass typed-order target**, not source-order file. |
| `FilePlan` / `PlanUnit` | `src/parse/types.ts` | Curriculum | Phase 8 already emits code-point `start`/`end`. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | **~4.1.11** | Unit + UI tests | `pnpm test`. UI project is happy-dom (`vite.config.ts`). |
| happy-dom | **^20.14.0** | DOM tests | CaptureSurface / App / FileScaffold. Spy `scrollIntoView`; do not assert layout. |
| fake-indexeddb | **6.2.5** | Persist tests | Already on the `ui` + `persistence` projects. |
| `glyphFor` | `src/trainer/state.ts` | Whitespace in static regions | Discretion: reuse for visual continuity with CaptureSurface. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Stacked source-order chrome | Pixel-perfect full-file textarea overlay | Locked out (D-02, Pitfall 6). Breaks IME/`beforeinput`. |
| `handleLoad(plan.exercise)` | Distinct `startScaffold` | `handleLoad` is whole-file (SCAF-05). |
| Per-unit History rows | One Session / file | Locked D-14; per-unit WPM is deferred. |
| Restore logs into `capture.ts` then `buildSession()` | Flatten in App / `session.ts` sibling | No restore API; D-20 forbids adding one without a proven bug. |
| Monaco / syntax highlight | React text + `text-muted` | Locked anti-feature; XSS sink. |

**Installation:** none.

**Version verification (this session, 2026-09-20):** React 19.2.8, Vitest 4.1.11, happy-dom 20.x, Dexie 4.4.4 already installed. No `npm view` for new names.

## Package Legitimacy Audit

> Phase 9 installs **no** external packages. The Package Legitimacy Gate has nothing to check.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | No installs |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
RepoBrowser TS/JS click (already)
    │
    ▼
 onPlanned(FilePlan)  ──►  App.startScaffold(plan)     NEVER handleLoad(plan.exercise)
    │
    ├─ exercise     = plan.exercise          // full file, sourceType github
    ├─ curriculum   = plan.units             // leaves-first
    ├─ unitIndex    = 0
    ├─ snapshots    = []
    ├─ startedAt    = Date.now()             // file-level; survives unit restart
    ├─ resetCapture(); loadToken++
    └─ FileScaffold(plan, unitIndex)
           │
           ├─ cover(text, units)  → source-order segments (unit | gap)
           │     gap = trivia / ERROR holes between PlanUnit ranges
           │     classify unit: done | current | future  from curriculum index
           │
           ├─ done/future/gap  → <pre>/div React text (glyphFor optional)
           └─ current          → CaptureSurface text={slice(unit)}  key={loadToken}
                                      │
                                      ├─ onComplete (NOT last) →
                                      │     snapshot getEvents/getCharLog/getMarkers
                                      │     resetCapture()          // BEFORE remount paint
                                      │     unitIndex++
                                      │     loadToken++
                                      │     scrollIntoView current
                                      │
                                      └─ onComplete (LAST) →
                                            snapshot last unit
                                            flatten snapshots → Session.events/charLog/markers
                                            Session.exercise = full file
                                            typedTarget = units.map(slice).join('')
                                            computeSessionMetrics(typedTarget, charLog, markers, completedAt)
                                            ResultsView + saveSession (fire-and-forget)
                                            History: sourceRef already labeled

Paste/upload CorpusInput.onLoad → handleLoad
    ├─ clear curriculum, snapshots, unitIndex, filePlan
    ├─ CaptureSurface text={exercise.text}   // no FileScaffold
    └─ Escape/Restart = today's whole-session reset

Tab Paste|GitHub: hide-not-unmount; does not call startScaffold or handleLoad
```

### Recommended Project Structure

```
src/
├── scaffold/                    # NEW pure core (no React, no WASM, no fetch)
│   ├── slice.ts                 # Array.from(text).slice(start, end).join('')
│   ├── slice.test.ts            # emoji / surrogate-pair golden
│   ├── cover.ts                 # source-order segments + inter-unit gaps
│   ├── cover.test.ts            # gaps between units; fallback 1-unit = no gaps
│   ├── flatten.ts               # concat snapshots; remap seq; optional markers
│   └── flatten.test.ts          # 2-unit concat; seq unique; restart not included
├── ui/
│   ├── FileScaffold.tsx         # NEW — landmark + regions; mounts CaptureSurface
│   ├── FileScaffold.test.tsx    # source order, dim future, no textarea in future,
│   │                            # React text (not HTML) for `</pre><script>`
│   ├── App.tsx                  # MODIFY — startScaffold, curriculum, intercept complete/restart
│   ├── App.test.tsx             # INVERT idle onPlanned test; 2-unit persist; Escape; paste exit
│   ├── CaptureSurface.tsx       # UNCHANGED props
│   ├── HistoryView.tsx          # UNCHANGED ternary (D-21)
│   └── RepoBrowser.tsx          # UNCHANGED onPlanned(FilePlan)
├── capture/capture.ts           # UNCHANGED (D-20)
├── session.ts                   # OPTIONAL sibling assembleSessionFromLogs
├── parse/types.ts               # UNCHANGED FilePlan
└── persistence/                 # UNCHANGED Dexie version(1)
```

**Analogs in existing code (name these in the plan):**

| New piece | Closest analog |
|-----------|----------------|
| `FileScaffold` | `CaptureSurface` overlay split (rendered layer vs textarea) — chrome vs input |
| Landmark `N / M` | `RepoBrowser` reserved status `<p role="status">` + `Banners` |
| `startScaffold` vs `handleLoad` | Phase 8 `onPlanned` vs paste `onLoad` — two corpus doors |
| `loadToken` remount | `App.tsx` CR-02 already remounts CaptureSurface on load/restart |
| Snapshot then `resetCapture` | `handleLoad` already `resetCapture()` before remount |
| Hide-not-unmount trainer | `App.tsx` `display: view === 'trainer' ? 'grid' : 'none'` |
| `COPY` const | `RepoBrowser.tsx` / `CorpusInput.tsx` |
| FilePlan fixture tests | `App.test.tsx` mocked `onPlanned`; `parse/plan.test.ts` forests |
| History github label | `HistoryView.test.tsx` `sourceType: 'github'` already |

Do **not** recreate `scaffold/plan.ts` — Phase 8 shipped the planner as `src/parse/plan.ts`.

### Pattern 1: Curriculum outside CaptureSurface

**What:** CaptureSurface remains `{ text, onRestartRequested, onComplete }`. App owns `curriculum`, `unitIndex`, snapshots. `text` is always the current slice.
**When to use:** Always (ARCHITECTURE Pattern 2, pick (1): reset per unit + concatenate).
**Example:**

```typescript
// Source: src/parse/types.ts + src/trainer/state.ts Array.from contract
export function sliceUnit(text: string, start: number, end: number): string {
  return Array.from(text).slice(start, end).join('')
}
```

### Pattern 2: Source-order chrome, curriculum-order typing

**What:** D-01 "three regions" are **states**, not three stacked blocks in done→current→future sequence. Sort by `PlanUnit.start`. Classify with the unit's index in `plan.units` (already topo-sorted).
**When to use:** Always. Otherwise a leaf-first file reads as "function b, then imports" — not "in the file."

```typescript
// Source: live parse/plan.ts orderByDeps vs PlanUnit.start
type Segment =
  | { kind: 'gap'; start: number; end: number }
  | { kind: 'unit'; unit: PlanUnit; role: 'done' | 'current' | 'future' }

function coverFile(text: string, units: PlanUnit[], unitIndex: number): Segment[] {
  const cpLen = Array.from(text).length
  const byStart = [...units].sort((a, b) => a.start - b.start)
  const roleOf = (u: PlanUnit): Segment['role'] => {
    const i = units.findIndex((x) => x.id === u.id)
    if (i < unitIndex) return 'done'
    if (i === unitIndex) return 'current'
    return 'future'
  }
  const out: Segment[] = []
  let cursor = 0
  for (const u of byStart) {
    if (u.start > cursor) out.push({ kind: 'gap', start: cursor, end: u.start })
    out.push({ kind: 'unit', unit: u, role: roleOf(u) })
    cursor = Math.max(cursor, u.end)
  }
  if (cursor < cpLen) out.push({ kind: 'gap', start: cursor, end: cpLen })
  return out
}
```

**Why gaps exist:** `planUnits` walks `program` **named** children only (`src/parse/plan.ts`). Trivia between top-level nodes (blank lines) and skipped `ERROR` nodes are not in any `PlanUnit`. `assertNonOverlapping` allows `start >= prev.end`, not full coverage. SCAF-01 "full file visible" requires FileScaffold to paint those holes as static canonical text (not typeable, not a fourth curriculum unit). Fallback `kind: 'file'` covers `[0, length)` — no gaps.

### Pattern 3: Snapshot → reset → remount (load-bearing order)

**What:** In the **same** `onComplete` turn, synchronously: copy frozen snapshots, `resetCapture()`, then `setUnitIndex` + `setLoadToken`. Never paint the next slice against the previous charLog (Pitfall 5).
**When to use:** Every non-last unit complete.

```typescript
// Source: App.tsx handleLoad order (resetCapture then remount) + CaptureSurface D-07
function advanceUnit(): void {
  snapshotsRef.current.push({
    events: getEvents(),
    charLog: getCharLog(),
    markers: getMarkers(),
  })
  resetCapture() // empties live buffers BEFORE React commits the next CaptureSurface
  setUnitIndex((i) => i + 1)
  setLoadToken((t) => t + 1)
}
```

`CaptureSurface` `onComplete` fires from `useEffect` on `completedAt` with a per-instance ref. Remounting on `loadToken` resets that ref so the **next** unit can complete. Do **not** call `onComplete` from FileScaffold. Do **not** pass `handleComplete` (persist) as `onComplete` until the last unit.

### Pattern 4: Flatten for persist; typed target for metrics

**What:** `buildSession` always reads **live** capture (`src/session.ts`). After per-unit `resetCapture`, live buffers are the last unit only. Assemble the `Session` from concatenated snapshots. Keep `exercise` as the full file. Pass **typedTarget** into `computeSessionMetrics`.
**When to use:** Last unit only (SCAF-03).

```typescript
// Source: src/metrics/metrics.ts replayAttempts(target, charLog);
//         src/metrics/resolve-metrics.ts uses exercise.text only on schema mismatch
const typedTarget = curriculum.map((u) => sliceUnit(exercise.text, u.start, u.end)).join('')
const session: Session = {
  exercise, // full file — History lengthChars + sourceRef
  events: flat.events,
  charLog: flat.charLog,
  markers: flat.markers,
  timingResolutionUs: probeTimerResolutionUs(),
  crossOriginIsolated: readCrossOriginIsolated(),
  startedAt: fileStartedAt, // D-17
}
const result = computeSessionMetrics(typedTarget, session.charLog, session.markers, completedAt)
void saveSession({ session, completedAt, metricsSnapshot: result }).catch(...)
```

Analytics digraphs/heatmap fold **charLog/events**, not `exercise.text` (`src/analytics/analytics.ts`) — concatenated typing-order logs are correct there.

`getEvents()` objects are `Object.freeze`d (`capture.ts`). Remap `seq` by **mapping to new objects**, do not mutate. Duplicate seq across units would confuse any future seq-join; remap is cheap. Unit-separator markers are optional (D-15 discretion).

Optional: add `assembleSessionFromLogs(...)` next to `buildSession` in `session.ts` so App does not duplicate isolation probes. Do not change `buildSession`'s live-read contract (paste path / 250ms refresh still use it).

### Pattern 5: Last-wins doors

**What:** `startScaffold` and `handleLoad` both reset capture and remount. Only one mode is active.
**When to use:** D-10.

| Event | Curriculum | CaptureSurface text | FileScaffold |
|-------|------------|---------------------|--------------|
| `onPlanned(plan)` | `plan.units`, index 0, snapshots [] | slice(unit 0) | yes (including fallback) |
| Paste/upload `handleLoad` | cleared | `exercise.text` | no |
| Paste \| GitHub tab | unchanged | unchanged | unchanged |

Replace `onPlanned={setFilePlan}` with `onPlanned={startScaffold}`. Keep `filePlan` only if UI still wants `data-file-plan`; otherwise curriculum non-null is the signal.

### Anti-Patterns to Avoid

- **`handleLoad(plan.exercise)` on GitHub click:** whole-file typing. Phase 8 App test even locks the idle hold — invert that test, do not route through `handleLoad`.
- **Full file in the textarea:** Pitfall 6. IME, paste-block, Tab no-op all assume 1:1 `text`.
- **`Exercise.text` = current unit:** Anti-Pattern 3. History would store fragments; SCAF-03 fails.
- **`computeSessionMetrics(exercise.text, concatLog)`:** accuracy collapses on any leaves-first file.
- **Three stacked blocks in curriculum order:** file no longer reads top-to-bottom (violates D-01).
- **Skipping gap fill:** blank lines between functions disappear; "full file" is a lie.
- **Teaching `computeTrainerState` about ranges:** hostile to IME; out of scope.
- **Modifying `capture.ts` to keep a mega-log:** D-20. Snapshot in App.
- **`innerHTML` / highlighter for "pretty" chrome:** XSS (Pitfall 8, React docs).
- **Calling persist `handleComplete` on every unit:** N History rows; last-unit-only session (the failure SUMMARY.md names).
- **Escape → `handleRestart` as written today:** today's handler resets `startedAt`, clears metrics, remounts the **same** `exercise.text`. Scaffold must **not** reuse it unmodified.
- **Unmount trainer on History:** Phase 4 D-08. FileScaffold lives inside the existing hide-not-unmount subtree.
- **New colors / accent on current unit:** 07-UI-SPEC accent is reserved for primary buttons, focus ring, textarea border, caret. Use `--color-border` / `--color-surface` / weight until UI-SPEC says otherwise.
- **Live GitHub or WASM in Vitest:** fixtures only. `FilePlan` objects, not `planUnits(realTree)`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keystroke capture / IME / paste-block | Parallel input layer | Existing `capture.ts` + CaptureSurface | Timing + IME invariants |
| Per-char coloring / caret | Reimplement trainer | CaptureSurface on the slice | Already 1:1 with `text` |
| WPM / accuracy formulas | Ad-hoc averages | `computeSessionMetrics` | Clock domain + replay rules |
| XSS escaping of blob text | Manual sanitizer | React text children | React escapes; `dangerouslySetInnerHTML` is the hole [CITED: react.dev common props] |
| Persist / History | New Dexie version | `saveSession` + existing `HistoryView` ternary | `exercise` is an unindexed blob; D-21 |
| scroll-into-view | Custom scroll math | `Element.scrollIntoView` | MDN baseline API [CITED: developer.mozilla.org Element/scrollIntoView] |

**Hand-roll IS required for:** FileScaffold source-order cover + gaps, curriculum state, snapshot flatten / seq remap, `startScaffold` vs `handleLoad`, unit-only restart. Those are the product.

**Key insight:** CaptureSurface cannot see the file. The file cannot live in the textarea. Metrics cannot see the file as a left-to-right tape of dependency-ordered keystrokes. Three different strings: **display source**, **typeable slice**, **metrics target**.

## Common Pitfalls

### Pitfall 1: Previous unit charLog paints the next slice

**What goes wrong:** First keystroke of unit 2 scores against leftover unit 1 log; or History WPM is only the last function.
**Why it happens:** Today one Exercise = one buffer. `resetCapture` forgotten, or persist reads live capture after resets.
**How to avoid:** D-15 order: snapshot → `resetCapture` → remount. Last unit: flatten **all** snapshots before `saveSession`. Assert 2-unit fixture → one History row whose `charLog` contains both slices' commits.
**Warning signs:** Overlay colors on unit 2 before any typing; `charLog.length` equals only the last function.

### Pitfall 2: Metrics target is the source-order file

**What goes wrong:** Leaves-first typing vs `replayAttempts` from cursor 0 of `import …` → near-zero accuracy, garbage slowest-keys, still a "successful" persist.
**Why it happens:** `handleComplete` today does `computeSessionMetrics(current.exercise.text, session.charLog, ...)`.
**How to avoid:** Typed-order concat of unit slices as `target`. Keep full file on `Session.exercise`. Do not "fix" this by changing `Exercise.text`.
**Warning signs:** Completing a 2-unit file of `function b` then `function a` shows ~0% accuracy.

### Pitfall 3: Escape uses today's `handleRestart`

**What goes wrong:** `unitIndex` jumps to 0, `startedAt` refreshes, completed snapshots vanish, or the full file is stuffed into CaptureSurface.
**Why it happens:** `handleRestart` is a whole-session reset (`App.tsx` lines 107–122).
**How to avoid:** Branch: if curriculum active → `resetCapture`; `loadToken++`; **keep** `unitIndex`, snapshots, `startedAt`; `setMetrics(null)` only if results were showing for this in-progress unit (usually null mid-file). Paste path keeps today's handler.
**Warning signs:** After typing unit 0 and starting unit 1, Escape returns the user to unit 0's slice.

### Pitfall 4: Chrome omits inter-unit trivia

**What goes wrong:** Functions glue together; SCAF-01 fails visual "full file."
**Why it happens:** Units are named-node ranges, not a partition of the file.
**How to avoid:** `coverFile` gap segments. Render gaps like done (canonical, not muted-as-future, not typeable).
**Warning signs:** Snapshot of FileScaffold missing blank lines that exist in `Exercise.text`.

### Pitfall 5: `innerHTML` of GitHub blob text

**What goes wrong:** `</pre><script>` / markdown in a fetched file becomes XSS.
**Why it happens:** Syntax highlighting temptation (Pitfall 8).
**How to avoid:** React text children only. Test fixture text `'<img src=x onerror=alert(1)>'` appears as characters, no extra `<img>`. Grep `dangerouslySetInnerHTML` / `innerHTML` stays zero. [CITED: react.dev — dangerouslySetInnerHTML is an XSS hole for untrusted data]
**Warning signs:** New DOM sink in FileScaffold; highlight.js / Prism.

### Pitfall 6: Persist `onComplete` on every unit

**What goes wrong:** N History rows; or only last unit persisted (SUMMARY.md "last-unit-only sessions").
**Why it happens:** CaptureSurface already fires `onComplete` per slice completion (D-07 fire-once **per remount**).
**How to avoid:** App wrapper: if `unitIndex < curriculum.length - 1` advance; else flatten + existing persist. Fallback 1-unit file: first complete **is** last — still FileScaffold, still one Session.

### Pitfall 7: UTF-16 `String.slice` on the file

**What goes wrong:** Phase 3 uncompletable-exercise bug returns for emoji in comments.
**Why it happens:** `PlanUnit.start/end` are code-point offsets (`parse/types.ts` comment).
**How to avoid:** `Array.from` → `slice` → `join`. Golden: supplementary-plane char **inside** a unit and **in a gap**.
**Warning signs:** Slice starts one character early after 😀.

### Pitfall 8: Tab switch treated as reset

**What goes wrong:** Typing lost when peeking at Paste; or GitHub tree discarded on paste load (tree should stay — Phase 7 D-04 — but **scaffold** must clear on actual `handleLoad`).
**Why it happens:** Conflating tab hide with load.
**How to avoid:** Tab only `display:none`. `handleLoad` clears scaffold. `startScaffold` last-wins vs in-progress scaffold.

### Pitfall 9: `scrollIntoView` ignored / fights reduced motion

**What goes wrong:** Current unit off-screen in a 400-line file; or smooth pan against `prefers-reduced-motion: reduce`.
**Why it happens:** happy-dom has no real layout; easy to skip the call.
**How to avoid:** `useLayoutEffect` on `unitIndex` + start: `el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: prefersReducedMotion() ? 'instant' : 'smooth' })`. Same `matchMedia('(prefers-reduced-motion: reduce)')` idea as CaptureSurface paste-block. [CITED: MDN scrollIntoView behavior instant|smooth|auto; MDN prefers-reduced-motion] Spy the method in tests; do not assert `scrollTop`.
**Warning signs:** No `scrollIntoView` in FileScaffold; `behavior: 'smooth'` with no reduce branch.

### Pitfall 10: App.test idle `onPlanned` left as-is

**What goes wrong:** The Phase 8 test `holds onPlanned FilePlan in memory without starting the trainer` fails or, if updated wrong, re-locks the idle bug.
**Why it happens:** That test **is** the Phase 8 success criterion. Phase 9 inverts it.
**How to avoid:** Rewrite: `onPlanned` mounts `#capture-surface` with the **slice**, not the full file; FileScaffold landmark present; `handleLoad` still whole-file.

### Pitfall 11: Post-results Escape double-persists with stale last snapshot

**What goes wrong:** After last-unit persist, Restart remounts last unit; completing again `push`es a second last-unit snapshot **on top of** the already-flattened-and-saved copies still in the ref → second History row with duplicated last unit, or worse duplicated 0..n-1 plus two lasts.
**Why it happens:** Paste Restart is a full reset; scaffold Restart is not.
**How to avoid:** On last-unit persist, either (a) clear curriculum (session done; Restart becomes a no-op until a new load — closest to D-18 abandon-via-new-load), or (b) pop the last snapshot, `setMetrics(null)`, remount last unit, allow a second persist (paste-like retry). **Recommend (a)** unless UI-SPEC wants retry: D-18 says no whole-file restart; results already shown. If (b), pop last snapshot before remount.

## Code Examples

Verified patterns from this repo and official docs.

### Slice (D-19)

```typescript
// Source: src/parse/types.ts (code-point start/end) + PROJECT.md Phase 3 Array.from
export function sliceUnit(text: string, start: number, end: number): string {
  return Array.from(text).slice(start, end).join('')
}
```

Never `exercise.text.slice(unit.start, unit.end)`.

### CaptureSurface stays ignorant

```tsx
// Source: src/ui/CaptureSurface.tsx props — do not grow them
<CaptureSurface
  key={loadToken}
  text={sliceUnit(exercise.text, unit.start, unit.end)}
  onRestartRequested={handleUnitRestart}
  onComplete={handleUnitComplete}
/>
```

Paste path keeps `text={exercise.text}` and `onComplete={handleComplete}` (persist).

### Static region: React text, not HTML

```tsx
// Source: React docs — do not use dangerouslySetInnerHTML for untrusted corpus
<pre className={role === 'future' ? 'text-muted' : undefined} style={{ userSelect: 'text' }}>
  {glyphFor ? renderGlyphs(slice) : slice}
</pre>
```

`renderGlyphs` maps code points through `glyphFor` for space/newline only (same as CaptureSurface). Discretion vs raw `<pre>`.

### scrollIntoView + reduced motion

```typescript
// Source: MDN Element.scrollIntoView + CaptureSurface prefersReducedMotion()
el.scrollIntoView({
  block: 'nearest',
  inline: 'nearest',
  behavior:
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 'instant'
      : 'smooth',
})
```

Default `block` is `'start'` — would yank a mid-file current unit under a sticky header. Use `'nearest'`.

### Flatten seq (frozen rows)

```typescript
// Source: capture.ts Object.freeze per event; repository already copies arrays
function flattenSnapshots(snaps: Snapshot[]): Pick<Session, 'events' | 'charLog' | 'markers'> {
  let seq = 0
  const events = snaps.flatMap((s) => s.events.map((e) => ({ ...e, seq: seq++ })))
  const charLog = snaps.flatMap((s) => s.charLog.map((c) => ({ ...c, seq: seq++ })))
  const markers = snaps.flatMap((s) => s.markers.map((m) => ({ ...m, seq: seq++ })))
  return { events, charLog, markers }
}
```

Discretion: interleave per-snapshot instead of events-all-then-charLog-all if seq-reconciliation ever matters. Metrics and analytics do not join on seq today (`src/capture/types.ts`: charLog reconciled by seq **within** a live session, never merged). Concatenating three arrays separately is enough; a single monotonic seq across types is nicer-to-have.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| App `onPlanned={setFilePlan}` idle | `startScaffold` starts unit 0 | this phase | Invert App.test idle case |
| CaptureSurface `text={exercise.text}` always | Slice when curriculum set | this phase | SCAF-01/05 split |
| `handleRestart` = whole session | Unit-only when scaffolding | this phase | SCAF-04 |
| `handleComplete` always `buildSession()` live | Flatten snapshots on last unit | this phase | SCAF-03 |
| Phase 8 UAT History github skipped | Checkable after persist | this phase | D-21 |
| Pixel overlay / cloze | Stacked source-order chrome | locked 2026-09-20 | Do not relitigate |

**Deprecated/outdated:**
- Phase 8 success "trainer stays idle" / empty-state "GitHub cannot start a session."
- ARCHITECTURE.md suggestion "do not resetCapture between units" — the same doc then **picks (1)** reset + concat because otherwise `computeTrainerState(unitText)` desyncs. Implement pick (1).
- `08-RESEARCH.md` "CaptureSurface / handleLoad NOT called" — handleLoad still must not be called; CaptureSurface **is** called with a slice.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Metrics `target` = curriculum-order join of unit slices; `Session.exercise.text` stays the source-order file | Pattern 4 / Pitfall 2 | If user wanted WPM vs full file as a tape, numbers are "wrong" in a different way — still the only honest replay. Confirm only if discuss-phase reopens D-14. |
| A2 | Inter-unit trivia is painted as static **gap** segments, not added to curriculum | Pattern 2 | If planner later expands units to include trivia, gaps become empty — still correct. |
| A3 | After last-unit persist, Restart/Escape should not start a second persist (option a) | Pitfall 11 | UI-SPEC may want last-unit retry like paste Restart. |
| A4 | Reuse `glyphFor` in done/future for continuity | Discretion | Raw `<pre>` is equally valid; UI-SPEC picks one. |
| A5 | No new packages | Standard Stack | If UI-SPEC demands a virtualizer, that is a later phase (100 KB cap bounds a full `<pre>`). |

**Seam-tagged `[ASSUMED]` count:** A1–A5 are implementation recommendations inside locked D-14/D-01, not new product forks.

## Open Questions

1. **Post-results Restart (Pitfall 11)**
   - What we know: Paste Restart allows another persist. D-16/D-18 unit-only, no whole-file restart.
   - What's unclear: whether completing the last unit again should write a second History row.
   - Recommendation: After persist, keep ResultsView; Restart remounts last unit for display but **do not** arm another `saveSession` until a new `startScaffold` / `handleLoad` (or pop-last + explicit retry if UI-SPEC says so).

2. **COPY / FileScaffold layout numbers**
   - What we know: UI hint yes; 07-UI-SPEC inherited tokens; no new palette unless UI-SPEC.
   - What's unclear: exact landmark string, Restart label, empty-state sentence, file chrome `max-height`.
   - Recommendation: Planner waits for UI-SPEC (or drafts COPY in FileScaffold in Phase 7 voice). Landmark shape `"N / M"` + optional `` `${kind} ${name}` ``. Empty-state must mention GitHub files once D-07 ships so "Load exercise" is not the only door.

3. **`assembleSessionFromLogs` vs inline in App**
   - What we know: `buildSession` is live-read only.
   - What's unclear: whether to add a sibling in `session.ts`.
   - Recommendation: Yes — one function, tested next to `buildSession`, App stays thin. Not a capture.ts change.

## Environment Availability

Step 2.6: no new external tools. Existing toolchain is present.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest / Vite | ✓ | v24.16.0 | — |
| pnpm | scripts | ✓ | 11.5.3 | — |
| happy-dom (via Vitest ui project) | FileScaffold / App tests | ✓ | ^20.14.0 | — |
| Dexie / fake-indexeddb | SCAF-03 persist tests | ✓ | already in repo | — |
| Live GitHub | — | n/a | — | **Do not use** in unit tests |
| tree-sitter WASM | — | n/a this phase | — | FilePlan fixtures; do not import `parse/wasm.ts` in new tests |
| Context7 CLI | docs | ✗ | — | Official URLs via WebFetch (done) |

**Missing dependencies with no fallback:** none.

**Nyquist validation:** `workflow.nyquist_validation` is `false` in `.planning/config.json` — Validation Architecture section omitted.

### Test strategy (for the planner — not a Nyquist map)

| Area | File | Notes |
|------|------|-------|
| slice / cover / flatten | `src/scaffold/*.test.ts` | Node `unit` project. No DOM. Emoji + gap + 2-unit concat. |
| FileScaffold | `src/ui/FileScaffold.test.tsx` | happy-dom. Fixture `FilePlan`. Current region has `#capture-surface`; future has **zero** textareas. Source order vs curriculum order. XSS fixture is text. Spy `scrollIntoView`. |
| App wiring | `src/ui/App.test.tsx` | Invert idle `onPlanned`. 2-unit complete → one `listNewestFirst` row, `exercise.text` full file, `sourceType: 'github'`. Escape after unit 1 started does not put unit 0 slice back. `handleLoad` unmounts FileScaffold / whole-file textarea. Fallback 1-unit still has FileScaffold landmark. Multi-unit: CaptureSurface `text` ≠ full file. |
| History UAT | `HistoryView.test.tsx` already has github `sourceRef`; add App-level persist path + 08-UAT test 2 in phase verification | D-21: do not rebuild the ternary |
| Capture / WASM / client | — | Do not add capture.ts tests unless a bug is proven. Zero `api.github.com`. Zero `Language.load`. |

Quick run: `pnpm test`. UI: existing happy-dom trusted `InputEvent` helpers in `App.test.tsx` / `CaptureSurface.test.tsx`.

**Must update:** `App.test.tsx` `holds onPlanned FilePlan in memory without starting the trainer`.

**Must not update unless copy changes:** `RepoBrowser.test.tsx` (still no CaptureSurface child). `HistoryView.test.tsx` github case already passes with `saveSession` fixtures.

## Security Domain

`security_enforcement` is enabled (ASVS level 1). `security_block_on: high`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Public GitHub already; no PAT |
| V3 Session Management | no | No app auth cookies |
| V4 Access Control | no | Single-user local SPA |
| V5 Input Validation | yes | Corpus already capped 100 KB + UTF-8 at ingest. FileScaffold must treat blob text as **data**. No `eval`, no markdown, no HTML. |
| V6 Cryptography | no | No new crypto |

### Known Threat Patterns for FileScaffold + untrusted GitHub corpus

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via file chrome (`innerHTML` / highlighter) | Tampering / Elevation | React text nodes / `glyphFor` only; grep for `innerHTML` stays 0 [CITED: react.dev] |
| XSS via current-unit textarea | Tampering | Native textarea text; CaptureSurface already 1:1; no `insertAdjacentHTML` |
| Script in dimmed future units still "looks clickable" | Spoofing | Not a textarea; clicks do not type; `user-select` OK |
| Huge 100 KB file janks / lock tab | Denial of service | Cap already at ingest; do not virtualize this phase; static regions must **not** subscribe to rAF (`useCharLogTick` stays inside CaptureSurface only) |
| Persist attacker-controlled huge Session | Denial of service | Same 100 KB exercise blob as paste; Dexie unchanged |
| Double `saveSession` / duplicate History | Tampering (integrity of log) | Last unit only; Pitfall 11 |
| Teaching CaptureSurface `dangerouslySetInnerHTML` for glyphs | Tampering | Keep `glyphFor` text in `<span>` as today |
| Fetch from FileScaffold | Information disclosure | No fetch. `github/client.ts` remains the only `fetch` module |

### Threat-model checklist for the planner

- [ ] No `innerHTML` / `dangerouslySetInnerHTML` in FileScaffold or App
- [ ] Future/done/gap are not `<textarea>`
- [ ] CaptureSurface `text` is never the full file for `units.length > 1`
- [ ] Static regions do not re-render per keystroke (no rAF on the file chrome — Pitfall "full-file React reconciliation")
- [ ] Tests include a payload that would execute if HTML-interpreted

## Sources

### Primary (HIGH confidence — live codebase this session)

- `src/ui/App.tsx` — `filePlan` idle, `handleLoad` / `handleRestart` / `handleComplete`, `loadToken`, hide-not-unmount, CaptureSurface `text={exercise.text}`
- `src/ui/CaptureSurface.tsx` — props, Escape → `onRestartRequested`, `onComplete` fire-once, overlay, `prefersReducedMotion`
- `src/parse/types.ts` — code-point `start`/`end`
- `src/parse/plan.ts` — named children, non-overlapping, not full-cover; `fallbackPlan`
- `src/trainer/state.ts` — `Array.from`, `glyphFor`
- `src/capture/capture.ts` — `resetCapture` / getters; freeze; no restore API
- `src/session.ts` — live `buildSession`
- `src/metrics/metrics.ts` — `replayAttempts(target, charLog)`
- `src/metrics/resolve-metrics.ts` — snapshot vs recompute on `exercise.text`
- `src/ui/HistoryView.tsx` — github `sourceRef` ternary (D-21 already done)
- `src/ui/RepoBrowser.tsx` — `onPlanned(plan)`; fallback COPY in status region
- `src/ui/App.test.tsx` — idle `onPlanned` test to invert
- `.planning/phases/08-parse-dependency-units/08-UAT.md` — skipped test 2
- `.planning/research/ARCHITECTURE.md` Pattern 2 pick (1); Anti-Patterns 2–3
- `.planning/research/PITFALLS.md` Pitfall 5, 6, 8, UX table
- `package.json` / `vite.config.ts` — versions, happy-dom ui project

### Secondary (MEDIUM confidence — official docs fetched this session)

- https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView — `behavior` instant/smooth/auto; `block` nearest vs default start
- https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion — `reduce` vs `no-preference`
- https://react.dev/reference/react-dom/components/common — `dangerouslySetInnerHTML` XSS warning

### Tertiary (LOW confidence)

- classify-confidence seam rates `webfetch` LOW even for MDN/React (same as Phase 8)
- A1 metrics-target split is deduced from `replayAttempts` + leaves-first order, not a user-facing sentence in CONTEXT.md (CONTEXT says concatenate + full `Exercise.text` + existing metrics writer)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; versions from `package.json`
- Architecture: HIGH — seams read from source; Pattern 2 pick (1) locked; source-order vs curriculum-order is the layout rule D-01 implies
- Pitfalls: HIGH — Pitfall 5/6 from v2.0 research plus live `handleRestart` / `handleComplete` / metrics replay
- Metrics typed-target: HIGH as a **correctness** claim against `metrics.ts`; MEDIUM as product wording (A1)

**Research date:** 2026-09-20
**Valid until:** 30 days (stable SPA patterns; no fast-moving npm pin this phase)
