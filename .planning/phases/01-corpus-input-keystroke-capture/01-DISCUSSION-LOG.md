# Phase 1: Corpus Input & Keystroke Capture - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-03
**Phase:** 1-Corpus Input & Keystroke Capture
**Mode:** `--auto` (autonomous — Claude selected the research-recommended option for every area; no interactive prompts)
**Areas discussed:** Platform & Scaffold, Character-Stream Capture Mechanism, Content & Normalizer Policy, Data Model, Cross-Origin Isolation & Layout Notice

---

## Platform & Scaffold

| Option | Description | Selected |
|--------|-------------|----------|
| Browser SPA, no backend (Vite 8 + React 19 + TS, pnpm) | Only platform with guaranteed cross-OS keyup + sub-ms timestamps; research recommendation | ✓ |
| Pure TUI (Rust/ratatui or Python/Textual) | No key-release without Kitty protocol; PTY/tmux jitter | |
| Hybrid TUI + web from the start | Premature; two capture engines | |

**User's choice:** Browser SPA (auto-selected, recommended default)
**Notes:** Resolves the platform-architecture open decision from PROJECT.md/STATE.md. Tauri v2 remains the planned v2 evolution path, reusing the React frontend.

---

## Character-Stream Capture Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| `beforeinput`/`input` for text + `keydown`/`keyup` for timing only | No blanket preventDefault; preserves dead keys/IME/AltGr; locked by CAPT-04 | ✓ |
| `preventDefault` on keydown, reconstruct text manually | Breaks dead keys, IME, AltGr; forecloses non-US layouts | |

**User's choice:** `beforeinput`/`input` + timing-only key listeners (auto-selected, recommended default)
**Notes:** Exact editable-surface choice (hidden textarea vs contenteditable vs visible input) and caret retention flagged as a spike for the research step. `event.repeat` filtered plus a per-`code` currently-down guard. Timestamp from `event.timeStamp` only.

---

## Content & Normalizer Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Type content as-is (comments, strings, everything) | v1 does not parse; structural filtering is a tree-sitter concern (out of scope) | ✓ |
| Strip comments/strings, type structural code only | Requires parsing per language; out of scope for v1 | |

**User's choice:** Type as-is (auto-selected, recommended default)
**Notes:** Normalizer defaults — CRLF→LF, tabs→spaces (configurable width, default 4), strip trailing whitespace per line, one trailing newline, strip BOM. Pure function, Vitest golden tests.

---

## Data Model

| Option | Description | Selected |
|--------|-------------|----------|
| `Exercise{text,language,sourceType}` + full `KeystrokeEvent{seq,type,key,code,modifiers,tMs,isRepeat}` now | Records language/sourceType and both key+code from day 1 so Phase 4 persistence and the later heatmap are non-breaking | ✓ |
| Minimal: just `text` + `{key,tMs}` events | Smaller now, but old sessions can never produce a heatmap; language partitioning lost | |

**User's choice:** Full data model (auto-selected, recommended default)
**Notes:** Append-only in-memory buffer owned by a `capture` module, exposed read-only. `Session` wrapper carries `timingResolutionUs`, `crossOriginIsolated`, `startedAt`.

---

## Cross-Origin Isolation & Layout Notice

| Option | Description | Selected |
|--------|-------------|----------|
| COOP/COEP headers in `vite.config.ts` + README note + warning banner if not isolated; static US-ANSI notice + best-effort `getLayoutMap()` console warning | Meets CAPT-05; degrades gracefully; recommended | ✓ |
| Require cross-origin isolation, hard-block the app if absent | Brittle in dev; unnecessary since digraph medians survive 1ms rounding | |
| Skip isolation, accept ~100µs/1ms clamp | Still ~1000× below signal, but loses the "record achieved resolution" requirement intent | |

**User's choice:** Headers + graceful degradation (auto-selected, recommended default)
**Notes:** `getLayoutMap()` browser support flagged for research. Record `timingResolutionUs` per session by probing at startup.

---

## Claude's Discretion

- Component/file structure, module names, listener attachment point (document vs surface).
- File-extension → language map contents.
- Dev tooling (ESLint/Prettier/CI) — include if cheap.

## Deferred Ideas

- Session persistence (Dexie/IndexedDB) — Phase 4 / v2.
- Language auto-detection beyond file extension — later.
- Repo / docs / shell-history source adapters — v2 milestone (Tauri).
- Syntactic chunking (tree-sitter) — out of scope.
- Whitespace glyph rendering, caret, per-char coloring — Phase 2.
- Non-US-ANSI layout support — out of scope.
