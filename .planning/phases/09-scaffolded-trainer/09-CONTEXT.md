# Phase 9: Scaffolded Trainer - Context

**Gathered:** 2026-09-20
**Status:** Ready for planning

<domain>
## Phase Boundary

The user types a GitHub TypeScript/JavaScript file in place as a scaffolded
exercise: the full file stays visible, only the current syntactic unit is
typeable, completing a unit advances until the file is done, Escape (and the
Restart control) restarts the current unit, and the existing results screen
persists one session for the whole file. Paste and upload remain the
whole-file corpus path.

**In scope:** SCAF-01 (full file visible, current unit only typeable),
SCAF-02 (complete unit → next until done), SCAF-03 (last unit → existing
results + one persisted session with full `Exercise.text`), SCAF-04
(Escape restarts current unit, not the file), SCAF-05 (paste/upload stay
whole-file). ROADMAP success criteria 1–5. History github `sourceRef` row
must become UAT-checkable once persist exists (Phase 8 test 2 skip).

**Out of scope (own phases / deferred):** cloze / hidden future units;
Monaco / CodeMirror; pixel-perfect full-file textarea overlay; syntax
highlighting / `innerHTML`; per-unit History rows or per-unit WPM UI;
whole-file restart control; PLAN-04/05 other languages / class methods;
REPO-05/06 branch picker / private repos; changing `capture.ts` unless a
bug is proven.

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.0 Milestone Research (primary — read before planning)
- `.planning/research/SUMMARY.md` §Phase 9 — FileScaffold, App curriculum,
  avoid capture.ts rewrites, full-file textarea, last-unit-only sessions.
- `.planning/research/ARCHITECTURE.md` Pattern 2 (curriculum outside
  CaptureSurface; pick (1) resetCapture per unit + concatenate logs),
  Anti-Pattern 2 (full-file textarea), Anti-Pattern 3 (`Exercise.text` =
  current unit only). Data flow: click → unit 0 → advance → last unit →
  `buildSession` + `saveSession`.
- `.planning/research/FEATURES.md` — full file visible; advance until
  done; paste/upload independent; cloze and Monaco are anti-features.
- `.planning/research/PITFALLS.md` Pitfall 5 (capture log vs remount),
  Pitfall 6 (future units ≠ textarea), UX table (landmark +
  `scrollIntoView`, Escape = current unit, dim future).

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — SCAF-01..05 (this phase); FILE-02 History
  origin; Out of Scope: cloze, Monaco, whole-file happy path.
- `.planning/ROADMAP.md` §"Phase 9" — five success criteria, `UI hint: yes`.
- `.planning/PROJECT.md` §Key Decisions — scaffolded file pending Phase 9;
  CaptureSurface overlay contract; hide-not-unmount; free-correction.
- `.planning/STATE.md` — Phase 8 UAT test 2 skip: re-check github
  `sourceRef` History label after SCAF-03 persist.

### Prior phase artifacts
- `.planning/phases/07-github-url-repo-tree/07-CONTEXT.md` — Paste | GitHub
  switch, D-04 tab switch is not a reset, tree status region, last-wins
  clicks.
- `.planning/phases/08-parse-dependency-units/08-RESEARCH.md` — FilePlan in
  App, never `handleLoad` for GitHub; `sourceRef` = `owner/repo:path`.
- `.planning/phases/08-parse-dependency-units/08-UAT.md` — skipped test 2
  (github History row) is this phase's persist check.

### Implementation seams
- `src/ui/App.tsx` — `filePlan` idle today; `handleLoad` / `handleRestart`
  / `handleComplete`; `CaptureSurface` keyed by `loadToken`; Restart button.
- `src/ui/CaptureSurface.tsx` — 1:1 with `text`; Escape →
  `onRestartRequested`; do not change the overlay contract.
- `src/parse/types.ts` — `FilePlan`, `PlanUnit` code-point `start`/`end`.
- `src/ui/HistoryView.tsx` — github `sourceLabel` already uses `sourceRef`.
- `src/ui/RepoBrowser.tsx` — `onPlanned(FilePlan)`; status COPY for planned
  / fallback; last-wins click generation.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/ui/CaptureSurface.tsx` — input host for the current unit slice.
  Remount via `key={loadToken}`. Escape already calls `onRestartRequested`.
- `src/ui/App.tsx` — owns `filePlan` (`onPlanned={setFilePlan}`) but does
  not start the trainer. `handleLoad` is paste/upload only. `handleRestart`
  today resets the whole session — scaffold must narrow it (D-16).
- `src/parse/types.ts` `FilePlan` — `exercise`, `units`, `fallback`,
  `notice`.
- `src/trainer/state.ts` — `Array.from` code-point indexing; `glyphFor`.
- `src/capture/capture.ts` — `resetCapture`, `getCharLog` / events /
  markers. Leave the hot path alone.
- `src/session.ts` `buildSession` — writer at file-complete after snapshots
  flatten.
- `src/ui/HistoryView.tsx` — github branch of `sourceLabel` already landed.
- `src/ui/RepoBrowser.tsx` — click → plan; status region for fallback
  notice.

### Established Patterns
- Platform seam: capture/wasm/fetch stay out of UI chrome.
- Last-wins monotonic token for in-flight async (RepoBrowser clickGen).
- Hide-not-unmount trainer subtree (`display:none`, never `hidden`).
- COPY const in the UI file; inline `role="status"` / `role="alert"`.
- Completion fires once per `completedAt` (CaptureSurface D-07). Scaffold
  advance must not call `onComplete` until the **last** unit.
- Tests: happy-dom; zero live GitHub; zero WASM in unit tests. FilePlan
  fixtures, not live parse.

### Integration Points
- `App` grows curriculum + `unitIndex` + per-unit snapshot accumulator.
  GitHub `onPlanned` → `startScaffold`. Paste `onLoad` → existing
  `handleLoad` and **clears** scaffold state.
- New `FileScaffold` wraps CaptureSurface when curriculum is active;
  paste/upload still mount CaptureSurface directly on `exercise.text`.
- Persist path unchanged: `saveSession` after last unit. Dexie `version(1)`
  stays — `exercise` is an unindexed blob.
- Empty-state "No exercise loaded" should not claim GitHub cannot start a
  session once D-07 lands (copy discretion).

### Creative options
- Architecture forbids teaching `computeTrainerState` about ranges.
- Virtualizing the file chrome is later; 100 KB cap bounds a full `<pre>`.
- Unit-separator markers in the Session log are optional, not a
  requirement.

</code_context>

<specifics>
## Specific Ideas

- Feel: click a function in the tree, the file appears, the leaf unit is
  already the typing surface, future functions are dimmed but readable
  below/around it, finishing a unit snaps to the next with a 3/12 landmark.
- Restarting a botched function must not throw away the functions already
  typed in this file.
- Fallback unparseable file: still this chrome, one unit, labeled notice
  already shown under the tree — not a surprise whole-file CaptureSurface
  with no file chrome.

</specifics>

<deferred>
## Deferred Ideas

- Per-unit History rows / per-function WPM (FEATURES "Add After Validation").
- Whole-file restart control (abandon via new load only).
- Pixel-perfect caret-inside-full-file overlay.
- Syntax highlighting of done/future regions.
- Cloze / hidden future units (explicitly rejected).
- PLAN-04/05, REPO-05/06.

None of these were requested as this-phase scope.

</deferred>

---

*Phase: 9-Scaffolded Trainer*
*Context gathered: 2026-09-20*
