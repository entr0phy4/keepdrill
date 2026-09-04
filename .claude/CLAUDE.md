<!-- GSD:project-start source:PROJECT.md -->

## Project

**keebdrill**

A typing trainer for developers that drills on **real technical corpus** — code
from Git repositories, technical documentation, pasted snippets, and shell
history — instead of English prose. It captures high-resolution keystroke events
and reports code-specific metrics (symbol-density-adjusted WPM, per-digraph
latency, keyboard heatmap, per-language profile, correction rate) that existing
platforms (Monkeytype, Keybr, 10FastFingers) do not measure.

**Core Value:** The user can paste or upload a real code/text file, type it with keystroke
capture, and see WPM, accuracy, and their five slowest keys. If that single loop
is useful for a week of daily self-use, the project is worth continuing.

### Constraints

- **Scope**: v1 is deliberately minimal — paste/upload, type with capture, see
  WPM + accuracy + five slowest keys. Nothing else. — Validates the idea cheaply
  before further investment.

- **Tech stack**: Undecided between three options — (A) Web: FastAPI backend,
  SQLite→PostgreSQL, React + TypeScript frontend, `performance.now()` keystroke
  capture; (B) TUI: Rust (ratatui) or Python (Textual), local SQLite; (C) Hybrid:
  TUI for daily practice + web dashboard sharing one database. — Choice shapes the
  capture engine and must be resolved before building.

- **Keystroke timing**: Capture must use high-resolution timestamps
  (`performance.now()` or equivalent) — per-digraph latency measurement is the
  core differentiator and depends on timing precision.

- **Privacy**: Ingested third-party content stays local — licensing / IP concern.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## TL;DR Recommendation

- **Vite 8 + React 19.2 + TypeScript** SPA, run locally (`vite dev` / static `dist/`).
- **Keystroke capture in the browser** using `KeyboardEvent.timeStamp` (both `keydown` and `keyup`). This is the single most important reason to pick web: the browser is the only one of the three options that reliably delivers **key-release events and sub-millisecond timestamps on every platform without special terminal configuration**.
- **No FastAPI, no PostgreSQL, no SQLite server for v1.** Persist to the browser with **Dexie 4 (IndexedDB)**. A server buys you nothing when the only user is the author on one machine.
- **Deferred evolution path:** when later phases need real filesystem / Git-repo / shell-history access, wrap the *same* React frontend in **Tauri v2** (Rust host) rather than standing up a separate FastAPI+Postgres+React stack. This is the "hybrid" you actually want, and it reuses 100% of the UI code.

## Recommended Stack — Architecture A (Web SPA, local-first) — CHOSEN

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vite | 8.2.x | Dev server + build | Current major (Vite 8, Sept 2026). Instant HMR, zero-config TS, tiny static output. No SSR machinery to fight. |
| React | 19.2.x | UI runtime | Current stable (19.2.7, Jun 2026; no successor announced). Ecosystem default; the author almost certainly knows it. `useSyncExternalStore` + refs make imperative keystroke handling clean. |
| TypeScript | 5.7+ | Language | Type-safety on the metrics engine (WPM, digraph tables, quantiles) is where bugs would otherwise hide. Non-negotiable for this domain. |
| `@vitejs/plugin-react` | latest for Vite 8 | React fast-refresh | Standard. (SWC variant `@vitejs/plugin-react-swc` if build speed matters; either is fine.) |
| Dexie | 4.x | IndexedDB wrapper — session + keystroke-log persistence | Smallest path to durable local storage. Typed tables, good query API, handles schema migrations. No server, no daemon, survives reload. |
| pnpm | 10.x | Package manager | Fast, disk-efficient, strict node_modules. |

### Keystroke capture (the load-bearing part)

| Choice | Detail | Why |
|--------|--------|-----|
| Event source | `keydown` + `keyup` listeners on a focused container (or `window`) | Browser is the only candidate that gives **keyup on every OS/terminal for free** → enables dwell time (hold duration) and flight time (release-to-press), not just press-to-press. |
| Timestamp | Read **`event.timeStamp`**, not `performance.now()` inside the handler, not `Date.now()` | `event.timeStamp` is a `DOMHighResTimeStamp` stamped at event *creation* (closer to the hardware event), immune to handler-scheduling delay. |
| Handler discipline | In the listener do **only**: `log.push({code, key, kind, t: event.timeStamp, repeat: event.repeat, isComposing: event.isComposing})`. Nothing else. | Keeps the handler off the critical path. Any React re-render, layout, or metric math in the handler adds jitter to the *next* keystroke's measurement. |
| Rendering | Update the visible "typed so far" view via a `ref` + direct DOM write, or throttle React state to `requestAnimationFrame`. Compute all metrics **after** the exercise completes (or on a rAF tick), from the log. | Decouples measurement from paint. |
| Autorepeat / IME | Discard events where `event.repeat === true`; discard/segment where `event.isComposing === true` or `key === 'Process'`. | OS key-repeat and IME composition are not real keystrokes and will pollute digraph stats. |
| Cross-origin isolation | Serve dev + prod with `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` | Unlocks Chromium's 5µs timer resolution instead of the default ~100µs. Cheap to add in `vite.config.ts` `server.headers` and your static host. Not required for correctness (see precision section) but free accuracy. |

### Metrics engine

| Choice | Version | Purpose | Why |
|--------|---------|---------|-----|
| Hand-written TS module | — | WPM (net + raw), accuracy, per-key / per-digraph / per-trigraph latency, "5 slowest" ranking | This is your product's IP. ~150 lines. Keep it pure (`(KeystrokeLog) => Metrics`), no I/O, 100% unit-tested. Don't outsource it to a library. |
| `d3-array` | 3.x | Optional: `quantile`, `mean`, `deviation`, `rollup` for the latency stats | Only if you don't want to hand-roll median/p95/coefficient-of-variation. Tree-shakes to a few KB. Otherwise skip. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zustand | 5.x | Global UI state (current exercise, phase: idle/typing/done) | v1. Tiny, no boilerplate, no context-provider tree. |
| Tailwind CSS | 4.x | Styling | v1, if the author likes utility CSS. Otherwise plain CSS Modules — this UI is small. |
| Recharts | 3.x | Bar chart for "5 slowest keys"; later the progress dashboard | Defer if v1 shows slowest keys as a table. Add when you want visuals. Alternative: `uPlot` for dense time-series in the later dashboard. |
| `web-tree-sitter` | 0.25.x–0.26.x (matches `tree-sitter` core) | LATER PHASE: syntactic chunking of code corpus, in-browser (WASM) | Keeps parsing client-side → satisfies the "third-party repo content never leaves the machine" constraint. Load grammar `.wasm` files on demand. |
| `@zip.js/zip.js` or browser `File`/`FileSystemAccess` API | — | LATER: multi-file / repo upload | File System Access API (Chromium) lets you point at a local folder without a server. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest | 3.x | Unit tests for the metrics engine | Shares Vite config; fast. Put the digraph-latency math under a golden-file test with a recorded keystroke log. |
| Playwright | 1.4x | E2E: simulate a real typing run, assert WPM/accuracy | `page.keyboard.press()` with delays; also the only sane way to regression-test capture. |
| ESLint 9 (flat config) + Prettier | Lint/format | Standard. |
| TypeScript strict mode | Correctness | `"strict": true`, `"noUncheckedIndexedAccess": true` — the metrics code indexes arrays constantly. |

### Installation (Architecture A)

# optional

# later phase

## Alternative Stack — Architecture B (TUI) — for reference / if the author insists on terminal

### Rust variant (recommended over Python for a TUI)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Rust | 1.88+ | Language | Required by current ratatui. |
| ratatui | 0.30.2 | TUI rendering | The maintained standard (successor to `tui-rs`). 0.30 split into a modular workspace. |
| crossterm | 0.29 | Terminal backend + input events | Exposes `PushKeyboardEnhancementFlags` / `supports_keyboard_enhancement()` and yields `KeyEventKind::{Press, Repeat, Release}` on Kitty-capable terminals. Without those flags you get **Press only**. |
| `std::time::Instant` | — | Monotonic timestamps | Nanosecond monotonic clock; the timestamp itself is not the bottleneck — PTY delivery is. |
| rusqlite (bundled) | 0.3x | Local SQLite | `features = ["bundled"]` so no system SQLite dependency. |
| clap | 4.x | CLI args | Standard. |

### Python variant (only if the author is Python-only and wants speed of authoring)

| Technology | Version | Purpose | Why / Caveat |
|------------|---------|---------|--------------|
| Textual | 6.5.x | TUI framework | Fastest to build a polished TUI in Python. **Caveat:** its asyncio input pipeline adds latency between the terminal byte and your handler; harder to characterize than crossterm's synchronous poll loop. |
| `time.perf_counter_ns()` | stdlib | Monotonic ns timestamps | Fine precision; same PTY-latency caveat as Rust. |
| `sqlite3` | stdlib | Local storage | No dependency. |
| uv | latest | Env + packaging | Current Python packaging standard. |

## Alternative Stack — Architecture C (Hybrid) — deferred, and when it returns, do it as Tauri

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tauri | v2 | Native host wrapping the existing React SPA | Reuse the entire Architecture-A frontend and its browser-grade keystroke capture (the WebView still gives you `keyup` + `timeStamp`). Adds Rust-side filesystem, Git, and shell-history access via commands. ~3–10 MB bundle, ~40 MB RAM, ~0.12 ms IPC. |
| SQLite via `tauri-plugin-sql` or `rusqlite` | — | One local DB, queryable from both the practice view and the dashboard | Single file, no server. This *is* the "shared DB" from option C, minus the ops. |
| tree-sitter (native Rust `tree-sitter` crate + grammar crates) | 0.25.x | Repo chunking on the Rust side if WASM proves too slow | Optional; `web-tree-sitter` in the WebView is usually enough. |

## Keystroke-Timing Precision — per platform

### Browser / WebView

| Engine | `performance.now()` / `event.timeStamp` resolution | Notes |
|--------|---------------------------------------------------|-------|
| Chromium (Chrome, Edge, Electron, Windows WebView2) | ~100 µs default; **5 µs** with `COOP: same-origin` + `COEP: require-corp` (cross-origin isolation) | Best case. Recommended target. |
| Firefox | **1 ms** (rounded; `privacy.reduceTimerPrecision`, Spectre mitigation) | Do not rely on sub-ms in Firefox. Still fine for this app. |
| Safari / WebKit / macOS WKWebView | ~1 ms clamp | Fine for this app. |
| Linux WebKitGTK (Tauri on Linux) | coarser / less documented | Acceptable; validate empirically if it becomes the primary platform. |

- **Use `event.timeStamp`**, not `performance.now()` read inside the handler (handler scheduling can be delayed by other main-thread work) and never `Date.now()` (wall clock, low-res, can jump).
- **`event.repeat`** — OS autorepeat fires synthetic keydowns; exclude them.
- **`event.isComposing` / `keyCode 229`** — IME composition; segment or exclude.
- **Keep the handler trivial**; move rendering to rAF; compute metrics post-hoc. React re-render per keystroke is the most common source of self-inflicted jitter.
- **Modifier combos** (`Shift`+`[` → `{`): you get separate `Shift` and `BracketLeft` events plus `event.key === '{'`. Decide whether to score the shift press as part of the digraph or fold it in. Browser gives you the raw material; a terminal does not.
- **Keyboard hardware polling** (125 Hz–1000 Hz = 1–8 ms) is the true physical floor and no software fixes it. Irrelevant at this app's scale.

### Terminal (TUI)

- **Default terminal input = key *press* only.** No `keyup`, no press/repeat/release distinction. Dwell time is **impossible** without the Kitty keyboard protocol.
- **Kitty keyboard protocol** (opt-in via `PushKeyboardEnhancementFlags`) adds `Release` and `Repeat` kinds. Supported: kitty, Ghostty, WezTerm, foot, Alacritty, iTerm2, Rio, and Windows Terminal (≥ Preview 1.25, ~early 2026). **Not** the macOS default Terminal.app, not older Windows consoles, not many SSH/CI environments.
- **PTY / tmux / SSH buffering** introduces variable latency between keypress and byte delivery — tens of ms under load, and it's not something you can subtract out. tmux in particular can batch input.
- **Multi-byte keys** (arrows, function keys, some symbols) arrive as escape-sequence bursts; the parser sees the whole sequence at once, so intra-sequence timing is meaningless.
- Timestamp source (`Instant` / `perf_counter_ns`) is sub-µs and not the limiting factor.
- **Net:** a TUI can measure press-to-press latency on a good terminal, but cannot guarantee dwell time or consistent jitter across environments. Wrong foundation for a product whose headline feature is per-digraph/dwell latency.

### Native desktop (Tauri/Electron) vs raw OS key hooks

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **FastAPI + PostgreSQL for v1** | Single user, single machine, one-week validation goal. A server and a client-server DB add deployment, migration, and CORS surface for zero benefit. Postgres is never needed unless keebdrill becomes multi-user hosted (explicitly out of scope). | No backend. Dexie/IndexedDB now; local SQLite (via Tauri) if/when you need SQL analytics. |
| **Next.js / Remix / any SSR/RSC framework** | It's a local, offline, single-page tool. SSR, routing, server components, and the build complexity are pure overhead. | Vite SPA. |
| **Redux / Redux Toolkit** | Boilerplate-heavy for an app with ~3 pieces of global state. | Zustand, or just React state + a ref for the keystroke log. |
| **Reading `performance.now()` inside the keydown handler for the timestamp** | Handler can be scheduled late; you measure "time until my JS ran," not "time the key was pressed." | `event.timeStamp`. |
| **`Date.now()` / `new Date()` for timing** | Millisecond wall clock, non-monotonic, can jump on NTP sync. | `event.timeStamp` (web) / `Instant` (Rust) / `time.perf_counter_ns()` (Python). |
| **Pure TUI (option B) as the v1 foundation** | No guaranteed keyup; terminal-dependent; PTY jitter. Undermines the core differentiator. | Browser capture (option A). |
| **Full two-app hybrid (option C) now** | Two codebases + shared-DB contract for a validation spike. | Ship A; evolve to Tauri (one codebase) later. |
| **`tui-rs`** (original crate) | Unmaintained since 2023. | `ratatui`. |
| **`py-tree-sitter-languages`** (grantjenks) | Unmaintained. | `tree-sitter-language-pack` (Python) or `web-tree-sitter` + grammar `.wasm` (web). |
| **Electron for v1** | 80–200 MB, ~168 MB RAM, slow start — you don't need a native shell yet. | Plain browser now; Tauri v2 later if native access is required. |
| **CodeMirror / Monaco as the typing surface** | They're full editors; their own key handling, IME, and DOM churn fight your measurement and add jitter. | A custom controlled render of the target text with a hidden input or `window` key listeners. |
| **Firefox as the reference/dev browser** | 1 ms timer clamp with extra randomization; you'll see noisier stats while developing. | Develop and benchmark on Chromium; treat Firefox as "also works." |

## Stack Patterns by Variant

- **Architecture A**, no server. Vite 8 + React 19 + TS, Dexie 4, Zustand 5, Vitest 3.
- Keystroke log = `Array<{code, key, kind: 'down'|'up', t: number, repeat: boolean}>` in a ref; flush to Dexie on completion.
- Metrics = one pure TS module, golden-tested.
- "5 slowest keys" = group down-events by `code`, compute median inter-key latency into each key, sort desc, take 5.
- Ship it as `vite build` + open `dist/index.html`, or run `vite preview`. Done.
- **Architecture B, Rust:** ratatui 0.30 + crossterm 0.29 (enable keyboard enhancement flags, detect with `supports_keyboard_enhancement()` and degrade gracefully to press-only), rusqlite bundled.
- Document the terminal requirement prominently; detect and warn on unsupported terminals.
- **Wrap Architecture A's frontend in Tauri v2.** Add Rust commands for filesystem/Git/`~/.zsh_history` access. Move persistence to a single local SQLite file via `tauri-plugin-sql`. This delivers option C's "shared DB, two surfaces" as one codebase.
- Keep tree-sitter in-WebView (`web-tree-sitter`) unless profiling says otherwise — it keeps third-party repo content in-process and satisfies the privacy constraint.
- *Then* introduce FastAPI (0.141.x) + SQLModel (0.0.4x) / SQLAlchemy 2.0 + PostgreSQL, and the SPA stays as-is, pointed at the API. Not before.

## Version Compatibility

| Package | Compatible with | Notes |
|---------|-----------------|-------|
| Vite 8.2.x | React 19.2.x via `@vitejs/plugin-react` (Vite-8 line) | Use the plugin release that targets Vite 8; older 4.x plugin is for Vite ≤7. |
| React 19.2.x | TypeScript 5.7+ with `@types/react@19` / `@types/react-dom@19` | React 19 types dropped the implicit `children` prop; expect minor type churn if porting old code. |
| ratatui 0.30.2 | crossterm 0.29, Rust ≥ 1.88 | 0.30 is a workspace reorg; import paths changed vs 0.29. |
| crossterm 0.29 | Kitty protocol needs a supporting terminal at runtime | `supports_keyboard_enhancement()` is a runtime check, not compile-time. |
| `web-tree-sitter` 0.25–0.26 | grammar `.wasm` built against the matching tree-sitter CLI major | Version-match the runtime and the compiled grammars or parsing fails. |
| Dexie 4.x | All evergreen browsers; IndexedDB | v4 changed some TypeScript generics vs v3. |
| Tailwind 4.x | Vite via `@tailwindcss/vite` plugin | v4 config is CSS-first (`@theme`), not `tailwind.config.js`. |
| Textual 6.5.x | Python ≥ 3.9, < 4.0 | — |
| FastAPI 0.141.x (only if hosted, later) | SQLModel 0.0.4x, SQLAlchemy 2.0.x, Pydantic v2, Python ≥ 3.10 (3.12/3.13 recommended) | Not part of v1. |

## Confidence Assessment

| Claim | Confidence | Basis |
|-------|------------|-------|
| React 19.2.x / Vite 8.2.x are current (Sept 2026) | HIGH | react.dev/versions and vite.dev/releases fetched directly |
| Browser is the only option with guaranteed cross-platform keyup + hi-res timestamps | HIGH | MDN KeyboardEvent, crossterm docs, Kitty protocol status |
| Terminals need Kitty protocol for release events; support list | HIGH | crossterm release notes, Alacritty/Windows Terminal issue threads |
| performance.now/timeStamp clamps: Chromium ~100µs/5µs, FF/Safari 1ms | HIGH | MDN High-precision-timing, Chrome developer blog |
| ratatui 0.30.2 / crossterm 0.29 / Textual 6.5.x versions | MEDIUM-HIGH | ratatui.rs/installation, search of crates.io/PyPI (not fetched from each canonical page) |
| Tauri v2 perf numbers (bundle/RAM/IPC) | MEDIUM | Multiple 2026 comparison articles, not first-party benchmarks; directional not exact |
| FastAPI 0.141.x / SQLModel 0.0.4x | MEDIUM | search aggregation; irrelevant to v1 so not deep-verified |
| Recommendation to pick Architecture A for the MVP | HIGH | Follows directly from the capture-quality analysis + single-dev/one-week constraint in PROJECT.md |
| Minor lib majors (Zustand 5, Tailwind 4, Vitest 3, Recharts 3, Dexie 4) | MEDIUM | Known-stable majors from training + ecosystem; pin exact latest at install time |

## Sources

- https://react.dev/versions — React stable = 19.2 (19.2.7) — HIGH
- https://vite.dev/releases — Vite current = 8.2.x; 7.3/8.1 in fix support — HIGH
- https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/High_precision_timing — timer clamping, cross-origin isolation → 5µs — HIGH
- https://developer.chrome.com/blog/when-milliseconds-are-not-enough-performance-now — Chromium precision tiers — HIGH
- https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/timeStamp (and /Event/timeStamp) — event timestamp is DOMHighResTimeStamp at creation — HIGH
- https://docs.rs/crossterm/latest/crossterm/event/index.html + https://github.com/crossterm-rs/crossterm/releases — KeyEventKind Press/Repeat/Release, keyboard enhancement flags — HIGH
- https://github.com/alacritty/alacritty/issues/6378 + Windows Terminal notes — Kitty protocol terminal support status 2026 — MEDIUM-HIGH
- https://ratatui.rs/installation/ — ratatui 0.30.2, crossterm 0.29, Rust 1.88 — MEDIUM-HIGH
- https://textual.textualize.io/ + PyPI — Textual 6.5.x, Python 3.9–3.x — MEDIUM
- https://tech-insider.org/tauri-vs-electron-2026/ + rustify.rs/buildmvpfast 2026 comparisons — Tauri v2 vs Electron footprint/latency — MEDIUM
- https://sqlmodel.tiangolo.com/release-notes/ + https://fastapi.tiangolo.com/release-notes/ — FastAPI 0.141.x, SQLModel 0.0.4x (not needed for v1) — MEDIUM
- Monkeytype WPM/accuracy/consistency definitions — typingtest/community docs — MEDIUM
- https://pypi.org/project/tree-sitter-language-pack/ + https://tree-sitter.github.io/py-tree-sitter/ — tree-sitter 0.25–0.26, language-pack maintained; py-tree-sitter-languages dead — MEDIUM-HIGH

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
