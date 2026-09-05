# Phase 2: Interactive Typing Trainer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-05
**Phase:** 2-Interactive Typing Trainer
**Mode:** `--auto` (autonomous — Claude selected the option most consistent with the existing Phase 1 code and locked REQUIREMENTS.md wording; no interactive prompts)
**Areas discussed:** Rendering Architecture, Trainer State Machine, Whitespace & Tab Handling, Restart, Session Timing

---

## Rendering Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Transparent textarea + absolutely-positioned colored-span layer beneath it | Native textarea keeps owning input/focus/IME/selection; a rendered layer shows per-char color + custom caret. Standard code-typing-tool pattern (Monkeytype, etc.) | ✓ |
| Fully custom `contenteditable` surface | Would require reimplementing caret/selection/IME handling that the native textarea already gives for free; Phase 1's D-04/D-05 already rejected contenteditable | |
| Style the real textarea's text color per-range | Not possible — a native `<textarea>` cannot color individual characters within its value | |

**Notes:** Font/line-height/letter-spacing must match exactly between the invisible textarea and the rendered layer (D-02) so the two carets never visually drift.

---

## Trainer State Machine

| Option | Description | Selected |
|--------|-------------|----------|
| New pure module `src/trainer/state.ts` folding `CommittedChar[]` + target text | Zero DOM access, testable like `normalize.ts`; matches the established pure-core pattern | ✓ |
| Compute per-char status inline inside the React component | Untestable in isolation, mixes rendering with logic, breaks the established pure-core/platform-seam split | |

**Notes:** Consumes `CommittedChar[]` (not `KeystrokeEvent[]`) as the authority on what was actually typed, consistent with Phase 1's D-04.

---

## Whitespace & Tab Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Glyphs `·`/`→`/`↵`; narrow `preventDefault` exception on Tab keydown to insert a literal tab | Common convention (VS Code, other typing tools); Tab exception mirrors the existing paste/drop exception in `capture.ts` | ✓ |
| Let Tab move focus natively (no exception) | Would make any exercise containing a tab character untypable — breaks the core loop | |
| Auto-indent on Enter | Explicitly out of scope per REQUIREMENTS.md ("Auto-indent replacing manual whitespace typing") | |

---

## Restart

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse `resetCapture()` + reset trainer state + re-mount `CaptureSurface` via existing `loadToken` bump | Same mechanism Phase 1 already uses for loading a different exercise; no new plumbing | ✓ |
| Full page reload | Loses in-memory `Exercise`/UI state unnecessarily; user must not lose the loaded corpus | |

---

## Session Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Pure `computeActiveElapsedMs(charLog, markers, now)` — first committed char as t0, subtract blur/hidden intervals from `CaptureMarker[]` | Testable with synthetic marker sequences; no new capture-layer work — Phase 1 already records everything needed | ✓ |
| Track elapsed time with a live `setInterval` in the UI and display a running timer | Not required by TYPE-06's wording (starts on first keystroke, excludes blur/hidden) and would pull WPM/timer-display scope from Phase 3 into Phase 2 | |

**Notes:** Paste-blocking (TYPE-06's other half) is already fully implemented in Phase 1 — no new work needed here.

---

## Claude's Discretion

- File/component split within `src/trainer/` and `src/ui/`.
- Caret blink animation details (respecting `prefers-reduced-motion`).
- CSS overlay technique (absolute positioning vs grid stacking).

## Deferred Ideas

- WPM / accuracy / five-slowest-keys computation and display — Phase 3.
- Results panel / end-of-session UI — Phase 3.
- Session persistence — v2 (Phase 4).
- Symbols drill mode, per-language profiles, adaptive drills — v2.
