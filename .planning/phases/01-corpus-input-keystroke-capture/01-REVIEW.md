---
phase: 01-corpus-input-keystroke-capture
reviewed: 2026-09-05T01:15:27Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - .gitignore
  - .npmrc
  - .oxlintrc.json
  - README.md
  - index.html
  - package.json
  - pnpm-workspace.yaml
  - public/favicon.svg
  - src/capture/capture.test.ts
  - src/capture/capture.ts
  - src/capture/types.ts
  - src/capture/use-capture.ts
  - src/index.css
  - src/ingestion/errors.ts
  - src/ingestion/language-map.ts
  - src/ingestion/normalize.test.ts
  - src/ingestion/normalize.ts
  - src/ingestion/paste.ts
  - src/ingestion/types.ts
  - src/ingestion/upload.test.ts
  - src/ingestion/upload.ts
  - src/main.tsx
  - src/platform/isolation.ts
  - src/platform/layout.ts
  - src/session.ts
  - src/ui/App.tsx
  - src/ui/Banners.tsx
  - src/ui/CaptureSurface.tsx
  - src/ui/CorpusInput.tsx
  - src/vite-env.d.ts
  - tsconfig.json
  - tsconfig.node.json
  - vite.config.ts
findings:
  critical: 2
  warning: 7
  info: 4
  total: 13
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-09-05T01:15:27Z
**Depth:** standard
**Files Reviewed:** 32 (source + config; see `files_reviewed_list`)
**Status:** issues_found

## Summary

The pure/isolated logic — `normalize.ts` (all 18 golden cases verified by hand-tracing plus the test suite), `capture.ts`'s repeat/IME/paste-block state machine, and `upload.ts`'s size/BOM/UTF-8 guards — is careful, well-commented, and behaves correctly against the documented contract. `pnpm test` passes (80/80), and I independently confirmed the CSP/COOP/COEP claims in README.md against a real `pnpm exec vite` dev response and a `pnpm build` production `dist/index.html` (both look correct: COOP/COEP headers present on the dev/preview server, and in the production build the CSP `<meta>` tag correctly precedes the bundled `<script>` tag so it actually governs it).

The defects are concentrated in the **UI wiring layer that stitches the tested modules together** — `App.tsx`, `session.ts`, `CorpusInput.tsx`, `CaptureSurface.tsx` — which has zero test coverage (see WR-07). Two of these are core-loop correctness bugs: the `Session` object is snapshotted before any typing happens and therefore never reflects real keystrokes (CR-01), and the typing surface is never reset when a second exercise is loaded, corrupting the correlation between the loaded exercise, the visible text, and the (correctly) reset capture buffer (CR-02). Several other findings show the "measured timer resolution" feature — the actual headline differentiator per README — has no live consumer despite the plumbing existing in `capture.ts`/`isolation.ts` (WR-01).

## Critical Issues

### CR-01: Session snapshot is taken before any typing happens — events/charLog/markers are permanently empty

**File:** `src/ui/App.tsx:32-40`, `src/session.ts:9-19`
**Issue:**
`handleLoad` calls `resetCapture()` and then, in the very next statement, `startSession(loaded)`:

```ts
const handleLoad = (loaded: Exercise) => {
  resetCapture() // fresh buffer per exercise
  setExercise(loaded)
  const session = startSession(loaded)      // <-- snapshots getEvents()/getCharLog()/getMarkers() NOW
  sessionRef.current = session
  if (import.meta.env.DEV) {
    window.__keebdrillSession = session
  }
}
```

`startSession` (`src/session.ts:9-19`) does `events: getEvents(), charLog: getCharLog(), markers: getMarkers()` — each of which returns `Object.freeze(buffer.slice())` of whatever is in the buffer *at that instant*. Since this runs immediately after `resetCapture()` and before the user has typed a single character (the `CaptureSurface` textarea doesn't even exist in the tree yet on first load), the returned `Session.events`/`charLog`/`markers` are frozen **empty arrays**, and nothing ever re-assigns `sessionRef.current` or `window.__keebdrillSession` afterward. No matter how much the user subsequently types, `sessionRef.current.events` stays `[]` for the lifetime of that exercise.

This is the app's only wired consumer of `Session` in Phase 1, and `window.__keebdrillSession` is explicitly exposed in dev builds — the obvious intent is to let a developer type in the capture surface and then inspect `window.__keebdrillSession` in devtools to confirm capture worked end-to-end. As implemented, that inspection point is permanently broken (always shows an empty session), and the docstring's promise ("Phase 3 metrics fold over this") is false for the object currently produced by this call site: any future phase that consumes `sessionRef.current` as-is will see zero data.

**Fix:** Don't build the `Session` snapshot at load time. Either (a) rename this to reflect that it's establishing exercise/environment context only (drop `events`/`charLog`/`markers` from what's captured here), or (b) defer the actual snapshot until the moment it's needed (e.g. a `finishSession(exercise)` called on completion, or make `sessionRef` hold a live getter instead of a frozen copy):

```ts
// session.ts
export function finishSession(exercise: Exercise, startedAt: number): Session {
  return {
    exercise,
    events: getEvents(),
    charLog: getCharLog(),
    markers: getMarkers(),
    timingResolutionUs: probeTimerResolutionUs(),
    crossOriginIsolated: readCrossOriginIsolated(),
    startedAt,
  }
}
```
and only assign `window.__keebdrillSession` when the exercise is actually complete (or refresh it on an interval/on-demand for dev inspection), not once at load.

---

### CR-02: Typing surface is never reset when a new exercise is loaded — stale text and stale composition state persist across reloads

**File:** `src/ui/App.tsx:69`, `src/ui/CaptureSurface.tsx:26-94`
**Issue:** `CorpusInput` (paste textarea + file input + "Load exercise" button) remains mounted and usable after an exercise is loaded, so a user can load a second exercise without a page refresh. `App.tsx` renders `<CaptureSurface />` unconditionally once `exercise !== null`, with no `key` prop tied to the exercise and no prop connecting it to `exercise` at all:

```tsx
{exercise === null ? ( ... ) : (
  <>
    <section>...<pre className="preview">{exercise.text}</pre></section>
    <CaptureSurface />
  </>
)}
```

Because `CaptureSurface`'s `<textarea>` is uncontrolled (by design, to avoid per-keystroke React state churn) and the component is never remounted or told to reset, loading a second exercise:
1. Calls `resetCapture()` — correctly clears the in-memory keystroke/char/marker buffers.
2. Does **not** touch the DOM `<textarea>`'s `.value` — whatever the user had typed for the *first* exercise is still visibly sitting in the box, now displayed against the *second* exercise's prompt.
3. Compounds with `capture.ts`'s Firefox-delete fallback (`lastValue`): `resetCapture()` sets `lastValue = ''`, but the real DOM value is non-empty, so the next `input` event's `value.length < lastValue.length` comparison in `onInput` (`src/capture/capture.ts:108-119`) is comparing against a value that doesn't match reality, which can misfire a synthetic deletion record.
4. The `useEffect(() => ref.current?.focus(), [])` in `CaptureSurface.tsx:44-46` only runs once on mount, so on reload the surface doesn't get refocused or cleared for the new exercise.

This directly corrupts the core Phase 1 loop ("load exercise → type it → capture matches what's on screen") for the (fully reachable, UI-supported) case of loading a second exercise in the same session.

**Fix:** Key `CaptureSurface` on the exercise identity so React remounts it cleanly on every load, or explicitly clear/refocus it in an effect keyed on the exercise:

```tsx
<CaptureSurface key={exercise.sourceRef ?? exercise.text} />
```
or, inside `CaptureSurface`, accept the loaded exercise (or a monotonic "load token") as a prop and reset `ref.current.value = ''` + refocus whenever it changes.

## Warnings

### WR-01: Displayed/recorded timer resolution never reflects a real measurement — dead measurement pipeline

**File:** `src/ui/App.tsx:22-28`, `src/session.ts:15`, `src/platform/isolation.ts:13-34`
**Issue:** `capture.ts` (`scheduleResolutionSample`/`recordMeasuredResolutionUs`, `capture.ts:63-72`) exists specifically to feed real measured inter-keydown deltas into `isolation.ts`'s module-level `measuredResolutionUs`, and `probeTimerResolutionUs()`'s docstring says it "prefers a real measurement once Plan 01-03 supplies one, else the per-browser expectation." But the only two call sites of `probeTimerResolutionUs()` are:
- `App.tsx:22-28`, inside `useMemo(() => ({...}), [])` — evaluated exactly once, on the very first render of `App`, before any exercise is even loaded. The comment justifying this ("These do not change over the lifetime of the document") is true for `crossOriginIsolated` but false for `timingResolutionUs`, which is designed to change once real keystrokes are measured.
- `session.ts:15`, inside `startSession()`, which (per CR-01) runs immediately after `resetCapture()`, before any typing for that exercise has occurred.

Since neither call site is ever re-invoked after typing happens, the elaborate measurement pipeline in `capture.ts` has no live consumer: the Banner's "Timer resolution: N µs" text is permanently stuck at the static per-browser expected value (5/100/1000 µs) and never updates to a measured figure, even after thousands of real keystrokes.

As a secondary wrinkle: `isolation.ts`'s `measuredResolutionUs` is module-level state that `capture.ts`'s `resetCapture()` does not clear, so if this were ever wired up correctly, a stale measurement from a *previous* exercise's typing would leak into a session that hasn't been typed in yet.

**Fix:** Re-read `probeTimerResolutionUs()` on a cadence tied to actual typing (e.g. via the same `useSyncExternalStore`/polling mechanism `useCapture` already uses for `count`), and decide whether `measuredResolutionUs` should be reset alongside `resetCapture()` or intentionally kept as a per-page-load rolling estimate (and document that choice).

---

### WR-02: `getEvents()`/`getCharLog()`/`getMarkers()` only shallow-freeze — callers can mutate the live buffer through the returned objects

**File:** `src/capture/capture.ts:200-216`
**Issue:**
```ts
export function getEvents(): readonly KeystrokeEvent[] {
  return Object.freeze(buffer.slice())
}
```
`buffer.slice()` copies the *array*, not its elements — each `KeystrokeEvent` object inside the returned array is the exact same object reference stored in the internal `buffer`. `Object.freeze` on the outer array only prevents push/pop/index-reassignment; it does not deep-freeze the referenced objects. So `getEvents()[0].tMs = 0` (or any other property mutation) silently corrupts the live internal buffer, in direct contradiction of the file's own D-13 comment ("Append-only buffer, exposed read-only... Returns a frozen snapshot so callers cannot mutate capture state") and the "read-only exposure" test suite, which only asserts array-level immutability (`.push()` throwing) — it never asserts that mutating a property of a returned event is prevented or is at least non-destructive to the source buffer. The same pattern applies to `getCharLog()` and `getMarkers()`.

**Fix:** Either deep-freeze each element before returning, or (cheaper) push already-frozen objects into the buffer at capture time so every consumer gets an immutable object regardless of entry point:
```ts
buffer.push(Object.freeze({ seq: seq++, type, key: e.key, /* ... */ }))
```
and add a test that mutates a property of a returned snapshot element and asserts either a throw (strict mode) or that the live buffer is unaffected.

---

### WR-03: Paste "busy" heuristic measures duration *after* the blocking work has already finished

**File:** `src/ui/CorpusInput.tsx:47-75`
**Issue:**
```ts
const started = performance.now()
const exercise = fromPaste(value)                 // synchronous, blocks main thread
const slow = performance.now() - started > FRAME_MS
...
if (slow) {
  setBusy(true)                                    // too late — the slow work is already done
  requestAnimationFrame(() => { commit(); setBusy(false) })
} else {
  commit()
}
```
`fromPaste(value)` is a synchronous call that has already completed (and already caused whatever main-thread jank it was going to cause) by the time `slow` is computed and `setBusy(true)` runs. The subsequent `requestAnimationFrame` doesn't re-run the slow work or protect the UI from it — it only delays the (already-cheap, since `exercise` is already computed) call to `onLoad` by one frame. The "Loading…" button text can therefore appear for at most one frame, strictly after the freeze it exists to signal, providing no real feedback during the actual jank and no protection against it.

**Fix:** If the intent is to show a busy indicator *during* a slow transform, the busy state must be set *before* starting the transform, and the transform itself deferred (e.g. via `requestAnimationFrame`/`requestIdleCallback`/a worker) rather than run synchronously first:
```ts
setBusy(true)
requestAnimationFrame(() => {
  const exercise = fromPaste(value)
  commit(exercise)
  setBusy(false)
})
```

---

### WR-04: No size limit on pasted content, unlike the 100 KB cap enforced for uploads

**File:** `src/ingestion/paste.ts:7-13`, `src/ui/CorpusInput.tsx:47-75`
**Issue:** `upload.ts` enforces `MAX_BYTES = 100_000` before ever reading a file (`CorpusTooLargeError`), but `fromPaste()` has no equivalent guard, and `CorpusInput.tsx`'s paste path never checks `value.length` before calling it. A user pasting a multi-megabyte clipboard payload (e.g. an entire large log file or repo dump) runs `normalize()` synchronously on the full string with no cap — for large enough input this can freeze the tab well past the `FRAME_MS` heuristic WR-03 already shows doesn't protect against jank.

**Fix:** Apply the same (or a paste-appropriate) size cap to `fromPaste`/`CorpusInput.tsx`, surfacing the existing `errTooLarge` copy (or a paste-specific variant) instead of silently accepting arbitrarily large input.

---

### WR-05: `role="alert"` misapplied to a non-error caption

**File:** `src/ui/CorpusInput.tsx:125-135`
**Issue:**
```tsx
<p role="alert" className={fileError ? undefined : 'text-muted'} ...>
  {fileError ?? (caption && <span className="text-label">{caption}</span>)}
</p>
```
The same `<p role="alert">` element is used both for real errors (`fileError`, e.g. "This file is over 100 KB...") and for the success caption ("Loaded from main.ts"). `role="alert"` implies an assertive live region reserved for important/time-sensitive information; screen readers will announce the ordinary success caption with the same urgency as an error every time a file is loaded.

**Fix:** Use `role="alert"` only for the error branch and a neutral `role="status"` (or no role) for the caption branch, e.g. two separate elements toggled by `fileError`/`caption`.

---

### WR-06: IME `composing` flag can get stuck `true` if window blur interrupts an active composition

**File:** `src/capture/capture.ts:122-155`
**Issue:** `onWindowBlur`/`onVisibilityChange` (`hidden` branch) clear `downCodes` but do not reset `composing`. If a user alt-tabs away (or the tab is hidden) while mid-IME-composition and the OS/browser does not reliably fire `compositionend` on blur (behavior varies by platform/IME), `composing` remains `true` indefinitely. Every subsequent `beforeinput` is then silently dropped from `charLog` (`onBeforeInput`'s `if (composing) return` guard, `capture.ts:93`) until a `compositionend` eventually fires — which may never happen if the composition was abandoned by the blur. This path is not covered by `capture.test.ts` (only the happy-path composition sequence is tested).

**Fix:** Reset `composing = false` in `onWindowBlur`/the `hidden` branch of `onVisibilityChange`, matching the existing `downCodes.clear()` treatment, and add a test for blur-during-composition.

---

### WR-07: No automated test coverage for the UI wiring layer

**File:** `src/ui/App.tsx`, `src/ui/CorpusInput.tsx`, `src/ui/CaptureSurface.tsx`, `src/session.ts`, `src/platform/isolation.ts`, `src/platform/layout.ts`
**Issue:** `find src -name "*.test.*"` returns exactly three files: `capture.test.ts`, `normalize.test.ts`, `upload.test.ts`. Every pure/isolated module is well-tested (80 passing assertions), but none of the components/modules that wire them together have any test coverage. CR-01, CR-02, and WR-01/WR-03 all live in exactly this untested layer, and would have been caught by even a shallow React Testing Library test that (a) loads an exercise, types a few keys, and asserts `window.__keebdrillSession`/`sessionRef` reflects them, or (b) loads two exercises in sequence and asserts the capture surface is empty on the second.

**Fix:** Add integration-level tests (e.g. `@testing-library/react` + happy-dom) for at least: load → type → verify a session/consumer sees the typed events; load exercise A → load exercise B → assert the capture surface and buffer are clean for B.

## Info

### IN-01: File `<input>` value is never reset after handling — re-selecting the identical file path may not re-fire `change`

**File:** `src/ui/CorpusInput.tsx:77-101`
**Issue:** After a successful or failed `fromFile()` call, `e.target.value` is never cleared. In some browsers, selecting the exact same file path again through the native file dialog does not produce a new `change` event because the input's value string is unchanged, which would leave a stale error message on screen with no way to retry against the same (now-fixed) file without picking a different filename.
**Fix:** Reset `e.target.value = ''` at the start or end of `handleFileChange` so re-selecting the same path always fires `change`.

### IN-02: CSP `<meta>` tag omits `base-uri` and `frame-ancestors`

**File:** `index.html:7-10`
**Issue:** `base-uri` and `frame-ancestors` are not inherited from `default-src` per the CSP spec and default to unrestricted when omitted. There is currently no HTML-injection primitive in the reviewed code (no `dangerouslySetInnerHTML`/`innerHTML` anywhere in `src/`, confirmed by grep), so this is defense-in-depth rather than an active vulnerability.
**Fix:** Add `base-uri 'self'` to the meta tag; `frame-ancestors` cannot be set via `<meta>` (spec restriction) — set it via a response header if/when a header-capable host is used (README already discusses header-capable hosts for COOP/COEP).

### IN-03: U+FFFD-based UTF-8 validation will false-positive on legitimate content

**File:** `src/ingestion/upload.ts:35-38`
**Issue:** `raw.includes('�')` rejects any file whose decoded text contains an actual (legitimately authored) U+FFFD replacement character, not just mis-decoded bytes — e.g. a text file that itself discusses/contains the Unicode replacement character would be rejected as "not UTF-8." This is a known, low-probability tradeoff and appears intentional per the surrounding comments, but is worth documenting explicitly as a limitation.
**Fix:** No change required; consider a one-line comment acknowledging the false-positive case, or (if ever revisited) validate via a strict/fatal `TextDecoder('utf-8', { fatal: true })` decode of the raw bytes instead of scanning the lossy-decoded string.

### IN-04: `isolation.ts`'s measured-resolution state is not part of `capture.ts`'s reset lifecycle

**File:** `src/capture/capture.ts:220-229`, `src/platform/isolation.ts:13-20`
**Issue:** `resetCapture()` clears every piece of `capture.ts`'s own module state (`buffer`, `charLog`, `markers`, `downCodes`, `composing`, `lastValue`, `lastRealKeydownTMs`, `seq`) but has no knowledge of — and does not reset — `isolation.ts`'s `measuredResolutionUs`, which `capture.ts` itself feeds via `recordMeasuredResolutionUs`. This means a measurement recorded during one exercise silently persists (as the "smallest observed delta so far," via `Math.min`) into the next exercise's session, once WR-01 is fixed and this value actually gets read live.
**Fix:** Either export a reset from `isolation.ts` and call it from `resetCapture()`/`App.tsx`'s `handleLoad`, or explicitly document that the timer-resolution measurement is intentionally a page-lifetime rolling estimate rather than a per-exercise one.

---

_Reviewed: 2026-09-05T01:15:27Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
