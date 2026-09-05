---
phase: 01-corpus-input-keystroke-capture
verified: 2026-09-05T01:35:00Z
status: human_needed
score: 5/7 must-haves verified
behavior_unverified: 2
overrides_applied: 0
behavior_unverified_items:
  - truth: "Session (sessionRef / window.__keebdrillSession) reflects real captured keystrokes as the user types, refreshed on the 250ms interval, instead of staying frozen at the empty buffer that existed the instant the exercise loaded (CR-01 fix)."
    test: "Load a paste exercise, type ~10 real keystrokes into the capture textarea, wait >250ms, then inspect `window.__keebdrillSession.events` / `.charLog` in devtools."
    expected: "`events` and `charLog` are non-empty and grow as typing continues, not permanently `[]`."
    why_human: "The fix (App.tsx setInterval re-calling buildSession) is a runtime state-refresh loop with no automated test — `find src -name '*.test.*'` still returns only capture.test.ts/normalize.test.ts/upload.test.ts; WR-07 (add UI-wiring integration tests) was explicitly skipped in 01-REVIEW-FIX.md. Grep/type-check can see the interval and the call, not that it actually fires and updates the ref at runtime."
  - truth: "Loading a second exercise remounts CaptureSurface (via `key={loadToken}`) so no stale typed text, uncontrolled-textarea value, or IME composition state from the first exercise persists against the second exercise's prompt (CR-02 fix)."
    test: "Load exercise A, type some text into the capture textarea, then load exercise B (paste or upload) without reloading the page. Inspect the capture textarea's visible value and `getEvents()`/`getCharLog()` counts."
    expected: "The capture textarea is empty and refocused for exercise B; `resetCapture()`'s cleared buffers are not immediately re-populated with stale DOM diff artifacts from A's leftover value."
    why_human: "This is a React remount/cleanup invariant (key change forcing full unmount+mount of an uncontrolled DOM node) with no automated regression test — the exact defect CR-02 fixed was only caught by manual code review, not a test, and no test was added guarding the fix. A key-based remount is a well-established React pattern, but its correctness here is unexercised by CI."
---

# Phase 1: Corpus Input & Keystroke Capture Verification Report

**Phase Goal:** The app loads real code or text as a typing-ready exercise and records every keystroke as a high-resolution, append-only event log that all later metrics derive from.
**Verified:** 2026-09-05T01:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can paste a code snippet and see it loaded as the exercise source (SC1 / INPUT-01) | ✓ VERIFIED | `CorpusInput.tsx` `handleLoad` calls `fromPaste(value)` → `onLoad` → `App.tsx` `setExercise` → `<pre className="preview">{exercise.text}</pre>` (React text child, no `innerHTML` anywhere in `src/ui`, confirmed by grep). `tsc`/`build` clean. |
| 2 | User can upload a local file and see its contents loaded as the exercise source (SC2 / INPUT-02) | ✓ VERIFIED | `upload.ts` `fromFile()`: 100 KB cap before read, UTF-16 BOM sniff, `File.text()`, U+FFFD scan, `normalize()`, returns `{sourceType:'upload', sourceRef:file.name, language: extToLang(...)}`. 15 `upload.test.ts` cases pass (oversize, BOM, U+FFFD, ext-map, normalize equivalence, empty file). |
| 3 | Loaded content is normalized (CRLF→LF, configurable tab width, trailing whitespace stripped, single trailing newline) and the normalizer is unit-tested (SC3 / INPUT-03) | ✓ VERIFIED | `normalize.ts` implements the fixed 5-step transform. `normalize.test.ts` runs the 18 golden cases via `it.each` plus 5 contract-edge tests — all pass (`pnpm vitest run` → 84/84 total, this file's share confirmed by direct read). |
| 4 | While typing, committed characters are captured via `input`/`beforeinput` (no blanket `preventDefault`) and every keydown/keyup is recorded with a monotonic high-res `event.timeStamp`, with OS key-repeat ignored (SC4 / CAPT-01, CAPT-02, CAPT-04) | ✓ VERIFIED | `capture.ts`: `onKey` pushes `tMs: e.timeStamp` only, no other clock read; `grep -n preventDefault` shows both hits confined to `onBeforeInput` (paste/drop only) — no keydown `preventDefault`; `isRepeat = e.repeat \|\| downCodes.has(e.code)`. 28 `it()` cases in `capture.test.ts` cover repeat, per-code fallback, blur-clears-downset, idempotent attach, char-log mapping, paste-block, composition — all pass. |
| 5 | The full raw keystroke log is retained as the session's single source of truth; the app verifies `crossOriginIsolated === true`, records the achieved timer resolution, and shows a "US ANSI layout only" notice (SC5 / CAPT-03, CAPT-05) | ✓ VERIFIED | `getEvents()`/`getCharLog()`/`getMarkers()` return frozen snapshots of seq-keyed arrays; elements frozen at push time (WR-02 fix). `curl -sI` against a live `pnpm preview` server confirms `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` are actually sent. `Banners.tsx` renders the "US ANSI keyboard layout" notice unconditionally; the warning banner is gated on `crossOriginIsolated !== true`. |
| 6 | Session (`sessionRef` / `window.__keebdrillSession`) reflects real captured keystrokes as the user types, not a permanently-frozen empty snapshot (CR-01 critical-bug fix) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code is present and correctly wired (`App.tsx`'s 250ms `setInterval` re-calls `buildSession(...)`, updates `sessionRef.current` and `window.__keebdrillSession`), but no automated test exercises the interval firing / ref updating at runtime — see `behavior_unverified_items`. |
| 7 | Loading a second exercise resets the capture surface — no stale typed text or IME state from the previous exercise persists (CR-02 critical-bug fix) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code is present and correctly wired (`<CaptureSurface key={loadToken} />` forces a React remount on every `handleLoad`), but no automated test exercises "load A → type → load B → surface is clean" — see `behavior_unverified_items`. |

**Score:** 5/7 truths verified (2 present + wired, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/ingestion/types.ts` | `Exercise`/`SourceType` (D-11) | ✓ VERIFIED | Present, matches interface contract |
| `src/ingestion/normalize.ts` | Pure `normalize()` | ✓ VERIFIED | Zero imports, pure, 18 golden + 5 edge tests pass |
| `src/ingestion/paste.ts` | `fromPaste()` | ✓ VERIFIED | Delegates to `normalize()`, `sourceType:'paste'` |
| `src/ingestion/upload.ts` | `fromFile()` + guards | ✓ VERIFIED | Size cap before read, BOM sniff, U+FFFD scan, `MAX_BYTES` exported (WR-04 reuse) |
| `src/ingestion/language-map.ts` | `extToLang()` | ✓ VERIFIED | Case-insensitive map, `'plaintext'` fallback |
| `src/ingestion/errors.ts` | `CorpusTooLargeError`, `NonUtf8Error` | ✓ VERIFIED | Both extend `Error`, readonly payload fields |
| `src/capture/types.ts` | `KeystrokeEvent`, `Session`, `CommittedChar`, `CaptureMarker` | ✓ VERIFIED | All fields present, `Session` carries `charLog`/`markers` additively |
| `src/capture/capture.ts` | Hot-path capture engine | ✓ VERIFIED | keydown/keyup/beforeinput/input/composition/blur/focus/visibilitychange all wired; frozen-at-push-time elements (WR-02) |
| `src/capture/use-capture.ts` | React hook seam | ✓ VERIFIED | `useLayoutEffect` attach before focus, `useSyncExternalStore` throttled count |
| `src/platform/isolation.ts` | `readCrossOriginIsolated`, `probeTimerResolutionUs`, `recordMeasuredResolutionUs`, `getTimingResolutionUs` | ✓ VERIFIED | Measured/expected split implemented and fed from real keydowns via `queueMicrotask` |
| `src/platform/layout.ts` | `warnIfNonAnsiLayout()` | ✓ VERIFIED | try/catch guarded, `console.warn` only, fire-and-forget from `main.tsx` |
| `src/session.ts` | `buildSession()` (renamed from `startSession` by CR-01 fix) | ✓ VERIFIED | Live snapshot, `startedAt` threaded as a parameter |
| `src/ui/App.tsx` | Wiring root | ✓ VERIFIED | `loadToken` remount key, 250ms session-refresh interval, `timingResolutionUs` state |
| `src/ui/CorpusInput.tsx` | Paste + upload + all states | ✓ VERIFIED | Empty/error/loading/last-wins/size-cap-on-paste all present |
| `src/ui/CaptureSurface.tsx` | Native textarea capture surface | ✓ VERIFIED | Paste-blocked flag, 4s fade, `aria-hidden`, reduced-motion aware |
| `src/ui/Banners.tsx` | Chrome banners | ✓ VERIFIED | Unconditional notice, gated warning, timer readout |
| `README.md` | Host/privacy posture | ✓ VERIFIED | COOP/COEP requirement, `_headers` snippet, GitHub Pages caveat, privacy statement all present |
| `vite.config.ts` | COOP/COEP + vitest project split | ✓ VERIFIED | Headers on both `server` and `preview`; confirmed live via `curl` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `CorpusInput.tsx` | `paste.ts` / `upload.ts` | `fromPaste`/`fromFile` calls in `handleLoad`/`handleFileChange` | ✓ WIRED | Confirmed by read |
| `App.tsx` | `CaptureSurface.tsx` | rendered only when `exercise !== null`, keyed on `loadToken` | ✓ WIRED | Confirmed by read |
| `CaptureSurface.tsx` | `use-capture.ts` | `useCapture(ref, handlePasteBlocked)` in `useLayoutEffect` before focus | ✓ WIRED | Confirmed by read |
| `use-capture.ts` | `capture.ts` | `attachCapture`/`detachCapture`/`getEvents`/`setPasteBlockedHandler` | ✓ WIRED | Confirmed by read |
| `App.tsx` | `session.ts` | `buildSession(exercise, startedAt)` called on load AND on a 250ms interval | ✓ WIRED | CR-01 fix confirmed present; runtime firing unverified by test (see truth 6) |
| `session.ts` | `platform/isolation.ts` | `readCrossOriginIsolated()`, `probeTimerResolutionUs()` | ✓ WIRED | Confirmed by read |
| `capture.ts` | `platform/isolation.ts` | `recordMeasuredResolutionUs` fed via `queueMicrotask` on real keydowns | ✓ WIRED | Confirmed by read |
| `vite.config.ts` | runtime `crossOriginIsolated` | COOP/COEP headers on `server`+`preview` | ✓ WIRED | `curl -sI` against live `pnpm preview` confirms both headers present |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | `pnpm vitest run` | `Test Files 3 passed (3)`, `Tests 84 passed (84)` | ✓ PASS |
| Full-tree typecheck | `./node_modules/.bin/tsc --noEmit -p tsconfig.json` && `-p tsconfig.node.json` | both exit 0 | ✓ PASS |
| Production build | `pnpm build` | `✓ built in 97ms`, `dist/` emitted | ✓ PASS |
| COOP/COEP served live | `pnpm preview --port 4174` + `curl -sI http://localhost:4174/` | `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` present | ✓ PASS |
| No debt markers in shipped source | `grep -rn -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER" src/ README.md` | Only hit is a test *fixture string* (`upload.test.ts` asserts a literal `"// TODO: keep me"` comment is preserved verbatim, D-08) — not project debt | ✓ PASS |
| CR-01/CR-02 runtime behavior (session refresh loop firing; remount clearing stale text) | — | Not run — requires a live browser/DOM interaction beyond what happy-dom + Vitest exercise | ? SKIP → routed to human verification |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INPUT-01 | 01-01, 01-02 | Paste text as exercise source | ✓ SATISFIED | `fromPaste`, `CorpusInput.tsx`, rendered preview |
| INPUT-02 | 01-02 | Upload local file as exercise source | ✓ SATISFIED | `fromFile`, size/UTF-8 guards, 15 unit tests |
| INPUT-03 | 01-01, 01-02 | Content normalized, normalizer unit-tested | ✓ SATISFIED | `normalize.ts`, 18 golden + 5 edge tests, applied identically to paste and upload |
| CAPT-01 | 01-01, 01-03 | keydown/keyup captured, `event.timeStamp`, minimal handler | ✓ SATISFIED | `onKey` pushes only; `tMs: e.timeStamp`; no other clock call in handler |
| CAPT-02 | 01-03 | OS key-repeat ignored | ✓ SATISFIED | `isRepeat` flag + per-code down-set fallback; blur/visibilitychange clear down-set |
| CAPT-03 | 01-01, 01-03 | Full raw log retained as SSOT | ✓ SATISFIED | `getEvents()`/`getCharLog()`/`getMarkers()`, seq-keyed, frozen at push time |
| CAPT-04 | 01-03 | Committed chars via `input`/`beforeinput`, no blanket `preventDefault`, US ANSI notice | ✓ SATISFIED | `onBeforeInput`/`onInput`; `preventDefault` confined to paste/drop; notice always renders |
| CAPT-05 | 01-01, 01-03 | Cross-origin isolation verified + timer resolution recorded | ✓ SATISFIED | `curl` confirms headers live; `getTimingResolutionUs()` exposes measured+expected |

No orphaned requirements — REQUIREMENTS.md traceability table lists exactly these 8 IDs against Phase 1, all marked Complete, matching the union of `requirements:` fields across 01-01/01-02/01-03-PLAN.md frontmatter.

### Anti-Patterns Found

None blocking. `grep` for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` across `src/` and `README.md` returns exactly one hit, inside `upload.test.ts`, and it is a test fixture asserting that a `// TODO: keep me` code comment survives `normalize()` unmodified (D-08 "content is typed as-is, never parsed or stripped") — not a real debt marker. No `console.log`-only implementations, no hardcoded-empty stubs feeding rendered output, no `innerHTML`/`dangerouslySetInnerHTML` anywhere in `src/`.

### Human Verification Required

### 1. End-to-end paste flow + live session reflection (CR-01 regression)

**Test:** `pnpm dev`, paste a short code snippet, click "Load exercise", confirm the preview renders inertly and the capture textarea is focused. Type ~10 keystrokes, wait a second, then check `window.__keebdrillSession.events.length` and `.charLog.length` in devtools.
**Expected:** Preview shows the normalized pasted text; capture textarea has focus without an extra click; `window.__keebdrillSession.events`/`.charLog` are non-empty and grow as you keep typing (not stuck at `[]`).
**Why human:** Visual focus/render outcome plus a runtime state-refresh loop (App.tsx's 250ms interval calling `buildSession`) that no automated test exercises — this is the exact bug (CR-01) code review found and fixed without adding a regression test.

### 2. Second-exercise reload does not leak stale state (CR-02 regression)

**Test:** Load exercise A, type a few characters into the capture textarea, then load exercise B (different paste or a file) without refreshing the page.
**Expected:** The capture textarea is empty and refocused for exercise B — no leftover text from A is visible, and typing in B does not misfire a spurious deletion record.
**Why human:** React remount-via-key is a runtime DOM lifecycle behavior; this is the exact defect (CR-02) code review found, fixed via `key={loadToken}`, with no automated test added to guard the fix.

### 3. Upload states and inline copy

**Test:** Upload a `.ts` file (should load as `language: 'typescript'`); upload a file over 100 KB; upload a UTF-16-encoded file; press "Load exercise" with both paste box and file input empty.
**Expected:** `.ts` file loads normally with the "Loaded from {filename}" caption; oversize file shows "This file is over 100 KB..." inline beneath the file control with no reflow; UTF-16 file shows "This file isn't UTF-8 text..."; empty press shows "Nothing to load yet..." beneath the (still-enabled) button.
**Why human:** Inline error placement and no-layout-shift claims need a real browser render; deferred per `01-02-SUMMARY.md` D3 (`human_judgment: true`).

### 4. Chrome banners and timer-resolution readout

**Test:** Under normal `pnpm dev` (cross-origin isolated), confirm no warning banner shows and "Timer resolution: N µs" reads a small figure (~5 µs). Force a non-isolated response (e.g. temporarily comment out the COOP/COEP headers in `vite.config.ts`) and reload — confirm the "Heads up" warning banner appears above the "US ANSI" notice with no layout shift of the controls below. Type several dozen keystrokes and confirm the readout eventually reflects a measured value rather than staying at the static per-browser expectation.
**Expected:** Banner stacking order (warning above notice) and zero layout shift when the warning appears/disappears; timer readout updates from the static WR-01-fixed value once real keystrokes are measured.
**Why human:** Visual layout-shift and banner-stacking claims need a real browser; deferred per `01-01-SUMMARY.md` D6 and `01-03-SUMMARY.md` D4 (`human_judgment: true`).

### 5. Paste-blocked flag in the typing surface

**Test:** Click into the "Type here" capture textarea and paste (Ctrl+V) some text. Separately, paste into the "Paste code or text" corpus box.
**Expected:** Pasting into the typing surface is blocked, shows the inline "Pasting into the typing area is disabled - type the exercise to record real keystrokes." message, and the message fades out after ~4 seconds. Pasting into the corpus paste box works normally and is unaffected.
**Why human:** Fade timing and exact inline placement need a real browser; deferred per `01-03-SUMMARY.md` D2 (`human_judgment: true`).

### Gaps Summary

No FAILED truths, no MISSING/STUB artifacts, no NOT_WIRED key links, and no blocking anti-patterns were found. Every automated gate the plans specify (84/84 tests, clean `tsc` on both configs, successful `pnpm build`, live COOP/COEP headers via `curl`) passes, and the two CRITICAL bugs found in code review (CR-01: Session frozen empty; CR-02: stale capture surface across reloads) both have code-verified fixes committed to `main` (`98d9feb`, `83bf157`).

The reason this phase is `human_needed` rather than `passed` is that (a) the fixes for CR-01 and CR-02 — the two most consequential defects in this phase — were never given automated regression coverage (WR-07, "add UI-wiring integration tests," was explicitly skipped in `01-REVIEW-FIX.md` as out-of-scope for an automated fix pass), so their correctness rests on code review reasoning rather than a passing test, and (b) the phase's own SUMMARY files already flag five distinct visual/interaction outcomes (paste→preview→focus, upload states, both banners' layout-shift behavior, paste-blocked fade) as `human_judgment: true` / `status: unknown`, deferred to end-of-phase human verification per the project's configured `human_verify_mode`. None of this indicates the phase goal was not achieved in the code — it indicates the goal's achievement has not yet been *confirmed* in a running browser, which is exactly what human verification is for.

---

_Verified: 2026-09-05T01:35:00Z_
_Verifier: Claude (gsd-verifier)_
