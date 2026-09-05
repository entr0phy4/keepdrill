# Milestones

## v1.0 MVP (Shipped: 2026-09-05)

**Phases completed:** 3 phases, 8 plans, 15 tasks
**Timeline:** 2026-09-03 → 2026-09-05 (~2 days) · 99 files changed, +17026/-20 · ~3,156 LOC (src/)

**Key accomplishments:**

- Vite 8 / React 19 / TS 5.9 SPA that loads pasted text through a pure zero-dependency normalizer (18 golden cases) into an in-memory Exercise, renders it as an inert <pre> preview, and appends every keydown/keyup to an append-only high-resolution KeystrokeEvent[] — served cross-origin-isolated with COOP/COEP verified on the document via `curl -I` against `pnpm preview`.
- Browser File-API upload path (`File.text()` UTF-8) through the same pure `normalize()` into an in-memory `Exercise`, guarded by a pre-read 100 KB cap and a UTF-16-BOM / U+FFFD non-UTF-8 check that surface as fixed inline copy — plus the empty, loading, and last-wins `CorpusInput` states the walking skeleton deferred.
- Completed the append-only capture engine — a seq-keyed committed-character log from `beforeinput`/`input` with IME composition and selective paste/drop blocking, blur/visibility lifecycle markers with down-set clearing, a `queueMicrotask`-deferred timer-resolution measurement tap — and finalized both chrome banners plus the production-host/privacy README.
- Pure `computeTrainerState` reducer + transparent-textarea-over-rendered-layer overlay delivering live per-character correctness coloring, free-correction, backspace, and whitespace glyphs — end-to-end and proven by an automated React-DOM render test.
- Restart button (D-08) with an Escape-key keyboard path, a Tab keydown that fully no-ops instead of stealing focus (D-07 amended), a focus/visibility-aware caret blink, and a pure `computeActiveElapsedMs` toggle-state-machine ready for Phase 3.
- `resyncCaret()` now fires on every native selection-change event (ArrowLeft/Right/Home/End/click) via `onSelect`, not only when `cursor` itself changes — closing 02-VERIFICATION.md's one blocking gap — plus an `isTrusted` guard on `handleKeyDown` matching `capture.ts`'s T-01-04 convention.
- Pure, re-runnable `metrics.ts` engine: net WPM (Monkeytype formula, active-time basis), accuracy (every attempt counted, including corrected-over ones), and five-slowest-keystrokes (median/trimmed, outlier-filtered, 3-sample gate) — auto-revealed in a `ResultsView` panel the instant an exercise completes.
- Found and fixed a critical cross-phase bug during code review: target text was indexed by UTF-16 code unit while the cursor advanced by Unicode code point, desyncing scoring (and potentially making an exercise uncompletable) for any text containing a supplementary-plane character — fixed in `state.ts`, `metrics.ts`, and `CaptureSurface.tsx`, independently re-verified by hand-executing the pre-fix algorithm against new regression tests.

---
