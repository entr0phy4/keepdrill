# Phase 2: Interactive Typing Trainer - Pattern Map

**Mapped:** 2026-09-05
**Files analyzed:** 8 (5 new, 3 modified)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/trainer/state.ts` (new) | service (pure-core reducer/fold) | transform | `src/ingestion/normalize.ts` | exact |
| `src/trainer/state.test.ts` (new) | test | transform | `src/ingestion/normalize.test.ts` | exact |
| `src/trainer/active-time.ts` (new, or co-located in `state.ts`) | utility (pure-core computation) | transform | `src/ingestion/normalize.ts` | exact |
| `src/trainer/active-time.test.ts` (new) | test | transform | `src/ingestion/normalize.test.ts` | exact |
| `src/capture/capture.ts` (modified — add direct-record export for Tab) | service (platform-coupled hot path) | event-driven | `src/capture/capture.ts` itself (existing exports `resetCapture`/`getCharLog`/marker pushers) | exact (self-extension) |
| `src/capture/capture.test.ts` (modified — cover new export) | test | event-driven | existing file (extend in place) | exact |
| `src/ui/CaptureSurface.tsx` (modified — overlay rendering, Tab exception, caret sync) | component | request-response (render) + event-driven (keydown) | `src/ui/CaptureSurface.tsx` itself (extend in place) + `src/capture/use-capture.ts` for the `useLayoutEffect` idiom | exact (self-extension) |
| `src/ui/App.tsx` (modified — restart wiring, pass trainer state down) | component / provider | state composition | `src/ui/App.tsx` itself (extend `handleLoad`/`loadToken`) | exact (self-extension) |

## Pattern Assignments

### `src/trainer/state.ts` (service, transform)

**Analog:** `src/ingestion/normalize.ts` (whole file, 34 lines — small file, read in full)

**Header-comment / contract-documentation pattern** (lines 1-6):
```typescript
// PURE — zero imports. INPUT-03 / D-09. The transform ORDER is load-bearing
// (01-RESEARCH.md "Normalizer reference shape" + Pitfall 4); the 18 golden cases
// in normalize.test.ts lock it. Do NOT Unicode-normalize (NFC/NFD), do NOT strip
// NBSP / vertical tab / form feed — only ASCII space and tab count as trailing
// whitespace (assumption A4). v1 uses fixed-width tab expansion, not elastic tab
// stops (assumption A3).
```
Copy this convention exactly: a top-of-file comment stating (a) purity/zero-DOM-access invariant, (b) which decision IDs/requirement IDs it satisfies, (c) which test file locks its behavior, (d) explicit "do NOT" list of tempting-but-wrong shortcuts. For `state.ts` this becomes: "PURE — zero DOM access. D-03/D-04/D-05. Order of operations across `charLog` is load-bearing; golden cases in `state.test.ts` lock it. Do NOT read `textarea.selectionStart` here; do NOT attempt to infer multi-char delete length from `data` (always null for delete* — Pitfall 5)."

**Options-object + defaulted-param pattern** (lines 8-12):
```typescript
export interface NormalizeOptions {
  tabWidth: number
}

export function normalize(raw: string, opts: NormalizeOptions = { tabWidth: 4 }): string {
```
`computeTrainerState(target: string, charLog: readonly CommittedChar[]): TrainerState` follows the same "plain data in, plain data out, no default-object needed since there are no options" shape — RESEARCH.md's Pattern 3 code example already gives the exact body to use (see below), sourced from this same file's structural convention.

**Type-only cross-module import pattern** (RESEARCH.md Pattern 3, mirrors `normalize.ts`'s zero-import purity as closely as the domain allows):
```typescript
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
  // ... fold logic — see 02-RESEARCH.md Architecture Patterns §Pattern 3 for the
  // full verbatim reference implementation (delete-branch, per-codepoint
  // insert loop, corrected/uncorrected tallying).
}
```
This is a **type-only** import (`import type`), matching the zero-runtime-coupling spirit of `normalize.ts`'s zero-import rule — the only concession pure-core modules in this codebase make to importing anything at all.

**Sequential-transform-with-numbered-steps pattern** (lines 15-33 of `normalize.ts`): each step is a numbered inline comment (`// 1. Strip...`, `// 2. CRLF...`) applied in a fixed, load-bearing order. Apply the same numbered-step discipline inside `computeTrainerState`'s `for (const rec of charLog)` loop body (delete branch first, then insert-by-codepoint branch, then completedAt check) — RESEARCH.md's Pattern 3 example already follows this convention; copy it verbatim as the starting implementation.

---

### `src/trainer/state.test.ts` (test, transform)

**Analog:** `src/ingestion/normalize.test.ts` (lines 1-56 read; golden-case-table pattern)

**Golden-case-table + `it.each` pattern** (lines 9-56):
```typescript
interface Case {
  n: number
  name: string
  input: string
  tabWidth: number
  expected: string
}

const cases: Case[] = [
  { n: 1, name: 'CRLF -> LF', input: 'a\r\nb\r\n', tabWidth: 4, expected: 'a\nb\n' },
  // ...
]

describe('normalize() — 18 golden cases (INPUT-03)', () => {
  it.each(cases)('case $n: $name', ({ input, tabWidth, expected }) => {
    expect(normalize(input, { tabWidth })).toBe(expected)
  })
})
```
Copy this shape directly for `state.test.ts`: a `Case` interface with `n`, `name`, plus whatever inputs the case needs (`target: string`, `charLog: CommittedChar[]`), and `expected: Partial<TrainerState>` (or the specific fields under test — `cursor`, `perCharStatus`, `correctedCount`, `uncorrectedCount`, `completedAt`). Use `it.each(cases)('case $n: $name', ...)` exactly as here. Cover at minimum: plain correct typing, a wrong-then-corrected char (D-04's `correctedCount`), a wrong-then-never-corrected char (`uncorrectedCount`), a backspace re-opening a position (D-05), a delete-inputType decrementing cursor by exactly one (Pitfall 5's documented limitation — assert the *current* one-position-back behavior, not a hypothetical length-aware one), IME multi-codepoint commit via `insertFromComposition` (Pitfall/Don't-Hand-Roll "Composed-character detection"), and completion (`cursor === target.length` sets `completedAt`).

**Named single-char literal constants for edge-case inputs** (lines 4-7):
```typescript
const BOM = '﻿'
const NBSP = ' '
```
If `state.test.ts` needs any non-obvious literal characters (e.g. testing the whitespace-glyph-adjacent newline handling), name them as top-level `const` with a comment, matching this file's convention, rather than inlining raw unicode escapes into the case table.

---

### `src/trainer/active-time.ts` (utility, transform)

**Analog:** `src/ingestion/normalize.ts` (same purity convention as `state.ts` above) + RESEARCH.md Pattern 4 for the concrete body.

**Full reference implementation** (from `02-RESEARCH.md` Architecture Patterns §Pattern 4, already verified against live `src/capture/types.ts:29-36`):
```typescript
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
    if (m.tMs < t0) continue
    const goesInactive = m.kind === 'blur' || m.kind === 'hidden'
    const goesActive = m.kind === 'focus' || m.kind === 'visible'
    if (goesInactive && inactiveSince === null) {
      inactiveSince = m.tMs
    } else if (goesActive && inactiveSince !== null) {
      totalInactiveMs += m.tMs - inactiveSince
      inactiveSince = null
    }
  }

  if (inactiveSince !== null) {
    totalInactiveMs += Math.max(0, now - inactiveSince)
  }

  return Math.max(0, now - t0 - totalInactiveMs)
}
```
Apply the same header-comment convention as `state.ts` above (purity, decision ID D-09, edge cases covered). Claude's Discretion (CONTEXT.md) allows co-locating this in `state.ts` instead of a separate file — if co-located, keep the two functions clearly separated by a comment banner, matching how `normalize.ts` keeps its single responsibility crisp (do not merge the two into one function).

---

### `src/trainer/active-time.test.ts` (test, transform)

**Analog:** `src/ingestion/normalize.test.ts` golden-case-table pattern (same as `state.test.ts` above), adapted to synthetic marker sequences.

Cover: no keystroke yet (returns 0), no blur/hidden at all (elapsed = `now - t0`), one blur/focus pair fully closed, one hidden with no matching visible (session ended while backgrounded — open interval counted to `now`), overlapping blur+hidden pair (both "inactive" markers while already inactive — must be a no-op per Pattern 4's toggle-state-machine design), out-of-order/duplicate active markers (no-op).

---

### `src/capture/capture.ts` (modified — service, event-driven)

**Analog:** the file's own existing exports — `resetCapture()`, `pushMarker()`, `onBeforeInput()` (lines 144-146, 91-105, 238-249 read in full).

**Direct-invocation (non-event) export pattern to add**, modeled on the existing internal push helpers:
```typescript
// existing internal helper this new export should mirror (lines 91-105):
function onBeforeInput(e: Event): void {
  if (!(e instanceof InputEvent)) return
  if (!e.isTrusted) return // T-01-04
  // ...
  const { inputType, data } = charRecordFor(e)
  charLog.push(Object.freeze({ seq: seq++, inputType, data, tMs: e.timeStamp }))
}
```
New export (per RESEARCH.md Pitfall 3's recommended design — direct function call, never wired to a DOM event listener, so it cannot become a general-purpose `isTrusted`-bypass an attacker could trigger):
```typescript
/** Deliberate, narrow bypass of the isTrusted guard for exactly one first-party
 *  code path: CaptureSurface's Tab-keydown exception (D-07). Must remain a
 *  plain function call reachable only from CaptureSurface.tsx's own keydown
 *  handler — never wired to any DOM event listener (see Pitfall 3/Security
 *  Domain in 02-RESEARCH.md). Also updates `lastValue` (Pitfall 4) so the
 *  Firefox-delete-fallback comparison in onInput stays correct afterward. */
export function recordSyntheticChar(inputType: string, data: string | null, tMs: number, newValue: string): void {
  charLog.push(Object.freeze({ seq: seq++, inputType, data, tMs }))
  lastValue = newValue
}
```
**Reset pattern to extend** (lines 240-249, `resetCapture()`) — no change needed here since Phase 2's D-08 restart already reuses this export as-is; listed only so the planner confirms no new module-level state was added by the Tab export that `resetCapture()` must also clear (in the implementation above, none is — `lastValue` is already reset there).

**Idempotent attach/detach pattern** (lines 178-210, `attachCapture`/`detachCapture`) — no change; cited only as the existing convention any new listener wiring (there is none needed for the Tab exception, per Pitfall 3's direct-call design) would have to follow.

---

### `src/capture/capture.test.ts` (modified — test, event-driven)

**Analog:** existing test file (not read this pass — small, extend in place per the file's own established per-export `describe` block convention, matching `capture.ts`'s own export list: `getEvents`, `getCharLog`, `getMarkers`, `resetCapture`). Add a `describe('recordSyntheticChar', ...)` block asserting: (a) the record appears in `getCharLog()` with the given `inputType`/`data`/`tMs`; (b) `lastValue` is updated (verify indirectly — simulate a subsequent Firefox-style bare `input` event and confirm no duplicate/missed delete record, per Pitfall 4's warning sign); (c) `resetCapture()` still clears everything afterward.

---

### `src/ui/CaptureSurface.tsx` (modified — component, request-response render + event-driven keydown)

**Analog:** the file itself (94 lines, read in full) + `src/capture/use-capture.ts` for the `useLayoutEffect`-before-focus idiom (lines 34-43).

**Existing imports/hooks pattern** (lines 1-2):
```typescript
import { useCallback, useEffect, useRef, useState } from 'react'
import { useCapture } from '../capture/use-capture'
```
Add `useLayoutEffect` to this import line (already used elsewhere in the codebase per `use-capture.ts`) for the caret-resync effect (D-10, RESEARCH.md Pattern 2); add `import { computeTrainerState } from '../trainer/state'` and `import { recordSyntheticChar } from '../capture/capture'` (for the Tab exception) and `import type { CommittedChar } from '../capture/types'` as needed.

**Existing paste-blocked-flag state/handler pattern to mirror for Tab** (lines 28-38):
```typescript
const [pasteBlocked, setPasteBlocked] = useState(false)
const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

const handlePasteBlocked = useCallback(() => {
  if (fadeTimeoutRef.current !== null) clearTimeout(fadeTimeoutRef.current)
  setPasteBlocked(true)
  fadeTimeoutRef.current = setTimeout(() => {
    setPasteBlocked(false)
    fadeTimeoutRef.current = null
  }, PASTE_BLOCKED_FADE_MS)
}, [])
```
This is the established convention for "a capture-layer event needs a transient, auto-clearing UI flag" — not directly reused for Tab (Tab has no such flag per CONTEXT.md), but this is the pattern to follow if the planner adds any transient UI feedback for the Tab-scores-incorrect behavior (Pitfall 2's optional UI-affordance discretion point).

**Existing `useEffect`-after-`useLayoutEffect` ordering pattern** (lines 40-46, with the comment explaining *why*):
```typescript
const { count } = useCapture(ref, handlePasteBlocked)

// Focus AFTER useCapture's useLayoutEffect has attached the listeners
// (PITFALLS #2 — no first-keystroke loss). A plain effect runs after layout effects.
useEffect(() => {
  ref.current?.focus()
}, [])
```
Add the new caret-resync `useLayoutEffect` (RESEARCH.md Pattern 2, verbatim) using this exact ordering discipline — it must run as a `useLayoutEffect` (not a plain effect) so it resolves before the browser paints, consistent with how this file already reasons about layout-effect-vs-effect timing:
```typescript
useLayoutEffect(() => {
  const el = ref.current
  if (!el) return
  if (el.selectionStart !== cursor || el.selectionEnd !== cursor) {
    el.selectionStart = cursor
    el.selectionEnd = cursor
  }
}, [cursor])
```

**Existing click-to-refocus pattern** (line 56, 61):
```typescript
const reclaimFocus = () => ref.current?.focus()
// ...
<section style={{ ... }} onClick={reclaimFocus}>
```
No change needed, but note it interacts with D-10/Open Question 2 (click-to-reposition is not a supported nav mode) — clicking already just refocuses without moving native selection anywhere new relative to this handler; the caret-resync effect (above) is what actually snaps any resulting selection drift back to `cursor`.

**Existing textarea JSX + reserved-space status line pattern** (lines 66-92) — the `<textarea>` element and the `aria-describedby`-linked status paragraphs are the base to extend: add the Tab keydown handler as a new prop on the same `<textarea>`, and add the rendered overlay layer (RESEARCH.md Pattern 1's CSS) as sibling markup inside the same grid/stack wrapper this `<section>` already establishes via `style={{ display: 'grid', gap: 'var(--space-sm)' }}` (line 60) — reuse this existing inline-style-object convention (the file uses inline `style={{}}` throughout, not CSS Modules or Tailwind) for any new layout wrapper.

**New Tab keydown exception** (per D-07/RESEARCH.md Pitfall 3, mirroring the file's existing `onKeyDown`-adjacent event-handling style — there is no existing keydown handler in this file yet; model it on `capture.ts`'s own guard-then-act style, lines 91-99):
```typescript
const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === 'Tab') {
    e.preventDefault()
    const el = e.currentTarget
    el.setRangeText('\t', el.selectionStart, el.selectionEnd, 'end')
    recordSyntheticChar('insertText', '\t', e.timeStamp, el.value)
  }
}
```

---

### `src/ui/App.tsx` (modified — component/provider, state composition)

**Analog:** the file itself (113 lines, read in full).

**Existing `loadToken` remount + `handleLoad` reset pattern** (lines 26-32, 48-60) — D-08's restart reuses this exact mechanism:
```typescript
const [loadToken, setLoadToken] = useState(0)
// ...
const handleLoad = (loaded: Exercise) => {
  resetCapture() // fresh buffer per exercise
  setExercise(loaded)
  setLoadToken((token) => token + 1)
  const startedAt = Date.now()
  loadRef.current = { exercise: loaded, startedAt }
  const session = buildSession(loaded, startedAt)
  sessionRef.current = session
  setTimingResolutionUs(session.timingResolutionUs)
  if (import.meta.env.DEV) {
    window.__keebdrillSession = session
  }
}
```
Add a `handleRestart` following the identical shape but keeping `exercise` unchanged (only `resetCapture()` + `setLoadToken((t) => t + 1)` + reset `loadRef`/`sessionRef` for the *same* `exercise`, not a newly-loaded one) — copy this function's structure, not its content, per D-08's spec ("same mechanism Phase 1 already uses when loading a different exercise, reused here for reloading the same one").

**Existing remount-via-`key` pattern** (line 108):
```typescript
<CaptureSurface key={loadToken} />
```
No change to the mechanism — `handleRestart`'s `setLoadToken` bump is what triggers the remount; a Restart control (button) simply needs to call `handleRestart`, following the same one-line-JSX-call convention `CorpusInput`'s `onLoad={handleLoad}` prop already establishes (line 92) for wiring a child-triggered callback into `App`'s state.

**Existing conditional-render-by-exercise-presence pattern** (lines 94-110) — the ternary between "no exercise loaded" and the loaded-exercise view is where the Restart button and any trainer-state display would be added, following this file's existing inline-JSX-in-`<section>` convention rather than extracting a new component (unless the planner's discretion on component split, per CONTEXT.md, decides otherwise).

## Shared Patterns

### Pure-core module contract
**Source:** `src/ingestion/normalize.ts` (whole file)
**Apply to:** `src/trainer/state.ts`, `src/trainer/active-time.ts`
- Top-of-file header comment stating: PURE / zero-DOM-access, which decision IDs it satisfies, which test file locks the behavior, and an explicit "do NOT" list of tempting shortcuts.
- Only `import type` (never a runtime import) crosses into these modules.
- Every transform step numbered/commented in the order it executes, because order is load-bearing and must not be "simplified" later.

### Golden-case-table test pattern
**Source:** `src/ingestion/normalize.test.ts` lines 9-56
**Apply to:** `src/trainer/state.test.ts`, `src/trainer/active-time.test.ts`
```typescript
interface Case { n: number; name: string; /* ...inputs... */; expected: /* ... */ }
const cases: Case[] = [ /* numbered, named cases */ ]
describe('<fn>() — N golden cases (<REQ-ID>)', () => {
  it.each(cases)('case $n: $name', ({ /* ... */ }) => {
    expect(/* call */).toBe(/* expected */) // or toEqual for object results
  })
})
```

### isTrusted guard discipline (security-relevant, ASVS V5-adjacent)
**Source:** `src/capture/capture.ts` lines 36, 93, 111, 133, 138
**Apply to:** any new listener touched in `CaptureSurface.tsx`; explicitly NOT applied to the new `recordSyntheticChar` direct-call export (that is the one deliberate, narrow, function-call-only bypass — must never be reachable via a DOM event listener).

### `useLayoutEffect`-before-`useEffect` DOM-timing discipline
**Source:** `src/capture/use-capture.ts` lines 34-43 and `src/ui/CaptureSurface.tsx` lines 40-46 (with its explanatory comment)
**Apply to:** the new caret-resync effect in `CaptureSurface.tsx` (D-10/Pattern 2) — must be `useLayoutEffect`, not `useEffect`, for the same reason focus-after-attach must be ordered correctly (pre-paint DOM state consistency).

### Inline `style={{}}` layout convention (no CSS Modules/Tailwind in this codebase)
**Source:** `src/ui/App.tsx` line 82, 104; `src/ui/CaptureSurface.tsx` lines 59-60
**Apply to:** the new overlay-stack wrapper in `CaptureSurface.tsx` — use inline `style={{ display: 'grid', ... }}` consistent with existing components, pulling values from `index.css` custom properties (`var(--space-sm)`, `var(--font-mono)`, etc.) rather than introducing a new stylesheet or CSS-in-JS library.

### Design tokens (colors, spacing, motion) already established
**Source:** `src/index.css` lines 1-56
**Apply to:** the rendered per-character layer's correct/incorrect/pending colors (must use `--color-accent`/`--color-destructive`/`--color-text-muted` or equivalent existing tokens, not new hard-coded hex values) and the caret-blink motion (must respect `--motion-duration` and the existing `prefersReducedMotion()` helper already defined in `CaptureSurface.tsx` lines 18-24).

## No Analog Found

None — every file in scope has at least one exact or near-exact analog already on disk, since Phase 2 is explicitly designed (per CONTEXT.md) to extend Phase 1's established `pure-core` / `capture` / `ui` tiering rather than introduce a new architectural shape.

## Metadata

**Analog search scope:** `src/` (ingestion, capture, ui, platform, session.ts) — entire existing codebase, 20 source files.
**Files scanned:** `normalize.ts`, `normalize.test.ts`, `capture.ts`, `capture/types.ts`, `use-capture.ts`, `CaptureSurface.tsx`, `App.tsx`, `session.ts`, `index.css` (read in full or in targeted ranges this session).
**Pattern extraction date:** 2026-09-05
