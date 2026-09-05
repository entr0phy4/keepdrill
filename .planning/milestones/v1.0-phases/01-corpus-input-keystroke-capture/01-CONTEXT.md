# Phase 1: Corpus Input & Keystroke Capture - Context

**Gathered:** 2026-09-03
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the input half of keebdrill: load real code or text into
the app (paste or file upload), normalize it into a typing-ready exercise, and
stand up the append-only high-resolution keystroke capture engine that every
later metric derives from. It does **not** render a typing trainer, score
anything, or persist across reloads — that is Phase 2 (trainer) and Phase 3
(metrics), with persistence deferred to v2.

Covers requirements: INPUT-01, INPUT-02, INPUT-03, CAPT-01, CAPT-02, CAPT-03,
CAPT-04, CAPT-05.

</domain>

<decisions>
## Implementation Decisions

Resolved autonomously in `--auto` mode. Each picked the research-recommended
option from SUMMARY.md / STACK.md / ARCHITECTURE.md / PITFALLS.md.

### Platform & Scaffold
- **D-01:** Build v1 as a **local-first browser SPA — no backend**. Stack: Vite 8 + React 19 + TypeScript (strict, `noUncheckedIndexedAccess`), pnpm. This resolves the open "platform architecture" decision from PROJECT.md and STATE.md in favor of the research recommendation. — **Reversibility:** costly — a later pivot to TUI/Tauri re-writes the capture layer and the host shell, though the metrics/state modules (pure TS) port unchanged; Tauri specifically is the planned v2 evolution path and reuses the React frontend.
- **D-02:** No persistence in this phase — the keystroke buffer and loaded exercise live in memory only. Dexie/IndexedDB is Phase 4 (v2).
- **D-03:** Testing: Vitest for unit tests (the normalizer in this phase); Playwright deferred until there is a trainer to drive.

### Character-Stream Capture Mechanism
- **D-04:** Capture committed characters from `beforeinput` / `input` events on a focused editable surface (textarea or contenteditable); use `keydown`/`keyup` listeners **only** for timing. Do **not** blanket-`preventDefault` on keydown (breaks dead keys, IME, AltGr). This is locked by CAPT-04 and confirmed by PITFALLS.md #8. — **Reversibility:** costly — the capture surface choice shapes the Phase 2 trainer rendering approach.
- **D-05:** The exact editable-surface choice (hidden textarea vs contenteditable vs visible input) and how caret control is retained is a **spike** for the research/planning step — PITFALLS.md and SUMMARY.md both flag `input`/`beforeinput` vs `keydown` reconciliation as needing a spike before the trainer is built.
- **D-06:** Filter `event.repeat === true`; additionally track a per-`code` "currently down" set as a fallback guard against key-repeat leaking through (PITFALLS.md #3).
- **D-07:** Timestamp source is `event.timeStamp` read off the event object — never `performance.now()` inside the handler, never `Date.now()`. The keydown/keyup listener does nothing but push to the buffer (PITFALLS.md #2).

### Content & Normalizer Policy
- **D-08:** Type the pasted/uploaded content **as-is** — comments, strings, and long literals all included. v1 does not parse or strip anything (resolves the "content scope" open decision; structural-only filtering is a later concern tied to tree-sitter, which is out of scope).
- **D-09:** Normalizer defaults (INPUT-03): CRLF → LF; tabs → spaces at a **configurable width defaulting to 4**; strip trailing whitespace per line; collapse to exactly one trailing newline; strip a leading BOM. The normalizer is a pure function with Vitest golden tests.
- **D-10:** Whitespace-visible rendering (glyphs for space/tab/newline) is a Phase 2 concern — the normalizer here just produces clean text; it does not render.

### Data Model
- **D-11:** Model the loaded exercise in memory as `Exercise { text: string; language: string; sourceType: 'paste' | 'upload'; sourceRef?: string }`. `language` is best-effort from the uploaded file extension (e.g. `.ts` → `typescript`), or `'plaintext'` for paste. Recording `language` + `sourceType` now (even without persistence) keeps Phase 4 persistence non-breaking (SUMMARY.md / FEATURES.md). — **Reversibility:** reversible — in-memory shape, no stored contract yet.
- **D-12:** `KeystrokeEvent { seq: number; type: 'keydown' | 'keyup'; key: string; code: string; ctrl: boolean; alt: boolean; shift: boolean; meta: boolean; tMs: number; isRepeat: boolean }`. `tMs` = `event.timeStamp`. Both `key` and `code` are captured — omitting `code` now means old sessions can never produce a heatmap (ARCHITECTURE.md). — **Reversibility:** costly — every downstream metric consumes this shape; adding a field later is fine, changing/removing one is not.
- **D-13:** The capture buffer is a plain append-only in-memory array owned by a `capture` module, exposed read-only. Downstream code (state machine, metrics) consumes `KeystrokeEvent[]` and never touches the DOM.
- **D-14:** A `Session` wrapper holds `{ exercise, events, timingResolutionUs, crossOriginIsolated, startedAt }` — the object Phase 3 metrics will fold over and Phase 4 will persist.

### Cross-Origin Isolation & Layout Notice
- **D-15:** Serve cross-origin-isolated: set `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` response headers in `vite.config.ts` (dev server) and document the production static-host requirement in the README (CAPT-05, PITFALLS.md #1).
- **D-16:** At startup, check `crossOriginIsolated === true`; probe and record the achieved timer resolution as `timingResolutionUs` on the session; if not isolated, show a visible warning banner (timing degraded) but do not block use.
- **D-17:** "US ANSI layout only" is a **static notice banner** in v1. Best-effort: attempt `navigator.keyboard.getLayoutMap()` and log a console warning if a clearly non-ANSI layout is detected — but never block. `getLayoutMap()` support/behavior across target browsers is flagged for the research step.

### Claude's Discretion
- Component/file structure, module names, and where the capture listeners are
  attached (document vs surface) — planner's call, guided by ARCHITECTURE.md's
  "capture/ is the only platform-coupled module" seam.
- Exact file-extension → language map contents.
- Dev tooling niceties (ESLint/Prettier config, CI) — include if cheap.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope & requirements
- `.planning/PROJECT.md` — project vision, core value, open Key Decisions (platform architecture now resolved to browser SPA by D-01; correction policy still Phase 2)
- `.planning/REQUIREMENTS.md` §v1 — INPUT-01/02/03, CAPT-01..05 exact wording; Out of Scope table (scope lock)
- `.planning/ROADMAP.md` §"Phase 1" — goal and 5 success criteria this phase is verified against

### Research (all in `.planning/research/`)
- `.planning/research/SUMMARY.md` — synthesized findings; §"Phase 1" implementation notes, §"Research Flags" (COOP/COEP deploy, `getLayoutMap()` support, `input`/`beforeinput` vs keydown reconciliation, `event.timeStamp` epoch behavior)
- `.planning/research/STACK.md` — Vite 8 / React 19 / TS versions, "what NOT to use" table, per-platform timer-precision analysis
- `.planning/research/ARCHITECTURE.md` — component boundaries, the `KeystrokeEvent` data model, `capture/` as the only platform-coupled module, build order
- `.planning/research/PITFALLS.md` — pitfalls #1 (timer clamping / COOP-COEP), #2 (wrong timestamp source), #3 (key-repeat), #7 (persist raw log), #8 (no blanket preventDefault), #10 (lifecycle data loss) all land in this phase
- `.planning/research/FEATURES.md` — table-stakes vs differentiators; the `{text, language, source_type}` exercise abstraction

### External docs
- No external ADRs/specs — requirements and research fully captured above. Vendor docs (MDN High-precision timing, Chrome cross-origin isolation, MDN KeyboardEvent) are cited inline in PITFALLS.md / STACK.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield repo. Only `.planning/` and `keebdrill.md` exist; no `package.json`, no `src/`.

### Established Patterns
- None yet. This phase sets the patterns: pure-function core modules with golden tests, `capture/` as the sole platform-coupled seam, `KeystrokeEvent[]` as the universal downstream contract.

### Integration Points
- This phase's outputs (`Exercise`, `Session`, `KeystrokeEvent[]`, the capture module API) are the inputs Phase 2's state machine and Phase 3's metrics engine consume. Design those boundaries as clean value-passing seams.

</code_context>

<specifics>
## Specific Ideas

- Metrics engine must be a pure TS module (no I/O, re-runnable over any log) — this is the product's IP per STACK.md/SUMMARY.md. Phase 1 just needs to make sure the captured `KeystrokeEvent[]` carries everything that module will ever need (hence both `key` and `code`, modifiers, monotonic `tMs`).
- "US ANSI layout only" banner and a "timing may be degraded" banner are the only two chrome elements this phase adds beyond the paste box and upload control.

</specifics>

<deferred>
## Deferred Ideas

- **Session persistence (Dexie/IndexedDB)** — Phase 4 / v2 (PERS-01, PERS-02). Phase 1 builds the data model append-only and complete so persistence is a non-breaking add.
- **Language auto-detection beyond file extension** (content sniffing, tree-sitter) — later; v1 uses extension or `plaintext`.
- **Repo / docs / shell-history source adapters** — v2 milestone (needs Tauri). The `sourceType` enum leaves room.
- **Syntactic chunking (tree-sitter)** — out of scope; v1 types whole normalized content.
- **Whitespace glyph rendering, caret, per-char coloring** — Phase 2.
- **Non-US-ANSI layout support** — out of scope; static notice only.

</deferred>

---

*Phase: 1-Corpus Input & Keystroke Capture*
*Context gathered: 2026-09-03*
