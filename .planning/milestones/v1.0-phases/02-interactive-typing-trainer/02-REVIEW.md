---
status: issues_found
files_reviewed: 9
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
---

# Code Review: Phase 02 — Interactive Typing Trainer

## Findings

### WR-1: Caret-resync effect never fires on arrow-key/click drift, contradicting its own stated purpose (D-10 / T-02-04)

`src/ui/CaptureSurface.tsx` lines 131–138:

```ts
useLayoutEffect(() => {
  const el = ref.current
  if (!el) return
  if (el.selectionStart !== cursor || el.selectionEnd !== cursor) {
    el.selectionStart = cursor
    el.selectionEnd = cursor
  }
}, [cursor])
```

The comment above it (line 128–130) and the threat model (T-02-04, "medium/mitigate") both describe this effect as resyncing native selection "whenever it drifts (arrow keys / click)". It does not. The effect's dependency array is `[cursor]`, and `cursor` is derived exclusively from `computeTrainerState`'s fold over `charLog` — it never changes in response to arrow keys, Home/End, or a mouse click inside the textarea, none of which produce a `beforeinput`/composition record. Consequently:

- Pressing Left/Right/Home/End moves the native (invisible) `<textarea>`'s real `selectionStart`/`selectionEnd` away from `cursor`, and this `useLayoutEffect` never re-runs to correct it, because React only re-invokes an effect body when a value in its dependency array changes, not on every render.
- Because React never even schedules a re-render for a bare arrow-key press (no state changes), there isn't even a render to trigger the "does the effect's deps differ" check until the next actual character commit — by which point the drifted native cursor has already determined where the browser applies the next `beforeinput` (e.g., a Backspace at native position 0 produces **no** `beforeinput` event at all, silently dropping the user's delete keystroke).
- The one-line premise "cursor is the only thing this effect watches, so it's fine because typed-character scoring never reads DOM position" holds for insert/delete *scoring* (the reducer only consumes `data`/`inputType`, never position), but it does not prevent a native-boundary condition from suppressing events entirely, which the docstring explicitly claims is handled.

Fix: run the resync unconditionally on every render (drop the dependency array, or resync via a `select`/`onSelect` handler that fires on any selection change) so drift introduced between commits is corrected before the next keystroke, not just after.

No automated test exercises arrow-key or click-driven drift (see IN-4), which is why this gap wasn't caught.

### WR-2: `handleKeyDown` does not check `event.isTrusted`, breaking the codebase's established input-trust invariant

`src/ui/CaptureSurface.tsx` lines 108–124. Every other input entry point in this codebase — `onKey`, `onBeforeInput`, `onCompositionStart/End` in `src/capture/capture.ts` — explicitly guards with `if (!e.isTrusted) return` (labelled T-01-04 in Phase 1), specifically to reject synthetic events dispatched by page scripts or extensions. `handleKeyDown`'s Escape/Tab branch has no such guard:

```ts
const handleKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === 'Escape') {
    e.preventDefault()
    onRestartRequested?.()
    return
  }
  if (e.key === 'Tab') {
    e.preventDefault()
  }
}
```

A non-trusted (script-dispatched) `keydown` with `key: 'Escape'` on the focused textarea will invoke `onRestartRequested`, discarding the user's in-progress session, with no trust check at all. Confirmed by grep — there is no `isTrusted` reference anywhere in this file. This is a real inconsistency with the pattern Phase 1 deliberately established across every other handler touching this same element. Impact is bounded (local session disruption only, no data exfiltration since nothing is persisted in Phase 2), so this is a warning rather than critical, but it should be closed with the same one-line guard used elsewhere: `if (!e.isTrusted) return` at the top of `handleKeyDown`.

### WR-3: `computeTrainerState` reads/tallies `wasEverWrong` and status arrays in a way that's easy to silently miscount on future edits — flagging as a maintenance risk, not a live bug

Not a bug today (verified via the golden-case suite and the analysis above — every path is currently correct), but worth flagging: `wasEverWrong` is set only in the insert branch (`state.ts` line 51) and never cleared, while `perCharStatus[cursor]` is reset to `'pending'` in the delete branch (line 37) without a corresponding change to `wasEverWrong`. The two arrays are updated by different, non-adjacent code paths with an implicit invariant ("wasEverWrong may be stale/true for a position currently pending, and that's intentional") that is documented only in a comment, not enforced by types or a shared helper. A future edit to either branch (e.g., adding a new delete variant, or a batch-correction feature) could easily violate this invariant without a compiler or test signal beyond the existing golden cases. Recommend either consolidating the two arrays into one richer status object per position (`{ status, wasEverWrong }`) so the coupling is structural, or adding an explicit code comment cross-reference at both mutation sites (currently only the delete branch's comment references the invariant; the insert branch's `wasEverWrong[cursor] = true` line has no reciprocal note).

### IN-1: `computeTrainerState` render-time read of external mutable state bypasses `useSyncExternalStore`'s intended data path

`src/ui/CaptureSurface.tsx` line 126: `computeTrainerState(text, getCharLog())` is called directly in the render body, not from the `getSnapshot`/render-derived value that `useCharLogTick()` returns. `useCharLogTick()` only drives *when* to re-render (via the `charLog.length` snapshot); the actual data consumed for rendering (`getCharLog()`) is re-fetched independently, ad hoc, in the same render pass. Under React's current single-threaded synchronous render model this is safe (no interleaved mutation can occur mid-render), but it is a latent tearing risk if this component or its tree ever pick up concurrent rendering (e.g., wrapped in `startTransition`, or interrupted work). Low priority given the app's actual concurrency profile, but worth noting since it deviates from the `useSyncExternalStore` contract's intent (consume the value the hook itself hands back, not a fresh separate read of the same external source).

### IN-2: Test coverage gap — no golden case for a multi-character backspace-after-multi-character-typing scenario

`src/trainer/state.test.ts`'s delete-branch cases (case 4, 5, 8) all use a single-character `target: 'a'`. There is no case exercising a delete record after typing multiple characters (e.g., `target: 'ab'`, type both, then backspace once and confirm `cursor` returns to 1 and specifically `perCharStatus[1]` — not `perCharStatus[0]` — resets to `'pending'`, leaving `perCharStatus[0]` untouched). The current implementation clearly handles this correctly by inspection (the delete branch only ever touches `perCharStatus[cursor]` after decrementing), but the golden suite doesn't lock the "only the last position is touched, everything before it is left alone" behavior explicitly.

### IN-3: Test coverage gap — no test for `visibilitychange`-driven `isActive` transitions

`CaptureSurface.test.tsx` covers the `focus`/`blur` (via `focusout`) path for `.trainer-caret[data-active]` but has no test dispatching a `visibilitychange` event (with `document.hidden` toggled) to verify the "solid caret while tab is hidden" backstop wiring described in the D-09 comment (lines 96–106 of `CaptureSurface.tsx`). Only the blur half of that logic is exercised.

### IN-4: Test coverage gap — no test for arrow-key/click-driven caret-resync (directly related to WR-1)

There is no test in `CaptureSurface.test.tsx` that dispatches an arrow key or a click and then asserts `textarea.selectionStart`/`selectionEnd` get pulled back to `cursor`. This is the exact gap that let WR-1 through — the D-10 resync behavior is asserted only implicitly (by the fact that the caret visually tracks `cursor` after a *committed* keystroke), never for the drift scenario the code comment and threat model specifically call out.
