# Walking Skeleton — keebdrill

**Phase:** 1
**Generated:** 2026-09-04

## Capability Proven End-to-End

A user pastes code or text into the browser, chooses **Load exercise**, sees it
normalized and rendered as inert, selectable text in a `<pre>` preview, and every
`keydown` / `keyup` they type into the focused capture `<textarea>` is appended to
an in-memory, high-resolution, append-only `KeystrokeEvent[]` — with the dev
server confirmed cross-origin-isolated (`crossOriginIsolated === true`, COOP/COEP
headers on the HTML document) and the achieved timer resolution recorded on the
`Session`.

No file upload, no metrics, no trainer, no persistence — just proof the whole
pipe runs on the architecture the rest of the project inherits.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Vite 8.2 + React 19.2 + TypeScript `~5.9.3` (strict, `noUncheckedIndexedAccess`), pnpm 11 | D-01. Browser is the only platform delivering cross-OS `keyup` + sub-ms monotonic timestamps without terminal configuration. TS pinned to 5.9 (not 7.x) so `typescript-eslint` works (RESEARCH §Standard Stack, A9). |
| Build / test runner | `@vitejs/plugin-react@6.1`, `vitest@~4.1.11` (not 5.0.0 — one day old, raises Node floor), `happy-dom@20` for capture-layer tests, `environment: 'node'` for the pure normalizer | D-03. Playwright deferred until there is a trainer to drive (A8). |
| Data layer | In-memory only. Append-only `KeystrokeEvent[]` owned by a `capture/` module singleton, exposed read-only via `getEvents()`. `Exercise` in one React `useState`. `Session` is a plain value object. | D-02, D-13. Dexie / IndexedDB is Phase 4 (v2); the data model is built complete + append-only now so persistence is a non-breaking add. |
| Capture surface | A single focused **native `<textarea>`** — never `contenteditable`. Committed characters from `beforeinput` / `input`; `keydown` / `keyup` for timing only; **no blanket `preventDefault`** on `keydown`. | D-04, D-05. RESEARCH spike outcome: `contenteditable` injects markup and has inconsistent `inputType`. |
| Timestamp source | `event.timeStamp` (a `DOMHighResTimeStamp`, monotonic, same origin as `performance.now()`) read off the event object. Never a wall-clock or perf-counter call inside the handler. | D-07, PITFALLS #2. The historical Unix-epoch `timeStamp` behavior is gone in all 2026 target browsers. |
| Event shape (`KeystrokeEvent`) | `{ seq, type: 'keydown'\|'keyup', key, code, ctrl, alt, shift, meta, tMs, isRepeat }` — both `key` and `code` captured. | D-12 (reversibility: **costly** — every downstream metric consumes this shape; adding a field later is fine, changing/removing one is not). |
| Cross-origin isolation | COOP `same-origin` + COEP `require-corp` set in `vite.config.ts` on **both** `server.headers` AND `preview.headers` (not inherited). Runtime `crossOriginIsolated` verified at startup → `Session.crossOriginIsolated`; timer resolution probed → `Session.timingResolutionUs`. | D-15, D-16, PITFALLS #1. |
| Deployment target | Local `pnpm dev` / `pnpm preview` for v1. Production needs a static host that sends COOP/COEP on the HTML document — Cloudflare Pages / Netlify / Vercel via a `_headers` file. **GitHub Pages cannot** (needs the `coi-serviceworker` shim). | RESEARCH §Environment Availability. Documented in README (Plan 03). |
| Directory layout | `src/{ingestion,capture,platform,ui}/` + `src/session.ts` + `src/main.tsx`. `capture/` and `platform/` are the **only** DOM-coupled modules; everything downstream consumes `readonly KeystrokeEvent[]` / `Session` value objects and never touches the DOM. A future Tauri port rewrites only these two directories. | RESEARCH §Recommended Project Structure; ARCHITECTURE.md seam. |
| Normalizer | Pure `normalize(raw, { tabWidth }): string`, zero imports. Fixed transform order: strip BOM → CRLF/CR→LF → expand tabs (fixed width, default 4) → strip trailing ASCII whitespace per line → collapse to exactly one trailing `\n`. 18 golden Vitest cases. | D-08, D-09; RESEARCH §"Normalizer reference shape" (verbatim-ready). |
| Styling | Hand-rolled CSS custom properties on `:root` + one `@media (prefers-color-scheme: dark)` override. No component library, no third-party assets (COEP `require-corp`). System-monospace font stack. | 01-UI-SPEC.md §Design System. |

## Stack Touched in Phase 1

- [x] Project scaffold — Vite + React + TS strict, ESLint (Oxlint from template), Vitest with a `node` + `happy-dom` project split
- [x] Routing — single page, no router (one screen in v1)
- [x] "Data layer" — in-memory append-only `KeystrokeEvent[]` (one real write per keystroke) + `getEvents()` read; `Exercise` state write on Load; `Session` composition read
- [x] UI — paste box + **Load exercise** button wired to `normalize()` → `Exercise`; focused capture `<textarea>` wired to the capture module
- [x] Deployment — `pnpm dev` serving cross-origin-isolated, verified by `curl -I` (both COOP/COEP headers on the HTML doc) and by `crossOriginIsolated === true` in the running app

## Out of Scope (Deferred to Later Slices)

- **File upload** (`File.text()`, size cap, non-UTF-8 guard, extension→language map) — Plan 01-02
- **Full `beforeinput` character-stream semantics** (inputType mapping, IME composition, selective paste/drop cancel + inline flag, `blur`/`visibilitychange` markers) — Plan 01-03
- **Key-repeat hardening** beyond the basic `event.repeat` + per-`code` down-set filter — Plan 01-03
- **Banner logic polish** (degraded-timing gating, timer readout formatting, no-layout-shift stacking) and the **best-effort `getLayoutMap()` console warning** — the skeleton renders static banner shells; Plan 01-03 fills the behavior
- **CorpusInput states** (empty state, "Nothing to load yet", `Loading…`, last-wins concurrency) — Plan 01-02
- **README** production-host / privacy posture — Plan 01-03
- Session persistence (Phase 4), the trainer view / caret / per-char coloring / whitespace glyphs (Phase 2), metrics (Phase 3), non-US-ANSI layouts (out of scope), tree-sitter chunking (out of scope)

## Subsequent Slice Plan

- **Plan 01-02 (Corpus file upload):** `File.text()` → size + UTF-8 guards → typed errors → `Exercise{ sourceType:'upload' }`; wire the file control and all `CorpusInput` states.
- **Plan 01-03 (Full capture semantics + chrome + docs):** complete the `beforeinput`/composition/blur handling, key-repeat hardening, paste-block flag, banner behavior, and the README.
- **Phase 2 (Interactive Typing Trainer):** joins `KeystrokeEvent[]` with `Exercise.text` in a pure reducer — caret, per-char verdict, backspace, free-correction, visible whitespace, restart, honest timing.
- **Phase 3 (Session Metrics):** a pure fold over `Session` — net WPM, accuracy, five slowest keystrokes, golden-tested.
