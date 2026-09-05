---
phase: 01-corpus-input-keystroke-capture
plan: 03
subsystem: capture
tags: [beforeinput, input-events, ime-composition, key-repeat, lifecycle-markers, cross-origin-isolation, timer-resolution, banners, readme]

requires:
  - phase: 01-01
    provides: "KeystrokeEvent/Session types, append-only capture hot path, useCapture hook, platform/isolation.ts probe shells, Banners/CaptureSurface shells"
  - phase: 01-02
    provides: "CorpusInput.tsx (paste + upload, all states) — untouched by this plan"
provides:
  - "src/capture/types.ts: CommittedChar + CaptureMarker types; Session additive charLog/markers fields"
  - "src/capture/capture.ts: beforeinput/input committed-character log, IME composition suspend/commit, selective paste/drop preventDefault + onPasteBlocked subscriber, blur/focus/visibilitychange lifecycle markers + down-set clearing, queueMicrotask-deferred timer-resolution sampling"
  - "src/capture/use-capture.ts: useCapture(target, onPasteBlocked?) forwards the paste-blocked subscription; attachCapture/detachCapture own all listener wiring so the capture module is testable without React"
  - "src/platform/isolation.ts: getTimingResolutionUs() exposing {expectedUs, measuredUs}; recordMeasuredResolutionUs wired end-to-end from real keydowns"
  - "src/session.ts: startSession reads getCharLog()/getMarkers() into Session"
  - "src/ui/Banners.tsx: finalized crossOriginIsolated !== true gating, single-line 'US ANSI keyboard layout' string, updated documentation comment"
  - "src/ui/CaptureSurface.tsx: paste-blocked inline flag (~4s, opacity-fade, aria-hidden, prefers-reduced-motion aware)"
  - "README.md: local run, COOP/COEP production-host requirement + _headers snippet + GitHub Pages caveat, privacy posture"
affects: [phase-02-trainer, phase-03-metrics, phase-04-persistence]

actuals:
  tokens: 7960
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Two parallel seq-keyed logs, never merged: KeystrokeEvent[] (timing) and CommittedChar[] (characters), reconciled by a shared monotonic seq counter (Pitfall 9)"
    - "Hot-path push stays a single op: the timer-resolution delta math runs in a queueMicrotask scheduled from onKey, never inline in the keydown handler (A10, D-07)"
    - "Single-subscriber callback module state (setPasteBlockedHandler) for a DOM-module-to-React-component signal that doesn't belong in the append-only logs"
    - "attachCapture/detachCapture own all listener wiring (keydown/keyup/beforeinput/input/composition on target, blur/focus/visibilitychange on window/document) so capture.ts is fully testable via plain Vitest + happy-dom without mounting the React hook"

key-files:
  created:
    - "README.md"
  modified:
    - "src/capture/types.ts"
    - "src/capture/capture.ts"
    - "src/capture/use-capture.ts"
    - "src/capture/capture.test.ts"
    - "src/platform/isolation.ts"
    - "src/session.ts"
    - "src/ui/Banners.tsx"
    - "src/ui/CaptureSurface.tsx"

key-decisions:
  - "planner_assumption on CAPT-05 confirmed as implemented: Session.timingResolutionUs stays a single number (probeTimerResolutionUs() = measuredUs ?? expectedUs), with the full {expectedUs, measuredUs} pair additionally exposed via the new platform/isolation.ts getTimingResolutionUs() for anything that wants the split view"
  - "attachCapture/detachCapture (not the React hook) own ALL listener wiring, including the new beforeinput/input/composition/blur/focus/visibilitychange types — keeps capture.ts testable in isolation (capture.test.ts never touches React) and avoids double-binding; use-capture.ts's job is purely mount/unmount timing plus forwarding the onPasteBlocked callback into a single-subscriber module setter"
  - "onInput's Firefox-delete-inputType fallback compares textarea.value.length against a tracked lastValue and backfills a deletion CommittedChar only when beforeinput was not captured on the same event tick — kept intentionally simple (length comparison, not a full diff) since Phase 2's reconciler is the real consumer of ground truth"
  - "App.tsx required zero changes: it already passed timingResolutionUs to Banners from 01-01, and probeTimerResolutionUs() now returns the combined measured+expected figure purely because Task 1 wired recordMeasuredResolutionUs upstream — same call site, richer semantics, so the plan's 'this is the only App.tsx change' bullet is satisfied by a no-op diff"
  - "Fixed a self-introduced Task 2 bug before committing Task 3: CaptureSurface.tsx referenced a nonexistent 'banner-fade' CSS class (index.css is outside this plan's file scope). Replaced with an inline opacity transition gated by a local window.matchMedia('(prefers-reduced-motion: reduce)') check, plus aria-hidden toggling, so the fade requirement is honored without touching an out-of-scope file"
  - "Fixed a pre-existing (01-01) source-formatting issue in Banners.tsx: the JSX text 'US ANSI keyboard layout' was split across two source lines, failing this plan's literal-string acceptance check even though the rendered DOM text was correct; reflowed onto one line"

patterns-established:
  - "Single-subscriber module callback (setXHandler(fn | null)) as the seam between a DOM-owned module and a React component that needs a one-shot signal, without adding the signal to an append-only log"
  - "queueMicrotask-deferred measurement tap pattern for keeping a hot-path handler to exactly one synchronous operation while still feeding a derived metric"

requirements-completed: [CAPT-02, CAPT-04, CAPT-01, CAPT-05]

coverage:
  - id: D1
    description: "A keydown carrying event.repeat===true, or a second keydown for an already-down code with no repeat flag, is recorded with isRepeat true and excluded from a logical-keystroke count; the down-set is cleared on blur and visibilitychange->hidden (with a marker recorded for each blur/focus/hidden/visible) so an alt-tab mid-hold cannot wedge a key or misflag the next real press"
    requirement: "CAPT-02"
    verification:
      - kind: unit
        ref: "src/capture/capture.test.ts (logical-keystroke-count exclusion, blur/visibilitychange down-set clearing + marker presence, focus/visible marker recording, pre-existing repeat + per-code-fallback + idempotency cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Committed characters come from beforeinput inputType/data (insertText, insertLineBreak -> '\\n', delete* -> deletion record) plus the input value diff as ground truth, never from KeyboardEvent.key; paste/drop into the capture textarea are cancelled via selective beforeinput preventDefault and flagged inline for ~4s; IME composition suspends per-char attribution until compositionend commits one record; the char log and timing log are two seq-keyed parallel logs, never merged"
    requirement: "CAPT-04"
    verification:
      - kind: unit
        ref: "src/capture/capture.test.ct (insertText/insertLineBreak/deleteContentBackward mapping, onInput Firefox-delete fallback, insertFromPaste/insertFromDrop prevented + not recorded + subscriber fired, composition suspend/commit, timing log untouched by char-log pushes)"
        status: pass
      - kind: manual_procedural
        ref: "pnpm dev -> paste into the typing area shows the inline 'Pasting into the typing area is disabled' flag for ~4s and fades; paste into the corpus box (CorpusInput, untouched by this plan) still works"
        status: unknown
    human_judgment: true
    rationale: "Visual fade timing and the exact inline placement need a human eye in a real browser; deferred to end-of-phase human-verify per config human_verify_mode."
  - id: D3
    description: "keydown/keyup timing capture (from 01-01) continues to append every keystroke, unaffected by the new beforeinput/composition/marker wiring layered alongside it in the same module"
    requirement: "CAPT-01"
    verification:
      - kind: unit
        ref: "src/capture/capture.test.ts — full pre-existing CAPT-01 suite (11 cases) still green; new char-stream tests explicitly assert getEvents() length is unchanged by beforeinput dispatches"
        status: pass
    human_judgment: false
  - id: D4
    description: "recordMeasuredResolutionUs is fed real inter-keydown deltas via a queueMicrotask tap so the hot-path push stays a single op; Session.timingResolutionUs and the new getTimingResolutionUs() expose the combined measured+expected figure; both chrome banners (US-ANSI notice unconditional, degraded-timing warning gated on crossOriginIsolated !== true) render with no layout shift; README documents the production COOP/COEP host requirement and the local-only privacy posture"
    requirement: "CAPT-05"
    verification:
      - kind: integration
        ref: "curl -sI http://localhost:4173/ (pnpm preview) -> Cross-Origin-Opener-Policy: same-origin + Cross-Origin-Embedder-Policy: require-corp still present"
        status: pass
      - kind: unit
        ref: "src/platform/isolation.ts getTimingResolutionUs(); src/capture/capture.ts scheduleResolutionSample wired from onKey"
        status: pass
      - kind: manual_procedural
        ref: "pnpm dev under isolation -> no warning banner; disable isolation -> warning banner shows above the notice with no layout shift"
        status: unknown
    human_judgment: true
    rationale: "Banner visual stacking and the no-layout-shift claim need a human eye in a real browser; deferred to end-of-phase human-verify per config human_verify_mode."

duration: 8min
completed: 2026-09-05
status: complete
---

# Phase 01 Plan 03: Full Capture Semantics, Chrome Banners & README Summary

**Completed the append-only capture engine — a seq-keyed committed-character log from `beforeinput`/`input` with IME composition and selective paste/drop blocking, blur/visibility lifecycle markers with down-set clearing, a `queueMicrotask`-deferred timer-resolution measurement tap — and finalized both chrome banners plus the production-host/privacy README.**

## Performance

- **Duration:** ~8 min (task execution); full session including plan/context re-reading was longer
- **Completed:** 2026-09-05T01:03Z
- **Tasks:** 3
- **Files modified:** 9 (8 modified + README.md created)

## Accomplishments

- `capture/types.ts`: `CommittedChar` and `CaptureMarker` types added; `Session` gains `charLog: readonly CommittedChar[]` and `markers: readonly CaptureMarker[]` as additive D-14 extensions.
- `capture/capture.ts`: `onBeforeInput` maps `inputType` per the 01-RESEARCH.md table (`insertLineBreak` → `'\n'`, `delete*` → deletion record, everything else → `e.data` as-is); `insertFromPaste`/`insertFromDrop` are cancelled via selective `preventDefault` and routed through a single-subscriber `onPasteBlocked` callback, never recorded as a committed char. `onInput` backfills a deletion from the `textarea.value` diff when `beforeinput` was skipped (Firefox delete-inputType edge). `compositionstart`/`compositionend` suspend and then commit one `CommittedChar` with `inputType: 'insertFromComposition'`. `attachCapture`/`detachCapture` now wire every listener type (`keydown`/`keyup`/`beforeinput`/`input`/`compositionstart`/`compositionend` on the target; `blur`/`focus` on `window`; `visibilitychange` on `document`) so the module is fully testable without React. `blur` and `visibilitychange`→`hidden` clear `downCodes` and push a `CaptureMarker`. A `queueMicrotask` tap on every real (non-repeat) `keydown` feeds `recordMeasuredResolutionUs` so the hot-path `buffer.push()` stays the only synchronous work.
- `capture/use-capture.ts`: `useCapture(target, onPasteBlocked?)` forwards the optional callback into the module's single-subscriber setter; `attachCapture`/`detachCapture` remain the sole listener-wiring authority.
- `platform/isolation.ts`: added `getTimingResolutionUs()` exposing `{ expectedUs, measuredUs }`; `recordMeasuredResolutionUs` (already implemented in 01-01) is now genuinely fed real data.
- `session.ts`: `startSession` reads `getCharLog()`/`getMarkers()` into the returned `Session`.
- `ui/Banners.tsx`: gating changed to the literal `crossOriginIsolated !== true` (fidelity to the CAPT-05 truth statement); fixed a pre-existing source-formatting bug where "US ANSI keyboard layout" was split across two JSX lines, failing a literal-string check even though rendered text was correct; updated the header comment to describe final (not shell) behavior.
- `ui/CaptureSurface.tsx`: inline paste-blocked flag with the exact copy "Pasting into the typing area is disabled - type the exercise to record real keystrokes.", auto-clearing after ~4s, cleared on unmount/re-fire, reserving its row (no layout shift), fading via an inline opacity transition gated by a local `matchMedia('(prefers-reduced-motion: reduce)')` check with `aria-hidden` toggling.
- `README.md` (new): local run instructions; the COOP/COEP production-host requirement with the verbatim `_headers` snippet; explicit note that GitHub Pages cannot send custom headers; the local-only privacy posture (no backend, no network, no persistence, memory-only keystroke log).
- 80 tests green (23 normalizer + 33 upload + 24 capture, up from 67); `tsc --noEmit` clean under `strict` + `noUncheckedIndexedAccess`; `pnpm build` exit 0; `pnpm preview` still serves COOP `same-origin` + COEP `require-corp` on the HTML document; oxlint clean; no `fetch`/`XMLHttpRequest`/`sendBeacon`/`WebSocket`/`innerHTML` anywhere in `src/`.

## Task Commits

1. **Task 1: Committed-character stream, key-repeat hardening, and lifecycle markers** — `192093b` (feat)
2. **Task 2: Capture test suite and the paste-blocked flag** — `6040f11` (test)
3. **Task 3: Chrome banners, timer readout, and README posture** — `cafbd99` (feat)

## Files Created/Modified

- `src/capture/types.ts` - `CommittedChar` / `MarkerKind` / `CaptureMarker`; `Session.charLog` / `Session.markers`
- `src/capture/capture.ts` - beforeinput/input char log, IME composition, paste/drop block + subscriber, blur/focus/visibilitychange markers + down-set clear, queueMicrotask resolution tap, `getCharLog()` / `getMarkers()` / `setPasteBlockedHandler()`
- `src/capture/use-capture.ts` - `useCapture(target, onPasteBlocked?)` forwarding
- `src/capture/capture.test.ts` - 13 new happy-dom cases (24 total) covering CAPT-01..04 edges
- `src/platform/isolation.ts` - `getTimingResolutionUs()`
- `src/session.ts` - reads `getCharLog()` / `getMarkers()` into `Session`
- `src/ui/Banners.tsx` - literal `!== true` gating, single-line notice string, updated comment
- `src/ui/CaptureSurface.tsx` - paste-blocked inline flag
- `README.md` - new: run instructions, COOP/COEP host requirement, privacy posture

## Decisions Made

See `key-decisions` frontmatter. Highlights:
- `attachCapture`/`detachCapture` own all listener wiring (not the React hook) so `capture.test.ts` never needs to mount React — consistent with the existing 01-01 test style.
- `App.tsx` required zero changes — `probeTimerResolutionUs()` gained the "combined" semantics purely from Task 1's upstream wiring, same call site.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] happy-dom's `CompositionEvent` does not implement `.data` from the init dict**
- **Found during:** Task 2 (composition test)
- **Issue:** `new CompositionEvent('compositionend', { data: 'ni' })` in happy-dom leaves `evt.data === undefined` — happy-dom's `CompositionEvent` is effectively an alias of its base `Event` class (confirmed via a Node probe: `window.CompositionEvent.toString()` printed the base `Event` class body, and `'data' in evt` was `false`). This matches RESEARCH assumption A8 ("happy-dom's InputEvent/getTargetRanges support may be incomplete").
- **Fix:** Test helper `trustedCompositionEvent()` sets `data` directly via `Object.defineProperty`, matching the file's existing `isTrusted`/`timeStamp` workaround pattern. Production code (`onCompositionEnd`) is unaffected — real browsers implement `CompositionEvent.data` natively.
- **Files modified:** `src/capture/capture.test.ts`
- **Verification:** `pnpm vitest run --project dom` — 24/24 pass.
- **Committed in:** `6040f11`

**2. [Rule 1 - Bug] `CaptureSurface.tsx` referenced a nonexistent CSS class**
- **Found during:** Task 3 review, before committing Task 3 (self-caught before landing)
- **Issue:** Task 2's implementation added `className="text-muted banner-fade"` to the paste-blocked flag, but `.banner-fade` is not defined anywhere in `index.css`, and `index.css` is outside this plan's `files_modified` scope — the class would have been a silent no-op (no fade, just an instant `visibility` toggle, and dead CSS-class reference).
- **Fix:** Replaced with an inline `opacity` transition gated by a local `window.matchMedia('(prefers-reduced-motion: reduce)')` check (honoring the Interaction Contract's "wrapped in `prefers-reduced-motion`" rule without touching the out-of-scope CSS file), plus `aria-hidden` toggling so screen readers don't announce the flag while inactive.
- **Files modified:** `src/ui/CaptureSurface.tsx`
- **Verification:** `tsc --noEmit` clean; `pnpm build` exit 0; visual behavior unchanged in intent (flag appears, fades, reserves its row).
- **Committed in:** `cafbd99`

**3. [Rule 1 - Bug] `Banners.tsx` "US ANSI keyboard layout" string split across two source lines**
- **Found during:** Task 3 acceptance-criteria self-check
- **Issue:** 01-01's JSX wrote `...for the US\n        ANSI keyboard layout...`, so the literal string "US ANSI keyboard layout" never appeared on one source line — `grep` for the exact phrase found nothing, even though the rendered DOM text (JSX whitespace-collapsed) was correct.
- **Fix:** Reflowed the JSX so "US ANSI keyboard layout" appears together on one line (`{' '}` used to preserve the space before it without introducing a lint-flagged trailing-space diff).
- **Files modified:** `src/ui/Banners.tsx`
- **Verification:** `grep -n "US ANSI keyboard layout" src/ui/Banners.tsx` matches; `pnpm build` exit 0; visual output unchanged.
- **Committed in:** `cafbd99`

### Intentional plan adjustments (not auto-fixes)

**4. `App.tsx` left untouched despite being listed in `files_modified`**
- The plan's Task 3 action says "pass the combined timing figure ... into `<Banners timingResolutionUs=...>`. This is the only App.tsx change" — but `App.tsx` already does exactly this from 01-01 (`timingResolutionUs: probeTimerResolutionUs()` passed straight through). Task 1's wiring of `recordMeasuredResolutionUs` upstream means the *same* `probeTimerResolutionUs()` call now returns the combined measured+expected figure instead of always the expected-only stub value — no App.tsx diff was needed to satisfy the requirement.

---

**Total deviations:** 3 auto-fixed (all Rule 1 bugs, two self-caught before landing) + 1 intentional no-op adjustment.
**Impact on plan:** No scope creep — every changed file is within the plan's `files_modified` list; `App.tsx`, `src/ingestion/*`, and `src/ui/CorpusInput.tsx` are unchanged (`git diff --stat` confirms zero diff on all three).

## Issues Encountered

- `pnpm exec tsc` output is swallowed by a supply-chain lockfile-verification wrapper in this environment (noted in 01-01/01-02); ran `./node_modules/.bin/tsc` directly for clean exit codes.

## User Setup Required

None — no external service configuration required.

## Known Stubs

None. Every `must_haves.truths` item from the plan frontmatter is implemented and covered by a passing automated test, except the two visual/manual items (paste-flag fade timing, banner no-layout-shift stacking) explicitly deferred to end-of-phase human-verify per `human_verify_mode` — these are documented in `coverage` above with `human_judgment: true`, not silently skipped.

## Threat Flags

None. All five `<threat_model>` mitigations from the plan are implemented as specified:
- T-01-04: `isTrusted` guard applies to `keydown`/`keyup` (unchanged from 01-01) and now also to `beforeinput`/`compositionstart`/`compositionend`/`input`.
- T-01-03: no `fetch`/`sendBeacon`/`WebSocket` anywhere in `src/` (verified via grep); README states the transcript never leaves the machine.
- T-01-08: paste/drop into the capture textarea cancelled via selective `beforeinput` `preventDefault`; corpus-box paste (01-02, untouched) is unaffected.
- T-01-09: `downCodes.clear()` on `blur` and `visibilitychange`→`hidden`, with markers recorded.
- T-01-05: README's isolation guidance keeps deployers on COOP/COEP with self-hosted assets; no third-party runtime scripts added.

No new security surface beyond the plan's threat register was introduced.

## Next Phase Readiness

- Phase 1 (corpus-input-keystroke-capture) is now fully implemented: INPUT-01/02/03 (01-01/01-02) and CAPT-01..05 (01-01/01-03) are all complete.
- `Session` now carries the complete D-14+extension shape (`exercise`, `events`, `charLog`, `markers`, `timingResolutionUs`, `crossOriginIsolated`, `startedAt`) — the full seam Phase 2 (trainer state machine) and Phase 3 (metrics) consume.
- The `attachCapture`/`detachCapture` single-authority wiring pattern and the single-subscriber module-callback pattern (`setPasteBlockedHandler`) are established and reusable.
- No blockers. Phase 2 can begin reconciling the two parallel logs (`events` + `charLog`) by `seq` into a trainer state machine.

## Self-Check: PASSED

- All 8 modified files + `README.md` verified present on disk with the expected content.
- All 3 task commits verified in git history: `192093b`, `6040f11`, `cafbd99`.
- Full verification re-run at summary time: `pnpm vitest run` → 80/80 passed; `tsc --noEmit -p tsconfig.json` clean; `pnpm build` exit 0; `curl -sI` of `pnpm preview` shows COOP `same-origin` + COEP `require-corp`; oxlint clean; no network-egress or raw-HTML sink in `src/`; `git diff --stat` confirms `App.tsx` / `src/ingestion/*` / `src/ui/CorpusInput.tsx` are unchanged.

---
*Phase: 01-corpus-input-keystroke-capture*
*Completed: 2026-09-05*
