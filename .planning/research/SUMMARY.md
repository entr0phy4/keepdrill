# Project Research Summary

**Project:** keebdrill
**Domain:** Developer typing trainer with high-resolution keystroke telemetry (local-first, single-user)
**Researched:** 2026-09-03
**Confidence:** MEDIUM-HIGH

## Executive Summary

keebdrill is a local-first, single-user typing trainer for developers that drills on real technical corpus (code, docs, shell history) and reports code-specific metrics — symbol-adjusted WPM, per-digraph latency, keyboard heatmap, correction rate — that Monkeytype/Keybr/typing.io do not measure. Architecturally it is a linear content-and-measurement pipeline, not a service: content flows one way from source to document to kata to trainer, and keystrokes flow one way from keyboard to capture to state machine to metrics to (later) store to dashboard. There is exactly one feedback loop (the deferred drill generator) and it runs offline.

The research strongly converges on one recommendation: build v1 as a local-first browser SPA (Vite 8 + React 19.2 + TypeScript), no backend, persisting to IndexedDB via Dexie. The browser is the only capture platform that reliably delivers key-release (keyup) events, sub-millisecond monotonic timestamps, and clean key+code identity on every OS without special terminal configuration — and per-digraph/dwell latency is the product's entire reason to exist. A pure TUI is rejected for v1 (no key-release without the Kitty keyboard protocol; PTY/tmux/SSH jitter). The two-app hybrid is rejected as premature; when native filesystem/Git access is needed later, wrap the same React frontend in Tauri v2 (one codebase, not two).

The dominant risks are all in the capture and metrics layers and are cheap to prevent now, expensive later: browser timer clamping (must serve cross-origin-isolated with COOP/COEP), using event.timeStamp rather than performance.now() read in the handler, filtering OS key-repeat, freezing WPM/accuracy formulas against the industry standard before data accrues, gating "5 slowest keys" behind a minimum sample count, normalizing whitespace/newlines/tabs explicitly, and — above all — persisting the raw keydown/keyup event log (not just computed metrics) from session one, because every deferred feature is pure post-processing over that log. The other project-level risk is scope creep: v1 must ship exactly the 5 active requirements and nothing else until a week of real self-use is logged.

## Key Findings

### Recommended Stack

Local-first browser SPA, no server. Vite 8.2 + React 19.2 + TypeScript (strict, noUncheckedIndexedAccess). Keystroke capture via keydown/keyup listeners reading event.timeStamp, with the handler doing nothing but pushing to a buffer. Persistence via Dexie 4 (IndexedDB). Metrics engine is a hand-written pure TS module (~150 lines, golden-tested) — the product's IP, not a library. Evolution path: wrap the same frontend in Tauri v2 when native Git/filesystem/shell access is needed. FastAPI/PostgreSQL only if keebdrill ever becomes hosted multi-user (out of scope).

**Core technologies:**
- Vite 8.2 + @vitejs/plugin-react — dev server + static build — instant HMR, zero-config TS, no SSR to fight
- React 19.2 + TypeScript 5.7+ — UI + type-safe metrics engine — ecosystem default; types are where digraph/quantile bugs hide
- Dexie 4 (IndexedDB) — session + raw keystroke-log persistence — smallest path to durable local storage, no daemon
- Zustand 5 — minimal global UI state (idle/typing/done) — no boilerplate, no provider tree
- Vitest 3 + Playwright 1.4x — unit tests for metrics (golden files) + E2E typing simulation
- COOP/COEP headers (vite.config.ts + host) — unlock Chromium 5us timer resolution (else ~100us; Firefox 1ms)
- Deferred: web-tree-sitter 0.25+ (WASM chunking), Recharts 3 / uPlot (dashboard), Tauri v2 (native host)

### Expected Features

keebdrill competes by measuring code-specific typing effort. Table stakes make it feel non-broken to a developer who has used Monkeytype; differentiators (mostly post-v1) are per-digraph latency, symbol-adjusted WPM, heatmap, per-language profiles, and repo/docs/shell source modes. Do not ship differentiators at once — the v1 data model just needs to record everything (raw events, language tag, source type) so nothing is lost.

**Must have (table stakes / v1):**
- Paste text or upload a file as exercise source — the input to the whole loop
- Live per-character correctness feedback while typing — otherwise the typing view is unusable
- High-resolution keydown/keyup capture with monotonic timestamps — the engine everything depends on
- WPM (standard 5-char-word net) and accuracy for the completed exercise — the expected headline numbers
- Top 5 slowest keys/keystrokes (with sample-count gating) — first taste of the code-specific angle
- One decided error-handling mode (recommend free typing, track corrected + uncorrected) — required to build the state machine
- Restart current exercise — trivial, expected

**Should have (competitive / v1.x, trigger: daily loop useful for a week):**
- Local session persistence with {text, language, source_type, timestamp} + keystroke aggregates
- Per-digraph / bigram latency table (top slow transitions) — the actionable unit of improvement
- Keyboard heatmap (speed + error per key, US ANSI)
- Symbol-density-adjusted WPM + correction/efficiency score (net/gross ratio) — tie weights to measured latency, not guesses
- Historical progress charts (latency trend per digraph/language) — this IS the one-month success metric
- Symbols drill mode ({}[]()<>, =>, ::, !==, |>, shifted number row)

**Defer (v2+):**
- Per-language profiles with separate baselines — needs sustained multi-language history
- Repo kata mode (local/remote Git ingest) — Git plumbing + tree-sitter + privacy guarantees are a milestone of their own
- tree-sitter syntactic chunking (function/block reps)
- Docs mode / shell-history mode — parallel source adapters
- Adaptive drill generation from detected weaknesses — hardest feature; needs history + code-plausible generator
- Fixed 10-minute Daily session with adaptive progression
- Non-US-ANSI keyboard layouts
- Anti-features: accounts/auth/cloud sync, gamification (streaks/XP/badges), multiplayer/races, forced-correction in v1, real-time keystroke streaming to a backend, filesystem auto-ingest

### Architecture Approach

A one-directional pipeline with clean value-passing seams. capture/ is the only platform-coupled module; everything downstream consumes KeystrokeEvent[]. The Session State Machine is the only place the correction policy lives (it is a state question — can the cursor advance past an error — not a measurement question). The Metrics Engine is pure functions with zero I/O, re-runnable over any historical log. Persist the raw event log as source of truth (lightweight event sourcing); metrics are a derived, cached view. Two-tier metrics: cheap incremental path for live WPM, full batch pass at session end. Chunking and ingestion sit behind strategy interfaces (ChunkStrategy, Source) so naive->tree-sitter and paste->git are additive.

**Major components (hard serial chain: Capture -> State Machine -> Metrics -> Trainer UI):**
1. Capture Engine — subscribe to key events, stamp with monotonic hi-res clock, normalize to KeystrokeEvent, guard paste/IME/repeat/blur
2. Session State Machine — join events with target text: cursor, per-char verdict, backspace, correction policy -> AnnotatedKeystroke[]
3. Metrics Engine — pure functions: net/raw WPM, accuracy, per-key & per-digraph latency, slowest-N, consistency, correction rate
4. Ingestion Sources — adapters returning normalized Document{text, language, provenance} (v1: paste + upload)
5. Chunker / Kata Builder — Document -> Kata[] (v1: naive whole-doc or time-windowed, behind ChunkStrategy)
6. Session Store — append/query raw KeystrokeEvent[] + cached SessionMetrics (v1: in-memory; later: SQLite)
7. Trainer UI — render kata text, caret, per-char coloring, live stats (windowed rendering from day one)
8. Dashboard UI + Drill Generator — later phases, read-only over store aggregates / offline batch

### Critical Pitfalls

1. **Browser timer precision clamping** — performance.now()/event.timeStamp clamp to 100us (Chrome) / 1ms (Firefox) unless cross-origin isolated. Serve with COOP same-origin + COEP require-corp from day one; verify crossOriginIsolated === true; store timing_resolution_us per session.
2. **Wrong timestamp source** — reading performance.now() in the handler measures when your JS got scheduled (contention, GC, React re-render), not when the key was pressed. Use event.timeStamp; keep the listener to a single buffer push; no per-keystroke React state updates.
3. **OS key-repeat counted as keystrokes** — held keys emit keydown streams creating fake ~30-60ms digraphs. Ignore event.repeat === true; track a per-code "currently down" set as a fallback.
4. **Ambiguous WPM/accuracy definitions** — invent your own and numbers aren't comparable to Monkeytype or your past self. Adopt standard: net WPM = correct chars / 5 / minutes; accuracy = correct / total keypresses (corrections in denominator); clock starts on first keystroke. Write the formula in the spec, version the metric schema, keep adjusted-WPM as a separate labeled metric.
5. **Small-sample "5 slowest keys"** — n=1-2 samples per digraph on a short snippet is noise; users chase phantom weaknesses. Require min sample count (>=5), use median/trimmed mean, filter gaps >1000ms (read-ahead pause) and <25ms (repeat artifact), show "not enough data," aggregate across sessions for the real profile.
6. **Whitespace/newline/Tab mishandling** — CRLF, no-final-newline, tabs-vs-spaces, trailing whitespace produce phantom errors at line ends. v1: normalize (CRLF->LF, tabs->spaces configurable width, strip trailing, single trailing newline), require explicit whitespace typing, render whitespace glyphs, unit-test the normalizer.
7. **Persisting only aggregates, discarding raw event log** — every future feature (heatmap, digraph profile, adaptive drills, metric bug fixes) becomes impossible. Persist full KeystrokeEvent[] (a few KB/session) from session 1; treat metrics as a cache. This is "never acceptable" tech debt.
8. **preventDefault() on keydown for a controlled input** — breaks dead keys, IME, AltGr (where {}[] live on EU/LATAM layouts), blocks the non-US-layout roadmap. Read committed text from input/beforeinput, use keydown/keyup only for timing; detect compositionstart; show a "US ANSI only" banner in v1.
9. **Corpus licensing / privacy leak** — ingested third-party code in git history, telemetry, crash reports, or a synced DB is redistribution (no-license = all rights reserved). Local-only from day one; gitignore corpus cache; store only derived non-reconstructive metrics centrally if a dashboard is ever built; scrub shell-history secrets.
10. **Data loss on lifecycle boundaries** — dropped first keystroke, clock started on mount, blur/alt-tab counted as typing time, paste of the answer, reload losing the session. Start timer on first keydown; pause/flag on blur/visibilitychange; block/flag paste; persist incrementally; compute elapsed as sum of active intervals.

## Implications for Roadmap

Research points to a tight v1 (the serial capture->metrics->UI chain, one platform, in-memory), then persistence, then analytics, then the deferred source-ingest and adaptive milestones.

### Phase 1: Foundation — Capture Engine + Corpus Ingest + Naive Chunker
**Rationale:** Everything depends on the capture data model and the event shape; get it right once. Ingestion (paste/upload) and naive chunking are trivial parallel tracks that only need to emit Document/Kata.
**Delivers:** keydown/keyup listeners reading event.timeStamp, normalized append-only KeystrokeEvent[] (seq, key, code, modifiers, tMonotonic, isRepeat); paste + file-upload adapters producing Document{text, language, sourceRef}; ChunkStrategy interface + NaiveChunker; COOP/COEP headers configured; US-ANSI layout detection banner.
**Addresses:** "paste or upload a file", "type with keydown/keyup capture at high-resolution timestamps"
**Avoids:** Pitfalls 1, 2, 3, 7, 8, 10

### Phase 2: Session State Machine + Correction Policy
**Rationale:** The correction-policy decision (PROJECT.md open question) must be resolved here, not bolted on later — free vs forced is a different reachable-state set. Free-correction is the smaller build and the recommended v1 choice.
**Delivers:** Pure reducer joining KeystrokeEvent[] with Kata.text -> AnnotatedKeystroke[] (targetIndex, expected/actual, verdict, flightMs, dwellMs?, digraph, corrected, sinceStartMs); backspace handling; corpus normalizer (CRLF/tabs/trailing-ws/BOM) with unit tests.
**Implements:** Session State Machine
**Avoids:** Pitfalls 5, 6; Anti-pattern "policy in metrics"

### Phase 3: Metrics Engine v1 + Trainer UI  (END OF v1 MVP)
**Rationale:** Metrics is a pure fold over Phase 2 output; the UI is the last link in the serial chain. Build digraph aggregation now even though only slowest-keys is shown — it is cheap and the seam matters.
**Delivers:** net/raw WPM, accuracy, per-key flight time -> 5 slowest keys (with min-sample gating + median + outlier filter); realtime tier (live WPM + progress); Trainer UI with windowed rendering, caret, per-char coloring, visible whitespace glyphs, end-of-session results panel. Session lives in memory.
**Addresses:** "sees WPM", "sees accuracy", "sees five slowest keys"; restart exercise
**Uses:** React 19.2, hand-written TS metrics module, Vitest golden tests
**Avoids:** Pitfalls 4, 5; UX pitfalls (WPM matches Monkeytype, whitespace visible)

### Phase 4: Session Persistence (post-validation, trigger: one week of daily self-use)
**Rationale:** First post-MVP phase. Needed the moment you want yesterday-vs-today. Records language tag + source type so history is retroactively partitionable.
**Delivers:** Dexie/IndexedDB storing raw KeystrokeEvent[] + cached SessionMetrics + {language, source_type, timestamp}; incremental persistence for crash recovery; corpus-cache gitignore + telemetry-exclusion guardrails.
**Implements:** Session Store
**Avoids:** Pitfalls 7, 9, 10

### Phase 5: Code-Specific Analytics
**Rationale:** The differentiators, now that raw history exists. Per-digraph latency and symbol-adjusted WPM are what the product is for; the historical trend chart is literally the one-month success criterion.
**Delivers:** per-digraph latency table, keyboard heatmap (speed + error), symbol-density-adjusted WPM + efficiency score, historical progress charts, symbols drill mode.
**Implements:** Metrics Engine post-session tier extensions, Dashboard UI
**Avoids:** Pitfall 5 (cross-session aggregation is where slowest-key becomes meaningful)

### Phase 6+: Source Ingest + Chunking Milestone (later)
**Rationale:** Git/docs/shell adapters + tree-sitter chunking + privacy guarantees are a milestone of their own; needs a backend (Tauri) for filesystem/subprocess access.
**Delivers:** Tauri v2 host, git/docs/shell-history Source adapters, TreeSitterChunker behind the existing interface, local-only privacy enforcement + README posture.
**Avoids:** Pitfall 9; Anti-patterns "tree-sitter in v1", "hybrid up front", "ingestion coupled to trainer"

### Phase 7+: Adaptive Drill Generation (later)
**Rationale:** Hardest feature; needs months of stored history plus a code-plausible fragment generator. The only feedback loop in the system; offline batch.

### Phase Ordering Rationale
- Capture -> State Machine -> Metrics -> Trainer UI is a hard serial dependency chain confirmed by both ARCHITECTURE and FEATURES; ingest + chunker is a parallel track within Phase 1.
- Persistence deliberately comes after the MVP so scope creep (Pitfall 9) can't delay validation; but the Phase 1 data model is built append-only and complete so persistence is non-breaking.
- Analytics before source-ingest: the differentiator metrics prove value on pasted corpus before investing in Git plumbing and a backend.
- One platform (browser) for v1; the hybrid/TUI question is explicitly a v2+ decision and must not block Phase 1.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** COOP/COEP deployment specifics, navigator.keyboard.getLayoutMap() support, input/beforeinput vs keydown reconciliation for the character stream, event.timeStamp epoch behavior across target browsers.
- **Phase 5:** symbol-adjusted WPM weighting model (must be latency-tied), consistency metric definition, statistical thresholds for digraph stability.
- **Phase 6+:** Tauri v2 keystroke-capture parity in platform WebViews, tree-sitter WASM grammar management, shell-history secret scrubbing, git ingest licensing posture.
- **Phase 7+:** code-plausible drill generation, weakness-detection ranking.

Phases with standard patterns (skip research-phase):
- **Phase 2:** state machine / reducer is well understood; the only open question (correction policy) is a decision, not research.
- **Phase 3:** WPM/accuracy formulas are documented (Monkeytype); metrics are pure functions with golden tests.
- **Phase 4:** Dexie/IndexedDB persistence is well-documented and small.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | React 19.2 / Vite 8.2 currency verified against official release pages; timer-clamping verified against MDN/Chrome/W3C; minor lib majors known-stable, pin at install; Tauri perf numbers directional only |
| Features | MEDIUM | Competitor feature sets corroborated across multiple sources; no primary user research beyond the author; specific digraph-latency numbers LOW |
| Architecture | MEDIUM-HIGH | Capture-engine platform differences documented (HIGH); component decomposition and build order are design judgment (MEDIUM) |
| Pitfalls | MEDIUM-HIGH | Timing/browser behavior HIGH from MDN/Chrome/W3C; statistical-validity and corpus-licensing MEDIUM; UX pitfalls MEDIUM |

**Overall confidence:** MEDIUM-HIGH — the load-bearing decision (browser capture for v1) and the critical pitfalls are well-sourced; feature prioritization and later-phase specifics carry normal early-stage uncertainty.

### Gaps to Address

- **Correction policy (free vs forced)** — PROJECT.md open decision; resolve at the start of Phase 2. Research recommends free typing.
- **Indentation / auto-indent model** — PROJECT.md open decision. Research recommends normalize + require explicit whitespace typing for v1, with a documented config toggle. Resolve during Phase 2.
- **Content scope (structural code only vs comments/strings)** — PROJECT.md open decision; low urgency, affects normalizer defaults. Decide during Phase 1/2.
- **Symbol-adjusted WPM formula** — no established standard; must be designed and tied to measured per-key latency. Phase 5 research.
- **Character-stream capture approach** — input/beforeinput + keydown-for-timing reconciliation recommended over preventDefault, but needs a spike in Phase 1 to confirm caret control.
- **Tauri WebView timing parity** — macOS WKWebView ~1ms clamp, Linux WebKitGTK coarser; validate empirically before committing native.

## Sources

### Primary (HIGH confidence)
- react.dev/versions, vite.dev/releases — React 19.2.7 / Vite 8.2.x current (Sept 2026)
- MDN High precision timing; Chrome "When milliseconds are not enough" + cross-origin isolation timers — clamping 100us default / 5us isolated, Firefox 1ms
- MDN KeyboardEvent (repeat, keyCode 229 IME); Event/KeyboardEvent timeStamp — DOMHighResTimeStamp at event creation, monotonic
- Chrome "Aligning input events" — keydown/keyup dispatched immediately, not rAF-coalesced
- MDN Element keydown event; W3C UI Events keyboard/key values — dead-key + composition behavior
- crossterm docs + issues #950/#642; kitty keyboard-protocol docs — no key-release in legacy terminals; Kitty protocol press/repeat/release
- Robert Elder "Why is it so hard to detect keyup events on the Linux terminal?"
- Monkeytype About — WPM = correct chars / 5 normalized to 60s; raw WPM includes errors; accuracy = % correct keypresses
- docs.rs/ratatui installation — ratatui 0.30.2 / crossterm 0.29 / Rust 1.88 (TUI alternative, reference only)

### Secondary (MEDIUM confidence)
- typing.io, SpeedCoder, Keybr reviews / algorithm write-ups — competitor feature sets, error-handling modes, adaptivity
- typetest.io / speedtypingonline WPM normalization — net vs raw WPM conventions
- Tauri vs Electron 2026 comparison articles — Tauri v2 footprint/RAM/IPC (directional)
- treesitter-chunker / Supermemory AST-chunking — tree-sitter function-boundary chunking feasibility
- Nolan Lawson "High-performance input handling on the web" / "input events and frame throttling"
- InfoWorld / Saveri / zephyrtronium — GitHub Copilot litigation; no-license = all rights reserved; MIT/BSD attribution
- SQLModel / FastAPI release notes — 0.141.x / 0.0.4x (only relevant if ever hosted)

### Tertiary (LOW confidence)
- CHI 2018 "136 Million Keystrokes" (Aalto) — digraph-latency ranges (60-300ms) only
- arXiv 2303.04605 Keystroke Dynamics survey; Frontiers in Human Neuroscience — ~1000+ digraphs for a usable profile; sample-size effects
- TiltStack "Code Typing Speed Actually Matters" — prose-vs-code character distribution, efficiency-score framing
- TypingTest bigram blitz / TypingMaster typing meter — per-key heatmap precedent
- lobste.rs tabs-vs-spaces discussion — auto-indent training trade-offs
- Personal-domain reasoning — symbol-density WPM design, session-lifecycle data loss, scope-lock against PROJECT.md Out of Scope

---
*Research completed: 2026-09-03*
*Ready for roadmap: yes*
