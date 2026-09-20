---
phase: 06-cross-session-analytics
plan: 03
subsystem: ui
tags: [analytics-dashboard, heatmap, digraph-table, language-profile, hide-not-unmount]

requires:
  - phase: 06-cross-session-analytics
    provides: "computeDigraphLatency + computeLanguageProfile; computeKeyboardHeatmap; HeatmapCell / DigraphEntry / LanguageProfileRow"
  - phase: 04-session-persistence-history
    provides: "useLiveQuery(listNewestFirst) History read path; hide-not-unmount trainer wrapper; CorpusInput outside the view switch"
provides:
  - "AnalyticsDashboard three-way live-query branch (loading / page-empty / stacked sections)"
  - "DigraphLatencyView semantic table + KeyboardHeatmap US-ANSI diagram + LanguageProfileView table"
  - "App view union trainer | history | analytics with third nav button and D-08 hide-not-unmount"
affects: [phase-verification, human-check]

tech-stack:
  added: []
  patterns:
    - "Analytics tables are semantic <table class=analytics-table>, not ResultsView ol / HistoryRow lists"
    - "Heatmap fill is relative color-mix via --kb-fill; unused keys stay --color-surface with no number"
    - "View switch is a third sibling of History: display ternary on trainer, conditional mount of AnalyticsDashboard"

key-files:
  created:
    - src/ui/AnalyticsDashboard.tsx
    - src/ui/AnalyticsDashboard.test.tsx
    - src/ui/DigraphLatencyView.tsx
    - src/ui/KeyboardHeatmap.tsx
    - src/ui/KeyboardHeatmap.test.tsx
    - src/ui/LanguageProfileView.tsx
  modified:
    - src/index.css
    - src/ui/App.tsx
    - src/ui/App.test.tsx

key-decisions:
  - "Heatmap sampled fill is stored on --kb-fill because happy-dom drops color-mix on the background shorthand; browsers still paint via background: var(--kb-fill)"
  - "Digraph and language rankings use UI-SPEC semantic tables, not the PATTERNS.md ResultsView ol / HistoryRow analog"

patterns-established:
  - "Display-layer lerp and Math.round live in the heatmap/table leaves, never in analytics/ folds"
  - "Third header item follows the same hide-not-unmount + CorpusInput-stays-visible contract as History"

requirements-completed: [ANLY-03, ANLY-04, ANLY-05]

coverage:
  - id: D1
    description: "Third header item Analytics; Trainer is default aria-current; hide-not-unmount round-trip preserves textarea identity, charLog, statuses, and caret; CorpusInput stays mounted"
    requirement: "ANLY-03"
    verification:
      - kind: unit
        ref: "src/ui/App.test.tsx — three nav buttons; Analytics aria-current; D-08 Analytics round-trip; #corpus-paste present"
        status: pass
    human_judgment: false
  - id: D2
    description: "AnalyticsDashboard heading Analytics; undefined → Loading analytics…; [] → History-matching empty copy and no sections; ≥1 session mounts Slowest digraphs → Keyboard heatmap → Language profile"
    requirement: "ANLY-03"
    verification:
      - kind: unit
        ref: "src/ui/AnalyticsDashboard.test.tsx — loading vs empty vs populated section order"
        status: pass
    human_judgment: false
  - id: D3
    description: "DigraphLatencyView empty copy when rows=[]; populated semantic table Digraph/Median/Samples with glyphFor chips, rounded ms, sample count; no row click"
    requirement: "ANLY-03"
    verification:
      - kind: unit
        ref: "src/ui/AnalyticsDashboard.test.tsx — DigraphLatencyView empty and populated cases"
        status: pass
    human_judgment: false
  - id: D4
    description: "KeyboardHeatmap always mounts a role=group figure; sampled keys show relative amber color-mix + rounded ms; unused keys surface fill and no number; ungated caption when every medianMs is null"
    requirement: "ANLY-04"
    verification:
      - kind: unit
        ref: "src/ui/KeyboardHeatmap.test.tsx — figure group, ungated caption, relative mix 0%/100%/50%, unused surface"
        status: pass
    human_judgment: true
    rationale: "Tests prove structure, copy, and color-mix percentages; sequential amber vs green/red score coloring and 320px overflow are visual/human checks queued end-of-phase"
  - id: D5
    description: "LanguageProfileView table with Language/WPM/Adj. WPM/Accuracy/Sessions; plaintext is a raw key-chip; adj. WPM always shown"
    requirement: "ANLY-05"
    verification:
      - kind: unit
        ref: "src/ui/AnalyticsDashboard.test.tsx — LanguageProfileView plaintext chip and rounded companion metrics"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-09-20
status: complete
---

# Phase 6 Plan 03: Analytics Dashboard UI Summary

**Stacked Analytics sibling view: semantic top-10 digraph table, static US-ANSI amber heatmap with on-key ms, and per-language profile including plaintext — hide-not-unmount from a third header item**

## Performance

- **Duration:** 7 min
- **Started:** 2026-09-20T18:21:59Z
- **Completed:** 2026-09-20T18:28:48Z
- **Tasks:** 3/3 (each TDD RED→GREEN)
- **Files modified:** 9

## Accomplishments

- Third header item `Analytics` from first paint; `view` union is `'trainer' | 'history' | 'analytics'`; trainer wrapper stays `display: grid | none` so CaptureSurface is never unmounted (D-01, D-08, D-15)
- `AnalyticsDashboard` mirrors History's `useLiveQuery(listNewestFirst)` three-way branch: loading copy, page-empty copy with no sections, populated stack in digraph → heatmap → language order (D-02, D-04)
- `DigraphLatencyView` is a semantic `analytics-table` (not ResultsView's `<ol>`): at most the fold's 10 rows, `glyphFor` chips, `{n} ms`, sample count; zero eligible pairs is a section empty, heatmap and language still mount (ANLY-03, D-07, D-08)
- `KeyboardHeatmap` is a static 15-column US-ANSI diagram with relative `--heatmap-lo/--heatmap-hi` mix, on-key rounded ms, unused keys `--color-surface` with no number, diagram never replaced by a paragraph (ANLY-04, D-10..D-14)
- `LanguageProfileView` table always includes adj. WPM and shows `plaintext` as an ordinary `.key-chip` bucket (ANLY-05, D-16..D-20)

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED: failing KeyboardHeatmap tests** - `2637da5` (test)
2. **Task 1 GREEN: heatmap tokens + KeyboardHeatmap** - `c6fed38` (feat)
3. **Task 2 RED: failing dashboard/table tests** - `ab13bc6` (test)
4. **Task 2 GREEN: AnalyticsDashboard + table leaves** - `00aa4f0` (feat)
5. **Task 3 RED: failing App Analytics nav / D-08 tests** - `c056d51` (test)
6. **Task 3 GREEN: view union + third nav button** - `efd48c4` (feat)

**Plan metadata:** pending docs commit

_Note: TDD tasks produced RED→GREEN commit pairs. No REFACTOR commit — leaves matched UI-SPEC once GREEN._

## Files Created/Modified

- `src/index.css` — `--heatmap-lo/--heatmap-hi/--heatmap-key-fg` (light + dark), `.analytics-table`, `.keyboard-heatmap` 15-col grid, `.kb-key`
- `src/ui/KeyboardHeatmap.tsx` — inert `div.kb-key` diagram, relative `--kb-fill` color-mix, on-key `Math.round`
- `src/ui/KeyboardHeatmap.test.tsx` — figure group, ungated caption, sampled vs unused fill
- `src/ui/DigraphLatencyView.tsx` — Slowest digraphs table / section empty copy
- `src/ui/LanguageProfileView.tsx` — Language profile table with raw tags
- `src/ui/AnalyticsDashboard.tsx` — `useLiveQuery(listNewestFirst)` three-way branch
- `src/ui/AnalyticsDashboard.test.tsx` — loading/empty/populated + leaf table cases
- `src/ui/App.tsx` — third nav button, `'analytics'` union, `{view === 'analytics' && <AnalyticsDashboard />}`
- `src/ui/App.test.tsx` — three-button invariant + Analytics D-08 round-trip

## Decisions Made

- Heatmap sampled fill is stored on `--kb-fill` because happy-dom drops `color-mix()` on the `background` shorthand; real browsers still paint via `background: var(--kb-fill)`
- Digraph and language rankings use UI-SPEC semantic tables, not the PATTERNS.md ResultsView `<ol>` / HistoryRow analog (plan locked this)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Heatmap color-mix via `--kb-fill` custom property**
- **Found during:** Task 1 GREEN (`happy-dom` stripped `style.background` when the value was `color-mix(...)`)
- **Issue:** Assertions on `element.style.background` received `''`; inline `background: color-mix(...)` never landed in the DOM style attribute
- **Fix:** Set `--kb-fill` to the `color-mix(...)` string (or `--color-surface` for unused keys) and `background: var(--kb-fill)`. Tests assert the custom property
- **Files modified:** `src/ui/KeyboardHeatmap.tsx`, `src/ui/KeyboardHeatmap.test.tsx`
- **Verification:** `pnpm test -- src/ui/KeyboardHeatmap.test.tsx` 3/3 pass; `pnpm typecheck` exits 0
- **Committed in:** `c6fed38` (Task 1 GREEN)

---

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** Necessary for the locked color-mix contract to be testable and to actually paint in Chromium. No scope creep.

## Issues Encountered

None beyond the happy-dom `color-mix` style drop (handled as Rule 3).

## Authentication Gates

None

## Known Stubs

None

## Threat Flags

None — no new network, auth, or export surface. T-06-07 (text nodes only) and T-06-09 (inert heatmap keys / no row click) are in the leaves. CaptureSurface still has no analytics import (D-15 / T-06-SC).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 6 plans are complete. Ready for `/gsd-verify-work 06` and the end-of-phase human-check (light/dark Analytics empty + populated, mid-exercise switch, 320px heatmap overflow).

ANLY-03 / ANLY-04 / ANLY-05 user-facing surfaces are shipped.

## TDD Gate Compliance

- RED: `2637da5` (KeyboardHeatmap), `ab13bc6` (dashboard/tables), `c056d51` (App nav/D-08)
- GREEN: `c6fed38` (heatmap), `00aa4f0` (dashboard), `efd48c4` (App)
- REFACTOR: none

---
*Phase: 06-cross-session-analytics*
*Completed: 2026-09-20*

## Self-Check: PASSED
