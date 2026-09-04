# Phase 1: Corpus Input & Keystroke Capture - Research

**Researched:** 2026-09-04
**Domain:** Browser SPA scaffold (Vite 8 / React 19 / TS), high-resolution DOM keystroke capture, cross-origin isolation, text normalization
**Confidence:** HIGH on stack versions and browser-timing behavior; MEDIUM on the editable-surface spike and Vite dev-server header scope

## Summary

Phase 1 scaffolds a brand-new local-first browser SPA and stands up two independent pieces: (1) a corpus input pipeline (paste + file upload → pure normalizer → in-memory `Exercise`), and (2) an append-only high-resolution keystroke capture engine (`keydown`/`keyup` stamped from `event.timeStamp`, committed characters from `beforeinput`/`input`, OS key-repeat filtered, full raw `KeystrokeEvent[]` retained). The app is served cross-origin-isolated (COOP `same-origin` + COEP `require-corp`), verifies `crossOriginIsolated === true`, probes achieved timer resolution, and shows a static "US ANSI layout only" notice. There is no backend, no persistence, and no trainer rendering yet.

The load-bearing findings: **`server.headers` and `preview.headers` are separate Vite options and both must be set** for the walking-skeleton and dev server to be isolated; the production static host must send the same two headers on the HTML document (GitHub Pages cannot — Netlify/Vercel/Cloudflare Pages can, or use the `coi-serviceworker` shim). **`event.timeStamp` in all 2026 target browsers is a `DOMHighResTimeStamp` on the same monotonic clock/origin as `performance.now()`** — the historical Unix-epoch behavior that scared people off is gone; read it off the event, never call `performance.now()` in the handler. **The capture surface should be a single focused native `<textarea>`**, never `contenteditable`, never `preventDefault()` on `keydown`; the character stream comes from `beforeinput` `inputType`/`data` (+ `input` value diff as ground truth), timing comes from `keydown`/`keyup`, and the two are reconciled by sequence, not merged. **`navigator.keyboard.getLayoutMap()` is still Chromium-only in 2026** (Firefox and Safari refused it for fingerprinting) so the layout check must be best-effort and never block.

Two ecosystem surprises since the project-level research (Sept 2026): **TypeScript 7.0 (Go-native compiler) is now `latest` on npm but `typescript-eslint` and ESLint core do not support it yet** (no stable compiler API until TS 7.1) — pin `typescript@~5.9`. **Vitest 5.0.0 shipped 2026-09-03 (one day ago)** — pin `vitest@~4.1` for a stable greenfield.

**Primary recommendation:** Scaffold with `pnpm create vite` `react-ts` (Vite 8.2 + `@vitejs/plugin-react` 6 + React 19.2), add `typescript@~5.9` + `vitest@~4.1`, set both `server.headers` and `preview.headers` to the COOP/COEP pair in `vite.config.ts`, build a `capture/` module whose only job in the hot path is `buffer.push()` off `event.timeStamp`, a focused hidden `<textarea>` as the capture surface, and a pure `normalize()` function with golden-file tests. Lead the plan with a walking skeleton: scaffold → paste box that loads + normalizes text → hidden textarea capturing to an on-screen event count → deploy to a header-capable host and confirm `crossOriginIsolated === true`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Platform & Scaffold**
- **D-01:** Build v1 as a **local-first browser SPA — no backend**. Stack: Vite 8 + React 19 + TypeScript (strict, `noUncheckedIndexedAccess`), pnpm. Reversibility: costly — a later pivot to TUI/Tauri re-writes the capture layer and the host shell, though the metrics/state modules (pure TS) port unchanged; Tauri specifically is the planned v2 evolution path and reuses the React frontend.
- **D-02:** No persistence in this phase — the keystroke buffer and loaded exercise live in memory only. Dexie/IndexedDB is Phase 4 (v2).
- **D-03:** Testing: Vitest for unit tests (the normalizer in this phase); Playwright deferred until there is a trainer to drive.

**Character-Stream Capture Mechanism**
- **D-04:** Capture committed characters from `beforeinput` / `input` events on a focused editable surface (textarea or contenteditable); use `keydown`/`keyup` listeners **only** for timing. Do **not** blanket-`preventDefault` on keydown (breaks dead keys, IME, AltGr). Locked by CAPT-04, confirmed by PITFALLS.md #8. Reversibility: costly — the capture surface choice shapes the Phase 2 trainer rendering approach.
- **D-05:** The exact editable-surface choice (hidden textarea vs contenteditable vs visible input) and how caret control is retained is a **spike** for the research/planning step.
- **D-06:** Filter `event.repeat === true`; additionally track a per-`code` "currently down" set as a fallback guard against key-repeat leaking through (PITFALLS.md #3).
- **D-07:** Timestamp source is `event.timeStamp` read off the event object — never `performance.now()` inside the handler, never `Date.now()`. The keydown/keyup listener does nothing but push to the buffer (PITFALLS.md #2).

**Content & Normalizer Policy**
- **D-08:** Type the pasted/uploaded content **as-is** — comments, strings, and long literals all included. v1 does not parse or strip anything.
- **D-09:** Normalizer defaults (INPUT-03): CRLF → LF; tabs → spaces at a **configurable width defaulting to 4**; strip trailing whitespace per line; collapse to exactly one trailing newline; strip a leading BOM. The normalizer is a pure function with Vitest golden tests.
- **D-10:** Whitespace-visible rendering (glyphs for space/tab/newline) is a Phase 2 concern — the normalizer here just produces clean text; it does not render.

**Data Model**
- **D-11:** `Exercise { text: string; language: string; sourceType: 'paste' | 'upload'; sourceRef?: string }`. `language` is best-effort from the uploaded file extension (e.g. `.ts` → `typescript`), or `'plaintext'` for paste. Reversibility: reversible — in-memory shape, no stored contract yet.
- **D-12:** `KeystrokeEvent { seq: number; type: 'keydown' | 'keyup'; key: string; code: string; ctrl: boolean; alt: boolean; shift: boolean; meta: boolean; tMs: number; isRepeat: boolean }`. `tMs` = `event.timeStamp`. Both `key` and `code` are captured. Reversibility: costly — every downstream metric consumes this shape; adding a field later is fine, changing/removing one is not.
- **D-13:** The capture buffer is a plain append-only in-memory array owned by a `capture` module, exposed read-only. Downstream code consumes `KeystrokeEvent[]` and never touches the DOM.
- **D-14:** A `Session` wrapper holds `{ exercise, events, timingResolutionUs, crossOriginIsolated, startedAt }`.

**Cross-Origin Isolation & Layout Notice**
- **D-15:** Serve cross-origin-isolated: set `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` response headers in `vite.config.ts` (dev server) and document the production static-host requirement in the README (CAPT-05, PITFALLS.md #1).
- **D-16:** At startup, check `crossOriginIsolated === true`; probe and record the achieved timer resolution as `timingResolutionUs` on the session; if not isolated, show a visible warning banner (timing degraded) but do not block use.
- **D-17:** "US ANSI layout only" is a **static notice banner** in v1. Best-effort: attempt `navigator.keyboard.getLayoutMap()` and log a console warning if a clearly non-ANSI layout is detected — but never block.

### Claude's Discretion
- Component/file structure, module names, and where the capture listeners are attached (document vs surface) — planner's call, guided by ARCHITECTURE.md's "`capture/` is the only platform-coupled module" seam.
- Exact file-extension → language map contents.
- Dev tooling niceties (ESLint/Prettier config, CI) — include if cheap.

### Deferred Ideas (OUT OF SCOPE)
- Session persistence (Dexie/IndexedDB) — Phase 4 / v2.
- Language auto-detection beyond file extension (content sniffing, tree-sitter) — later.
- Repo / docs / shell-history source adapters — v2 milestone (needs Tauri).
- Syntactic chunking (tree-sitter) — out of scope.
- Whitespace glyph rendering, caret, per-char coloring — Phase 2.
- Non-US-ANSI layout support — out of scope; static notice only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INPUT-01 | User can paste text into the app to use as the typing exercise source | React controlled `<textarea>` / paste box → string → `normalize()` → `Exercise{sourceType:'paste', language:'plaintext'}`. No backend. See "Corpus input" pattern. |
| INPUT-02 | User can upload a local file to use as the exercise source | Browser File API: `<input type="file">` → `File.text()` (UTF-8) → `normalize()` → `Exercise{sourceType:'upload', sourceRef:file.name, language:extToLang(file.name)}`. No `FileReader` needed. Size cap + non-UTF-8 guard (Pitfalls 11, 13). |
| INPUT-03 | Content normalized (CRLF→LF, configurable tab width, trailing whitespace stripped, single trailing newline) + normalizer unit-tested | Pure `normalize(raw, {tabWidth})` function; transform order and 18 golden-test cases in "Normalizer" section. Vitest `environment: 'node'`. |
| CAPT-01 | Capture keydown+keyup for the whole session, stamped from `event.timeStamp`, listener does nothing but append to a buffer | `capture/` module; `window`/textarea listener pushes `KeystrokeEvent` to a ref-held array; `tMs = event.timeStamp` (DOMHighResTimeStamp, monotonic, same origin as `performance.now()`). No setState in hot path. |
| CAPT-02 | Ignore OS key-repeat (`event.repeat`) so a held key ≠ multiple keystrokes | Filter `event.repeat === true`; fallback per-`code` currently-down `Set` (D-06); clear the set on `blur`/`visibilitychange` to avoid stuck keys. |
| CAPT-03 | Full raw keystroke log (seq, key, code, modifiers, timestamp, isRepeat) retained as single source of truth | `KeystrokeEvent[]` append-only array (D-12 shape, verbatim below); `Session.events` (D-14); event-sourcing pattern from ARCHITECTURE.md — never discard, metrics derive later. |
| CAPT-04 | Capture committed characters via `input`/`beforeinput` (no blanket `preventDefault` on keydown) + "US ANSI layout only" notice | `beforeinput` `inputType`/`data` mapping table; selective `preventDefault` on `beforeinput` for `insertFromPaste` only; static notice banner + best-effort `navigator.keyboard.getLayoutMap()` (Chromium-only). |
| CAPT-05 | Served cross-origin-isolated (COOP/COEP), verifies `crossOriginIsolated === true`, records achieved timer resolution with the session | `server.headers` + `preview.headers` in `vite.config.ts`; runtime `crossOriginIsolated` check → `Session.crossOriginIsolated`; timer-resolution probe → `Session.timingResolutionUs`; production host header requirement documented in README. |
</phase_requirements>

## Architectural Responsibility Map

Single-tier browser SPA (no backend), but capabilities still map to distinct owners:

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Paste input | Browser/Client — React state | — | No server; a string in memory |
| File upload read | Browser/Client — `File.text()` | — | File API decodes to UTF-8 in-process; no `FileReader`, no upload |
| Normalization | Browser/Client — pure TS module (`ingestion/normalize.ts`) | — | Pure `(string, opts) => string`; unit-tested; no I/O |
| Keystroke capture | Browser/Client — DOM event listeners (`capture/`) | — | The **only** platform-coupled module (ARCHITECTURE.md seam); everything downstream consumes `KeystrokeEvent[]` |
| Cross-origin isolation | Dev server config (`server.headers`) + **static host** (HTTP response headers on the HTML doc) | `coi-serviceworker` shim | COOP/COEP must be on the top-level document response; a header-less host (GitHub Pages) needs the SW workaround |
| `crossOriginIsolated` verification | Browser/Client — runtime global | — | One boolean read at startup → `Session.crossOriginIsolated` |
| Timer-resolution probe | Browser/Client — runtime measurement | — | Measured at startup, stored on `Session.timingResolutionUs` |
| "US ANSI only" notice | Browser/Client — static UI + best-effort `navigator.keyboard` | — | `getLayoutMap()` is Chromium-only; must degrade to a static banner |

**Tier-assignment sanity checks for the planner:**
- Normalization and the file-extension→language map are pure client logic — no build step, no server, no WASM.
- The COOP/COEP headers are a *deployment/infrastructure* task, not application code. The plan must include (a) `vite.config.ts` headers, (b) a documented production-host requirement, and (c) a runtime check. Do not conflate them.
- Nothing in this phase touches a network endpoint. Any task that adds `fetch`/analytics/telemetry is out of scope and a privacy regression (see Security Domain).

## Standard Stack

### Core

| Library | Version (verified 2026-09-04) | Purpose | Why Standard |
|---------|------------------------------|---------|--------------|
| `vite` | `^8.2.2` | Dev server + build (Rolldown-powered in v8) | Current major; `npm view vite version` → `8.2.2` `[VERIFIED: npm registry]`. Vite 8 GA ~March 2026, Rust `rolldown` replaces esbuild+Rollup — transparent for an app this size `[CITED: vite.dev/blog/announcing-vite8]` |
| `@vitejs/plugin-react` | `^6.1.1` | React Fast Refresh / JSX transform | `npm view` → `6.1.1`, peer `vite: ^8.0.0` `[VERIFIED: npm registry]`. v6 dropped Babel, uses Oxc `[CITED: vitejs/vite-plugin-react CHANGELOG]`. The v5 plugin line targets Vite ≤7 — do not use it |
| `react` / `react-dom` | `^19.2.8` | UI runtime | `npm view react version` → `19.2.8` `[VERIFIED: npm registry]`. React 19.2 current stable line `[CITED: react.dev/versions]` |
| `@types/react` | `^19.2.18` | React types | `npm view @types/react version` → `19.2.18` `[VERIFIED: npm registry]` |
| `@types/react-dom` | `^19.2.7` | ReactDOM types | `npm view @types/react-dom version` → `19.2.7` `[VERIFIED: npm registry]` |
| `typescript` | `~5.9.3` **(NOT 7.x)** | Language + `tsc --noEmit` typecheck | `npm view typescript version` → `7.0.2` is `latest`, but `5.9.3` is the newest 5.x `[VERIFIED: npm registry dist-tags]`. **TS 7.0 (Go-native) has no stable compiler API until 7.1; `typescript-eslint` and ESLint core do not support it yet** `[CITED: github.com/typescript-eslint/typescript-eslint/issues/12518; theregister.com/2026/07/09]`. Pin `~5.9` for a project that will use ESLint |
| `@types/node` | `^26.4.1` (`ts5.9` tag also → `26.4.1`) | Node types for `vite.config.ts` | `npm view @types/node dist-tags` `[VERIFIED: npm registry]` |
| `pnpm` | `11.x` (11.5.3 present locally) | Package manager (D-01) | Installed in this environment `[VERIFIED: pnpm --version → 11.5.3]`. Project research assumed 10.x — 11.x is fine, use `packageManager` field |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | `~4.1.11` **(NOT 5.0.0)** | Unit tests for the normalizer (D-03) | `npm view vitest` → `latest` is `5.0.0` published **2026-09-03** (one day old); `4.1.11` is the mature line, peer `vite ^6\|^7\|^8`, Node `^20\|^22\|>=24` `[VERIFIED: npm registry]`. Vitest 5 also raises the Node floor to `^22.12`. Pin `~4.1` |
| `@vitest/ui` | matches vitest (`~4.1.11`) | Optional local test UI | Nice-to-have; D-discretion |
| `happy-dom` | `^20.14.0` | DOM env for `beforeinput`/capture-layer tests | `npm view happy-dom version` → `20.14.0` `[VERIFIED: npm registry]`. Lighter than jsdom; use only for the capture module's tests. The normalizer needs no DOM (`environment: 'node'`) |
| `jsdom` | `^30.0.1` | Alternative DOM env | `npm view jsdom version` → `30.0.1` `[VERIFIED: npm registry]`. Use if happy-dom's `InputEvent`/`getTargetRanges` support proves incomplete |
| `zustand` | `^5.0.15` | Global UI state (idle/loaded) | `npm view zustand version` → `5.0.15` `[VERIFIED: npm registry]`. **Likely unnecessary in Phase 1** — a module singleton + `useSyncExternalStore` for the capture buffer, and one `useState` for the loaded `Exercise`, is enough. Add only if the component tree genuinely needs shared state |
| `coi-serviceworker` | `^0.1.7` | Cross-origin-isolation shim for header-less static hosts | `npm view coi-serviceworker version` → `0.1.7` `[VERIFIED: npm registry]`. Only if the deploy target (e.g. GitHub Pages) cannot send COOP/COEP. Adds a service worker — accept the extra moving part or pick a header-capable host |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `typescript@~5.9` | `typescript@7.0.2` | 8–12x faster typecheck, but breaks `typescript-eslint`/ESLint until TS 7.1; Microsoft ships `@typescript/typescript6` as a bridge. Not worth it for a small greenfield that wants lint. Revisit when 7.1 + typescript-eslint land |
| `typescript@~5.9` | `typescript@6.0.0-beta` | 6.0 is the transitional last JS-compiler release; still beta as of 2026-09 `[VERIFIED: npm dist-tags → beta: 6.0.0-beta]`. Stay on stable 5.9 |
| `vitest@~4.1` | `vitest@5.0.0` | One day old at research time; ecosystem plugins (`@vitest/coverage-v8` etc.) pin exact-match versions and may lag. Adopt after a few weeks |
| `@vitejs/plugin-react` | `@vitejs/plugin-react-swc` | SWC variant; now redundant since v6 uses Oxc. `@vitejs/plugin-react-oxc` is deprecated (folded into `plugin-react` 6) `[CITED: vitejs/vite-plugin-react CHANGELOG]`. Use the standard plugin |
| native `<textarea>` capture surface | `contenteditable` div | contenteditable injects `<div>`/`<br>`/`&nbsp;`, `inputType` is less consistent (`insertParagraph` vs `insertLineBreak`), selection + paste handling is far harder. Rejected — see spike below |
| `File.text()` | `FileReader` + encoding sniffing | `File.text()` is the modern promise-based API, always UTF-8; sniffing arbitrary encodings is out of scope (D-08 "as-is", US-ANSI focus) |
| `zustand` | module singleton + `useSyncExternalStore` | For a 1–2 screen app the singleton is less indirection and keeps the capture buffer off React's render path by construction |

**Installation:**
```bash
# Scaffold (greenfield: repo currently holds only .planning/ and keebdrill.md)
pnpm create vite@latest keebdrill-app --template react-ts   # scaffold in a temp name
# then move src/, index.html, vite.config.ts, tsconfig*.json, package.json,
# .gitignore, public/ into the repo root, preserving .planning/ and keebdrill.md
#   (alternative: `pnpm create vite . --template react-ts` and accept the
#    "directory not empty" prompt to merge — verify it does not clobber .planning/)

pnpm install
pnpm add react@^19.2 react-dom@^19.2
pnpm add -D vite@^8.2 @vitejs/plugin-react@^6.1 typescript@~5.9 \
  @types/react@^19.2 @types/react-dom@^19.2 @types/node@^26 \
  vitest@~4.1 @vitest/ui@~4.1 happy-dom@^20
# optional (add only if needed):
pnpm add zustand@^5
```
> `pnpm create vite` passes flags without the `--` separator that `npm` needs. The `react-ts` template pulls Vite 8 + `@vitejs/plugin-react` 6 + React 19.2 + an Oxlint config; it does **not** include Vitest — add it manually. `[VERIFIED: npm — create-vite 9.2.0; template contents CITED: github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts]`

**Version verification performed this session** (`npm view <pkg> version` / `dist-tags`, 2026-09-04):
`vite 8.2.2` · `@vitejs/plugin-react 6.1.1` · `react / react-dom 19.2.8` · `@types/react 19.2.18` · `@types/react-dom 19.2.7` · `typescript 7.0.2 latest / 5.9.3 newest-5.x` · `@types/node 26.4.1` · `vitest 5.0.0 latest / 4.1.11 newest-4.x` · `happy-dom 20.14.0` · `jsdom 30.0.1` · `zustand 5.0.15` · `create-vite 9.2.0` · `coi-serviceworker 0.1.7`.

## Package Legitimacy Audit

Ran `gsd-tools query package-legitimacy check --ecosystem npm …` this session.

| Package | Registry | Latest publish | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|----------------|-----------|-------------|---------|-------------|
| `react` | npm | 2026-07-21 | 172M/wk | github.com/facebook/react | OK | Approved |
| `react-dom` | npm | 2026-07-21 | 161M/wk | github.com/facebook/react | OK | Approved |
| `typescript` | npm | 2026-07-08 | 273M/wk | github.com/microsoft/TypeScript | OK | Approved (pin `~5.9`, see stack table) |
| `@types/react` | npm | 2026-07-30 | 157M/wk | DefinitelyTyped | OK | Approved |
| `vite` | npm | 2026-08-20 | 176M/wk | github.com/vitejs/vite | SUS → OK | Approved — "too-new" is a **release-cadence false positive** (Vite publishes patches every ~2 wks); 176M downloads/wk, canonical repo |
| `@vitejs/plugin-react` | npm | 2026-08-28 | 84M/wk | github.com/vitejs/vite-plugin-react | SUS → OK | Approved — same false positive |
| `vitest` | npm | 2026-09-03 | 100M/wk | github.com/vitest-dev/vitest | SUS → OK | Approved — flagged because `5.0.0` shipped 1 day ago; **mitigation: pin `~4.1.11`, not latest** |
| `@types/react-dom` | npm | 2026-09-03 | 131M/wk | DefinitelyTyped | SUS → OK | Approved — DefinitelyTyped publishes constantly; recency false positive |
| `zustand` | npm | 2026-08-13 | 54M/wk | github.com/pmndrs/zustand | SUS → OK | Approved — recency false positive; optional dependency anyway |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `vite`, `@vitejs/plugin-react`, `vitest`, `@types/react-dom`, `zustand` — all are release-recency false positives (the heuristic keys on *latest version* age, not package age; every one has a verified canonical GitHub repo, 50M+ weekly downloads, no `postinstall`, and appears in official Vite/React documentation). **No `checkpoint:human-verify` needed.** The one real risk — Vitest 5.0.0 being a day old — is handled by pinning `vitest@~4.1`.

`happy-dom`, `jsdom`, `@types/node`, `coi-serviceworker`, `@vitest/ui` verified via `npm view` only (not re-run through the legitimacy seam); all are long-established, widely-used packages with canonical repos.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
  PASTE ─── string ──────▶│  ingestion/                                  │
                          │   paste.ts   :  string          ──┐         │
  UPLOAD ── File ────────▶│   upload.ts  :  File.text()  ─────┤         │
   (File API, UTF-8)      │                 + extToLang(name) │         │
                          │                                   ▼         │
                          │   normalize.ts (PURE)                       │
                          │     1 strip BOM → 2 CRLF/CR→LF →            │
                          │     3 expand tabs → 4 strip trailing ws →   │
                          │     5 exactly one trailing "\n"             │
                          └───────────────────┬─────────────────────────┘
                                              ▼
                                  Exercise { text, language,
                                             sourceType, sourceRef? }   (in memory, D-11)
                                              │
                                              ▼
   ┌───────────────────────────────┐   renders raw text (walking skeleton)
   │  ui/  App                     │───────────────────────────────────────▶ (Phase 2 trainer)
   │   - paste box / file input    │
   │   - <textarea> capture surface│◀── focus ── user types
   │   - COOP/COEP banner          │
   │   - "US ANSI only" banner     │
   └──────────────┬────────────────┘
                  │  attaches listeners
                  ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │  capture/  (ONLY platform-coupled module — D-13)                      │
   │                                                                      │
   │  keydown / keyup ──▶ HOT PATH: push KeystrokeEvent to ref array      │
   │    tMs = event.timeStamp   (DOMHighResTimeStamp, monotonic)          │
   │    filter event.repeat===true  +  per-code downSet fallback (D-06)   │
   │    NOTHING ELSE in the handler (no setState, no metrics)             │
   │                                                                      │
   │  beforeinput / input ──▶ character stream:                           │
   │    inputType + data → committed chars / deletions / paste            │
   │    selective preventDefault on beforeinput for insertFromPaste only  │
   │    compositionstart/end → suspend char attribution (IME)             │
   │                                                                      │
   │  blur / visibilitychange ──▶ clear downSet; record marker           │
   │                                                                      │
   │  exposes:  getEvents(): readonly KeystrokeEvent[]   (D-13)           │
   └──────────────┬───────────────────────────────────────────────────────┘
                  ▼
        Session { exercise, events, timingResolutionUs,
                  crossOriginIsolated, startedAt }   (D-14, in memory)
                  ▲
                  │ startup
   ┌──────────────┴───────────────┐
   │  platform/                   │
   │   crossOriginIsolated global │──▶ Session.crossOriginIsolated (D-16)
   │   timer-resolution probe     │──▶ Session.timingResolutionUs   (D-16)
   │   navigator.keyboard best-   │──▶ console.warn only            (D-17)
   │     effort layout check      │
   └──────────────────────────────┘
```

Trace of the primary use case: user pastes code → `paste.ts` hands the string to `normalize.ts` → normalized text becomes `Exercise.text` → `App` renders it and focuses the hidden `<textarea>` → user types → `capture/` appends `keydown`/`keyup` events (timing) and reads `beforeinput` (characters) → both land in `Session.events`, the append-only source of truth Phase 3 will fold over.

### Recommended Project Structure

```
src/
├── ingestion/
│   ├── types.ts          # Exercise, SourceType
│   ├── normalize.ts      # PURE normalize(raw, {tabWidth}): string
│   ├── normalize.test.ts # golden-file cases (Vitest, environment: 'node')
│   ├── paste.ts          # string -> Exercise
│   ├── upload.ts         # File -> Promise<Exercise>  (File.text())
│   └── language-map.ts   # extToLang('.ts') -> 'typescript'  (D-discretion)
├── capture/
│   ├── types.ts          # KeystrokeEvent (D-12 shape), Session (D-14)
│   ├── capture.ts        # listener wiring, downSet, ref buffer, getEvents()
│   ├── use-capture.ts    # React hook: attach/detach, useSyncExternalStore
│   └── capture.test.ts   # held-key, repeat, first-keystroke (happy-dom)
├── platform/
│   ├── isolation.ts      # readCrossOriginIsolated(), probeTimerResolutionUs()
│   └── layout.ts         # best-effort getLayoutMap() check -> console.warn
├── ui/
│   ├── App.tsx
│   ├── CorpusInput.tsx   # paste box + file input
│   ├── CaptureSurface.tsx# the focused hidden <textarea>
│   └── Banners.tsx       # COOP/COEP + US-ANSI notices
├── session.ts            # builds the in-memory Session (composition)
└── main.tsx
vite.config.ts            # plugins + server.headers + preview.headers + test
```

Rationale: mirrors ARCHITECTURE.md's stack-agnostic layout, keeps `capture/` as the sole DOM-coupled seam, and keeps `normalize.ts` a pure leaf with zero imports so its golden tests stay trivial.

### Pattern 1: Hot-path handler does exactly one thing

**What:** The `keydown`/`keyup` listener constructs a `KeystrokeEvent` and pushes it to a plain array held in a `useRef` (or module singleton). No React state update, no metric math, no DOM read.
**When to use:** Always, for timing-critical capture.
**Example:**
```typescript
// capture/capture.ts   Source pattern: PITFALLS.md #2, ARCHITECTURE.md Anti-Pattern 1
const buffer: KeystrokeEvent[] = [];
const downCodes = new Set<string>();
let seq = 0;

function onKey(e: KeyboardEvent, type: 'keydown' | 'keyup') {
  if (!e.isTrusted) return;                         // reject synthetic/extension events
  const isRepeat = e.repeat || (type === 'keydown' && downCodes.has(e.code));
  if (type === 'keydown') downCodes.add(e.code);
  else downCodes.delete(e.code);
  buffer.push({
    seq: seq++,
    type,
    key: e.key,
    code: e.code,
    ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey,
    tMs: e.timeStamp,                               // D-07: off the event, never performance.now()
    isRepeat,
  });
  // nothing else
}
```
> Every field name and literal above is quoted verbatim from CONTEXT.md D-12: `{ seq: number; type: 'keydown' | 'keyup'; key: string; code: string; ctrl: boolean; alt: boolean; shift: boolean; meta: boolean; tMs: number; isRepeat: boolean }` and "`tMs` = `event.timeStamp`". `isTrusted` and the `downCodes` fallback are additions the planner may fold in (D-12 allows adding fields).

### Pattern 2: Character stream from `beforeinput`, timing from `keydown` — reconciled by sequence, not merged

**What:** Two parallel logs. `keydown`/`keyup` → `KeystrokeEvent[]` (timing). `beforeinput`/`input` → a committed-character log (what text actually changed). Phase 2's state machine joins them; Phase 1 only has to record both cleanly.
**When to use:** Any editable surface where dead keys / IME / AltGr / autocomplete must survive (D-04, Pitfall 7).
**Example:**
```typescript
// capture/capture.ts  — beforeinput handler
function onBeforeInput(e: InputEvent) {
  if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') {
    e.preventDefault();            // SELECTIVE cancel — safe on beforeinput, unlike keydown
    recordPasteBlocked(e);
    return;
  }
  charLog.push({ seq: seq++, inputType: e.inputType, data: e.data, tMs: e.timeStamp });
}
// 'input' fires after the DOM changed — read textarea.value as the authoritative result
function onInput() { reconcile(textareaRef.current!.value); }
```

`inputType` → meaning (textarea surface):

| `inputType` | Means | Phase 1 handling |
|-------------|-------|------------------|
| `insertText` | Typed plain text; `data` = the char(s) (usually 1, can be many via autocomplete) | Record `data` as committed chars |
| `insertLineBreak` | Enter in a `<textarea>` (contenteditable would be `insertParagraph`) | Record as `\n` |
| `insertFromComposition` / after `compositionend` | IME-committed string | Record `compositionend.data`; suspend per-char attribution during composition |
| `insertReplacementText` | Autocorrect / spellcheck swap | Record; `getTargetRanges()` gives the replaced span |
| `deleteContentBackward` | Backspace (1 char or a selection) | Record deletion |
| `deleteWordBackward` / `deleteContentForward` / `deleteHardLineBackward` | Ctrl/Alt+Backspace, Delete, etc. | Record deletion; Firefox historically skipped `beforeinput` for some of these — use `input` + value diff as ground truth |
| `insertFromPaste` / `insertFromDrop` | Paste / drag-drop | `preventDefault()` + flag (CAPT-04, and TYPE-06 later) |
| `historyUndo` / `historyRedo` | Ctrl+Z / Ctrl+Y | Decide policy in Phase 2; Phase 1 record only |

`beforeinput` is supported in all 2026 target browsers (Firefox shipped full support in v87). `[CITED: MDN InputEvent/inputType, w3.org/TR/input-events-1]`

### Pattern 3: Cross-origin isolation set in two places + verified at runtime

**What:** `server.headers` (dev) and `preview.headers` (`pnpm preview` + the walking-skeleton deploy) are **independent** Vite options — setting only one leaves the other context non-isolated. The production static host must also send the headers on the HTML document response. The app reads `crossOriginIsolated` at startup and never trusts config alone.
**Example:**
```typescript
// vite.config.ts       Source: vite.dev/config/server-options + preview-options
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
} as const;

export default defineConfig({
  plugins: [react()],
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },   // NOT inherited from server.headers
  test: {
    projects: [
      { test: { name: 'unit', environment: 'node', include: ['src/**/*.test.ts'] } },
      { test: { name: 'dom', environment: 'happy-dom', include: ['src/capture/**/*.test.ts'] } },
    ],
  },
});
```
```typescript
// platform/isolation.ts
export const readCrossOriginIsolated = (): boolean => self.crossOriginIsolated === true;

// Probe achieved resolution: histogram the smallest non-zero gap between
// consecutive real keydown event.timeStamp values over the first N keystrokes,
// AND record the per-browser expectation keyed on crossOriginIsolated.
// (A tight performance.now() loop measures call overhead, not stamp granularity.)
```
> Header **values** `same-origin` and `require-corp` are quoted verbatim from CONTEXT.md D-15. `preview.headers` existence `[VERIFIED: vite.dev/config/preview-options — "preview.headers … Type: OutgoingHttpHeaders"]`; it has no documented default to `server.headers`.

### Anti-Patterns to Avoid

- **`preventDefault()` on `keydown`** to control the textarea → kills dead keys, IME composition, AltGr symbols (`{ } [ ]` on LATAM/EU layouts). Only ever cancel `beforeinput` selectively (paste/drop). `[PITFALLS.md #8, D-04]`
- **Reading `event.key` in `keydown` to build the typed string** → wrong for dead keys, AltGr, IME, autocomplete. The character stream is `beforeinput.data` + `input` value diff. `[Pitfall 7]`
- **`performance.now()` or `Date.now()` for the timestamp** → measures handler scheduling / wall-clock jumps. Use `event.timeStamp`. `[D-07, PITFALLS.md #2]`
- **`setState` per keystroke** (e.g. binding `textarea.value` to React state, or a live event counter) → the re-render jitters the *next* measurement. Keep the buffer in a ref; surface counts via `useSyncExternalStore` throttled, or only on demand. `[PITFALLS.md #2, Performance Traps]`
- **Keeping the raw `KeystrokeEvent[]` in React state** → GC pauses masquerade as slow digraphs. Ref / plain array. `[Performance Traps]`
- **`contenteditable` as the capture surface** → injected markup, inconsistent `inputType`, selection/paste pain. Use `<textarea>`. `[D-05 spike outcome]`
- **Normalizing only for display while capturing/targeting the raw string** → every whitespace comparison downstream fails. The normalized text *is* `Exercise.text`; nothing downstream sees the raw input. `[Pitfall 6]`
- **Only `server.headers`, forgetting `preview.headers`** → the walking-skeleton deploy and `pnpm preview` are not isolated; `crossOriginIsolated` is silently `false`.
- **Blanket-`preventDefault` on paste via the `paste` event on `window`** → also blocks paste into the corpus-input box, which is INPUT-01. Scope paste-blocking to the capture `<textarea>`'s `beforeinput`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Editable surface: caret, selection, multi-line, IME, dead keys, mobile keyboard | `contenteditable` + manual caret/selection management | native `<textarea>` | Decades of browser edge cases; `contenteditable` re-introduces all of them plus markup injection |
| Typed-character stream | Reconstruct text from `keydown` + modifier state | `beforeinput`/`input` `inputType` + `data` (+ `getTargetRanges()`) | Dead keys, AltGr, IME, autocomplete, drag-drop, undo — not reconstructable from key events |
| Keystroke clock | `Date.now()` / `performance.now()` in the handler / a custom RAF timer | `event.timeStamp` (already a monotonic `DOMHighResTimeStamp`) | Stamped at event creation, before your JS is scheduled |
| Key-repeat detection | Time-threshold debounce (as a TUI would) | `event.repeat` + per-`code` `Set` fallback | A time threshold drops legitimately fast digraphs; `.repeat` is reliable on modern browsers for physical keyboards |
| File decoding | `FileReader` + charset sniffing | `File.text()` (UTF-8) + explicit BOM strip in `normalize()` | Covers essentially every dev source file; non-UTF-8 is out of scope (D-08, US-ANSI focus) |
| Cross-origin-isolation detection | Parse response headers in JS | `self.crossOriginIsolated` global boolean | The browser already computed it |
| Keyboard layout detection | Scancode / physical-key tables | `navigator.keyboard.getLayoutMap()` — **best-effort, Chromium-only** | Firefox & Safari refuse it (fingerprinting); must degrade to the static banner |
| Line-ending / trailing-ws transforms | A character-by-character state machine | Documented `String.prototype.replace` with the regexes below | It genuinely is a handful of regexes — but tab expansion needs column tracking (see below) |

**Key insight:** The capture layer's correctness comes almost entirely from *using the right browser primitive* (`event.timeStamp`, `beforeinput`, `<textarea>`, `crossOriginIsolated`) rather than from clever code. The one place you write real logic is the pure normalizer, and there the risk is transform *ordering* and tab-stop math, not volume of code.

## Common Pitfalls

### Pitfall 1: `server.headers` set but `crossOriginIsolated` still `false`

**What goes wrong:** COOP/COEP present on module responses but not the top-level HTML document (misconfigured host, or `preview.headers` not set), so `crossOriginIsolated` is `false` and timers stay clamped at ~100µs (Chromium) / ~1ms (Firefox).
**Why it happens:** Historically Vite's dev `server.headers` only applied to served modules, not the HTML entry; and `preview` is a separate server with its own `headers` option. Production hosts need explicit header config.
**How to avoid:** Set both `server.headers` and `preview.headers`. Add a runtime assert (`readCrossOriginIsolated()`), surface the degraded banner (D-16). In CI / the walking-skeleton smoke test, `curl -I` the deployed URL and assert both headers on the `text/html` response.
**Warning signs:** `window.crossOriginIsolated === false`; `SharedArrayBuffer` undefined; timer deltas quantized to 100µs / 1ms.
**Confidence:** MEDIUM — modern Vite is widely reported to apply `server.headers` to the document, but the docs do not state it explicitly; verify empirically during the walking skeleton. `[ASSUMED — A1]`

### Pitfall 2: First keystroke lost or mistimed

**What goes wrong:** Listeners attached in a `useEffect` that runs after the textarea is already focusable/focused; the first `keydown` is missed or its `flightMs` baseline is wrong.
**Why it happens:** Effect ordering; focusing the surface before wiring listeners.
**How to avoid:** Attach `keydown`/`keyup` on `window` (or the surface) in a `useLayoutEffect`/mount that runs before the surface can receive focus; only `.focus()` the textarea after listeners are live. Test: first event has a plausible `tMs` and the count matches keys pressed.
**Warning signs:** First char of every session has ~0 latency, or event count is one short.

### Pitfall 3: Held key leaks past `event.repeat`

**What goes wrong:** A `keydown` stream with no `.repeat` flag (some WebViews, RDP, remote desktop, synthetic input) inflates the log with ~30–60ms fake digraphs.
**How to avoid:** `isRepeat = e.repeat || downCodes.has(e.code)` on `keydown` (D-06). **Clear `downCodes` on `blur` and `visibilitychange`** — otherwise an alt-tab mid-hold leaves a code stuck "down" forever and the next real press of that key is wrongly dropped.
**Warning signs:** Secondary latency mode at ~30–60ms; a key that "stops registering" after alt-tab.

### Pitfall 4: Normalizer transform-order bugs

**What goes wrong:** Stripping trailing whitespace *before* CRLF→LF leaves `\r` at line ends; expanding tabs *after* stripping trailing whitespace misplaces alignment; BOM stripped after other ops if the BOM shifted.
**How to avoid:** Fixed order — (1) strip BOM, (2) `\r\n?` → `\n`, (3) expand tabs per line with column tracking, (4) strip trailing `[ \t]+` per line, (5) collapse `\n+$` → exactly one `\n`. Golden tests lock the order.
**Warning signs:** Phantom errors at line ends only on Windows-pasted or tab-indented files.

### Pitfall 5: Tab expansion ignores column position

**What goes wrong:** Replacing every `\t` with `' '.repeat(tabWidth)` is *not* how editors render tabs — a tab advances to the next multiple of `tabWidth`, so `x\ty` with width 4 is `x   y` (3 spaces), not `x    y`.
**How to avoid:** Decide explicitly. **Recommended for v1: fixed-width replacement** (`\t` → `tabWidth` spaces) for predictability — a typing trainer wants the user to type a known number of spaces, and D-09 says "tabs → spaces at a configurable width". Document the choice. If you instead do proper elastic tab stops, reset the column counter at every `\n`. `[ASSUMED — A3]`
**Warning signs:** Indentation in the rendered exercise looks ragged vs the source editor.

### Pitfall 6: Huge paste / upload freezes the tab

**What goes wrong:** A 5 MB file pasted → synchronous `normalize()` + a giant React text node → multi-second main-thread block; also a DoS vector.
**How to avoid:** Cap input size (recommend ~100 KB / ~2,000 lines) with a friendly message; for anything near the cap, run `normalize()` off a `requestIdleCallback` or a worker. `[ASSUMED — A5: no requirement specifies a cap]`
**Warning signs:** Beachball on paste of a large file.

### Pitfall 7: Non-UTF-8 upload → mojibake

**What goes wrong:** `File.text()` always decodes as UTF-8; a UTF-16 or Latin-1 file yields `�` replacement characters, and the user types against garbage.
**How to avoid:** After `File.text()`, scan for U+FFFD (or a leading UTF-16 BOM `0xFF 0xFE` / `0xFE 0xFF`) and show "This file isn't UTF-8 — not supported." `[ASSUMED — A6]`
**Warning signs:** `�` in the loaded exercise.

### Pitfall 8: Layout check blocks or throws

**What goes wrong:** `navigator.keyboard` is `undefined` in Firefox/Safari; `getLayoutMap()` returns a promise that must be awaited; treating a non-ANSI result as fatal breaks US users on secondary layouts.
**How to avoid:** `navigator.keyboard?.getLayoutMap?.()` guarded, `await` in a `try/catch`, `console.warn` only, never gate the UI (D-17). The banner is static regardless.
**Warning signs:** `TypeError: navigator.keyboard is undefined`; UI blocked on a non-US layout.

### Pitfall 9: `input`/`beforeinput` and `keydown` logs drift

**What goes wrong:** Trying to merge the character stream and the timing stream into one array in Phase 1 — they don't 1:1 correspond (a dead-key sequence is 2 keydowns → 1 `insertText`; IME is many keydowns → 1 `insertFromComposition`; `Shift` is a keydown with no input event).
**How to avoid:** Keep them as two logs keyed by `seq`/`tMs`. The Phase 2 state machine reconciles. Phase 1's job is clean, complete, separate capture. `[ARCHITECTURE.md — "reconciled", not merged]`

### Pitfall 10: Scaffolding clobbers `.planning/`

**What goes wrong:** `pnpm create vite .` in the repo root over `.planning/` and `keebdrill.md`.
**How to avoid:** Scaffold into a temp directory and copy the generated files in, or use the "merge into non-empty dir" prompt and diff before committing. Confirm `.planning/` and `keebdrill.md` are untouched. `git status` before the first commit.

## Common Operations / Code Examples

### Normalizer reference shape

```typescript
// ingestion/normalize.ts   — PURE, zero imports.  Transform order is load-bearing.
export interface NormalizeOptions { tabWidth: number }   // default 4 (D-09)

export function normalize(raw: string, opts: NormalizeOptions = { tabWidth: 4 }): string {
  // 1. Strip a single leading BOM (U+FEFF), only at position 0
  let s = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;

  // 2. CRLF and lone CR -> LF
  s = s.replace(/\r\n?/g, '\n');

  // 3. Expand tabs (v1: fixed width — see Pitfall 5 / assumption A3)
  const tab = ' '.repeat(Math.max(1, opts.tabWidth));
  s = s.replace(/\t/g, tab);

  // 4. Strip trailing whitespace per line
  s = s.replace(/[ \t]+$/gm, '');

  // 5. Exactly one trailing newline (empty input stays empty)
  s = s.replace(/\n+$/g, '');
  return s.length === 0 ? '' : s + '\n';
}
```

### Golden-test cases (Vitest, `environment: 'node'`) — INPUT-03

| # | Input (escaped) | Expected | Locks |
|---|-----------------|----------|-------|
| 1 | `"a\r\nb\r\n"` | `"a\nb\n"` | CRLF → LF |
| 2 | `"a\rb"` | `"a\nb\n"` | lone CR (old Mac) |
| 3 | `"a\r\nb\nc"` | `"a\nb\nc\n"` | mixed endings |
| 4 | `"<BOM>hello"` | `"hello\n"` | BOM strip |
| 5 | `"<BOM>a\r\nb"` | `"a\nb\n"` | BOM + CRLF |
| 6 | `"\tx"` (width 4) | `"    x\n"` | leading tab indent |
| 7 | `"a\tb"` (width 4) | `"a    b\n"` | mid-line tab (documents fixed-width choice) |
| 8 | `"\tx"` (width 2) | `"  x\n"` | configurable width |
| 9 | `"x   \ny\t\n"` | `"x\ny\n"` | trailing spaces + trailing tab |
| 10 | `"no newline"` | `"no newline\n"` | adds final newline |
| 11 | `"x\n\n\n\n"` | `"x\n"` | collapse trailing blank lines |
| 12 | `""` | `""` | empty stays empty |
| 13 | `"   \n\t\n"` | `"\n"` | whitespace-only → single newline (each line strips to empty) |
| 14 | `"a\n\n\nb\n"` | `"a\n\n\nb\n"` | interior blank lines preserved |
| 15 | `"café ☕ \n"` | `"café ☕\n"` | non-ASCII / emoji preserved, trailing space stripped |
| 16 | `"a\r\n   \r\nb"` | `"a\n\nb\n"` | blank CRLF line → empty LF line |
| 17 | `"line \n"` | `"line \n"` | NBSP is NOT trailing ASCII ws — preserved (A4) |
| 18 | `"a\tb\tc\n"` width 4 | `"a    b    c\n"` | multiple tabs |

> Values in cases 6–8, 17 depend on assumptions A3 (fixed-width tabs) and A4 (NBSP/`\v`/`\f` left as-is). If the user overturns A3 in discuss-phase (elastic tab stops), cases 7 and 18 change.

### File upload → Exercise

```typescript
// ingestion/upload.ts
export async function fromFile(file: File, tabWidth = 4): Promise<Exercise> {
  if (file.size > 100_000) throw new CorpusTooLargeError(file.size);   // A5
  const raw = await file.text();                                       // UTF-8
  if (raw.includes('�')) throw new NonUtf8Error(file.name);       // Pitfall 7
  return {
    text: normalize(raw, { tabWidth }),
    language: extToLang(file.name),          // '.ts' -> 'typescript', else 'plaintext'
    sourceType: 'upload',                    // D-11 literal
    sourceRef: file.name,                    // D-11: optional
  };
}
```
> `sourceType: 'upload'` / `'paste'` and the `Exercise` field names/types are quoted verbatim from CONTEXT.md D-11: `Exercise { text: string; language: string; sourceType: 'paste' | 'upload'; sourceRef?: string }`.

### Session assembly

```typescript
// session.ts   — D-14 shape, verbatim: { exercise, events, timingResolutionUs, crossOriginIsolated, startedAt }
export function startSession(exercise: Exercise): Session {
  return {
    exercise,
    events: capture.getEvents(),               // readonly KeystrokeEvent[] (D-13)
    timingResolutionUs: probeTimerResolutionUs(),
    crossOriginIsolated: readCrossOriginIsolated(),
    startedAt: Date.now(),                     // wall clock, display only
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact on this phase |
|--------------|------------------|--------------|----------------------|
| Vite dev = esbuild, build = Rollup | Vite 8 = `rolldown` (Rust) for both | ~March 2026 (`vite@8`) | Transparent; no config change. `@vitejs/plugin-react` 6 is the Vite-8 line `[CITED: vite.dev/blog/announcing-vite8]` |
| `@vitejs/plugin-react` uses Babel for Fast Refresh | v6 uses Oxc; Babel dependency removed | 2026-03-12 (`plugin-react@6.0.0`) | Smaller install, faster; nothing to configure `[CITED: vitejs/vite-plugin-react CHANGELOG]` |
| TypeScript 5.x (JS compiler) | TS 7.0 Go-native compiler is `latest` on npm | July 2026 GA | **Do not adopt yet** — `typescript-eslint`/ESLint unsupported until TS 7.1 (no stable API). Pin `~5.9`. `[CITED: theregister 2026-07-09; typescript-eslint issue #12518]` |
| Vitest 3 (project research assumption) | Vitest 4.1.x stable; 5.0.0 shipped 2026-09-03 | 4.1 ~Mar 2026; 5.0.0 Sep 2026 | Pin `~4.1`; 5.0.0 is a day old and raises the Node floor `[VERIFIED: npm registry]` |
| `KeyboardEvent.keyCode` / `charCode` | `event.code` (physical) + `event.key` (logical) — both in D-12 | long-deprecated | D-12 already captures both |
| `event.timeStamp` = Unix epoch millis (`DOMTimeStamp`) | `event.timeStamp` = `DOMHighResTimeStamp`, monotonic, same origin as `performance.now()` | ~2016, universal by 2026 | Read it directly; the old cross-browser epoch inconsistency is gone `[CITED: developer.chrome.com/blog/high-res-timestamps; MDN]` |
| `navigator.keyboard.getLayoutMap()` "experimental, coming soon" | Still Chromium-only in 2026; Firefox + Safari declined (fingerprinting) | unchanged | Layout check must be best-effort only (D-17) `[CITED: web-platform-dx web-features-explorer "keyboard-map"; MDN KeyboardLayoutMap]` |
| `keypress` event | `beforeinput`/`input` with `inputType` | `keypress` deprecated | D-04 already mandates `beforeinput`/`input` |

**Deprecated / outdated — do not use:**
- `@vitejs/plugin-react` v5 or the standalone `@vitejs/plugin-react-oxc` (folded into v6).
- `pnpm create vite --template react` without `-ts`.
- `FileReader.readAsText` for new code — `Blob.text()` / `File.text()`.
- `document.execCommand`, `keypress`, `KeyboardEvent.keyCode`.

## Runtime State Inventory

Not applicable — greenfield phase, no rename/refactor/migration. No pre-existing stored data, live-service config, OS-registered state, secrets, or build artifacts. Repo currently contains only `.planning/` and `keebdrill.md` (verified via `git status` and directory listing this session).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite 8 (`^20.19 \|\| >=22.12`), Vitest 4 (`^20 \|\| ^22 \|\| >=24`) | ✓ | v24.16.0 | — |
| pnpm | Package manager (D-01) | ✓ | 11.5.3 | corepack (`0.35.0` present) |
| npm | fallback pkg manager / `npm view` | ✓ | 11.13.0 | — |
| git | VCS, commit gating | ✓ | 2.55.0 | — |
| Chromium | Primary dev/test browser; `crossOriginIsolated` → ~5µs timers; only browser with `getLayoutMap()` | ✓ | 152.0.7977 | — |
| Firefox | Cross-browser check (1ms timer clamp; no `navigator.keyboard`) | ✓ | 154.0.1 | — |
| Static host with custom response headers | Production COOP/COEP (CAPT-05) + walking-skeleton deploy | ✗ (not selected) | — | `coi-serviceworker` shim, **or** choose Netlify / Vercel / Cloudflare Pages (all support `_headers` / config). **GitHub Pages cannot send custom headers** |

**Missing dependencies with no fallback:** none block local development.
**Missing dependencies with fallback:** production/preview host with header support — decide before the walking-skeleton deploy. Recommend Cloudflare Pages or Netlify with a `_headers` file:
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

## Security Domain

`security_enforcement: true`, ASVS L1. This is a no-backend, no-auth, local-only SPA — most categories are N/A, but corpus/keystroke data is sensitive.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Local-only: **no network calls** for corpus or keystroke data; no analytics/telemetry/error-reporting SDK; CSP `connect-src 'self'` (or `'none'`). Document the "content never leaves the machine" posture in the README (PITFALLS.md #8/#9) |
| V5 Input Validation | yes | File size cap (~100 KB); render corpus as **text nodes only** — never `dangerouslySetInnerHTML` / no HTML interpretation; BOM + non-UTF-8 handling; filename shown but never used as a filesystem path or in a URL |
| V6 Cryptography | no | No secrets, no crypto in scope |
| V2 Authentication / V3 Session / V4 Access Control | no | No auth, no backend, no server-side session |
| V14 Configuration | yes | COOP `same-origin` + COEP `require-corp`; **cross-origin isolation enables `SharedArrayBuffer`** → keep the dependency tree minimal, self-host all assets (fonts/icons — `require-corp` forces this anyway), add a Content-Security-Policy meta/header |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Rendered corpus contains `<script>` / HTML / template-injection payload | Tampering (XSS) | React text rendering only; no `innerHTML`; if syntax highlighting is added later, use a sanitizing highlighter and never trust corpus as markup |
| Uploaded/pasted file contains secrets (API keys, tokens, `.env` content) | Information disclosure | In-memory only (D-02); no persistence, no network; no SDK that could capture DOM/keystrokes; README states corpus is never transmitted |
| Keystroke log is a verbatim transcript of everything typed (incl. anything pasted then retyped) | Information disclosure | Treat `Session.events` as sensitive; memory-only in v1; forbid any `fetch`/beacon of it; when Phase 4 adds persistence it must be local IndexedDB only |
| Giant paste / pathological input | DoS | Size cap + off-main-thread normalization for large inputs |
| COEP `require-corp` + a third-party script/CDN asset | Elevation / expanded Spectre surface via `SharedArrayBuffer` | Zero third-party runtime scripts; self-host fonts and assets; add SRI where a CDN is unavoidable; minimal `dependencies` |
| `event.isTrusted === false` events (extensions, automation) polluting the log | Tampering (data integrity) | Filter to `event.isTrusted` in the capture handler (Playwright's synthetic events are still trusted, so E2E later is unaffected) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vite 8 `server.headers` applies to the `index.html` document response in dev (old "modules only" bug fixed) | Pitfall 1, Pattern 3 | Walking skeleton not isolated in dev; wastes debugging time. **Cheap to verify:** `curl -I http://localhost:5173/` during the walking skeleton |
| A2 | `create-vite` `react-ts` template does not bundle Vitest | Installation | Minor — planner adds `vitest` explicitly anyway |
| A3 | Tab expansion uses **fixed-width** replacement (`\t` → `tabWidth` spaces), not elastic tab stops | Normalizer, golden tests 6–8/18 | Rendered indentation may look ragged vs source; golden tests 7 & 18 would change. Flag to discuss-phase |
| A4 | Normalizer leaves NBSP (U+00A0), `\v`, `\f` untouched (only ASCII space/tab are "trailing whitespace") | Normalizer, golden test 17 | Rare phantom mismatches on exotic files |
| A5 | Input size cap ~100 KB is acceptable (no requirement specifies one) | Pitfall 6, upload example | Too low → rejects legitimate large files; too high → jank. Confirm with user |
| A6 | `File.text()` UTF-8-only decoding is acceptable; non-UTF-8 files are out of scope | INPUT-02, Pitfall 7 | A user with Latin-1/UTF-16 source files can't load them; D-08 says "as-is" but is silent on encoding |
| A7 | `blur`/`focus`/`visibilitychange` are recorded as markers (in the event stream or at session level) so Phase 2/3 can compute active time | Diagram, Pitfall 3 | If omitted, Phase 2 can't exclude blurred time (TYPE-06); adding later means re-capture. Planner should decide the representation now |
| A8 | Phase 1 capture-layer tests use happy-dom/jsdom (Playwright deferred per D-03) | Standard Stack, structure | happy-dom's `InputEvent`/`getTargetRanges` support may be incomplete → fall back to jsdom or defer some assertions to Phase 2 Playwright |
| A9 | Pin `typescript@~5.9` (not 7.x) and `vitest@~4.1` (not 5.0.0) for ecosystem stability | Standard Stack | Conservative; low downside. If TS 7.1 + typescript-eslint ship during the milestone, revisit |
| A10 | The timer-resolution probe records both a measured min-`timeStamp`-delta and the per-browser expected value keyed on `crossOriginIsolated` | Pattern 3, D-16 | A naive `performance.now()`-loop probe measures call overhead, not stamp granularity → `timingResolutionUs` would be meaningless |
| A11 | `Exercise.language` for paste is the literal `'plaintext'` (D-11 says "`'plaintext'` for paste") and the ext→lang map is small/hand-maintained (D-discretion) | Data model, upload example | Cosmetic; Phase 4 partitioning by language would be slightly off for pasted content |

## Open Questions

1. **Scaffold in-place vs temp-then-move**
   - What we know: repo root has `.planning/` + `keebdrill.md`; `pnpm create vite` wants an empty or new dir.
   - What's unclear: whether `pnpm create vite .` "merge" mode is safe here.
   - Recommendation: scaffold into a temp dir, copy `src/ index.html vite.config.ts tsconfig*.json package.json .gitignore public/` to root, `git status` before committing.

2. **Where the capture listeners attach — `window` vs the `<textarea>`**
   - Recommendation: `keydown`/`keyup`/`beforeinput`/`input` on the textarea (focus-scoped, avoids logging global browser shortcuts and events fired while the corpus-input box has focus); `blur`/`visibilitychange` on `window`. D-discretion allows the planner to choose.

3. **Timer-resolution probe method** — see A10. Recommend measured + expected, stored together.

4. **Deploy target for the walking skeleton** — must support custom response headers (Netlify / Vercel / Cloudflare Pages) or use `coi-serviceworker`. Not GitHub Pages. Pick before the deploy task.

5. **`blur`/visibility markers: `KeystrokeEvent` variant or `Session`-level list?** (A7) — D-12's `type` is `'keydown' | 'keyup'` only, so markers likely belong at the `Session` level or in a sibling log. Planner to decide; it affects the Phase 2 state machine's input shape.

6. **Does `Session.startedAt` (D-14) start at session construction or first keystroke?** D-14 just says `startedAt`; PITFALLS.md #10 and Phase 2 TYPE-06 want the *clock* to start on first keystroke. Recommend `startedAt` = wall-clock construction time for display, and let Phase 2 derive elapsed from the first `KeystrokeEvent.tMs`.

## Sources

### Primary (HIGH confidence — verified via tool this session)
- `npm view` (registry, 2026-09-04): `vite@8.2.2`, `@vitejs/plugin-react@6.1.1` (peer `vite ^8.0.0`), `react@19.2.8`, `@types/react@19.2.18`, `@types/react-dom@19.2.7`, `typescript` dist-tags (`latest 7.0.2`, newest-5.x `5.9.3`, `beta 6.0.0-beta`), `@types/node@26.4.1`, `vitest` dist-tags (`latest 5.0.0` pub 2026-09-03, newest-4.x `4.1.11`), `happy-dom@20.14.0`, `jsdom@30.0.1`, `zustand@5.0.15`, `create-vite@9.2.0`, `coi-serviceworker@0.1.7`
- `gsd-tools query package-legitimacy check` — verdicts for react/react-dom/typescript/@types/react (OK) and vite/@vitejs/plugin-react/vitest/@types/react-dom/zustand (SUS = release-recency false positive)
- Local environment probe: Node v24.16.0, pnpm 11.5.3, npm 11.13.0, corepack 0.35.0, git 2.55.0, Chromium 152.0.7977, Firefox 154.0.1
- CONTEXT.md D-01..D-17, REQUIREMENTS.md (INPUT/CAPT wording), ROADMAP.md Phase 1 success criteria — read this session

### Secondary (MEDIUM confidence — official docs / release notes via WebSearch)
- vite.dev/config/server-options, vite.dev/config/preview-options — `server.headers` / `preview.headers` are separate `OutgoingHttpHeaders` options
- vite.dev/blog/announcing-vite8 — Vite 8 GA, Rolldown
- github.com/vitejs/vite-plugin-react CHANGELOG — v6.0.0 (2026-03-12) drops Babel, uses Oxc; `@vitejs/plugin-react-oxc` deprecated
- react.dev/versions, react.dev/blog/2025/10/01/react-19-2 — React 19.2 line
- MDN: InputEvent/inputType, KeyboardEvent/timeStamp, KeyboardLayoutMap, Performance_API/High_precision_timing; developer.chrome.com/blog/high-res-timestamps, /blog/cross-origin-isolated-hr-timers
- w3.org/TR/input-events-1 — `insertText` / `insertLineBreak` / `deleteContentBackward` inputType definitions
- web-platform-dx web-features-explorer "keyboard-map"; github.com/jupyterlab/lumino#271 — `getLayoutMap()` Chromium-only, Firefox/Safari declined
- theregister.com 2026-07-09, infoq.com 2026-08, typescript-eslint.io, github.com/typescript-eslint/typescript-eslint#12518, github.com/eslint/eslint#21070 — TS 7.0 GA but no stable API until 7.1; typescript-eslint/ESLint unsupported
- vitest.dev/blog — Vitest 4.1 (Mar 2026), 5.0 line
- create-vite npm page + github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts

### Project research (inherited, MEDIUM)
- `.planning/research/{SUMMARY,STACK,PITFALLS,ARCHITECTURE}.md` — pitfalls #1/#2/#3/#7/#8/#10, KeystrokeEvent model, `capture/` seam, browser-vs-TUI timer analysis

### Tertiary (LOW confidence — community, flagged for validation)
- Community reports that modern Vite `server.headers` applies to the HTML document in dev (A1) — verify empirically during the walking skeleton
- gist/blog examples of Vite COOP/COEP config (mizchi gist, captaincodeman) — pattern corroboration only

## Metadata

**Confidence breakdown:**
- Standard stack (versions): HIGH — every package version confirmed via `npm view` this session; two adoption caveats (TS 7, Vitest 5) backed by dated official/press sources
- Cross-origin isolation config: MEDIUM-HIGH — `server.headers`/`preview.headers` split VERIFIED against Vite docs; the dev-document-scope question (A1) is MEDIUM and empirically checkable
- Keystroke timing (`event.timeStamp`, `.repeat`): HIGH — MDN/Chrome/W3C, consistent with project research
- Editable-surface spike (`<textarea>` over `contenteditable`): MEDIUM-HIGH — strong consensus + `inputType` behavior documented; exact caret-retention approach for Phase 2 still open
- `inputType` → character mapping: MEDIUM — spec-backed; Firefox delete-* edge cases mean `input` value-diff must be the ground truth
- Normalizer: HIGH on transform set/order; MEDIUM on tab-stop policy (A3) and exotic-whitespace policy (A4) — both need user confirmation
- Layout detection: HIGH — `getLayoutMap()` Chromium-only status unchanged in 2026

**Research date:** 2026-09-04
**Valid until:** ~2026-10-04 for stack versions (fast-moving: Vitest 5, TS 7.1, Vite 8.x patches); ~2027-01 for browser-API and normalizer findings (stable)
