# Phase 1: Corpus Input & Keystroke Capture - Pattern Map

**Mapped:** 2026-09-04
**Files analyzed:** 20 (all new)
**Analogs found:** 0 / 20 — **GREENFIELD REPO**

## Greenfield Confirmation

The repo contains only `.planning/` and `keebdrill.md`. There is no `package.json`,
no `src/`, no `index.html`, no build config, no test setup. Verified against
`git status` and CONTEXT.md §"Existing Code Insights" ("None — greenfield repo").

**There are zero in-repo analogs.** Every file below is classified "no in-repo
analog (greenfield)". Recommended shapes are drawn from `01-RESEARCH.md`
(Standard Stack, Architecture Patterns, Code Examples) and `01-UI-SPEC.md` (token
foundation). This phase *establishes* the patterns that Phases 2-4 will copy.

The planner should treat `01-RESEARCH.md` §"Recommended Project Structure" and
§"Common Operations / Code Examples" as the authoritative pattern source, and
`01-UI-SPEC.md` as the authoritative UI/token source.

## File Classification

| New File | Role | Data Flow | Analog | Recommended Pattern Source |
|----------|------|-----------|--------|----------------------------|
| `package.json` | config | — | none (greenfield) | RESEARCH §Standard Stack + §Installation — pin `vite@^8.2`, `@vitejs/plugin-react@^6.1`, `react@^19.2`, `typescript@~5.9` (NOT 7.x), `vitest@~4.1` (NOT 5.0), `happy-dom@^20`; `packageManager` field for pnpm 11.x |
| `vite.config.ts` | config | — | none (greenfield) | RESEARCH §Pattern 3 (verbatim example) — `plugins:[react()]`, `server.headers` AND `preview.headers` both set to `{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}`; `test.projects` split unit (node) / dom (happy-dom) |
| `tsconfig.json` / `tsconfig.node.json` | config | — | none (greenfield) | `create vite` react-ts template defaults + `strict: true`, `noUncheckedIndexedAccess: true` (D-01) |
| `index.html` | config | — | none (greenfield) | `create vite` template default; single `#root` mount, `main.tsx` module entry |
| `.eslintrc` / `eslint.config.js` | config | — | none (greenfield) | Discretion (D); Oxlint config ships with template — keep it, add `typescript-eslint` only if cheap (note TS pinned to 5.9 for lint compat) |
| `src/main.tsx` | provider | request-response | none (greenfield) | `create vite` template default `createRoot(...).render(<App/>)`; run `platform/` startup probes before render or in App mount |
| `src/ingestion/types.ts` | model | — | none (greenfield) | D-11 verbatim: `Exercise { text: string; language: string; sourceType: 'paste' \| 'upload'; sourceRef?: string }`; `SourceType` union |
| `src/ingestion/normalize.ts` | utility | transform | none (greenfield) | RESEARCH §"Normalizer reference shape" (verbatim). PURE, zero imports. Fixed transform order: BOM → CRLF/CR→LF → expand tabs (fixed width) → strip trailing ws per line → collapse to one trailing `\n`. `NormalizeOptions { tabWidth: number }` default 4 |
| `src/ingestion/normalize.test.ts` | test | — | none (greenfield) | RESEARCH §"Golden-test cases" — 18 cases, table-driven `it.each`, Vitest `environment: 'node'` |
| `src/ingestion/paste.ts` | service | transform | none (greenfield) | `(raw: string) => Exercise` — `normalize()` then `{sourceType:'paste', language:'plaintext'}` |
| `src/ingestion/upload.ts` | service | file-I/O | none (greenfield) | RESEARCH §"File upload → Exercise" (verbatim) — `async (file, tabWidth) => Promise<Exercise>`; `file.size > 100_000` guard → `CorpusTooLargeError`; `File.text()` (no FileReader); U+FFFD scan → `NonUtf8Error`; `extToLang(file.name)`; `sourceType:'upload'`, `sourceRef:file.name` |
| `src/ingestion/language-map.ts` | utility | — | none (greenfield) | Discretion — `extToLang('.ts') => 'typescript'`, fallback `'plaintext'`; plain `Record<string,string>` lookup |
| `src/capture/types.ts` | model | — | none (greenfield) | D-12 verbatim: `KeystrokeEvent { seq: number; type: 'keydown' \| 'keyup'; key: string; code: string; ctrl: boolean; alt: boolean; shift: boolean; meta: boolean; tMs: number; isRepeat: boolean }`; `Session` per D-14: `{ exercise, events, timingResolutionUs, crossOriginIsolated, startedAt }` |
| `src/capture/capture.ts` | service | event-driven | none (greenfield) | RESEARCH §Pattern 1 + §Pattern 2 (verbatim). Module singleton `buffer: KeystrokeEvent[]`, `downCodes: Set<string>`, `seq` counter. `onKey` hot path: `isTrusted` check, `isRepeat = e.repeat \|\| downCodes.has(e.code)`, push, **nothing else** — `tMs = e.timeStamp` (never `performance.now()`/`Date.now()`). Separate `charLog` from `beforeinput` (selective `preventDefault` for `insertFromPaste`/`insertFromDrop` only). Clear `downCodes` on `blur`/`visibilitychange`. Expose `getEvents(): readonly KeystrokeEvent[]` |
| `src/capture/use-capture.ts` | hook | event-driven | none (greenfield) | RESEARCH §Pitfall 2 — attach listeners in `useLayoutEffect` (before surface focusable), detach on unmount; surface count via `useSyncExternalStore` (throttled / on-demand), NEVER `setState` per keystroke |
| `src/capture/capture.test.ts` | test | — | none (greenfield) | Vitest `environment: 'happy-dom'`; cases: held-key repeat filtered, per-code fallback, first-keystroke not lost, `blur` clears downSet |
| `src/platform/isolation.ts` | utility | — | none (greenfield) | RESEARCH §Pattern 3 — `readCrossOriginIsolated = () => self.crossOriginIsolated === true`; `probeTimerResolutionUs()` = histogram smallest non-zero gap between consecutive real `event.timeStamp` values |
| `src/platform/layout.ts` | utility | — | none (greenfield) | RESEARCH §Pitfall 8 — `navigator.keyboard?.getLayoutMap?.()` guarded, `await` in `try/catch`, `console.warn` only, never block/gate UI (D-17). Chromium-only; degrade silently elsewhere |
| `src/session.ts` | service | transform | none (greenfield) | RESEARCH §"Session assembly" (verbatim) — `startSession(exercise): Session` composes `capture.getEvents()` + `probeTimerResolutionUs()` + `readCrossOriginIsolated()` + `startedAt: Date.now()` (display only) |
| `src/ui/App.tsx` | component | request-response | none (greenfield) | UI-SPEC — single centered column `max-width: 45rem`; renders Banners → CorpusInput → preview → CaptureSurface; owns one `useState<Exercise \| null>`; tab order per Interaction Contract |
| `src/ui/CorpusInput.tsx` | component | request-response | none (greenfield) | UI-SPEC Copywriting Contract — controlled `<textarea>` paste box + `<input type="file">` + "Load exercise" button; inline error strings beneath the offending control (not toasts); "Loading…" disabled state only if normalize exceeds one frame |
| `src/ui/CaptureSurface.tsx` | component | event-driven | none (greenfield) | UI-SPEC — plain native `<textarea>` on Secondary surface, accent border + focus ring while focused, visible caret, NO per-char coloring / glyphs / overlay; rendered only after load; programmatic focus after listeners attached |
| `src/ui/Banners.tsx` | component | — | none (greenfield) | UI-SPEC — always-on neutral "US ANSI only" notice; Warning-token "timing degraded" banner only when `crossOriginIsolated !== true`; both occupy space from first paint (no layout shift), stack warning-above-notice with `--space-sm` |
| `src/index.css` (or `styles/tokens.css`) | config | — | none (greenfield) | UI-SPEC §Design System — CSS custom properties on `:root` + `@media (prefers-color-scheme: dark)` override; spacing scale (4px multiples), monospace-only type scale (2 weights), color tokens (light + dark), 44px min hit target, focus ring `2px` accent `outline-offset: 2px` |
| `README.md` | config | — | none (greenfield) | D-15 — document production static-host COOP/COEP header requirement (GitHub Pages needs `coi-serviceworker` shim; Netlify/Vercel/Cloudflare Pages can send headers) |

## Shared Patterns (this phase establishes them)

### Pure-core module pattern
**Establish in:** `ingestion/normalize.ts`, `session.ts`, later the metrics engine
**Shape:** No I/O, no DOM, no imports at the leaf. `(input, opts) => output`.
Golden/table-driven Vitest tests in `node` environment. This is the product IP
seam (RESEARCH §Summary, CONTEXT §specifics).

### Platform-coupled seam
**Establish in:** `capture/`, `platform/`
**Rule:** These are the ONLY modules allowed to touch `window`, `document`,
`navigator`, `self.crossOriginIsolated`, DOM events. Everything downstream
consumes `readonly KeystrokeEvent[]` / `Session` value objects and never the DOM
(D-13, ARCHITECTURE seam). A future Tauri port rewrites only these.

### Hot-path handler pattern
**Establish in:** `capture/capture.ts`
**Rule:** Event listener body = construct value + `buffer.push()`. No `setState`,
no metric math, no DOM read, no `performance.now()`. Timestamp is always
`event.timeStamp`. (RESEARCH §Pattern 1, §Anti-Patterns, D-07)

### Two parallel logs, reconciled by seq — not merged
**Establish in:** `capture/capture.ts`
**Rule:** `keydown`/`keyup` → `KeystrokeEvent[]` (timing). `beforeinput`/`input`
→ character log. Keyed by `seq`/`tMs`. Phase 2 joins them. (RESEARCH §Pattern 2,
§Pitfall 9)

### Cross-origin isolation: config in two places + runtime verify
**Establish in:** `vite.config.ts` + `platform/isolation.ts` + `README.md`
**Rule:** `server.headers` AND `preview.headers` (not inherited); runtime
`crossOriginIsolated` check feeds `Session`; production host requirement
documented. Three distinct tasks, do not conflate. (RESEARCH §Pattern 3,
§Pitfall 1, D-15/D-16)

### Token-driven CSS
**Establish in:** `src/index.css`
**Rule:** All spacing/type/color via `:root` custom properties with a single
`@media (prefers-color-scheme: dark)` override block. No component library, no
third-party assets (COEP `require-corp`). Native elements styled directly.
(UI-SPEC §Design System)

### Error-as-typed-class + inline render
**Establish in:** `ingestion/upload.ts` + `ui/CorpusInput.tsx`
**Rule:** Ingestion throws named errors (`CorpusTooLargeError`, `NonUtf8Error`);
UI catches and renders the fixed copy string inline beneath the offending
control. No toasts, no stack traces. (RESEARCH §"File upload", UI-SPEC
Copywriting Contract)

## No Analog Found

All 25 files — greenfield repo, no `src/` exists. Planner uses `01-RESEARCH.md`
(§Recommended Project Structure, §Patterns 1-3, §Code Examples — several are
verbatim-ready) and `01-UI-SPEC.md` (tokens, copy, state coverage) as the
pattern source in place of in-repo analogs.

## Metadata

**Analog search scope:** repo root — only `.planning/` and `keebdrill.md` present
**Files scanned:** 0 source files (none exist)
**Pattern extraction date:** 2026-09-04
