---
phase: 01-corpus-input-keystroke-capture
fixed_at: 2026-09-05T01:27:30Z
review_path: .planning/phases/01-corpus-input-keystroke-capture/01-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 8
skipped: 1
status: partial
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-09-05T01:27:30Z
**Source review:** .planning/phases/01-corpus-input-keystroke-capture/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (2 critical + 7 warning; Info findings out of scope per `fix_scope: critical_warning`)
- Fixed: 8
- Skipped: 1

**Verification:** All fixes were applied and verified inside an isolated git worktree (`.claude/worktrees/rf-01-854729-*`, branch `gsd-reviewfix/01-854729`), with `node_modules` symlinked in from the main checkout's real `node_modules` (never `pnpm install`ed inside the worktree, to avoid pnpm relinking/pruning the shared directory). After all fixes, the full gate was re-run directly against the binaries in that shared `node_modules`: `tsc --noEmit` (both `tsconfig.json` and `tsconfig.node.json`) — clean; `vite build` — succeeded (`dist/index.html` + assets, 100ms); `vitest run` — **84/84 passing** (80 pre-existing + 4 new tests added by WR-02 and WR-06 fixes). The worktree's commits were fast-forwarded onto `main` and the worktree removed; these results are reproducible from `main` in the primary checkout.

## Fixed Issues

### CR-01: Session snapshot is taken before any typing happens — events/charLog/markers are permanently empty

**Files modified:** `src/session.ts`, `src/ui/App.tsx`
**Commit:** `98d9feb`
**Applied fix:** Renamed `startSession(exercise)` to `buildSession(exercise, startedAt)`, documented as a **live** snapshot rather than a one-time event. `App.tsx` now takes an initial snapshot at load (as before) but also re-invokes `buildSession` on a 250ms interval (`SESSION_REFRESH_MS`, same order of magnitude as `useCapture`'s own throttle) for as long as an exercise is loaded, refreshing both `sessionRef.current` and the dev-only `window.__keebdrillSession`. `startedAt` is threaded through as a parameter so re-snapshotting doesn't reset the wall-clock start time. This directly fixes the bug: `sessionRef`/`window.__keebdrillSession` now reflect real captured keystrokes instead of staying frozen at the empty buffer that existed the instant the exercise loaded.

### CR-02: Typing surface is never reset when a new exercise is loaded

**Files modified:** `src/ui/App.tsx`
**Commit:** `83bf157`
**Applied fix:** Added a monotonic `loadToken` state, incremented on every `handleLoad`, and keyed `<CaptureSurface key={loadToken} />` on it. A monotonic counter was chosen over a content-derived key (e.g. `exercise.sourceRef ?? exercise.text`, as the review's Fix section suggested) because a content-derived key would fail to remount when the *same* text/file is loaded twice in a row — a reachable case the counter handles correctly. React now fully unmounts/remounts `CaptureSurface` on every load, discarding the stale uncontrolled `<textarea>` DOM node (and its stale value/IME composition state) instead of leaving it visibly showing the previous exercise's typed text.

### WR-01: Displayed/recorded timer resolution never reflects a real measurement

**Files modified:** `src/ui/App.tsx`
**Commit:** `e5c5f82`
**Applied fix:** Reused the CR-01 refresh interval: `timingResolutionUs` moved out of the one-time `useMemo` (which now only covers `crossOriginIsolated`, which genuinely never changes) into `useState`, updated by both `handleLoad` and the periodic refresh via `buildSession(...).timingResolutionUs`. The Banner's "Timer resolution: N µs" text now updates as real measurements arrive from `capture.ts`'s microtask-scheduled resolution sampling, instead of being permanently frozen at the static per-browser expectation. (The secondary note in WR-01 about `measuredResolutionUs` not being reset alongside `resetCapture()` is IN-04, an Info finding explicitly out of `fix_scope: critical_warning` — left untouched.)

### WR-02: `getEvents()`/`getCharLog()`/`getMarkers()` only shallow-freeze

**Files modified:** `src/capture/capture.ts`, `src/capture/capture.test.ts`
**Commit:** `05d1d85`
**Applied fix:** Every push into `buffer`, `charLog`, and `markers` now wraps the pushed object in `Object.freeze(...)` at capture time (in `onKey`, `onBeforeInput`, `onInput`'s Firefox-delete-backfill branch, `onCompositionEnd`, and `pushMarker`), so every consumer gets an immutable element regardless of entry point — matching the file's own D-13 "read-only exposure" claim. Added two tests (`capture.test.ts`) that mutate a property on a returned `getEvents()`/`getCharLog()` element and assert both a throw (strict mode) and that the live buffer is unaffected, per the review's explicit test suggestion.

### WR-03: Paste "busy" heuristic measures duration after the blocking work has finished

**Files modified:** `src/ui/CorpusInput.tsx`
**Commit:** `1c8e78d`
**Applied fix:** Rewrote `handleLoad` to set `busy` **before** running `fromPaste(value)`, then defer the actual (synchronous, blocking) transform into a `requestAnimationFrame` callback so the "Loading…" button state is guaranteed to paint before the jank happens, rather than measuring duration after the fact and showing the indicator (at most one frame) strictly after the freeze it existed to signal. Removed the now-dead `FRAME_MS`/`performance.now()` duration heuristic entirely, matching the review's suggested fix. The load-token concurrency guard (last-wins semantics) is preserved.

### WR-04: No size limit on pasted content

**Files modified:** `src/ingestion/upload.ts`, `src/ui/CorpusInput.tsx`
**Commit:** `a0c7d3e`
**Applied fix:** Exported `MAX_BYTES` (100,000) from `upload.ts` instead of duplicating the magic number, and added a byte-size check (`new TextEncoder().encode(value).length > MAX_BYTES`) at the top of `CorpusInput.tsx`'s `handleLoad`, before any transform runs — mirroring upload.ts's "size cap before any read" ordering. Surfaces a new paste-specific copy string (`errTooLargePaste`) via the existing `emptyError` slot, rather than the file-specific `errTooLarge` copy (which mentions "file").

### WR-05: `role="alert"` misapplied to a non-error caption

**Files modified:** `src/ui/CorpusInput.tsx`
**Commit:** `41961c0`
**Applied fix:** Made the `role` on the file-status `<p>` conditional: `role={fileError ? 'alert' : 'status'}`, instead of always `role="alert"`. Kept it as a single element (rather than splitting into two, per the review's alternative suggestion) to preserve the existing row-reservation/no-reflow layout behavior — the accessibility fix only requires the role to track which branch (error vs. success caption) is actually showing.

### WR-06: IME `composing` flag can get stuck `true` if window blur interrupts an active composition

**Files modified:** `src/capture/capture.ts`, `src/capture/capture.test.ts`
**Commit:** `7296658`
**Applied fix:** Added `composing = false` to both `onWindowBlur` and the `hidden` branch of `onVisibilityChange`, matching the existing `downCodes.clear()` treatment in both handlers. Added two tests exercising blur-during-composition and hidden-during-composition, asserting that a `beforeinput` dispatched afterward is recorded rather than silently dropped by the `if (composing) return` guard.

## Skipped Issues

### WR-07: No automated test coverage for the UI wiring layer

**File:** `src/ui/App.tsx`, `src/ui/CorpusInput.tsx`, `src/ui/CaptureSurface.tsx`, `src/session.ts`, `src/platform/isolation.ts`, `src/platform/layout.ts`
**Reason:** This finding's fix is "add `@testing-library/react` + `happy-dom` integration tests," which is a feature-scope addition (new devDependency, new test infrastructure, meaningfully-designed test scenarios), not a targeted line-level bug fix. Installing it safely requires running `pnpm add` in a tree with a real (non-symlinked) `node_modules`; the isolated worktree used for this fix run has `node_modules` symlinked in from the main checkout specifically so existing tests/build could be verified without a fresh install, and running `pnpm add`/`pnpm install` against that symlinked directory risks pnpm relinking or pruning the shared `node_modules` out from under the main checkout (network access was confirmed available, but the risk is structural, not connectivity). This should be done as a deliberate follow-up (add the dependency in the main checkout, then design the two integration scenarios the review calls out: load → type → verify a session consumer sees the events; load A → load B → assert the capture surface is clean for B) rather than through this automated fix-and-rollback flow.
**Original issue:** `find src -name "*.test.*"` returns exactly three files (`capture.test.ts`, `normalize.test.ts`, `upload.test.ts`); every pure/isolated module is well-tested, but none of the components/modules that wire them together (where CR-01, CR-02, and WR-01/WR-03 all lived) have any test coverage.

---

_Fixed: 2026-09-05T01:27:30Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
