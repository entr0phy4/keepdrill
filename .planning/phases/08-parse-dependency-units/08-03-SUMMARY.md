---
phase: 08-parse-dependency-units
plan: 03
subsystem: parse
tags: [planUnits, FilePlan, utf16, tree-sitter, topo, Kahn, PLAN-01, PLAN-02, PLAN-03]

requires:
  - phase: 01-paste-type-capture
    provides: Exercise type, Array.from code-point indexing in trainer/state.ts
  - phase: 07-github-url-repo-tree
    provides: PURE named-child walk analog (foldTree), Case[] + it.each goldens
provides:
  - TsNode / PlanUnit / FilePlan / PlanUnitKind contracts with code-point start/end
  - utf16ToCodePoint (UTF-16 index → code-point offset via Array.from(slice))
  - planUnits non-overlapping namedChildren cover + fallbackPlan whole-file unit
  - Leaves-first in-file identifier topo with cycle leftovers by source start
affects: [08-04 wasm parse seam, 09 scaffolded trainer chrome]

tech-stack:
  added: []
  patterns:
    - plan.ts and utf16.ts are PURE; they must not import web-tree-sitter
    - Tests inject TsNode fixtures; never Language.load
    - Unit ids are kind-start-seq; fallback file unit id is file

key-files:
  created:
    - src/parse/types.ts
    - src/parse/utf16.ts
    - src/parse/utf16.test.ts
    - src/parse/plan.ts
    - src/parse/plan.test.ts
  modified: []

key-decisions:
  - "Unit ids are ${kind}-${start}-${seq} so equal-start cycle members stay unique for dependsOn"
  - "Import units never emit dependsOn; specifiers are definitions (in-degree 0)"
  - "plan.ts and utf16.ts stay PURE with zero WASM imports; 08-04 owns Parser.init"

patterns-established:
  - "Walk program namedChildren only; merge consecutive import_statement; do not merge consecutive type decls"
  - "Class/abstract class is one unit; nested functions are not collected because they are not program named children"
  - "utf16ToCodePoint = Array.from(text.slice(0, utf16Index)).length before recording PlanUnit start/end"
  - "Kahn ready queue is in-degree 0 sorted by start; leftover cycle members stable-sorted by start"

requirements-completed: [PLAN-01, PLAN-02, PLAN-03]

coverage:
  - id: D1
    description: "utf16ToCodePoint maps UTF-16 indices through Array.from so a supplementary-plane emoji is one code point"
    requirement: PLAN-01
    verification:
      - kind: unit
        ref: "src/parse/utf16.test.ts#maps 'a😀b' UTF-16 indices onto code-point offsets"
        status: pass
      - kind: unit
        ref: "src/parse/utf16.test.ts#counts an emoji outside a later range as one code point, not two"
        status: pass
      - kind: other
        ref: "grep utf16.ts has no web-tree-sitter import"
        status: pass
    human_judgment: false
  - id: D2
    description: "Non-overlapping syntactic cover: merged imports, class-as-one-unit, nested functions stay in parent, export range includes export, consecutive types do not merge"
    requirement: PLAN-01
    verification:
      - kind: unit
        ref: "src/parse/plan.test.ts#planUnits — golden cover (PLAN-01, PLAN-03)"
        status: pass
      - kind: other
        ref: "grep plan.ts has no web-tree-sitter import"
        status: pass
    human_judgment: false
  - id: D3
    description: "Empty namedChildren or only ERROR yields fallback true and exactly one file unit covering [0, Array.from(text).length)"
    requirement: PLAN-03
    verification:
      - kind: unit
        ref: "src/parse/plan.test.ts#empty namedChildren yields fallback file unit covering the whole text"
        status: pass
      - kind: unit
        ref: "src/parse/plan.test.ts#only ERROR named children yield fallback file unit"
        status: pass
      - kind: unit
        ref: "src/parse/plan.test.ts#never returns an empty units array"
        status: pass
    human_judgment: false
  - id: D4
    description: "Leaves-first identifier topo: callee before caller, imports in-degree 0 first, cycles leftover by start, property_identifier ignored"
    requirement: PLAN-02
    verification:
      - kind: unit
        ref: "src/parse/plan.test.ts#orders callee B before caller A even when A appears first in source"
        status: pass
      - kind: unit
        ref: "src/parse/plan.test.ts#keeps an import that defines a used specifier first (in-degree 0)"
        status: pass
      - kind: unit
        ref: "src/parse/plan.test.ts#concatenates cycle leftovers after the Kahn prefix, sorted by start"
        status: pass
      - kind: unit
        ref: "src/parse/plan.test.ts#ignores property_identifier so foo.bar does not depend on bar"
        status: pass
      - kind: unit
        ref: "src/parse/plan.test.ts#keeps equal-start leftover cycle members in source order"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-09-20
status: complete
---

# Phase 8 Plan 3: Parse Dependency Units Planner Summary

**Pure `planUnits` over TsNode fixtures: non-overlapping syntactic cover, UTF-16→code-point ranges, whole-file fallback, and leaves-first Kahn order with cycle leftovers by source start — zero WASM**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-20T23:36:49Z
- **Completed:** 2026-09-20T23:45:32Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `src/parse/types.ts` exports `TsNode`, `PlanUnit`, `FilePlan`, `PlanUnitKind` with code-point `start`/`end` and no WASM import
- `utf16ToCodePoint` converts tree-sitter UTF-16 indices via `Array.from(text.slice(0, utf16Index)).length`
- `planUnits` walks program `namedChildren` only: consecutive imports merge; class is one unit; nested functions stay in the parent; `export` keeps the export-node range; consecutive type decls stay separate; leftover named children are `other`
- Empty / only-ERROR / zero collected units call `fallbackPlan` — never `units: []`
- In-file identifier/`type_identifier` graph + Kahn topo; imports stay in-degree 0; `property_identifier` is ignored; cycle leftovers concatenate after the Kahn prefix, sorted by `start`

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1: FilePlan types and utf16ToCodePoint**
   - `e9acbf7` (test) add failing utf16ToCodePoint tests
   - `5415152` (feat) implement utf16ToCodePoint and FilePlan types
2. **Task 2: Non-overlapping cover (PLAN-01, PLAN-03)**
   - `233ad59` (test) add failing planUnits cover / fallback tests
   - `959c52d` (feat) implement cover policy and fallbackPlan
3. **Task 3: Leaves-first identifier topo (PLAN-02)**
   - `49c0349` (test) add failing topo / cycle / property_identifier tests
   - `3171ccc` (feat) identifier graph + Kahn order

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/parse/types.ts` — named types only: TsNode, PlanUnit, FilePlan, PlanUnitKind
- `src/parse/utf16.ts` — PURE utf16ToCodePoint, zero imports
- `src/parse/utf16.test.ts` — U+1F600 outside a range and shifting a later index
- `src/parse/plan.ts` — PURE planUnits + fallbackPlan + Kahn topo
- `src/parse/plan.test.ts` — TsNode fixtures; 24 unit tests; never Language.load

## Decisions Made

- Unit ids are `` `${kind}-${start}-${seq}` `` so two units with the same start (cycle leftover fixture) do not collide in `dependsOn`
- Import units never emit `dependsOn` — specifier identifiers are definitions, not in-file uses, so imports stay in-degree 0
- `plan.ts` and `utf16.ts` must not import the WASM runtime; 08-04 is the sole `web-tree-sitter` seam

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** Plan executed exactly as written. Unit id seq suffix is within the plan's "kind-start or similar" allowance.

## Issues Encountered

None

## TDD Gate Compliance

RED and GREEN gate commits present for all three tasks (`test(08-03)` then `feat(08-03)`). No REFACTOR commit (implementation stayed minimal).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 08-04 (WASM parse seam + RepoBrowser `onPlanned`). `planUnits(root, exercise)` is the planner 08-04 should call after `Language.load`; tests must keep injecting fixtures.

## Self-Check: PASSED

- FOUND: src/parse/types.ts
- FOUND: src/parse/utf16.ts
- FOUND: src/parse/utf16.test.ts
- FOUND: src/parse/plan.ts
- FOUND: src/parse/plan.test.ts
- FOUND: e9acbf7, 5415152, 233ad59, 959c52d, 49c0349, 3171ccc
- Verification: `pnpm exec vitest run --project unit src/parse/plan.test.ts src/parse/utf16.test.ts` — 24 passed
- plan.ts and utf16.ts have no web-tree-sitter import

---
*Phase: 08-parse-dependency-units*
*Completed: 2026-09-20*
