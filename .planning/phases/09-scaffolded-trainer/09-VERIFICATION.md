---
phase: 09-scaffolded-trainer
verified: 2026-09-21T02:30:04Z
status: human_needed
score: 34/35 must-haves verified
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "Done/future/gap reuse glyphFor + .ws-glyph at Body 15/1.5 with the same padding as .trainer-stack so columns do not visibly drift from the overlay. Layout-engine check is human/Chromium; unit tests assert glyph characters, not pixel alignment."
    test: "In Chromium, start a multi-unit GitHub file so a done or future static region sits above or below the current CaptureSurface card. Compare the column of · and ↵ glyphs against the overlay of the current unit."
    expected: "Static done/future/gap glyphs line up with the overlay; columns do not visibly drift."
    why_human: "happy-dom has no layout engine. Unit tests assert glyph characters (· / ↵) only. Source also double-pads the current card (card padding plus CaptureSurface .trainer-stack padding), so pixel alignment cannot be certified from presence checks."
human_verification:
  - test: "pnpm dev in Chromium: import a small public repo, click a .ts file"
    expected: "Typing starts on unit 0 immediately; full file visible; future units dimmed; landmark N / M."
    why_human: "App tests mock onPlanned and never hit api.github.com. Live click-to-type, tree browse-while-typing, and visual dimming need a real Chromium session."
  - test: "Type the current unit to completion, then press Escape on the next unit"
    expected: "Instant advance with no Next button; Escape restarts only that unit (landmark stays, prior snapshots kept)."
    why_human: "Advance/Escape are covered in happy-dom; live caret, remount feel, and absence of interstitial chrome are visual/real-time."
  - test: "Finish the last unit, open History"
    expected: "ResultsView appears, Restart is gone, History shows one row with owner/repo:path and not Pasted snippet."
    why_human: "Persist and sourceRef are unit-tested; live results layout and History row chrome are visual."
  - test: "After a scaffold is in progress, Paste tab → Load exercise"
    expected: "FileScaffold gone, whole-file trainer, Restart exercise."
    why_human: "handleLoad last-wins is tested in happy-dom; confirm the live paste/upload path still feels like today's whole-file drill."
  - test: "Glyph columns: done/future · and ↵ versus the current overlay"
    expected: "Static · and ↵ visually line up with the overlay (same inset as .trainer-stack)."
    why_human: "Layout-engine check. Unit tests assert glyph characters, not pixels. Current-card padding plus CaptureSurface padding may inset the overlay ~16px+1px versus static <pre> segments."
---

# Phase 9: Scaffolded Trainer Verification Report

**Phase Goal:** The user types a GitHub file in place as a scaffolded exercise — full file visible, current unit only typeable — until the file is complete; paste and upload stay whole-file drills.
**Verified:** 2026-09-21T02:30:04Z
**Status:** human_needed
**Re-verification:** No — initial verification

Automated checks pass. Five Chromium UAT items remain (planner-deferred `<human-check>` plus the glyph-alignment backstop). No must-have FAILED.

## Goal Achievement

### Observable Truths

Roadmap success criteria kept as the contract. PLAN truths that restated an SC are folded into that row. Remaining PLAN must-haves are additional.

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | User sees the full file, including future units; only the current syntactic unit is typeable. (SCAF-01) | ✓ VERIFIED | `FileScaffold` paints `coverFile` segments in source order; only `role === 'current'` mounts `#capture-surface`. Tests: `puts #capture-surface only in the current card`; `paints source-order top-to-bottom`; App `puts the first curriculum slice into CaptureSurface, not the full two-unit file`. 36 UI tests passed. |
| 2 | User who completes the current unit advances to the next until the file is done. (SCAF-02) | ✓ VERIFIED | `handleComplete` snapshots then `resetCapture`, increments `unitIndex` / `loadToken` when `idx < length-1`. Test: `completing unit 0 does not persist or show results; landmark becomes 2 / 2` — History length 0, overlay is unit A not B. |
| 3 | User who finishes the last unit sees the existing results screen and gets one persisted session for the whole file (full `Exercise.text`). (SCAF-03) | ✓ VERIFIED | Last-unit path: `flattenSnapshots` → `assembleSessionFromLogs(current.exercise, …)` → `computeSessionMetrics(joinUnitSlices(…), …)` → `saveSession` once. Test: `last unit persist writes one github History row with full file text and both slices` — `.results-panel` present, `exercise.text === TWO_UNIT_FILE`, charLog contains both slices. |
| 4 | User who presses Escape restarts the current unit, not the entire file. (SCAF-04) | ✓ VERIFIED | Shared `handleRestart`: if curriculum active and not complete, `resetCapture` + `loadToken++` only — does not zero `unitIndex`, drop `snapshotsRef`, or refresh `startedAt`. Test: `Escape after unit 0 keeps unitIndex at 1 and does not persist`. |
| 5 | User can still paste text or upload a file as the corpus path for ad-hoc and non-TS/JS drills; that path stays a whole-file exercise. (SCAF-05) | ✓ VERIFIED | `CorpusInput onLoad={handleLoad}` (paste and upload). `handleLoad` clears curriculum and mounts `CaptureSurface text={exercise.text}`. Tests: `handleLoad after a scaffold unmounts FileScaffold and mounts whole-file CaptureSurface`; `paste path still persists one row and shows Restart exercise`. |
| 6 | `sliceUnit` uses Array.from then slice then join; PlanUnit start/end are exclusive code-point offsets | ✓ VERIFIED | `src/scaffold/slice.ts` is exactly `Array.from(text).slice(start, end).join('')`. Tests: emoji golden `a😀b` → `😀` at `[1, 2)`; UTF-16 `String.slice(1,2)` is not `😀`. |
| 7 | `joinUnitSlices` concatenates in curriculum array order, ≠ source-order `Exercise.text` on a leaves-first two-unit file | ✓ VERIFIED | `units.map(sliceUnit).join('')`. Test: `'aa\nbb\n'` with `[3,6)` then `[0,3)` equals `'bb\naa\n'`, not the source. |
| 8 | `coverFile` emits source-order segments sorted by start, including gap holes, without mutating the curriculum array | ✓ VERIFIED | `[...units].sort` copy; gap when `u.start > cursor`. Tests: blank-line gap; leaves-first paint order vs roles; `does not mutate the input units array`. |
| 9 | Fallback one-unit `[0, cpLen)` emits no gaps; empty units + non-empty text emits one whole-file gap | ✓ VERIFIED | Tests: `emits only the fallback unit and zero gaps`; `emits one whole-file gap when units are empty and text is not`. |
| 10 | A supplementary-plane character inside a unit and inside a gap counts as one code point | ✓ VERIFIED | slice emoji golden + cover test `counts an emoji inside a gap as one code point, not two UTF-16 units` (`Array.from` length 5 vs UTF-16 length 6). |
| 11 | `flattenSnapshots` concatenates events/charLog/markers, remaps `seq` on new objects, does not mutate frozen rows | ✓ VERIFIED | Spread `{ ...row, seq: seq++ }`. Tests: concat order, unique seq, frozen original `seq` still 7. |
| 12 | A discarded in-progress restart is absent from flatten because restart never pushes a snapshot | ✓ VERIFIED | `handleRestart` does not `snapshotsRef.push`. App tests keep landmark `2 / 2` and History length 0 after Escape / Restart unit. Flatten helper omits unpushed rows. |
| 13 | `assembleSessionFromLogs` copies isolation probes like `buildSession`, takes flattened logs, does not read live getters, keeps `exercise.text` as the full file | ✓ VERIFIED | `session.ts` 33–47. Tests: exercise identity + full text; `getEvents`/`getCharLog`/`getMarkers` not called; `buildSession` still calls them. |
| 14 | Pure helpers are synchronous with no module-level mutable cache | ✓ VERIFIED | `src/scaffold/{slice,cover,flatten}.ts` export pure functions only; no module `let`/`var` cache; zero React/WASM/`github/client` imports. |
| 15 | SCAF-03 encoding backstop: typedTarget is curriculum-order join; `Session.exercise.text` stays the source-order file; resolve-metrics fallback against `exercise.text` is documented; Dexie unchanged | ✓ VERIFIED | Explicit: `App.tsx` `typedTarget = joinUnitSlices(...)` then `computeSessionMetrics(typedTarget, …)`; `assembleSessionFromLogs` passes `exercise` through (`session.ts` comment: "metrics typedTarget is joined elsewhere"); `resolve-metrics.ts` still `computeSessionMetrics(s.exercise.text, …)` and was not modified this phase; `db.ts` still `version(1)`. |
| 16 | Heading + body from Copywriting; CaptureSurface and FileScaffold are not rendered until a load or onPlanned start | ✓ VERIFIED | App `COPY.emptyHeading` / `emptyBody` match 09-UI-SPEC.md verbatim. `exercise === null` renders empty-state only. Test: `empty state names the GitHub door verbatim`. |
| 17 | Fixed sentence wraps in `--column-max`; no ellipsis | ✓ VERIFIED | `src/index.css` `--column-max: 45rem` on the column. Zero `text-overflow` / `ellipsis` in `src/`. Static/landmark use `overflow-wrap: anywhere`. |
| 18 | Chrome wrapper `max-height: 70vh; overflow: auto`; names/lines wrap; unbreakable token may horizontal-scroll | ✓ VERIFIED | File chrome `style={{ maxHeight: '70vh', overflow: 'auto' }}`. Landmark subtitle and static `pre` set `overflowWrap: 'anywhere'`. |
| 19 | Fallback `1 / 1` still FileScaffold (one current card, no future). Many units: same segment layout, landmark n / m | ✓ VERIFIED | Tests: FileScaffold `shows a 1 / 1 landmark, one current card, and no future role`; App `starts typing immediately on a fallback FilePlan with a 1 / 1 landmark`; two-unit `1 / 2`. |
| 20 | Static pre and overlay use `overflow-wrap: anywhere` + `pre-wrap`; no truncation of source | ✓ VERIFIED | `staticPreStyle` `whiteSpace: 'pre-wrap'`, `overflowWrap: 'anywhere'`. `.trainer-stack > *` already `pre-wrap` + `overflow-wrap: anywhere`. |
| 21 | N / M `min-height: 1.4em` is a floor; kind/name wraps below; landmark is outside the chrome scroller | ✓ VERIFIED | Landmark `role="status"` is a sibling above the `aria-label="File"` scroller. N/M `<p>` has `minHeight: '1.4em'`. |
| 22 | Long name wraps with `overflow-wrap: anywhere`; no ellipsis | ✓ VERIFIED | Subtitle `<p className="text-muted" style={{ overflowWrap: 'anywhere' }}>`. `KIND_LABEL.other === ''`. |
| 23 | Done and future regions render canonical source slices from `Exercise.text`, never the typed buffer | ✓ VERIFIED | Static segments call `renderGlyphs(sliceUnit(text, …))` from `text` prop (full file). No `getCharLog` / typed-buffer read in FileScaffold. |
| 24 | FileScaffold owns the three regions and the N/M landmark; CaptureSurface props stay `text`, `onRestartRequested`, `onComplete` | ✓ VERIFIED | FileScaffold call site passes only those three props (+ React `key`). `CaptureSurface.tsx` signature unchanged; git log since 09-01 has no diff on that file. |
| 25 | First paint of a unit is all-pending overlay (Phase 2 initial state), not a distinct empty-copy surface | ✓ VERIFIED | FileScaffold mounts existing `CaptureSurface` on the slice; no extra empty-copy UI. `CaptureSurface.tsx` unmodified this phase. |
| 26 | GitHub `onPlanned` uses `startScaffold`; the paste/upload load callback is never given `plan.exercise` | ✓ VERIFIED | `RepoBrowser onPlanned={startScaffold}`. `CorpusInput onLoad={handleLoad}`. `startScaffold` does not call `handleLoad`. |
| 27 | Fallback `plan.fallback true` still mounts FileScaffold immediately; PLAN-03 notice stays in RepoBrowser status | ✓ VERIFIED | App fallback FilePlan test mounts `#capture-surface` + `1 / 1`. FileScaffold has no fallback/split notice copy. `RepoBrowser.tsx` still owns `COPY.fallback`. |
| 28 | A new GitHub click or paste/upload load replaces an in-progress scaffold (discard snapshots, resetCapture, remount). Paste\|GitHub tab switch does not reset | ✓ VERIFIED | `startScaffold` / `handleLoad` zero `snapshotsRef`. Tests: `a second onPlanned replaces the first`; `handleLoad after a scaffold unmounts FileScaffold`; `switching Paste \| GitHub tabs does not clear an in-progress scaffold`. |
| 29 | Trainer subtree hide-not-unmount is unchanged; the tree stays browseable while typing | ✓ VERIFIED | Trainer wrapper `display: view === 'trainer' ? 'grid' : 'none'` — never `hidden`. Test: `hides the trainer with display none on History, never the hidden attribute`. Corpus shell stays mounted above the trainer. |
| 30 | Landmark is 1-based `N / M` with spaces around the slash plus kind/name when present; COPY verbatim from 09-UI-SPEC.md | ✓ VERIFIED | `COPY.landmark === '{n} / {m}'`; `KIND_LABEL` matches UI-SPEC including `other: ''`. Test: `COPY.landmark uses spaces around the slash`; aria-label `1 / 1, x` for name-only. |
| 31 | After last-unit persist Restart is hidden; no whole-file restart control; do not arm a second `saveSession` | ✓ VERIFIED | `{!scaffoldComplete && <button>Restart…}`. `handleComplete` returns immediately if `scaffoldCompleteRef`. Tests: Restart unit/exercise absent after persist; `does not write a second History row after last-unit persist`. |
| 32 | History github rows show `sourceRef` owner/repo:path and never Pasted snippet | ✓ VERIFIED | `HistoryView.tsx` github ternary unmodified this phase. Test: `after scaffold persist, History shows sourceRef and not Pasted snippet`. |
| 33 | Paste empty already rejected at ingest; fallback 1-unit still FileScaffold | ✓ VERIFIED | `CorpusInput` `value.trim() === ''` sets empty error and does not call `onLoad`. Fallback 1-unit tests above. |
| 34 | `scrollIntoView({ block: 'nearest', inline: 'nearest' })` on the current card at start and every advance; `behavior: 'instant'` when `prefers-reduced-motion: reduce`, else `'smooth'` | ✓ VERIFIED | Backstop with explicit spy tests (passing): called on mount and `unitIndex` change with `nearest`/`nearest`; `instant` when reduce matches. Does not assert `scrollTop`. |
| 35 | Done/future/gap reuse glyphFor + `.ws-glyph` at Body 15/1.5 with the same padding as `.trainer-stack` so columns do not visibly drift from the overlay | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Glyph characters are wired and tested (`renders glyphFor middle-dot and newline via .ws-glyph on a gap`). Pixel column alignment vs overlay is not exercised. Current card also applies `padding: var(--space-md)` around CaptureSurface, whose overlay already has `.trainer-stack` padding — likely inset drift (see Human Verification). |

**Score:** 34/35 truths verified (1 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/scaffold/slice.ts` | `sliceUnit` / `joinUnitSlices` (code-point) | ✓ VERIFIED | 12 lines, `Array.from` → `slice` → `join`. Wired from FileScaffold + App persist. |
| `src/scaffold/cover.ts` | `coverFile` source-order unit/gap segments | ✓ VERIFIED | Copy-sort, curriculum roles, gap fill. Wired from FileScaffold. |
| `src/scaffold/flatten.ts` | `UnitSnapshot` + `flattenSnapshots` | ✓ VERIFIED | Concat + seq remap on new objects. Wired from App last-unit persist. |
| `src/session.ts` | `assembleSessionFromLogs` sibling of `buildSession` | ✓ VERIFIED | `buildSession` body still live-reads getters. Wired from App last-unit persist. |
| `src/ui/FileScaffold.tsx` | Landmark N/M + source-order chrome; CaptureSurface on current slice | ✓ VERIFIED | 176 lines. No `innerHTML` / `dangerouslySetInnerHTML`. Wired from App when `curriculum !== null`. |
| `src/ui/App.tsx` | `startScaffold`, curriculum, unit advance, unit restart, last-wins vs `handleLoad`, last-unit persist | ✓ VERIFIED | `onPlanned={startScaffold}`; intercept `onComplete`; hide Restart after `scaffoldComplete`. |

gsd-tools `verify.artifacts` on both plans: 6/6 passed (existence). Level 2–3 confirmed by reading exports and call sites.

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `src/scaffold/cover.ts` | `src/scaffold/slice.ts` | cover tests assert gap/unit slices via `sliceUnit` | WIRED | `cover.test.ts` imports `sliceUnit`; FileScaffold also uses both. |
| `src/scaffold/flatten.ts` | `src/capture/types.ts` | spread-copy frozen events/charLog/markers; remap `seq` | WIRED | `{ ...e, seq: seq++ }` on each array. |
| `src/session.ts` | `src/platform/isolation.ts` | `assembleSessionFromLogs` uses the same isolation probes as `buildSession` | WIRED | Both call `probeTimerResolutionUs` + `readCrossOriginIsolated`. |
| `src/ui/App.tsx` | `src/ui/RepoBrowser.tsx` | `onPlanned={startScaffold}` — never the paste/upload load callback | WIRED | Line 299 vs `CorpusInput onLoad={handleLoad}`. |
| `src/ui/FileScaffold.tsx` | `src/scaffold/cover.ts` | `coverFile(text, units, complete ? units.length : unitIndex)` | WIRED | `coverIndex = complete ? units.length : unitIndex`. |
| `src/ui/FileScaffold.tsx` | `src/ui/CaptureSurface.tsx` | `text={sliceUnit(...)} key={loadToken}` — slice only | WIRED | Only current unit; unmounted when `complete`. |
| `src/ui/App.tsx` | `src/scaffold/flatten.ts` | last unit: snapshot then `flattenSnapshots` then `assembleSessionFromLogs` | WIRED | `handleComplete` last-unit branch. |
| `src/ui/App.tsx` | `src/metrics/metrics.ts` | `computeSessionMetrics(joinUnitSlices(...), charLog, markers, completedAt)` | WIRED | Scaffold path uses `typedTarget`; paste path still uses `exercise.text`. |

gsd-tools `verify.key-links`: 8/8 pattern-found. Call-site wiring confirmed in source.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `FileScaffold` | `text` / `units` / segments | `App` `exercise.text` + `curriculum` (`plan.units`); `coverFile` then `sliceUnit` | FilePlan / GitHub blob text, not `[]`/`''` hardcoded | ✓ FLOWING |
| `FileScaffold` current card | CaptureSurface `text` | `sliceUnit(text, unit.start, unit.end)` | Current unit slice of the same file | ✓ FLOWING |
| App last-unit persist | `session.exercise` / `charLog` | `assembleSessionFromLogs(current.exercise, flattenSnapshots(snapshotsRef))` | Full file + concatenated live capture snapshots | ✓ FLOWING |
| App last-unit metrics | `typedTarget` | `joinUnitSlices(current.exercise.text, units)` | Curriculum-order join, not source-order file | ✓ FLOWING |
| App paste path | CaptureSurface `text` | `exercise.text` from `handleLoad` | Paste/upload corpus | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Unit scaffold helpers | `pnpm exec vitest run --project unit src/scaffold/slice.test.ts src/scaffold/cover.test.ts src/scaffold/flatten.test.ts src/session.test.ts` | 4 files, 20 tests, exit 0 | ✓ PASS |
| FileScaffold + App curriculum | `pnpm exec vitest run --project ui src/ui/FileScaffold.test.tsx src/ui/App.test.tsx` | 2 files, 36 tests, exit 0 | ✓ PASS |
| Types | `pnpm exec tsc --noEmit -p tsconfig.json` | exit 0 | ✓ PASS |
| No markup sink | python scan of FileScaffold.tsx + App.tsx for `innerHTML` / `dangerouslySetInnerHTML` | no tokens | ✓ PASS |
| Protected files unmodified this phase | `git log 68dcb01^..HEAD` on `capture.ts`, `CaptureSurface.tsx`, `HistoryView.tsx`, `RepoBrowser.tsx`, `resolve-metrics.ts`, `db.ts` | empty (last touches are Phase 8 / earlier) | ✓ PASS |

Named tests that lock behavior-dependent SCs (all in the passing UI run): `completing unit 0 does not persist or show results; landmark becomes 2 / 2`; `Escape after unit 0 keeps unitIndex at 1 and does not persist`; `last unit persist writes one github History row with full file text and both slices`; `handleLoad after a scaffold unmounts FileScaffold and mounts whole-file CaptureSurface`.

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | — | No `scripts/*/tests/probe-*.sh`; PLAN/SUMMARY do not declare probes | SKIPPED |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| SCAF-01 | 09-01, 09-02 | User sees the full file, including future units; only the current unit is typeable | ✓ SATISFIED | Truths 1, 8, 19, 23, 27; FileScaffold + App tests |
| SCAF-02 | 09-02 | User who completes the current unit advances to the next until the file is done | ✓ SATISFIED | Truth 2; App advance test; no persist until last unit |
| SCAF-03 | 09-01, 09-02 | Last unit → existing results + one persisted session for the whole file | ✓ SATISFIED | Truths 3, 7, 11–13, 15, 31; persist test full `Exercise.text` |
| SCAF-04 | 09-02 | Escape restarts the current unit, not the entire file | ✓ SATISFIED | Truths 4, 12; Escape + Restart unit tests |
| SCAF-05 | 09-02 | Paste/upload stay whole-file exercises | ✓ SATISFIED | Truths 5, 26, 28, 33; handleLoad + paste persist tests |

No orphaned Phase 9 IDs. REQUIREMENTS.md maps SCAF-01..05 only to Phase 9; both plans claim them (09-01: SCAF-01, SCAF-03; 09-02: all five).

### Prohibitions

Code-checked (must-NOT did not happen). Not counted in the 34/35 score.

| Prohibition | Status | Evidence |
| ----------- | ------ | -------- |
| MUST NOT use UTF-16 `String.slice` on `Exercise.text` for unit ranges | ✓ held | `sliceUnit` uses `Array.from`; contrast test locks UTF-16 as wrong |
| MUST NOT change `buildSession` live-read contract | ✓ held | Getters still called; session tests lock field order + live reads |
| MUST NOT modify `capture.ts` or add a restore API | ✓ held | No Phase 9 commits on `src/capture/capture.ts` |
| MUST NOT set `Exercise.text` to the current unit slice | ✓ held | Persist passes full `plan.exercise`; test `exercise.text === TWO_UNIT_FILE` |
| MUST NOT import React, WASM, or github/client from `src/scaffold/` | ✓ held | Only `parse/types` and `capture/types` |
| MUST NOT pass the planned exercise into the paste/upload load callback | ✓ held | Separate `onPlanned` / `onLoad` |
| MUST NOT put the full file into CaptureSurface when `units.length > 1` | ✓ held | Slice-only tests |
| MUST NOT hide future units or use cloze/full-file textarea overlay | ✓ held | Future is static `pre`, not hidden; current is slice textarea |
| MUST NOT interpret blob text as HTML | ✓ held | React text + glyphs; XSS fixture `querySelector('img')` is null |
| MUST NOT call persist `onComplete` until the last unit | ✓ held | Non-last complete → History length 0 |
| MUST NOT add a whole-file restart control this phase | ✓ held | Restart hidden after persist; no Restart exercise on scaffold path |
| MUST NOT grow CaptureSurface props beyond the three | ✓ held | Call sites + unmodified `CaptureSurface.tsx` |
| MUST NOT rebuild the HistoryView github `sourceRef` ternary | ✓ held | File untouched this phase |
| MUST NOT use accent for current-unit card fill or stroke | ✓ held | Card uses `--color-surface` / `--color-border` only |
| MUST NOT duplicate PLAN-03 fallback notice on FileScaffold | ✓ held | No fallback copy in FileScaffold |
| MUST NOT put Phase 9, WASM, tree-sitter, parser, AST, or curriculum in user-visible copy | ✓ held | App/FileScaffold COPY matches UI-SPEC; `curriculum` is state only |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/ui/FileScaffold.tsx` | 157–161 vs CaptureSurface `.trainer-stack` | Current card adds `padding: var(--space-md)` around a surface that already pads `--space-md` | ⚠️ Warning | Overlay glyphs likely inset vs done/future/gap. Does not block SCAF-01 (file still visible / only current typeable). Routed to human glyph check. |
| `src/ui/App.tsx` | 155–158 | Fire-and-forget `saveSession` catch calls `setSaveFailed(true)` with no generation token | ⚠️ Warning | A last-wins load can inherit a stale save-failure notice. Not a must-have; persist still happens once per completed file. |
| `src/ui/App.tsx` | 202–215 | 250ms `buildSession` interval skipped while `curriculum !== null`; `startScaffold` never `setTimingResolutionUs` | ℹ️ Info | Timer-resolution banner can freeze on the GitHub path. Persist still probes into the stored Session. |
| `src/scaffold/flatten.ts` | 15–18 | Concat with no unit-boundary marker | ℹ️ Info | Cross-unit pause can land on the next unit's first glyph in heatmap/slowest-5. Out of SCAF-03 scope (one session, full text). |
| `src/metrics/resolve-metrics.ts` | 30 | Recompute uses `s.exercise.text` | ℹ️ Info | Intentional this phase (Dexie unchanged). Schema bump would mis-score leaves-first logs. Documented trap, not a Phase 9 gap. |

No `TBD` / `FIXME` / `XXX` in phase-modified source. `FileScaffold.test.tsx` `innerHTML` use is an XSS assertion, not a markup sink.

**Confirmation-bias notes (not gaps):** (1) The last-unit persist test does not assert `metricsSnapshot` was computed from `joinUnitSlices` — that is locked by the `App.tsx` call site, not by comparing stored WPM. (2) `flatten.test.ts` "omits in-progress restart rows" never passes the discarded snapshot into `flattenSnapshots` (tautological); App Escape/Restart tests cover the real invariant. (3) Uncovered error path: in-flight `saveSession` rejection after last-wins (warning above).

### Human Verification Required

Planner-deferred Chromium checks from 09-02-PLAN.md, merged with the glyph backstop.

### 1. Live GitHub click-to-type

**Test:** `pnpm dev` in Chromium: import a small public repo, click a `.ts` file.
**Expected:** Typing starts on unit 0 immediately; full file visible; future units dimmed; landmark N / M.
**Why human:** Tests mock `onPlanned` and never call `api.github.com`.

### 2. Advance and unit Escape

**Test:** Type the current unit to completion, then Escape on the next unit.
**Expected:** Instant advance, no Next button; Escape restarts only that unit.
**Why human:** Live caret/remount feel; happy-dom already covers the state machine.

### 3. Last unit → results + History

**Test:** Finish the last unit, open History.
**Expected:** ResultsView appears, Restart gone, one row with `owner/repo:path`, not "Pasted snippet".
**Why human:** Visual results/History chrome; persist payload is already tested.

### 4. Paste exit

**Test:** Paste tab → Load exercise while a scaffold is in progress.
**Expected:** FileScaffold gone, whole-file trainer, Restart exercise.
**Why human:** Confirm the live paste/upload path still feels like the whole-file drill.

### 5. Glyph column alignment

**Test:** Compare done/future · and ↵ to the current overlay.
**Expected:** Columns line up; no visible inset drift.
**Why human:** No layout engine in happy-dom. Source currently double-pads the current card — if they drift, that is this item failing, not a new SCAF-01 blocker unless the file is no longer readable as one column.

---

_Verified: 2026-09-21T02:30:04Z_
_Verifier: Claude (gsd-verifier)_
