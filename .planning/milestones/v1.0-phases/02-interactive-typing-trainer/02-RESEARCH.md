# Phase 2: Interactive Typing Trainer - Research

**Researched:** 2026-09-05
**Domain:** Browser-native transparent-overlay text rendering + pure-function state reconciliation (no new libraries)
**Confidence:** MEDIUM — the core rendering technique and the reducer design are well-established patterns cross-checked against MDN and multiple independent sources, but several concrete interaction details (whether `execCommand`-fired input events are `isTrusted` on a plain `<textarea>`, exact caret/selection behavior across Chrome/Firefox/Safari) could not be verified against a live browser this session and are flagged as assumptions requiring a spike or manual check.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Rendering Architecture**
- **D-01:** Use the **transparent-textarea-over-rendered-layer** pattern (the standard code-typing-test technique): keep `CaptureSurface`'s existing focused native `<textarea>` as the exclusive input/focus/caret host, but make its text and native caret invisible (`color: transparent`, `caret-color: transparent`, `background: transparent`) and stack a `<pre>`-like absolutely-positioned layer beneath it that renders each target character as a `<span>` colored by status (correct / incorrect / pending) plus a custom caret element positioned at the current index. The native textarea keeps owning real keyboard/IME/selection behavior — nothing about Phase 1's capture pipeline (`beforeinput`/`input`/`keydown`/`keyup`) changes. — **Reversibility:** costly — this is the seam Phase 3's UI (results panel) and any later visual work build on.
- **D-02:** The rendered layer and the textarea must use identical font/line-height/letter-spacing (both already pull from `index.css`'s monospace tokens) so the invisible textarea's caret position and the rendered caret marker never drift apart.

**Trainer State Machine**
- **D-03:** New pure module `src/trainer/state.ts` (mirrors the Phase 1 `pure-core` pattern of `normalize.ts`): a reducer/fold that joins the target `Exercise.text` with the capture layer's `CommittedChar[]` (not `KeystrokeEvent[]` — committed characters are the authority on what was actually typed, matching D-04 from Phase 1) and produces `{ perCharStatus: Array<'correct'|'incorrect'|'pending'>, cursor: number, correctedCount: number, uncorrectedCount: number, completedAt: number | null }`. Zero DOM access, testable in isolation like the normalizer.
- **D-04:** Free-correction semantics (TYPE-02, already locked by REQUIREMENTS.md): the cursor always advances on any committed character (right or wrong) — never blocked waiting for a correction. A position is "corrected" if it was ever wrong and its current value now matches the target; "uncorrected" if the cursor has moved past it and the current value still doesn't match. Exercise "complete" = cursor reaches `text.length`, regardless of any remaining uncorrected positions.
- **D-05:** Backspace (TYPE-03) moves the cursor back one position via the `beforeinput` `inputType === 'deleteContentBackward'` (and related delete `inputType`s already surfaced in Phase 1's `CommittedChar.inputType`) — re-opens that position as `pending` until retyped. No new capture-layer work; the state module just interprets `CommittedChar` entries it already receives.

**Whitespace & Tab Handling**
- **D-06:** Whitespace glyphs (TYPE-04): space → `·` (middle dot), tab → `→`, newline → `↵` followed by an actual line break in the rendered layer — the common code-typing-tool convention. Glyphs are muted-color, not part of the correct/incorrect palette (they overlay the correct/incorrect coloring, not replace it).
- **D-07:** Tab key: browser default Tab moves focus out of the textarea, which would break typing through any exercise containing a literal tab. Add a **narrowly-scoped keydown exception** — `if (e.key === 'Tab') e.preventDefault()` — that inserts a tab character via `document.execCommand` fallback or by dispatching the equivalent `beforeinput`/`input` sequence the browser would have produced, so it still flows through the existing `beforeinput` capture path (D-04 from Phase 1) rather than bypassing it. This mirrors the existing paste/drop exception in `capture.ts` (CAPT-04) — a second narrow, documented carve-out, not a reopening of the "no blanket preventDefault" rule. — **Reversibility:** reversible — isolated to one keydown branch.

**Restart**
- **D-08:** Restart (TYPE-05) calls the existing `resetCapture()` (Phase 1, clears the keystroke/char/marker buffers), resets `trainer/state.ts`'s reducer to its initial state for the same `Exercise`, and re-mounts `CaptureSurface` via the existing `loadToken`-based remount (Phase 1, `App.tsx`) so no stale DOM/IME state survives — the same mechanism Phase 1 already uses when loading a *different* exercise, reused here for reloading the *same* one.

**Session Timing**
- **D-09:** TYPE-06's "starts on first keystroke, excludes blurred/hidden time" is a pure computation, not new capture-layer plumbing: add `computeActiveElapsedMs(charLog: CommittedChar[], markers: CaptureMarker[], now: number): number` (co-located with `trainer/state.ts` or `session.ts`) that finds the first `CommittedChar.tMs` as t0, then subtracts any `[blur, focus)` / `[hidden, visible)` interval pairs from the markers list (already recorded by Phase 1's `capture.ts`) from `now - t0`. Phase 2 does not need to *display* a running timer (that's Phase 3/metrics territory) — it only needs the value to exist and be correct, verified by unit tests with synthetic marker sequences. Paste-blocking (the other half of TYPE-06) is already fully implemented in Phase 1's `CaptureSurface`/`capture.ts` — no new work.

### Claude's Discretion
- Exact component/file split within `src/trainer/` and `src/ui/` (e.g. whether the rendered character layer is its own component or lives inside `CaptureSurface.tsx`).
- Caret blink animation details (respecting `prefers-reduced-motion`, per the existing `01-UI-SPEC.md` motion rule).
- Exact CSS technique for overlaying the transparent textarea and the rendered layer (absolute positioning vs CSS grid stacking) — planner's call, constrained only by D-02.

### Deferred Ideas (OUT OF SCOPE)
- **WPM / accuracy / five-slowest-keys computation and display** — Phase 3. This phase produces the data (`perCharStatus`, `correctedCount`, `uncorrectedCount`, `computeActiveElapsedMs`) Phase 3 will consume; it does not compute or show any metric itself.
- **Results panel / end-of-session UI** — Phase 3 (`UI hint: yes` there too).
- **Session persistence** — v2 (Phase 4, Dexie/IndexedDB), unchanged from Phase 1's deferral.
- **Symbols drill mode, per-language profiles, adaptive drills** — v2, unchanged.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TYPE-01 | User sees the exercise text with a caret and per-character correctness feedback (correct/incorrect/pending) updating live while typing | Architecture Patterns §Overlay Technique + §Caret Discipline; Code Examples §Reducer, §Caret Sync |
| TYPE-02 | User types under a free-correction policy — advancing past an error is allowed, and both corrected and uncorrected errors are tracked | Code Examples §Reducer (`wasEverWrong` tracking); Common Pitfalls §Delete-type ambiguity |
| TYPE-03 | User can press backspace to correct earlier characters | Code Examples §Reducer (delete-branch); Common Pitfalls §Delete-type ambiguity (word-delete/cut edge cases) |
| TYPE-04 | Whitespace characters (spaces, tabs, newlines) are rendered with visible glyphs and must be typed explicitly | Common Pitfalls §Tab Never Reaches the Target (critical finding — normalize.ts strips all tabs before Phase 2 ever sees them); Architecture Patterns §Whitespace Glyphs |
| TYPE-05 | User can restart the current exercise, keeping the loaded content and resetting all session state | Architecture Patterns §Restart reuses `loadToken` (already verified in `App.tsx`) |
| TYPE-06 | Session timing starts on the first keystroke and excludes time while the window is blurred or hidden; pasting the exercise answer is blocked or flagged | Code Examples §computeActiveElapsedMs; Common Pitfalls §Marker Edge Cases |
</phase_requirements>

## Summary

Phase 2 adds zero new dependencies — everything is hand-rolled TypeScript/CSS on top of the existing Phase 1 capture pipeline, consistent with the project's own explicit guidance (`.claude/CLAUDE.md` STACK.md: "CodeMirror/Monaco as the typing surface" is a documented anti-pattern; use "a custom controlled render of the target text with a hidden input"). The transparent-textarea-over-colored-layer technique is a well-documented pattern (confirmed independently via CSS-Tricks, DEV.to, and MDN caret-color docs) — the load-bearing detail is that the invisible textarea and the rendered layer must share every text-metric CSS property (`font-family`, `font-size`, `line-height`, `letter-spacing`, `padding`, `border`, `white-space`, `tab-size`) or the two layers visibly drift apart.

The most consequential finding from reading the live Phase 1 code (not just its docs) is that `src/ingestion/normalize.ts` unconditionally expands every tab to spaces (`s.replace(/\t/g, tab)`, line 25) before an `Exercise` is ever constructed — meaning **`Exercise.text` can never contain a literal tab character**. The tab→`→` glyph decision (D-06) and ROADMAP's success-criterion wording ("tabs... render as visible glyphs") describe a code path that is structurally unreachable on the *target* side. The only place a tab can appear in Phase 2 is in the *user's typed input*, if they press the physical Tab key (D-07) — and since the target position at that point is a space character, a literal `\t` inserted there will always score `'incorrect'` by construction. This is not a bug to fix (D-07 is locked) but it is a fact the planner must build the plan around explicitly, not discover during implementation.

The second major finding is that `document.execCommand`, `setRangeText`, and manual `textarea.value` splicing all have different event-firing semantics, and Phase 1's `capture.ts` rejects any event where `!e.isTrusted` (T-01-04) — including any `dispatchEvent(new InputEvent(...))` a developer might synthesize by hand, since script-dispatched events are `isTrusted: false` by spec. `setRangeText()` fires **no** input event at all (confirmed: programmatic value mutation never fires `input`); whether `execCommand('insertText', …)` produces a *trusted* `input` event on a plain (non-contenteditable) `<textarea>` in every target browser could not be confirmed from documentation alone (Firefox has a long history of `execCommand` quirks on form controls — Bugzilla #1220696) and needs either a manual browser check or a design that avoids the question entirely. The safer, needs-no-browser-trust-assumption design is to bypass the DOM-event path completely for the Tab exception: call `setRangeText()` to update the visible value, then call a new, directly-invoked (non-event) `capture.ts` export that pushes a `CommittedChar` record exactly the way `onBeforeInput` already does. This sidesteps the `isTrusted` question by never relying on a browser-authenticated event at all.

**Primary recommendation:** Build `trainer/state.ts` as a pure fold over `(target: string, charLog: readonly CommittedChar[])` exactly like `normalize.ts` was built for Phase 1 — golden-tested, zero DOM access — and derive the rendered caret position solely from that reducer's `cursor` output (never from `textarea.selectionStart`), re-synchronizing `textarea.selectionStart`/`selectionEnd` back to `cursor` in a `useLayoutEffect` after every commit so arrow-key/mouse-click drift cannot desync the invisible native caret from the visible rendered one.

## Architectural Responsibility Map

This project has no server/CDN/DB tiers (browser SPA only); the meaningful tier split, established by Phase 1 and continued here, is capture (DOM-coupled hot path) vs. pure-core (DOM-free computation) vs. UI (DOM-coupled rendering/paint).

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-character correctness status (TYPE-01) | Pure-Core (`trainer/state.ts`) | UI (renders the spans) | Status is a fold over already-captured data; the UI only paints the result — no new DOM reads needed to compute it. |
| Free-correction bookkeeping (TYPE-02) | Pure-Core (`trainer/state.ts`) | — | Purely a function of `CommittedChar[]` order; no DOM involvement at all. |
| Backspace / correction (TYPE-03) | Capture Hot-Path (already emits `deleteContentBackward` records) | Pure-Core (interprets them) | Phase 1's `capture.ts` already reconciles `beforeinput`/`input`; Phase 2 only *reads* `CommittedChar.inputType`. |
| Whitespace glyph rendering (TYPE-04) | UI (`CaptureSurface`/rendered layer) | — | Pure presentation — glyph substitution happens at render time over `perCharStatus`, no state impact. |
| Tab key literal insertion (TYPE-04 support) | UI (keydown exception in `CaptureSurface`) | Capture Hot-Path (new direct-record export) | The exception is a UI-level `preventDefault`; recording the char requires a new, explicitly-invoked (non-event) capture.ts function — see Common Pitfalls. |
| Restart (TYPE-05) | UI (`App.tsx` `loadToken` remount) | Capture Hot-Path (`resetCapture()`) + Pure-Core (fresh reducer state) | Reuses the exact mechanism Phase 1 built for loading a *different* exercise. |
| Active-elapsed session timing (TYPE-06) | Pure-Core (`computeActiveElapsedMs`) | Capture Hot-Path (source data: markers/charLog, already recorded) | No new capture-layer plumbing (D-09) — pure post-hoc computation over existing logs. |
| Paste-blocking (TYPE-06, already done) | Capture Hot-Path (Phase 1, unchanged) | — | Out of Phase 2 scope entirely. |

## Standard Stack

No new libraries. Phase 2 is 100% hand-rolled TypeScript + CSS on the existing stack.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.8 (pinned, `package.json`) [VERIFIED: package.json] | Rendering the per-character span layer, keydown exceptions | Already the project's UI runtime; no reason to introduce anything else for span rendering. |
| TypeScript | 5.9.3 (pinned, `package.json`) [VERIFIED: package.json] | `trainer/state.ts` types and reducer | Matches Phase 1's pure-core module style exactly. |
| Vitest | 4.1.11 (pinned, `package.json`) [VERIFIED: package.json] | Golden-file tests for the reducer and `computeActiveElapsedMs` | Same test runner as `normalize.test.ts`. |

### Supporting
None. No charting, no state-management library needed — `trainer/state.ts` is a plain fold, not a store; React's existing `useState`/`useRef` (already used in `App.tsx`/`CaptureSurface.tsx`) is sufficient.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled transparent-textarea overlay | CodeMirror / Monaco / `react-simple-code-editor` | Explicitly an anti-pattern per project CLAUDE.md STACK.md — a real editor's own key handling, IME, and DOM churn "fight your measurement and add jitter." Rejected by the project before this research started; not re-litigated here. |
| `setRangeText()` + explicit capture.ts export for Tab | `document.execCommand('insertText', false, '\t')` | `execCommand` preserves native undo and *may* fire a trusted `input` event on Chromium/WebKit (unverified this session), but has a documented history of Firefox form-control bugs and is spec-deprecated with no committee-endorsed successor. The `setRangeText` + direct-call approach needs no browser-trust assumption at all — recommended as primary; `execCommand` documented as a fallback the planner can spike if the direct-call approach proves awkward. |

**Installation:** N/A — no packages to install.

## Package Legitimacy Audit

**No external packages are introduced by this phase.** `trainer/state.ts` and the rendered overlay layer are hand-rolled TypeScript/CSS/JSX using only what's already installed (React, TypeScript). The Package Legitimacy Gate is not applicable — nothing to check against `npm view` or the legitimacy seam.

## Architecture Patterns

### System Architecture Diagram

```
User keystroke (physical key press)
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  Native <textarea> (D-01/D-02) — invisible text + caret        │
│  - keydown/keyup  ──────────────► capture.ts (UNCHANGED,       │
│  - beforeinput/input               Phase 1 hot path)           │
│  - IME composition                    │                        │
│  - Tab keydown (NEW: CaptureSurface  │  produces               │
│    exception, D-07) ─────┐            ▼                        │
└───────────────────────────┼──► getCharLog() → CommittedChar[]  │
                             │        + getMarkers() → CaptureMarker[]
     setRangeText('\t')      │                │
     + direct record call ──┘                │
     (bypasses the DOM event                  │
      pipeline entirely — see                 │
      Common Pitfalls)                        │
                                               ▼
                          ┌────────────────────────────────────┐
                          │  trainer/state.ts (NEW, pure, D-03) │
                          │  computeTrainerState(target, log)   │
                          │  → { perCharStatus, cursor,         │
                          │      correctedCount,                │
                          │      uncorrectedCount, completedAt }│
                          │                                     │
                          │  computeActiveElapsedMs(log,        │
                          │      markers, now) → number (D-09)  │
                          └───────────────┬─────────────────────┘
                                          │  React re-render
                                          ▼
                          ┌────────────────────────────────────┐
                          │  Rendered layer (NEW UI, D-01/D-06) │
                          │  target chars → colored <span>s     │
                          │  + whitespace glyphs (· → ↵)        │
                          │  + custom caret at `cursor` index   │
                          │  stacked BENEATH the invisible      │
                          │  textarea, identical font metrics   │
                          └────────────────────────────────────┘
                                          │
                          useLayoutEffect: force
                          textarea.selectionStart/End = cursor
                          (prevents arrow-key/click caret drift
                           — see Common Pitfalls)
```

### Recommended Project Structure
```
src/
├── trainer/
│   ├── state.ts           # NEW — pure computeTrainerState() (D-03)
│   ├── state.test.ts       # NEW — golden-file suite, mirrors normalize.test.ts
│   ├── active-time.ts      # NEW — computeActiveElapsedMs() (D-09), or co-locate in state.ts (Claude's discretion)
│   └── active-time.test.ts # NEW — synthetic marker sequences
├── capture/
│   ├── capture.ts          # MODIFIED — add a direct (non-event) char-record export for the Tab exception
│   └── capture.test.ts     # MODIFIED — cover the new export
└── ui/
    ├── CaptureSurface.tsx  # MODIFIED — rendered layer, Tab keydown exception, caret sync effect
    └── App.tsx             # MODIFIED (small) — restart wiring, pass trainer state down
```

### Pattern 1: Transparent-Textarea-Over-Colored-Layer
**What:** Two elements stacked in the same box (CSS Grid `grid-template-areas`/`grid-area: 1/1` on both children, or `position: absolute` with identical `top/left/width/height`): the real `<textarea>` on top (receives all input/focus/IME), a `<pre>`-like rendered layer beneath it (paints colored spans).
**When to use:** This phase's entire rendering surface (TYPE-01, TYPE-04).
**Example:**
```css
/* Source: pattern cross-checked across CSS-Tricks "Creating an Editable
   Textarea That Supports Syntax-Highlighted Code" and a DEV.to writeup of the
   same technique — [CITED: css-tricks.com/creating-an-editable-textarea-that-supports-syntax-highlighted-code]
   [CITED: dev.to/helgesverre/syntax-highlighting-a-plain-textarea-with-a-transparent-overlay-1fck] */
.trainer-stack {
  position: relative;
  display: grid; /* both children share grid-area: 1/1 to perfectly superimpose */
}
.trainer-stack > * {
  grid-area: 1 / 1;
  /* every property below MUST match between the two children (D-02) */
  font-family: var(--font-mono);
  font-size: var(--text-body-size);
  line-height: var(--text-body-line);
  letter-spacing: normal;
  padding: var(--space-md);
  border: 1px solid transparent; /* reserve the same box even if only one layer visibly borders */
  white-space: pre-wrap;         /* long lines wrap identically in both layers */
  word-break: normal;
  overflow-wrap: anywhere;       /* long unbroken tokens (minified code) don't blow out the box */
  tab-size: 4;                   /* defensive; Exercise.text never contains a raw tab — see Pitfalls */
  margin: 0;
  box-sizing: border-box;
}
.trainer-rendered-layer {
  pointer-events: none; /* clicks pass through to the textarea above (D-01) */
  color: var(--color-text); /* overridden per-span by correctness status */
}
.trainer-textarea {
  color: transparent;
  -webkit-text-fill-color: transparent; /* WebKit/Blink need this in addition to color:transparent */
  background: transparent;
  caret-color: transparent; /* the native caret is invisible — the rendered layer draws its own (D-01) */
  resize: none;
  overflow: hidden; /* the rendered layer owns visible scroll framing; keep both layers' scrollTop in sync (see Pitfalls) */
}
```
[CITED: css-tricks.com] [CITED: dev.to/helgesverre] — cross-checked across two independent write-ups of the same technique, both agreeing on the property list; MEDIUM confidence per the source-hierarchy seam (`classify-confidence --provider websearch --verified` → MEDIUM).

### Pattern 2: Caret Discipline via `selectionStart` Re-Sync
**What:** After every reducer recompute, force `textarea.selectionStart = textarea.selectionEnd = cursor` in a `useLayoutEffect`.
**When to use:** Always, for this phase — it is what makes D-02's "never drift apart" claim actually true rather than merely usually-true.
**Why it's needed (not just nice-to-have):** The rendered custom caret in Pattern 1 is positioned from `trainer/state.ts`'s `cursor` (a pure count of committed characters), not from `textarea.selectionStart`. Nothing about a native `<textarea>` prevents a user from pressing an arrow key or clicking to move `selectionStart` to a different index — Phase 1's `capture.ts` does not block arrow keys, and neither should it (blocking them isn't in the CONTEXT.md decision list). If left unhandled, the *real* (invisible) native caret can end up at an index the *rendered* caret does not agree with, and the next character the user types will `beforeinput`-insert at the *real* selection position, not the logical `cursor` position `trainer/state.ts` expects — silently breaking D-04's assumption that every insert lands at `cursor` and advances it by exactly the inserted length.
**Example:**
```typescript
// Source: reasoned from MDN HTMLTextAreaElement.selectionStart/selectionEnd
// semantics [CITED: developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/selectionStart]
// combined with the project's own useLayoutEffect-before-focus pattern already
// established in CaptureSurface.tsx (useCapture attaches listeners in
// useLayoutEffect before the plain useEffect that calls .focus()).
useLayoutEffect(() => {
  const el = textareaRef.current
  if (!el) return
  if (el.selectionStart !== cursor || el.selectionEnd !== cursor) {
    el.selectionStart = cursor
    el.selectionEnd = cursor
  }
}, [cursor])
```
[ASSUMED] — this specific re-sync pattern was not found verbatim in any fetched source; it is derived by combining (a) the verified fact that `setRangeText`/programmatic value changes don't auto-sync any external state [MEDIUM, cross-checked], and (b) standard React `useLayoutEffect`-for-DOM-sync practice already used in this codebase (`use-capture.ts`, confirmed by reading `CaptureSurface.tsx` this session). Flag for the planner to confirm via a manual arrow-key test during execution.

### Pattern 3: Pure Reducer Over Two Parallel Logs (mirrors `normalize.ts`)
**What:** `trainer/state.ts` folds `Exercise.text` (the immutable target) and `CommittedChar[]` (seq-ordered, from `capture.ts`) into `{ perCharStatus, cursor, correctedCount, uncorrectedCount, completedAt }` with zero DOM access, matching the Phase 1 pure-core convention (`normalize.ts` has zero imports; `trainer/state.ts` should have at most a type-only import from `capture/types.ts`).
**When to use:** The entire TYPE-01/02/03 computation.
**Example:**
```typescript
// Source: designed from the verbatim CommittedChar/inputType shape read this
// session in src/capture/types.ts:22-27 and the charRecordFor() mapping read
// in src/capture/capture.ts:82-89 (both [VERIFIED: src/capture/capture.ts:82-89]
// / [VERIFIED: src/capture/types.ts:22-27] — quoted verbatim below).
//
// types.ts:22-27 —
//   export interface CommittedChar {
//     seq: number
//     inputType: string
//     data: string | null
//     tMs: number
//   }
//
// capture.ts:82-89 —
//   function charRecordFor(e: InputEvent): { inputType: string; data: string | null } {
//     const inputType = e.inputType
//     if (inputType === 'insertLineBreak') return { inputType, data: '\n' }
//     if (inputType.startsWith('delete')) return { inputType, data: null }
//     return { inputType, data: e.data }
//   }
import type { CommittedChar } from '../capture/types'

export type PerCharStatus = 'correct' | 'incorrect' | 'pending'

export interface TrainerState {
  perCharStatus: PerCharStatus[]
  cursor: number
  correctedCount: number
  uncorrectedCount: number
  completedAt: number | null
}

export function computeTrainerState(
  target: string,
  charLog: readonly CommittedChar[],
): TrainerState {
  const perCharStatus: PerCharStatus[] = new Array(target.length).fill('pending')
  const wasEverWrong = new Array<boolean>(target.length).fill(false)
  let cursor = 0
  let completedAt: number | null = null

  for (const rec of charLog) {
    if (rec.inputType.startsWith('delete')) {
      // KNOWN v1 LIMITATION (see Common Pitfalls "Delete-type ambiguity"):
      // every delete* inputType decrements by exactly ONE position because
      // CommittedChar carries no length for the deletion (data is always
      // null for delete* per charRecordFor above). deleteWordBackward /
      // deleteByCut / deleteContentForward will under-correct relative to
      // the real textarea value if they ever fire.
      if (cursor > 0) {
        cursor -= 1
        perCharStatus[cursor] = 'pending' // D-05: reopen, don't clear wasEverWrong
      }
      continue
    }

    const data = rec.data ?? ''
    for (const ch of data) { // for...of iterates by code point, not UTF-16 unit —
                              // correct for IME-composed multi-char commits
      if (cursor >= target.length) break // typed past the end: nowhere to score it
      if (ch === target[cursor]) {
        perCharStatus[cursor] = 'correct'
      } else {
        perCharStatus[cursor] = 'incorrect'
        wasEverWrong[cursor] = true
      }
      cursor += 1
    }

    if (cursor >= target.length && completedAt === null) {
      completedAt = rec.tMs
    }
  }

  let correctedCount = 0
  let uncorrectedCount = 0
  for (let i = 0; i < target.length; i++) {
    if (perCharStatus[i] === 'correct' && wasEverWrong[i]) correctedCount++
    if (perCharStatus[i] === 'incorrect') uncorrectedCount++
  }

  return { perCharStatus, cursor, correctedCount, uncorrectedCount, completedAt }
}
```
[VERIFIED: src/capture/types.ts:22-27] [VERIFIED: src/capture/capture.ts:82-89] for the input shapes; the reducer body itself is original design work for this research (not copied from any external source), built to satisfy D-03/D-04/D-05 as locked.

### Pattern 4: `computeActiveElapsedMs` — Toggle State Machine, Not Pair-Matching
**What:** Rather than trying to pair up `blur`↔`focus` and `hidden`↔`visible` markers by index (fragile if they interleave or arrive out of order), walk the marker list once, tracking a single `inactiveSince: number | null`. `blur`/`hidden` set it (only if not already set); `focus`/`visible` close it (only if set) and accumulate the interval. This is robust to overlapping pairs (blur and hidden often fire within the same tick when switching tabs) because a second "go inactive" marker while already inactive is a no-op.
**When to use:** D-09's `computeActiveElapsedMs(charLog, markers, now)`.
**Example:**
```typescript
// Source: derived from the verbatim CaptureMarker shape read this session in
// src/capture/types.ts:29-36 — [VERIFIED: src/capture/types.ts:29-36]
//   export type MarkerKind = 'blur' | 'focus' | 'hidden' | 'visible'
//   export interface CaptureMarker {
//     seq: number
//     kind: MarkerKind
//     tMs: number
//   }
import type { CommittedChar, CaptureMarker } from '../capture/types'

export function computeActiveElapsedMs(
  charLog: readonly CommittedChar[],
  markers: readonly CaptureMarker[],
  now: number,
): number {
  const first = charLog[0]
  if (first === undefined) return 0 // no keystroke yet — D-09: elapsed is 0

  const t0 = first.tMs
  let inactiveSince: number | null = null
  let totalInactiveMs = 0

  for (const m of markers) {
    if (m.tMs < t0) continue // marker before the session started: irrelevant
    const goesInactive = m.kind === 'blur' || m.kind === 'hidden'
    const goesActive = m.kind === 'focus' || m.kind === 'visible'
    if (goesInactive && inactiveSince === null) {
      inactiveSince = m.tMs
    } else if (goesActive && inactiveSince !== null) {
      totalInactiveMs += m.tMs - inactiveSince
      inactiveSince = null
    }
    // a second "inactive" marker while already inactive, or a stray "active"
    // marker while already active, is a no-op — this is what makes the
    // function robust to overlapping/duplicate blur+hidden pairs.
  }

  // Session ended (or "now" was sampled) while still blurred/hidden: the open
  // interval counts up to "now" too.
  if (inactiveSince !== null) {
    totalInactiveMs += Math.max(0, now - inactiveSince)
  }

  return Math.max(0, now - t0 - totalInactiveMs)
}
```
[VERIFIED: src/capture/types.ts:29-36] for the marker shape; the toggle-state-machine algorithm is original design work addressing the exact edge cases D-09 calls out (overlapping/out-of-order pairs, session ending while blurred, no keystroke yet).

### Anti-Patterns to Avoid
- **Deriving the rendered caret from `textarea.selectionStart`:** couples the visible caret to whatever the native selection happens to be, which can be moved by arrow keys/clicks independent of `trainer/state.ts`'s logical `cursor`. Use Pattern 2 instead — derive the caret from `cursor`, then force `selectionStart` back to match it.
- **Trying to compute `perCharStatus` from `KeystrokeEvent[]` instead of `CommittedChar[]`:** `KeystrokeEvent.key` is the raw physical key, not the committed character — it doesn't reflect IME composition, autocorrect, or dead-key composition. D-03 already locks `CommittedChar[]` as the source; don't second-guess it mid-implementation.
- **Reaching for a real code editor (CodeMirror/Monaco/`react-simple-code-editor`) "to save time" on the overlay:** explicitly rejected by this project's own CLAUDE.md STACK.md ("their own key handling, IME, and DOM churn fight your measurement and add jitter").
- **Using `dangerouslySetInnerHTML` or string-concatenated HTML to render the colored spans:** breaks the zero-raw-HTML-sink invariant Phase 1 established and verified (`grep` for `innerHTML` across `src/` returned nothing) — render every character as a React text child / mapped `<span>{char}</span>`, never as an HTML string.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rich-text/code editing surface | A custom contenteditable-based editor with its own undo stack | The transparent-`<textarea>`-overlay (Pattern 1) | The native `<textarea>` already gives correct IME, undo (native Ctrl+Z on the real value), selection, and accessibility behavior for free; building any of that yourself is exactly the trap CLAUDE.md's "What NOT to Use" table warns against. |
| Composed-character (IME) detection | A custom multi-keystroke composition buffer in `trainer/state.ts` | Phase 1's existing `composing` flag + `insertFromComposition` CommittedChar (already implemented, `capture.ts:132-141`) | Phase 1 already solved this; `trainer/state.ts` just needs to iterate `rec.data` by code point (`for...of`) to correctly consume a multi-character composed commit as multiple target positions. |
| Caret-position math from raw pixel offsets | Manually measuring character widths / using `Range.getBoundingClientRect()` to compute where to draw the caret | Position the caret via the *character index* (`cursor`) — render it as a real DOM element positioned by CSS `grid`/inline flow at that index in the span list, not by pixel math | Pixel-measuring is exactly the kind of thing "no layout engine in tests" (see Testing section) makes untestable and brittle; index-based caret placement (e.g., an empty `<span class="caret">` inserted at the right position in the render, or a `::before`/`::after` on the span at `cursor`) needs no measurement code at all. |

**Key insight:** Nearly everything in this domain is *supposed* to be hand-rolled per the project's own architecture decisions — the "don't hand-roll" list here is short specifically because the project already rejected the more heavyweight alternatives (a real code editor) before this research began. What should NOT be hand-rolled is the *plumbing already built in Phase 1* (composition detection, delete-type mapping, timestamp capture) — reuse it, don't reimplement it inside `trainer/state.ts`.

## Common Pitfalls

### Pitfall 1: Tab Never Reaches the Target Text (verified via source read)
**What goes wrong:** The planner or executor assumes exercises can contain literal tab characters that need the `→` glyph (as ROADMAP.md's Phase 2 success-criterion #4 literally states: "Whitespace characters (spaces, tabs, newlines) render as visible glyphs"), and either builds/tests target-side tab-glyph rendering as if it's reachable, or is confused when a "type this indented code" exercise never once needs the tab glyph.
**Why it happens:** `src/ingestion/normalize.ts:23-25` [VERIFIED: src/ingestion/normalize.ts:23-25] unconditionally does:
```
const tab = ' '.repeat(Math.max(1, opts.tabWidth))
s = s.replace(/\t/g, tab)
```
Every tab in the raw pasted/uploaded content is replaced with spaces (default width 4) **before** an `Exercise` object exists. There is no configuration path that preserves a literal `\t` in `Exercise.text`. This was correctly identified and locked in Phase 1 (D-09) and is **not** something Phase 2 should try to undo (reversibility of Phase 1's normalizer contract is "costly" — 23 golden tests lock it).
**How to avoid:** Build the tab→`→` glyph substitution generically (it's harmless dead code on the target side, and it IS reachable if `Exercise.text` is ever constructed some other way in the future), but do **not** write a plan verification step that asserts "load an exercise with an indented code sample, confirm the tab glyph renders in the target" — it structurally cannot happen. If the planner wants a human-visible test of the tab glyph and D-07's tab-insertion path, it must be demonstrated by the *user pressing the Tab key while typing*, not by loading tab-containing source.
**Warning signs:** A plan `must_haves` line that says something like "target text with a tab character renders `→`" — this should read "the corpus's indentation is pre-expanded to spaces by Phase 1's normalizer" as a precondition, or should test the typed-Tab path instead.

### Pitfall 2: Pressing Tab Will Always Score `'incorrect'` (locked-decision consequence, not a bug)
**What goes wrong:** A user presses Tab out of habit to indent, expecting it to "count" toward completing the indentation. Because `Exercise.text` never contains a `\t` (Pitfall 1), the character the reducer expects at that position is a space, not a tab. D-07 says the Tab exception should insert a literal `\t` character — so `computeTrainerState` will score that position `'incorrect'` by definition, every single time, for every user who reaches for Tab instead of Space at an indent.
**Why it happens:** This is the direct, foreseeable consequence of two independently-locked decisions (Phase 1's D-09 tab-to-space normalization + Phase 2's D-07 literal-tab-insertion) that were locked in different phases and never cross-checked against each other until this research pass.
**How to avoid:** This is **not** a decision for research to override — D-07 is locked. But the planner should make this an *explicit, intentional* behavior in the plan (e.g., a `must_haves` line stating "pressing Tab inserts a literal tab character and registers as incorrect against the space-normalized target, matching the 'v1 requires explicit whitespace' scope note in REQUIREMENTS.md's Out of Scope table") rather than let it be discovered as a surprise during human verification. Whether to add any UI affordance (a hint, muted-color treatment distinguishing "wrong because you pressed Tab" from "wrong keystroke") is Claude's discretion / an open question for discuss-phase, not something this research resolves.
**Warning signs:** A UAT reviewer types an indented code sample using Tab and reports "every indent shows as an error" as if it were a bug — it is working as specified by D-07 given Phase 1's normalizer contract.

### Pitfall 3: Synthetic `dispatchEvent` Cannot Feed the Tab Character Through `capture.ts`
**What goes wrong:** A natural-seeming implementation for D-07 is: after `preventDefault()`, manually update `textarea.value` (or call `setRangeText`) and then `el.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: '\t', bubbles: true }))` to "flow through the existing beforeinput capture path" as D-07's wording literally suggests. This event will be silently dropped.
**Why it happens:** `src/capture/capture.ts:93` [VERIFIED: src/capture/capture.ts:93] — `onBeforeInput` begins with `if (!e.isTrusted) return // T-01-04`, and `onInput` (`capture.ts:111`) has the identical guard. Per the UI Events spec, an event constructed and dispatched from script (`new InputEvent(...)` + `dispatchEvent()`) is `isTrusted: false` — there is no way to construct a trusted event from JavaScript. This guard was deliberately added in Phase 1 to reject extension/automation-injected keystrokes (T-01-04) and it makes no exception for "well-intentioned" synthetic events.
**How to avoid:** Don't dispatch a synthetic event at all. Add a new, directly-invoked (plain function call, not an event) export to `capture.ts` — e.g. `recordSyntheticChar(inputType: string, data: string | null, tMs: number)` — that does exactly what `onBeforeInput` already does (`charLog.push(Object.freeze({ seq: seq++, inputType, data, tMs }))`), and have the Tab keydown handler in `CaptureSurface.tsx` call it directly after `setRangeText()`. This is the "or by dispatching the equivalent... sequence" fallback D-07's own wording anticipates, interpreted as "produce the same *data*, not literally the same *event*."
**Warning signs:** Tests pass under happy-dom (which does not enforce `isTrusted` the same way — Phase 1's own test suite had to work around this, see `01-01-SUMMARY.md` "happy-dom leaves `event.isTrusted` undefined on scripted events") but the Tab character never appears in `getCharLog()` when manually verified in a real browser.

### Pitfall 4: `setRangeText()`/direct-record Tab Insertion Leaves `capture.ts`'s Internal `lastValue` Stale
**What goes wrong:** `capture.ts`'s Firefox-delete-fallback logic (`onInput`, comparing `value.length < lastValue.length`) tracks its own `lastValue` variable, updated only inside `onInput` (`capture.ts:129`). If the Tab exception updates `textarea.value` via `setRangeText()` without going through `onInput`, `lastValue` becomes stale (out of sync with the real `textarea.value`) the moment a tab is inserted. The next real backspace could then be misjudged by the Firefox-fallback length comparison.
**Why it happens:** `lastValue` is private, hot-path state inside `capture.ts` (verified by reading the full file this session — `capture.ts:19`, `capture.ts:129`) that has exactly one writer (`onInput`) and no public setter.
**How to avoid:** Whatever new function `capture.ts` exports for the Tab exception (Pitfall 3) must also update `lastValue` to the new `textarea.value` at the same time it pushes the `CommittedChar` record, so the Firefox-delete-fallback comparison stays correct for the next real keystroke.
**Warning signs:** A test that inserts a Tab then simulates a Firefox-style delete-without-beforeinput (an `input` event with no matching `beforeinput`) intermittently fails to record the deletion, or double-records it.

### Pitfall 5: `deleteWordBackward` / `deleteByCut` / `deleteContentForward` Carry No Length Information
**What goes wrong:** D-05 says the reducer should handle "related delete `inputType`s already surfaced in Phase 1's `CommittedChar.inputType`" generically. But `charRecordFor()` (`capture.ts:83-89`, verified) maps **every** `delete*` inputType to `{ inputType, data: null }` — there is no character count. A single Ctrl+Backspace (deletes a whole word) or Ctrl+X after selecting a range (deleteByCut) produces exactly one `CommittedChar` record indistinguishable, in the reducer's eyes, from a single-character `deleteContentBackward`.
**Why it happens:** Phase 1 designed `CommittedChar` around the single-character `insertText`/`deleteContentBackward` case (TYPE-03's literal wording is "press backspace"); multi-character deletes were not in that phase's scope and the shape was never extended for them.
**How to avoid:** Treat every `delete*` inputType as "decrement cursor by exactly one" in `trainer/state.ts` (as coded in Pattern 3 above) — this is correct for the required case (`deleteContentBackward` / plain Backspace) and is a **known, documented limitation** for the unrequired cases (word-delete, cut, forward-delete). Do not attempt to guess a deletion count from a diff against `textarea.value` inside `trainer/state.ts` — that would require DOM access, violating D-03's "zero DOM access" pure-module contract. If the planner wants correct handling of word-delete/cut, that requires extending Phase 1's `CommittedChar` shape with an explicit length/count field (out of this phase's stated scope; flag as a possible small addition to `capture.ts` rather than something `trainer/state.ts` can solve alone).
**Warning signs:** A manual test where a user selects several characters and cuts them (Ctrl+X) shows the rendered cursor only one position behind the real textarea value.

### Pitfall 6: Overlay Layers Silently Drift When One CSS Property Is Missed
**What goes wrong:** The rendered layer and the invisible textarea start pixel-aligned, then drift out of sync the first time the exercise contains a long line, a tab-expanded indent, or wraps — because one of `white-space`, `word-break`, `overflow-wrap`, `tab-size`, `letter-spacing`, or `padding`/`border` box-sizing differs by even one pixel-equivalent unit between the two layers.
**Why it happens:** Cross-checked across two independent sources (CSS-Tricks, DEV.to — both [CITED], MEDIUM confidence): both explicitly warn "if these properties diverge, the text drifts out of alignment," and this is exactly the kind of bug that is invisible in code review and invisible in an automated test (see Testing section — happy-dom has no layout engine) but immediately obvious to a human eye.
**How to avoid:** Define the shared property set as a single CSS class or custom-property group applied to *both* layers (Pattern 1's `.trainer-stack > *` selector approach) rather than writing the properties out twice on two separate selectors — this makes it structurally impossible for the two layers to diverge as the codebase evolves.
**Warning signs:** Visual misalignment that only appears with certain exercise content (long lines, specific indentation depths) rather than every exercise — a strong signal that a wrapping-related property (not a static one like `font-family`) is the one that diverged.

### Pitfall 7: Whitespace Glyphs Must Not Change the Character Count in the Rendered Layer
**What goes wrong:** Substituting `' '` → `'·'`, or `'\n'` → `'↵' + <br>`, inside the rendered layer, if implemented by literally replacing characters in a string that's later measured or diffed, can shift column alignment or break the 1-span-per-target-character invariant the caret-index-based positioning (Pattern 1's Anti-Pattern note) depends on.
**Why it happens:** It's tempting to do the substitution as a string transform (`target.replace(/ /g, '·')`) before splitting into spans, which is fine *as long as* the glyph substitution is exactly 1-codepoint-in, 1-codepoint-out (true for space→`·` and tab→`→`, since both source characters are single code points and Exercise.text never actually contains a raw tab — Pitfall 1) — but newline→`↵`+linebreak is 1-codepoint-in, 2-visual-units-out (the glyph character plus an actual line break), which must be rendered as two DOM nodes (a `<span>↵</span>` immediately followed by a line break), not baked into the same span as the correctness-colored character, or the correctness color will incorrectly apply to the glyph+break as one unit.
**How to avoid:** Render one `<span>` per **target character** (indexed by `cursor` position, matching `perCharStatus[i]`), and let the glyph substitution be a pure display-mapping function `glyphFor(char: string): string` applied only inside that span's text content — for the newline case specifically, emit the glyph span followed by a separate, unstyled `<br>` (or `white-space: pre-wrap`'s natural line break, since the real `\n` in the string content already produces a soft line break under `pre-wrap` — no explicit `<br>` needed if `white-space: pre-wrap` is used and the `\n` character itself is kept in the text content, with the `↵` visually inserted via a `::before`/`::after` pseudo-element or an adjacent zero-width sibling span, not by replacing the actual `\n` in the DOM text).
**Warning signs:** Copy-pasting the rendered layer's text produces `·` and `→` characters mixed into what should be a plain-text representation, or clicking to select text in the rendered layer (should be `pointer-events: none` per Pattern 1, so this shouldn't be reachable at all) yields glyph characters instead of the real content.

## Code Examples

See Architecture Patterns §1-4 above for the primary code examples (overlay CSS, caret-sync effect, the reducer, `computeActiveElapsedMs`) — all four are placed there because each is inseparable from the pattern/pitfall discussion that justifies its design. No additional standalone examples beyond those.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `document.execCommand` as the primary programmatic text-insertion API | Input Events Level 2 (`beforeinput`) + `setRangeText()` for value-only mutation | `execCommand` formally marked obsolete in the HTML spec years ago; still shipped by all major engines with no committee-endorsed full replacement | For this project: `setRangeText()` is the standards-track, well-specified way to splice `textarea.value`, but (confirmed this session) it does not fire `input`/`beforeinput` — a real gap the Tab exception must work around explicitly (Pitfall 3), not paper over with `execCommand`. |
| Building a from-scratch caret-position-via-pixel-measurement system | Index-based caret placement using a real DOM element positioned by document flow (not `getBoundingClientRect` measurement) | Standard practice for years in the overlay-textarea pattern | Avoids needing any layout-measurement code at all (also sidesteps the "no layout engine in tests" limitation entirely — see Testing). |

**Deprecated/outdated:**
- `document.execCommand`: spec-obsolete, kept only for a shrinking set of use cases with "no viable alternative" (per the still-open `mdn/content` issue #40245 found this session) — not recommended as this phase's primary mechanism, though documented as a fallback the planner may spike if the direct-record approach (Pattern in Pitfall 3) proves harder to wire up than expected.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `document.execCommand('insertText', …)` on a plain (non-contenteditable) `<textarea>` fires a *trusted* (`isTrusted: true`) `input`/`beforeinput` event pair in current Chromium/WebKit, and may or may not in current Firefox | Standard Stack §Alternatives Considered; State of the Art | If wrong in the direction of "never trusted," `execCommand` cannot be used as a Tab-insertion technique at all regardless of browser — this only affects the *fallback* path (the recommended primary path, direct-record via `setRangeText` + explicit `capture.ts` export, does not depend on this claim being true either way). Low risk since the primary recommendation sidesteps it. |
| A2 | The `useLayoutEffect`-based `selectionStart` re-sync (Pattern 2) is sufficient to prevent visible caret desync from arrow-key/mouse-click navigation, with no perceptible flash of a momentarily-wrong native caret position | Architecture Patterns §Pattern 2 | If wrong, a user who arrow-navigates mid-exercise could see a brief visual glitch, or (worse) manage to insert a character at an unexpected position before the effect runs — this is a genuinely untested-this-session claim; recommend a manual arrow-key check during execution/UAT. |
| A3 | CSS Grid stacking (`grid-area: 1 / 1` on both children) is at least as robust as `position: absolute` for this overlay, across Chrome/Firefox/Safari | Architecture Patterns §Pattern 1 | Low risk — both techniques are well-established; if Grid stacking has an unexpected quirk, falling back to `position: absolute` with explicit `top/left/width/height` is a same-day fix, not a redesign. |
| A4 | Monkeytype's actual implementation matches the generic "transparent overlay" description found via web search (its source was not read directly this session) | Summary; Standard Stack §Alternatives Considered | Low risk — Monkeytype is cited only as evidence the *category* of technique is standard/proven, not as a source of specific implementation details; no code example in this document claims to be "from Monkeytype." |
| A5 | Rendering one `<span>` per target character (rather than batching runs of same-status characters into fewer spans) will not become a performance problem for typical exercise sizes (Phase 1's upload cap is 100 KB, per `CorpusTooLargeError`) | Common Pitfalls §7; Anti-Patterns | Low-medium risk — 100 KB of single-character `<span>` elements (up to ~100,000 DOM nodes in a pathological case) could cause noticeable render/re-render cost on low-end hardware; if this becomes a measured problem during execution, span-batching by contiguous same-status runs is a standard, safe optimization that doesn't change the reducer's output shape. |

## Open Questions

1. **Should Tab-key insertion use `execCommand` or the direct-record approach?**
   - What we know: `setRangeText()` fires no events at all (confirmed); a synthetic `dispatchEvent` cannot pass `capture.ts`'s `isTrusted` guard (confirmed by reading `capture.ts:93`/`111` this session); `execCommand`'s trust/event-firing behavior on a plain `<textarea>` across all three target browsers is unverified this session.
   - What's unclear: Whether `execCommand` is even worth spiking, given the direct-record approach (Pitfall 3) has no browser-trust dependency and is a small, self-contained addition to `capture.ts`'s existing export surface.
   - Recommendation: Default to the direct-record approach (Pattern in Pitfall 3) as primary; only spike `execCommand` if the direct-record approach proves awkward to wire into the existing `charLog`/`lastValue` state during actual implementation.

2. **Should arrow-key navigation and click-to-reposition be blocked entirely, or allowed and corrected via the `selectionStart` re-sync (Pattern 2)?**
   - What we know: CONTEXT.md's D-01..D-09 never mention arrow keys or mouse clicks at all — this is genuinely new information surfaced by this research, not a gap in a locked decision.
   - What's unclear: Whether the "re-sync after the fact" approach (Pattern 2) is visually acceptable (a user might see a one-frame caret jump) versus adding a third narrow keydown exception (mirroring Tab and paste/drop) that outright blocks arrow-key navigation within the exercise, matching how most reference typing tests (Monkeytype-category tools) behave.
   - Recommendation: Start with Pattern 2 (re-sync, don't block) since it requires no new `preventDefault` carve-out and is reversible; add a blocking exception later only if manual verification shows the drift is visually objectionable. Flag for discuss-phase/planner confirmation since it's a genuinely new UX decision, not implied by any locked D-0x.

3. **Does the corrected/uncorrected accounting need to survive a Restart, or does Restart always zero it?**
   - What we know: D-08 says Restart resets "all session state" including the reducer.
   - What's unclear: Nothing, actually — this is unambiguous. Listed here only to confirm it was checked, not left as a genuine gap.
   - Recommendation: No action needed; D-08 is sufficient as written.

## Environment Availability

No external tools, services, or runtimes are introduced by this phase beyond what Phase 1 already established (Node/pnpm/Vite dev server, already verified working in Phase 1's summaries). Skipped — no new dependency surface.

## Validation Architecture

Skipped — `.planning/config.json` sets `workflow.nyquist_validation: false` [VERIFIED: .planning/config.json].

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` [VERIFIED: .planning/config.json] — included per policy.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No accounts/auth anywhere in this project (explicitly Out of Scope in REQUIREMENTS.md). |
| V3 Session Management | No | "Session" here means an in-memory typing-exercise session object, not an authenticated web session; no cookies/tokens involved. |
| V4 Access Control | No | Single-user local tool, no access boundaries. |
| V5 Input Validation | Yes | React's automatic text-child escaping — every corpus character and glyph must render via `{char}` (a React text child) or a typed prop, never via `dangerouslySetInnerHTML` or manual `innerHTML` assignment. This is a direct continuation of the invariant Phase 1 established and verified (`01-03-SUMMARY.md`: "no `fetch`/`XMLHttpRequest`/`sendBeacon`/`WebSocket`/`innerHTML` anywhere in `src/`"). |
| V6 Cryptography | No | No cryptographic operations in this phase. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| XSS via untrusted corpus content rendered into per-character spans | Tampering / Elevation of Privilege | Render every character (including whitespace glyphs) as a React text child (`<span>{char}</span>` / `{glyphFor(char)}`), never as an HTML string; no new `dangerouslySetInnerHTML` sink. Verify by grep (same check Phase 1 used) at the end of the phase. |
| Untrusted/extension-injected synthetic keystrokes reaching the char log | Spoofing | Already mitigated by Phase 1's `isTrusted` guard in `capture.ts` (T-01-04); Phase 2's new direct-record export (Pitfall 3) is a **deliberate, narrow, explicitly-invoked** bypass of that guard for exactly one first-party code path (the Tab exception) — it must remain a plain function call reachable only from `CaptureSurface.tsx`'s own keydown handler, never wired to any DOM event listener, so it cannot become a general-purpose bypass an attacker (e.g. a malicious browser extension) could trigger by dispatching a fake event. |
| Network egress leaking corpus/keystroke content | Information Disclosure | Continue the Phase 1 invariant: no `fetch`/`XMLHttpRequest`/`sendBeacon`/`WebSocket` anywhere in `src/`. Phase 2 introduces none. |

## Sources

### Primary (HIGH confidence)
- `src/ingestion/normalize.ts` (read this session, lines 23-25 quoted verbatim) — tab-to-space expansion is unconditional.
- `src/capture/types.ts` (read this session, lines 22-51 quoted verbatim) — `CommittedChar`/`CaptureMarker`/`Session` shapes.
- `src/capture/capture.ts` (read this session, lines 82-130 and 93/111 quoted/cited) — `charRecordFor`, `isTrusted` guards, `lastValue` tracking.
- `src/ui/CaptureSurface.tsx`, `src/ui/App.tsx` (read this session) — existing `useLayoutEffect`-before-focus pattern, `loadToken` remount mechanism.
- `.planning/config.json` (read this session) — `nyquist_validation: false`, `security_enforcement: true`, `security_asvs_level: 1`.

### Secondary (MEDIUM confidence — WebSearch cross-checked against ≥2 independent sources or against MDN)
- https://css-tricks.com/creating-an-editable-textarea-that-supports-syntax-highlighted-code/ — overlay CSS property list.
- https://dev.to/helgesverre/syntax-highlighting-a-plain-textarea-with-a-transparent-overlay-1fck — independent confirmation of the same property list + scroll-sync + trailing-newline caveat.
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement/setRangeText — `setRangeText` selectMode semantics, confirmed no `input`/`beforeinput` mention in the spec's own event list.
- jsdom project documentation + capricorn86/happy-dom GitHub issues #1416/#1161 (cross-checked, two independent DOM-simulation projects both confirming no layout engine) — `getBoundingClientRect`/`offsetWidth`/`offsetTop` always zero under Vitest+happy-dom.

### Tertiary (LOW confidence — single WebSearch result, not independently cross-checked, marked for validation)
- github.com/fregante/text-field-edit README (via WebFetch) — claim that `execCommand('insertText')` fires a real `input` event with `inputType: 'insertText'` when it succeeds; did not independently verify `isTrusted` status of that event.
- Bugzilla #1220696, #1399040 — historical Firefox `execCommand`/textarea bugs; dates and current-2026 status not independently re-verified (Bugzilla search results returned the bug reports themselves, not a resolution-status confirmation).
- General claim that Monkeytype specifically uses this exact technique — sourced from search-result summarization, not from reading Monkeytype's actual source this session.

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — no new packages, all versions read verbatim from the live `package.json`.
- Architecture (overlay technique): MEDIUM — cross-checked across two independent write-ups plus MDN, but no live-browser confirmation this session.
- Architecture (Tab-insertion / isTrusted semantics): LOW-MEDIUM — the core blocking fact (`setRangeText` fires no events; synthetic dispatch is untrusted and rejected by `capture.ts`) is verified from source + spec; the `execCommand` fallback's exact cross-browser trust behavior is unverified and explicitly flagged.
- Pitfalls (Phase-1-cross-reference findings: tab normalization, isTrusted guard, lastValue staleness, delete-type ambiguity): HIGH — all four are derived from reading the live Phase 1 source this session, not from external search.
- Testing/Validation approach: HIGH — the "no layout engine" claim is cross-checked against two independent DOM-simulation projects' own documentation/issue trackers.

**Research date:** 2026-09-05
**Valid until:** 30 days (no fast-moving external dependency; the only expiring facts are the live-codebase reads, which are current as of this commit and will need re-verification if Phase 1 code changes before Phase 2 planning begins).
