---
phase: 09-scaffolded-trainer
plan: 01
subsystem: scaffold
tags: [code-point, slice, cover, flatten, session, tdd]

requires:
  - phase: 08-parse-dependency-units
    provides: PlanUnit start/end as exclusive code-point offsets; FilePlan units in leaves-first curriculum order
  - phase: 01-corpus-capture
    provides: Session shape, frozen capture rows, buildSession live-read contract, isolation probes
provides:
  - sliceUnit and joinUnitSlices (Array.from then slice then join)
  - coverFile source-order unit/gap segments with curriculum roles
  - flattenSnapshots concat + seq remap on new objects
  - assembleSessionFromLogs sibling of buildSession (no live getters)
affects: [09-02 FileScaffold chrome, App last-unit persist, metrics typedTarget]

tech-stack:
  added: []
  patterns:
    - Code-point Array.from slice join — never UTF-16 String.slice on Exercise.text
    - Sort a copy of units by start; classify role from curriculum index
    - Spread-copy frozen capture rows and remap seq; do not assign through freeze
    - Isolation probes live in session.ts for both live and flattened persist paths

key-files:
  created:
    - src/scaffold/slice.ts
    - src/scaffold/slice.test.ts
    - src/scaffold/cover.ts
    - src/scaffold/cover.test.ts
    - src/scaffold/flatten.ts
    - src/scaffold/flatten.test.ts
    - src/session.test.ts
  modified:
    - src/session.ts

key-decisions:
  - "sliceUnit walks Array.from(text).slice(start, end).join(''); UTF-16 String.slice is locked as the wrong extractor on the 😀 golden"
  - "joinUnitSlices is the metrics typedTarget (curriculum order); Session.exercise.text stays the source-order file"
  - "coverFile sorts a copy by start, fills trivia holes as { kind: 'gap' } with no role, and treats unitIndex >= length as all done"
  - "flattenSnapshots remaps seq with one monotonic counter across events, then charLog, then markers, spreading onto new objects"
  - "assembleSessionFromLogs is a sibling of buildSession; buildSession still reads live getters; unit-separator markers omitted"

patterns-established:
  - "src/scaffold/ is PURE — zero React, zero WASM, zero github/client"
  - "typedTarget = joinUnitSlices; display cover = coverFile; persist exercise = full file"

requirements-completed: [SCAF-01, SCAF-03]

coverage:
  - id: D1
    description: "sliceUnit extracts by code point (😀 golden) and joinUnitSlices concatenates curriculum-order unit slices, not source-order file text"
    requirement: SCAF-03
    verification:
      - kind: unit
        ref: "src/scaffold/slice.test.ts#extracts the emoji in 'a😀b' as the code point at [1, 2)"
        status: pass
      - kind: unit
        ref: "src/scaffold/slice.test.ts#joins leaves-first units of 'aa\\nbb\\n' as 'bb\\naa\\n', not the source text"
        status: pass
    human_judgment: false
  - id: D2
    description: "coverFile emits source-order segments with trivia gaps, fallback no-gaps, leaves-first roles, empty-units whole-file gap, and emoji-in-gap as one code point"
    requirement: SCAF-01
    verification:
      - kind: unit
        ref: "src/scaffold/cover.test.ts#emits one gap whose slice equals the blank line between two units"
        status: pass
      - kind: unit
        ref: "src/scaffold/cover.test.ts#paints source-order a then b while unitIndex 0 keeps leaves-first b current and a future"
        status: pass
      - kind: unit
        ref: "src/scaffold/cover.test.ts#counts an emoji inside a gap as one code point, not two UTF-16 units"
        status: pass
    human_judgment: false
  - id: D3
    description: "flattenSnapshots concatenates snapshot arrays, remaps seq uniquely, does not mutate frozen input, and omits unpushed restart rows"
    requirement: SCAF-03
    verification:
      - kind: unit
        ref: "src/scaffold/flatten.test.ts#concatenates two snapshots' charLog in snapshot order"
        status: pass
      - kind: unit
        ref: "src/scaffold/flatten.test.ts#does not mutate frozen input rows when remapping seq"
        status: pass
    human_judgment: false
  - id: D4
    description: "assembleSessionFromLogs passes through full-file exercise, copies isolation probes, does not call capture getters; buildSession still reads live getters"
    requirement: SCAF-03
    verification:
      - kind: unit
        ref: "src/session.test.ts#passes the full-file exercise through, keeps startedAt, and copies isolation probes"
        status: pass
      - kind: unit
        ref: "src/session.test.ts#does not call getEvents, getCharLog, or getMarkers"
        status: pass
      - kind: other
        ref: "pnpm exec tsc --noEmit -p tsconfig.json; git diff -- src/capture/capture.ts src/ui/CaptureSurface.tsx empty"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-09-21
status: complete
---

# Phase 09 Plan 01: Pure Scaffold Core Summary

**Code-point sliceUnit/joinUnitSlices, source-order coverFile with trivia gaps, flattenSnapshots seq remap, and assembleSessionFromLogs without live capture**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-21T01:55:09Z
- **Completed:** 2026-09-21T02:00:26Z
- **Tasks:** 3/3 (6 TDD commits: RED+GREEN each)
- **Files modified:** 8

## Accomplishments

- `sliceUnit` extracts exclusive code-point ranges via `Array.from` → `slice` → `join`; `joinUnitSlices` is the leaves-first metrics `typedTarget` and is not equal to source-order `Exercise.text`
- `coverFile` paints the whole file as source-order unit/gap segments: trivia holes become `{ kind: 'gap' }`, roles come from curriculum index, fallback one-unit cover emits no gaps
- Last-unit persist can assemble one `Session` from frozen unit snapshots: `flattenSnapshots` remaps `seq` onto new objects; `assembleSessionFromLogs` copies isolation probes and never reads live capture getters; `buildSession` is unchanged

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED: failing sliceUnit/joinUnitSlices tests** - `68dcb01` (test)
2. **Task 1 GREEN: implement sliceUnit and joinUnitSlices** - `eea7d08` (feat)
3. **Task 2 RED: failing coverFile tests** - `2168edb` (test)
4. **Task 2 GREEN: implement coverFile with source-order gaps** - `0b806f7` (feat)
5. **Task 3 RED: failing flatten and assembleSessionFromLogs tests** - `f4b6734` (test)
6. **Task 3 GREEN: implement flattenSnapshots and assembleSessionFromLogs** - `c78fcd2` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/scaffold/slice.ts` - `sliceUnit` / `joinUnitSlices` code-point helpers
- `src/scaffold/slice.test.ts` - emoji golden, UTF-16 contrast, leaves-first join ≠ source
- `src/scaffold/cover.ts` - `coverFile` + `ScaffoldSegment` source-order cover
- `src/scaffold/cover.test.ts` - gaps, fallback, leaves-first roles, empty units, mutation lock
- `src/scaffold/flatten.ts` - `UnitSnapshot` + `flattenSnapshots` concat and seq remap
- `src/scaffold/flatten.test.ts` - 2-unit concat, unique seq, freeze, restart-not-pushed
- `src/session.ts` - added `assembleSessionFromLogs`; `buildSession` body unchanged
- `src/session.test.ts` - full-file exercise, no live getters, field-order vs `buildSession`

## Decisions Made

- Typed target for metrics is curriculum-order `joinUnitSlices`; persisted `Session.exercise.text` stays the source-order file (`resolve-metrics` fallback trap documented, Dexie unchanged)
- Gaps have no `role` field — FileScaffold will paint them like done
- Seq remap uses one monotonic counter across events, then charLog, then markers (RESEARCH Pattern 4)
- Unit-separator markers omitted (CONTEXT discretion)
- Isolation probes stay in `session.ts`; App must not duplicate them in 09-02

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** None

## Issues Encountered

None

## Authentication Gates

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 09-02 FileScaffold chrome + App curriculum. Pure helpers are synchronous with no module-level cache. `capture.ts` and `CaptureSurface.tsx` are unmodified. User-visible SCAF-01 (typeable current unit in file chrome) and SCAF-03 (results + persist) still need App wiring in 09-02.

## TDD Gate Compliance

Each of the three `tdd="true"` tasks produced a `test(09-01)` RED commit followed by a `feat(09-01)` GREEN commit. No REFACTOR commits (implementations matched RESEARCH patterns with no cleanup).

## Verification

- `pnpm exec vitest run --project unit src/scaffold/slice.test.ts src/scaffold/cover.test.ts src/scaffold/flatten.test.ts src/session.test.ts` — 4 files, 20 tests, exit 0
- `pnpm exec tsc --noEmit -p tsconfig.json` — exit 0
- `git diff -- src/capture/capture.ts src/ui/CaptureSurface.tsx` — empty
- No new packages in `package.json`

## Self-Check: PASSED

---
*Phase: 09-scaffolded-trainer*
*Completed: 2026-09-21*
