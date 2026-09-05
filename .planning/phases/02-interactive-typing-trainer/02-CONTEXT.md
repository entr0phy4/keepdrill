# Phase 2: Interactive Typing Trainer - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the actual typing trainer surface: the user types the exercise
loaded in Phase 1 and sees live per-character correctness feedback, under a
free-correction policy (advancing past an error is allowed), with backspace,
visible whitespace glyphs, restart, and honest session timing (starts on first
keystroke, excludes blurred/hidden time — paste-blocking is already delivered
in Phase 1). It does **not** compute or display WPM/accuracy/slowest-keys (Phase 3)
and does **not** persist anything (v2).

Covers requirements: TYPE-01, TYPE-02, TYPE-03, TYPE-04, TYPE-05, TYPE-06.

</domain>

<decisions>
## Implementation Decisions

Resolved autonomously in `--auto` mode. Each picked the option most consistent
with the Phase 1 architecture already on disk (capture/ as the platform seam,
pure-core modules with golden tests) and the locked REQUIREMENTS.md wording.

### Rendering Architecture
- **D-01:** Use the **transparent-textarea-over-rendered-layer** pattern (the standard code-typing-test technique): keep `CaptureSurface`'s existing focused native `<textarea>` as the exclusive input/focus/caret host, but make its text and native caret invisible (`color: transparent`, `caret-color: transparent`, `background: transparent`) and stack a `<pre>`-like absolutely-positioned layer beneath it that renders each target character as a `<span>` colored by status (correct / incorrect / pending) plus a custom caret element positioned at the current index. The native textarea keeps owning real keyboard/IME/selection behavior — nothing about Phase 1's capture pipeline (`beforeinput`/`input`/`keydown`/`keyup`) changes. — **Reversibility:** costly — this is the seam Phase 3's UI (results panel) and any later visual work build on.
- **D-02:** The rendered layer and the textarea must use identical font/line-height/letter-spacing (both already pull from `index.css`'s monospace tokens) so the invisible textarea's caret position and the rendered caret marker never drift apart.

### Trainer State Machine
- **D-03:** New pure module `src/trainer/state.ts` (mirrors the Phase 1 `pure-core` pattern of `normalize.ts`): a reducer/fold that joins the target `Exercise.text` with the capture layer's `CommittedChar[]` (not `KeystrokeEvent[]` — committed characters are the authority on what was actually typed, matching D-04 from Phase 1) and produces `{ perCharStatus: Array<'correct'|'incorrect'|'pending'>, cursor: number, correctedCount: number, uncorrectedCount: number, completedAt: number | null }`. Zero DOM access, testable in isolation like the normalizer.
- **D-04:** Free-correction semantics (TYPE-02, already locked by REQUIREMENTS.md): the cursor always advances on any committed character (right or wrong) — never blocked waiting for a correction. A position is "corrected" if it was ever wrong and its current value now matches the target; "uncorrected" if the cursor has moved past it and the current value still doesn't match. Exercise "complete" = cursor reaches `text.length`, regardless of any remaining uncorrected positions.
- **D-05:** Backspace (TYPE-03) moves the cursor back one position via the `beforeinput` `inputType === 'deleteContentBackward'` (and related delete `inputType`s already surfaced in Phase 1's `CommittedChar.inputType`) — re-opens that position as `pending` until retyped. No new capture-layer work; the state module just interprets `CommittedChar` entries it already receives.

### Whitespace & Tab Handling
- **D-06:** Whitespace glyphs (TYPE-04): space → `·` (middle dot), tab → `→`, newline → `↵` followed by an actual line break in the rendered layer — the common code-typing-tool convention. Glyphs are muted-color, not part of the correct/incorrect palette (they overlay the correct/incorrect coloring, not replace it).
- **D-07:** Tab key: browser default Tab moves focus out of the textarea, which would break typing through any exercise containing a literal tab. Add a **narrowly-scoped keydown exception** — `if (e.key === 'Tab') e.preventDefault()` — that inserts a tab character via `document.execCommand` fallback or by dispatching the equivalent `beforeinput`/`input` sequence the browser would have produced, so it still flows through the existing `beforeinput` capture path (D-04 from Phase 1) rather than bypassing it. This mirrors the existing paste/drop exception in `capture.ts` (CAPT-04) — a second narrow, documented carve-out, not a reopening of the "no blanket preventDefault" rule. — **Reversibility:** reversible — isolated to one keydown branch.

### Restart
- **D-08:** Restart (TYPE-05) calls the existing `resetCapture()` (Phase 1, clears the keystroke/char/marker buffers), resets `trainer/state.ts`'s reducer to its initial state for the same `Exercise`, and re-mounts `CaptureSurface` via the existing `loadToken`-based remount (Phase 1, `App.tsx`) so no stale DOM/IME state survives — the same mechanism Phase 1 already uses when loading a *different* exercise, reused here for reloading the *same* one.

### Session Timing
- **D-09:** TYPE-06's "starts on first keystroke, excludes blurred/hidden time" is a pure computation, not new capture-layer plumbing: add `computeActiveElapsedMs(charLog: CommittedChar[], markers: CaptureMarker[], now: number): number` (co-located with `trainer/state.ts` or `session.ts`) that finds the first `CommittedChar.tMs` as t0, then subtracts any `[blur, focus)` / `[hidden, visible)` interval pairs from the markers list (already recorded by Phase 1's `capture.ts`) from `now - t0`. Phase 2 does not need to *display* a running timer (that's Phase 3/metrics territory) — it only needs the value to exist and be correct, verified by unit tests with synthetic marker sequences. Paste-blocking (the other half of TYPE-06) is already fully implemented in Phase 1's `CaptureSurface`/`capture.ts` — no new work.

### Claude's Discretion
- Exact component/file split within `src/trainer/` and `src/ui/` (e.g. whether the rendered character layer is its own component or lives inside `CaptureSurface.tsx`).
- Caret blink animation details (respecting `prefers-reduced-motion`, per the existing `01-UI-SPEC.md` motion rule).
- Exact CSS technique for overlaying the transparent textarea and the rendered layer (absolute positioning vs CSS grid stacking) — planner's call, constrained only by D-02.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope & requirements
- `.planning/PROJECT.md` — project vision, core value, Key Decisions (Phase 1 already resolved platform/capture/content-scope; correction policy and indentation are Phase 2's remaining Pending rows — now resolved by D-04/D-06/D-07 above and by REQUIREMENTS.md's Out of Scope table, which already excludes auto-indent)
- `.planning/REQUIREMENTS.md` §v1 — TYPE-01..06 exact wording; Out of Scope table explicitly excludes "Auto-indent replacing manual whitespace typing" and "Forced-correction typing mode in v1"
- `.planning/ROADMAP.md` §"Phase 2" — goal and 5 success criteria this phase is verified against; `UI hint: yes`

### Phase 1 artifacts (this phase builds directly on their code, not just their decisions)
- `.planning/phases/01-corpus-input-keystroke-capture/01-CONTEXT.md` — D-04/D-05 (capture surface is a native `<textarea>`, no `preventDefault` on keydown except the documented paste/drop exception), D-12 (`KeystrokeEvent`/`CommittedChar`/`CaptureMarker` shapes), D-14 (`Session` shape)
- `.planning/phases/01-corpus-input-keystroke-capture/01-SUMMARY.md`, `01-02-SUMMARY.md`, `01-03-SUMMARY.md` — what was actually built (see Existing Code Insights below)
- `.planning/phases/01-corpus-input-keystroke-capture/01-UI-SPEC.md` — the token foundation (spacing/type/color, light+dark) this phase's UI-SPEC extends; motion rule (`prefers-reduced-motion`)
- `.planning/research/SUMMARY.md` §Phase 2 note — "resolve correction-policy (free) and indentation model here" — resolved above

### External docs
- No external ADRs/specs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/capture/capture.ts` — `getEvents()`, `getCharLog()`, `getMarkers()`, `resetCapture()`, `attachCapture`/`detachCapture` — the entire capture pipeline (keydown/keyup, beforeinput/input, IME, key-repeat, blur/visibility markers, paste-block) is DONE and unchanged by this phase.
- `src/session.ts` — `buildSession()` composes `Exercise` + capture snapshots into `Session`; Phase 2's trainer state is a parallel, separate fold over the same `CommittedChar[]`/`CaptureMarker[]` data, not a replacement.
- `src/ui/CaptureSurface.tsx` — already the focused `<textarea>` with paste-blocked flag and `useCapture` wiring; this phase modifies it to add the transparent-overlay rendering (D-01) rather than replacing it.
- `src/ui/App.tsx` — `loadToken` remount mechanism (D-08 reuses this for restart), `handleLoad`, existing `Banners`/`CorpusInput` composition.
- `src/index.css` — spacing/type/color design tokens from `01-UI-SPEC.md`; the new rendered character layer must reuse these, not introduce new ones.

### Established Patterns
- Pure-core modules with Vitest golden/unit tests, zero DOM access (`normalize.ts` is the model `trainer/state.ts` should follow).
- `capture/` is the only platform-coupled (DOM-touching) module — Phase 2's new trainer-state module must NOT touch `document`/`window` directly; it consumes already-captured `CommittedChar[]`/`CaptureMarker[]` as plain data.
- Narrow, documented `preventDefault` exceptions live in `capture.ts` next to the capture pipeline (the paste/drop precedent for D-07's Tab exception).

### Integration Points
- `trainer/state.ts` (new) consumes `CommittedChar[]` from `capture.ts` and `Exercise.text` from `ingestion/types.ts` — no changes needed to either.
- `computeActiveElapsedMs` (D-09) consumes `CaptureMarker[]` — already fully populated by Phase 1.
- Phase 3's metrics engine will fold over the same `Session`/`CommittedChar[]`/`KeystrokeEvent[]` data this phase reads — keep the trainer state module's output shape (`perCharStatus`, `correctedCount`, `uncorrectedCount`) simple enough that Phase 3 can derive accuracy from it without re-deriving correctness itself.

</code_context>

<specifics>
## Specific Ideas

- The transparent-textarea-over-rendered-layer approach is the standard technique used by Monkeytype and similar tools — it is not a novel invention for this project, just the correct application of a known pattern to the existing Phase 1 capture surface.
- Whitespace glyph choice (`·` / `→` / `↵`) is a common convention (also used by VS Code's "render whitespace" feature) — reuse rather than invent new symbols.

</specifics>

<deferred>
## Deferred Ideas

- **WPM / accuracy / five-slowest-keys computation and display** — Phase 3. This phase produces the data (`perCharStatus`, `correctedCount`, `uncorrectedCount`, `computeActiveElapsedMs`) Phase 3 will consume; it does not compute or show any metric itself.
- **Results panel / end-of-session UI** — Phase 3 (`UI hint: yes` there too).
- **Session persistence** — v2 (Phase 4, Dexie/IndexedDB), unchanged from Phase 1's deferral.
- **Symbols drill mode, per-language profiles, adaptive drills** — v2, unchanged.

</deferred>

---

*Phase: 2-Interactive Typing Trainer*
*Context gathered: 2026-09-05*
