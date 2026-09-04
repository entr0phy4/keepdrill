# Architecture Research

**Domain:** Developer typing-trainer (local-first, single-user) — high-resolution keystroke capture + code-specific typing analytics
**Researched:** 2026-09-03
**Confidence:** MEDIUM-HIGH (capture-engine platform differences: HIGH, documented; component decomposition + build order: MEDIUM, design judgment applied to the stated scope)

## Standard Architecture

keebdrill is a **linear content-and-measurement pipeline**, not a service mesh. Content flows
in one direction from a source to a typing target; keystrokes flow in one direction from the
keyboard to a metrics report. There is exactly one feedback loop (the drill generator, a later
phase) and it runs offline, not in the hot path.

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CONTENT TRACK (one-way)                        │
│  ┌───────────────┐   ┌────────────┐   ┌───────────────┐               │
│  │  Ingestion    │──▶│  Document  │──▶│   Chunker /   │──▶ Kata[]     │
│  │  Sources      │   │ (normalized│   │  Kata Builder │   (15-60s     │
│  │ paste│upload  │   │  text +    │   │  v1: naive    │    targets)   │
│  │ (later: git,  │   │  language) │   │  later: tree- │               │
│  │  docs, shell) │   │            │   │  sitter CST)  │               │
│  └───────────────┘   └────────────┘   └───────────────┘               │
├──────────────────────────────────────────────────────────────────────┤
│                       TRAINER (live loop)                             │
│  ┌───────────────┐   ┌───────────────────┐   ┌────────────────────┐   │
│  │   Trainer UI  │◀─▶│  Session State    │◀──│  Capture Engine    │   │
│  │  renders Kata │   │  Machine          │   │  key events +      │   │
│  │  text, caret, │   │  cursor, per-char │   │  monotonic hi-res  │   │
│  │  per-char clr │   │  verdict, backsp, │   │  timestamps,       │   │
│  │  live stats   │   │  correction policy│   │  normalization     │   │
│  └───────┬───────┘   └─────────┬─────────┘   └────────────────────┘   │
│          │                     │ AnnotatedKeystroke[]                 │
│          │ realtime metrics    ▼                                      │
│          │           ┌───────────────────┐                            │
│          └───────────│  Metrics Engine   │  (pure functions)          │
│                      │  realtime: WPM,   │                            │
│                      │  progress         │                            │
│                      │  post-session:    │                            │
│                      │  accuracy, per-   │                            │
│                      │  key/digraph      │                            │
│                      │  latency, slowest │                            │
│                      └─────────┬─────────┘                            │
├────────────────────────────────┼─────────────────────────────────────┤
│                       PERSISTENCE + REPORTING (later phases)          │
│                      ┌─────────▼─────────┐   ┌────────────────────┐   │
│                      │  Session Store    │──▶│  Dashboard UI      │   │
│                      │  raw event log +  │   │  trends, heatmap,  │   │
│                      │  cached metrics   │   │  digraph table,    │   │
│                      │  v1: in-memory    │   │  per-language      │   │
│                      │  later: SQLite    │   │  profile           │   │
│                      └─────────┬─────────┘   └────────────────────┘   │
│                                │                                      │
│                      ┌─────────▼─────────┐                            │
│                      │  Drill Generator  │── synthetic Document ──▶   │
│                      │  weakness detect  │   (back into Chunker)      │
│                      │  → targeted text  │                            │
│                      └───────────────────┘                            │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Owns | Does NOT know about | Typical Implementation |
|-----------|------|---------------------|------------------------|
| **Capture Engine** | The raw input event stream: subscribe to key events, stamp each with a monotonic high-resolution clock, normalize to `KeystrokeEvent`, emit an ordered log. Guard against paste / IME / auto-repeat / blur. | Target text, correctness, WPM, scoring | Browser: `keydown`/`keyup` listeners on a focused element + `performance.now()`. TUI: stdin raw mode + per-read `perf_counter_ns()`. |
| **Session State Machine** | "Where am I in the target." Joins `KeystrokeEvent[]` with `Kata.text`: cursor position, per-character status (untyped / correct / incorrect / corrected), backspace handling, error-correction policy (mandatory vs free). Emits `AnnotatedKeystroke[]`. | How WPM/latency are computed; rendering | Pure reducer / state machine, one per session. This is the **only** place the correction policy lives. |
| **Metrics Engine** | Pure, stateless functions over `AnnotatedKeystroke[]`. Realtime tier (cheap, incremental): live WPM, progress, running accuracy. Post-session tier (full pass): net/raw WPM, accuracy, per-key & per-digraph latency, five slowest keys, consistency, correction rate; later: keyboard heatmap, per-language profile. | Where events came from, where results go, DB | Library of pure functions. No I/O. Re-runnable over any historical event log. |
| **Ingestion Sources** | Turn a source into a normalized `Document` (raw text + detected language + provenance metadata). v1: paste + file upload. Later: git repo walker, docs parser (Markdown/rST/man), shell-history reader. | Katas, durations, typing | One adapter per source, all returning the same `Document` shape. Later sources need filesystem/subprocess access → backend. |
| **Chunker / Kata Builder** | `Document` → ordered `Kata[]`, each a 15-60s typing target with provenance spans back into the document. v1: naive (whole doc, or fixed line/char window with a typing-time estimate). Later: tree-sitter parse → walk CST → cut on syntactic boundaries (functions, classes, YAML blocks), pack into duration-bounded chunks. | Capture, metrics, storage | v1: ~30 lines. Later: `web-tree-sitter` (WASM) in browser or native bindings in backend, **behind the same interface**. |
| **Session Store** | Append + query `SessionRecord` (kata ref, full raw `KeystrokeEvent[]`, cached `SessionMetrics`, timestamps, source). v1: in-memory object. Later: SQLite with date/language indices + aggregate tables. | Everything else — it is a passive repository | v1: a variable. Later: SQLite via a thin repository module. |
| **Drill Generator** (later) | Read aggregated metrics from the store, detect weaknesses (slow digraphs, error-prone keys), synthesize targeted practice text (generated symbol sequences and/or filtered corpus lines), emit a synthetic `Document`. | Live capture, rendering | Offline batch job. Feeds its output back into the Chunker — the one cycle in the system. |
| **Dashboard / Reporting UI** (later) | Read-only views over store aggregates: WPM trend, keyboard heatmap, digraph latency table, per-language profile, correction-rate trend. | Writing data, live capture | Same frontend stack as the Trainer UI; a separate route/screen. |
| **Trainer UI** | Render the current `Kata` text, caret, per-character coloring from the state machine, and live stats from the realtime metrics tier. Capture the session's start/stop. | How verdicts or metrics are computed | The live typing screen. Subscribes to State Machine + Metrics Engine. |

## Recommended Project Structure

Stack-agnostic module layout (names map cleanly onto a React+TS SPA, a FastAPI+React app, or a Rust/Python TUI):

```
src/
├── capture/                # Capture Engine — platform-specific, isolated
│   ├── types.ts            # KeystrokeEvent, KeyboardLayout
│   ├── browser-capture.ts  # keydown/keyup + performance.now(); paste/IME/repeat guards
│   └── (tui-capture.rs)    # later: raw-mode stdin + Kitty protocol negotiation
├── session/                # Session State Machine
│   ├── state-machine.ts    # reducer: events + target -> AnnotatedKeystroke[]
│   ├── correction-policy.ts# mandatory | free-correction strategies
│   └── types.ts            # AnnotatedKeystroke, CharStatus, SessionState
├── metrics/                # Metrics Engine — pure, no I/O
│   ├── realtime.ts         # incremental: live WPM, progress, running accuracy
│   ├── wpm.ts              # net / raw WPM, normalized
│   ├── latency.ts          # per-key flight time, per-digraph latency, slowest-N
│   ├── accuracy.ts         # error rate, correction rate
│   ├── consistency.ts      # coefficient of variation of raw WPM over time
│   └── (heatmap.ts, profile.ts)   # later
├── ingestion/              # Ingestion Sources
│   ├── types.ts            # Document, SourceRef, Language
│   ├── paste.ts            # string -> Document
│   ├── file-upload.ts      # File -> Document (language from extension)
│   └── (git.ts, docs.ts, shell-history.ts)   # later, backend-side
├── chunking/               # Chunker / Kata Builder
│   ├── types.ts            # Kata, ChunkStrategy interface
│   ├── naive.ts            # v1: window by estimated typing time
│   └── (tree-sitter.ts)    # later: CST-boundary chunking, same interface
├── store/                  # Session Store
│   ├── types.ts            # SessionRecord, SessionMetrics
│   ├── memory-store.ts     # v1
│   └── (sqlite-store.ts)   # later
├── drills/                 # Drill Generator — later
├── ui/
│   ├── trainer/            # live typing screen
│   └── dashboard/          # later: reporting screens
└── app.ts                  # wiring / composition root
```

### Structure Rationale

- **`capture/` is the only platform-coupled module.** Everything downstream consumes
  `KeystrokeEvent[]`. Swapping browser → TUI, or adding a TUI client alongside the web app,
  touches only this folder plus a new composition root.
- **`session/` owns the correction policy, not `metrics/`.** Whether every error must be fixed
  is a *state* question ("can the cursor advance past an error?"), not a *measurement* question.
  Keeping it here means the Metrics Engine stays a set of pure functions that never branch on
  policy.
- **`metrics/` has zero I/O and zero dependencies on `store/` or `ui/`.** It is re-runnable over
  any historical event log. This is load-bearing: the entire project premise is that the metric
  set will grow (heatmap, per-language profile, new digraph analyses), and you will want to
  re-analyze old sessions with new metrics.
- **`chunking/` defines `ChunkStrategy` now and ships the naive implementation.** tree-sitter is
  a drop-in behind that interface later — deferring it costs nothing if the seam exists.
- **`ingestion/` adapters all return `Document`.** The Trainer never sees a git repo or a shell
  history file — only normalized text + a language tag + provenance.

## Architectural Patterns

### Pattern 1: Event-log as source of truth (event sourcing, lightweight)

**What:** The Capture Engine produces an immutable, ordered `KeystrokeEvent[]`. All state (cursor
position, per-char verdict) and all metrics are *derived* by replaying that log. The Session
Store persists the **raw log**, not just computed metrics.

**When to use:** Whenever the downstream analysis is expected to evolve. That is exactly this
project — the differentiator is a growing set of code-specific metrics.

**Trade-offs:** More storage per session (a 60s code kata ~= 300-600 events ~= a few KB
uncompressed; trivial for single-user). Buys the ability to answer questions you had not thought
of yet ("what was my `->` latency six months ago?") and to fix metric bugs retroactively.

```typescript
// Everything is a fold over the log
const state   = keystrokes.reduce(applyKeystroke, initialState(kata.text));
const metrics = analyze(state.annotated);          // pure, re-runnable
store.append({ kataId, events: keystrokes, metrics }); // persist RAW events
```

### Pattern 2: Two-tier metrics (realtime incremental vs post-session full pass)

**What:** Split the Metrics Engine into a cheap incremental path (updates a small accumulator on
each keystroke: elapsed time, correct-char count → live WPM) and an expensive batch path (one
full pass over the annotated log at session end for digraph latency, slowest keys, consistency).

**When to use:** Any live-feedback UI. Keeps per-keystroke work O(1) so the hot path never
stutters, while allowing arbitrarily rich end-of-session analysis.

**Trade-offs:** Two code paths for "WPM". Mitigate by having the realtime path compute only the
handful of numbers actually shown live, and treating the batch path as authoritative.

### Pattern 3: Strategy interface for chunking (and for ingestion sources)

**What:** `interface ChunkStrategy { chunk(doc: Document): Kata[] }`. v1 registers `NaiveChunker`;
a later phase registers `TreeSitterChunker`. Same for ingestion: `interface Source { load(input): Document }`.

**When to use:** When a component has a known-cheap v1 and a known-expensive "real" version, and
the roadmap explicitly defers the expensive one.

**Trade-offs:** A small amount of indirection now. Prevents the naive implementation's assumptions
(e.g. "a kata is a slice of lines") from leaking into the Trainer and Metrics code.

### Pattern 4: Optional fields for platform-variable capture data

**What:** `KeystrokeEvent.type` may be `"keyup"` or not; `dwellMs` may be absent. The state
machine and metrics engine treat keyup / dwell as a bonus, and always rely on
keydown→keydown **flight time** as the primary latency signal.

**When to use:** Cross-target capture (browser has native keyup; legacy terminals do not — see
below).

**Trade-offs:** Metrics that need dwell time (e.g. true key-hold analysis) are conditionally
available. Acceptable — flight time / inter-key interval is the metric that matters for digraph
latency, and it is always present.

## Data Flow

### Content flow (one-way, happens before typing)

```
paste string  ──┐
file upload    ──┼──▶ Ingestion adapter ──▶ Document{ text, language, sourceRef }
(later: git)   ──┘                              │
                                                ▼
                                    Chunker.chunk(doc) ──▶ Kata[]{ text, provenanceSpan }
                                                │
                                                ▼
                                    Trainer UI renders Kata.text
```

### Keystroke flow (one-way, during typing)

```
physical keypress
      ↓
Capture Engine  ──▶  KeystrokeEvent{ seq, type, key, code, modifiers, tMonotonic, isRepeat }
      ↓  (ordered log, buffered — NOT analyzed in the handler)
Session State Machine  ──join with Kata.text──▶  AnnotatedKeystroke{ ...event, targetIndex,
      ↓                                            expected, actual, verdict, flightMs,
      ↓                                            dwellMs?, digraph, corrected, sinceStartMs }
      ├──▶ realtime Metrics tier ──▶ live WPM / progress ──▶ Trainer UI
      │
      └──(on completion)──▶ post-session Metrics tier ──▶ SessionMetrics{ wpmNet, wpmRaw,
                                                            accuracy, correctionRate,
                                                            consistency, perKeyLatency,
                                                            perDigraphLatency, slowestKeys[5] }
                                    │
                                    ▼
                          Session Store.append(SessionRecord{ events[], metrics })   // later phase
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
          Dashboard UI (aggregate reads)   Drill Generator ──▶ synthetic Document ──▶ Chunker
```

### The keystroke-event data model

Design goal: one record shape that supports **every planned metric** — net/raw WPM, accuracy,
per-key latency, per-digraph (bigram) latency, keyboard heatmap, per-language profile, correction
rate, and consistency (variance over time).

**`KeystrokeEvent`** — emitted by the Capture Engine, persisted verbatim:

| Field | Type | Purpose / which metric needs it |
|-------|------|--------------------------------|
| `seq` | int (monotonic) | Stable ordering; tie-break when timestamps clamp to equal values |
| `type` | `"keydown"` \| `"keyup"` | keyup optional (absent in legacy TUI). Enables dwell time |
| `key` | string | Logical value (`"a"`, `"{"`, `"Shift"`, `"Backspace"`, `"Enter"`, `"Tab"`) — `KeyboardEvent.key` semantics. Drives correctness + per-character metrics |
| `code` | string | Physical key (`"KeyA"`, `"BracketLeft"`, `"Digit2"`) — `KeyboardEvent.code` semantics. Drives the keyboard heatmap and layout-independent analysis |
| `modifiers` | `{shift,ctrl,alt,meta: bool}` | State at event time. Needed to attribute shifted symbols (`{`, `_`, `|`, `~`) and to measure the shifted-number-row cost |
| `tMonotonic` | float ms | High-resolution **monotonic** timestamp. The primary timing field. All latency = differences of this |
| `isRepeat` | bool | OS auto-repeat (held key). Excluded from latency stats and error counts |
| `eventTimeStamp` | float ms (browser only) | Raw `event.timeStamp` kept for cross-check against handler-side `performance.now()` |

**Session-level** (stored once, not per event): `sessionId`, `kataId`, `sourceRef`, `language`,
`keyboardLayout`, `startedAtEpoch` (wall clock, for display only), `targetText` (or hash + ref),
`captureCapabilities` (`{hasKeyup, hasModifierEvents, protocol}`).

**`AnnotatedKeystroke`** — produced by the State Machine, consumed by Metrics (derived, not
necessarily persisted separately since it is a pure function of the event log + target):

| Field | Purpose |
|-------|---------|
| `targetIndex` | Cursor position in `targetText` this event acts on |
| `expected` / `actual` | Expected char at that index vs char produced |
| `verdict` | `"correct"` \| `"incorrect"` \| `"correction"` (backspace) \| `"navigation"` \| `"ignored"` |
| `flightMs` | `tMonotonic` − previous keydown `tMonotonic` — inter-key interval = **digraph latency** |
| `dwellMs` | `keyup.t` − `keydown.t` for this key, when keyup is available |
| `digraph` | `(prevChar, thisChar)` tuple — aggregation key for per-bigram latency |
| `corrected` | Was an earlier error at this index later fixed — feeds correction rate |
| `sinceStartMs` | Offset from first keystroke — time-series buckets for consistency / WPM-over-time graph |

**Key decisions this model forces onto the roadmap:**
1. **Persist raw `KeystrokeEvent[]`, not only `SessionMetrics`.** Non-negotiable given the
   evolving metric set. The store schema is "one blob of events + one cache of metrics per
   session."
2. **`tMonotonic` is monotonic-clock only** (`performance.now()` / `Instant` / `perf_counter_ns`).
   Never `Date.now()` / wall clock — it is non-monotonic (NTP corrections) and lower resolution.
3. **Capture both `key` and `code`.** `key` for correctness, `code` for the heatmap. Retrofitting
   `code` later means old sessions cannot produce a heatmap.

## Suggested Build Order

Dependency reality: **Capture → State Machine → Metrics → Trainer UI is a hard serial chain.**
Ingestion + Chunker is an independent parallel track that only has to emit `Document` / `Kata`.
Store slots in after Metrics. Dashboard needs Store + history. Drill Generator needs Store +
accumulated metrics + weakness analytics.

| Order | Component | Scope at this step | Depends on | Notes for roadmap |
|-------|-----------|--------------------|-----------|-------------------|
| **1** | Capture Engine | keydown/keyup, `performance.now()`, normalize to `KeystrokeEvent`, guard paste/IME/repeat/blur | — | Foundational. Everything waits on the event shape. Nail the data model here |
| **1 (parallel)** | Ingestion: paste + upload | string / `File` → `Document` (+ language from extension) | — | Trivial. Can be built alongside capture |
| **1 (parallel)** | Naive Chunker | whole `Document` as one `Kata`, or window by estimated typing time; define `ChunkStrategy` interface | Document | ~30 lines. The interface matters more than the impl |
| **2** | Session State Machine | join events with target, backspace, per-char verdict, pick a correction policy (free-correction is the smaller build) | Capture, Chunker | The correction-policy decision (PROJECT.md open question) must be resolved here |
| **3** | Metrics Engine v1 | net/raw WPM, accuracy, per-key flight time → five slowest keys; realtime tier = live WPM + progress | State Machine | Pure functions. Build digraph aggregation now even if not shown — cheap |
| **4** | Trainer UI | render target, caret, per-char coloring, live stats, end-of-session results panel | State Machine, Metrics | **End of v1 MVP.** Session lives in memory; no persistence |
| **5** | Session Store (SQLite) | append + list; persist raw `KeystrokeEvent[]` + cached `SessionMetrics` | Metrics | First post-MVP phase. Introduces a backend if the v1 was frontend-only |
| **6** | Dashboard / Reporting UI | WPM trend, digraph latency table, keyboard heatmap, per-language profile | Store + accumulated sessions | Needs real history to be meaningful — sequence after a week of stored sessions |
| **7** | tree-sitter Chunker | replace `NaiveChunker` with CST-boundary chunking behind the same interface | Chunker interface | Drop-in. Isolated risk |
| **8** | Ingestion: git repo / docs / shell history | new `Source` adapters → `Document`; local-only file/subprocess access | Backend (from step 5), Chunker | Honor the privacy constraint: ingested third-party content never leaves the machine |
| **9** | Drill Generator | weakness detection over store aggregates → synthetic `Document` → back into Chunker | Store, Metrics, weakness analytics | The only feedback loop. Offline batch, not hot path |

## Browser vs TUI: how the Capture Engine differs

This is the decision that "conditions the design of the capture engine" (PROJECT.md). The two
targets are materially different in what raw signal they can even observe.

| Aspect | Browser | TUI (terminal) |
|--------|---------|----------------|
| **Event source** | `keydown` / `keyup` DOM events on a focused element | `stdin` in raw mode (`termios`: clear `ICANON`+`ECHO`, `VMIN=1 VTIME=0`); a **byte stream** you parse into key events |
| **Key release / dwell time** | Native `keyup` → real dwell time available for free | **No key-release events in legacy terminals.** A TTY is a data stream, not an event source — "byte available" is the only signal, equivalent to keydown. Dwell time is unobtainable *unless* the terminal supports the **Kitty keyboard protocol** (progressive-enhancement flag `0b10`, reports press/repeat/release), supported by kitty, ghostty, foot, WezTerm, Alacritty, iTerm2, rio — negotiated at startup, must fall back gracefully |
| **Timestamp source & precision** | `event.timeStamp` (DOMHighResTimeStamp) or `performance.now()` read in the handler. Monotonic, but **precision is clamped for Spectre mitigation**: ~5µs cross-origin-isolated / ~100µs + jitter otherwise (Chrome), ~20µs (Firefox), ~1ms (Safari) | `Instant::now()` / `time.perf_counter_ns()` read the instant the byte is read — true monotonic nanosecond precision, no clamping. But the measurement point is *byte-read time*, which includes OS input latency + terminal line buffering, not the physical keypress |
| **Precision verdict** | 100µs–1ms resolution vs a signal (digraph flight times) of **80–300 ms**. Three-plus orders of magnitude of headroom. Not a real constraint | Higher nominal precision, but noisier measurement point. Also fine for the signal |
| **Key identity** | `event.key` (logical) **and** `event.code` (physical, layout-independent) both delivered cleanly | You decode byte / escape sequences yourself (or via crossterm/termion/Textual). Plain printable chars are easy; arrows, function keys, and modified keys are ambiguous escape sequences in legacy mode. Kitty protocol disambiguates and adds explicit modifier + event-type fields |
| **Modifiers** | Modifier flags on every event; standalone Shift/Ctrl/Alt fire their own `keydown` | Legacy: modifiers only *inferred* — Shift from the resulting char, Ctrl from a control byte (`< 0x20`); pure modifier presses are **invisible**. Kitty protocol reports them explicitly |
| **Auto-repeat** | `event.repeat === true` | Legacy: indistinguishable from fast retyping. Kitty protocol marks repeat as a distinct event type |
| **Paste contamination** | Must handle `paste` event + IME (`isComposing` / `compositionstart`) so a paste does not register as inhumanly fast typing | Enable bracketed-paste mode (`ESC [ ? 2004 h`) to detect and reject pastes. IME is rare in terminals |
| **Focus / blur** | `blur` while typing must pause the session timer | Terminal focus is implicit; focus reporting needs `ESC [ ? 1004 h` (xterm / Kitty) |
| **Rendering coupling** | DOM renders independently of the input handler | Input read and screen redraw usually share one thread — the redraw must be kept off the timing-critical path |

**Design implications, regardless of target:**
- Model `type: "keyup"` and `dwellMs` as **optional**. `flightMs` (keydown→keydown) is the
  primary latency metric and is always available. The Metrics Engine must not branch on target.
- Record a `captureCapabilities` descriptor per session (`hasKeyup`, `hasModifierEvents`,
  `protocol: "dom" | "kitty" | "legacy"`) so the Dashboard can explain why some metrics are
  missing for some sessions.
- Keep metric computation **out of the capture handler** on both targets — buffer events, analyze
  after.

**Recommendation for v1: target the browser.**
- Native `keyup` (real dwell time), clean `key` + `code`, trivial to render code with syntax
  coloring + a caret, and the later dashboard is trivial in the same stack.
- Timing precision (100µs) is ~1000× below the signal — a non-issue.
- The TUI is genuinely attractive for a developer's daily-driver ergonomics, but its capture
  engine is materially harder and needs the Kitty protocol just to reach parity on dwell time
  and modifiers. Revisit it as a later "hybrid" phase where a TUI client writes to the same
  Session Store (via the step-5 backend). Do **not** build the hybrid two-client architecture
  up front — see anti-patterns.

## Scaling Considerations

Single user, local machine. "Scale" here means input size and session history, not concurrency.

| Scale | Adjustments |
|-------|-------------|
| Normal daily use | In-memory session, SQLite append. No optimization needed |
| Large pasted / uploaded file (10k+ lines) | Chunk lazily; virtualize the Trainer render (only draw the visible kata window). Do not hold the whole rendered DOM/screen for a 5000-line file |
| Months of session history | Index SQLite by `startedAt` and `language`; maintain rollup/aggregate tables for the dashboard so it does not re-scan every raw event log on load. Keep raw logs for on-demand recompute only |
| Re-analysis over all history (new metric added) | Precompute + cache `SessionMetrics`; recompute in a background pass, not on dashboard open |

### Scaling Priorities

1. **First thing that bites:** rendering a huge file in the Trainer. Fix with windowed rendering
   from day one of the UI.
2. **Second:** dashboard load time once there are hundreds of sessions. Fix with aggregate tables
   when the dashboard is built (step 6), not before.

## Anti-Patterns

### Anti-Pattern 1: Computing metrics inside the keystroke handler

**What people do:** Recompute WPM / latency / accuracy on every `keydown`.
**Why it's wrong:** Puts heavy work on the timing-critical path; on the TUI it also blocks the
read loop and corrupts the very timestamps you are trying to measure.
**Do this instead:** The handler does one thing — append a normalized `KeystrokeEvent` to a
buffer. The realtime metrics tier reads the buffer and updates a tiny accumulator; the full
analysis runs once at session end.

### Anti-Pattern 2: Persisting only computed metrics, discarding the raw event log

**What people do:** Store `{wpm, accuracy, slowestKeys}` per session to "save space."
**Why it's wrong:** This project's entire premise is a *growing* set of code-specific metrics
(heatmap, per-language profile, new digraph analyses). Discarding raw events means every new
metric starts from zero history, and metric bugs can never be fixed retroactively.
**Do this instead:** Persist the full `KeystrokeEvent[]` (a few KB per session) plus a *cache* of
current metrics. Treat metrics as a derived view.

### Anti-Pattern 3: Wall-clock timestamps for latency

**What people do:** `Date.now()` / `time.time()` for keystroke timing.
**Why it's wrong:** Non-monotonic (jumps on NTP sync, DST, manual clock changes) and lower
resolution. A single backward jump produces negative or absurd digraph latencies.
**Do this instead:** `performance.now()` / `Instant::now()` / `time.perf_counter_ns()` for every
event; store wall-clock time once, for the session start, for display only.

### Anti-Pattern 4: Baking the tree-sitter dependency into v1

**What people do:** Pull in tree-sitter for the first chunker "so we don't redo it later."
**Why it's wrong:** Adds a WASM/native build dependency and grammar management to the MVP for
zero MVP value (whole-file typing works fine for validation).
**Do this instead:** Define `ChunkStrategy` now, ship `NaiveChunker`, add `TreeSitterChunker`
behind the same interface in its own phase.

### Anti-Pattern 5: Correction policy living in the Metrics Engine

**What people do:** `if (mandatoryCorrection) { ...different WPM calc... }` inside metrics.
**Why it's wrong:** Mandatory-vs-free correction changes what states are *reachable* (can the
cursor pass an error?), not how you count a given sequence of events. Spreading it into metrics
makes both hard to reason about.
**Do this instead:** The Session State Machine owns the policy — it decides whether a keystroke
advances the cursor. The Metrics Engine just folds over whatever `AnnotatedKeystroke[]` results.

### Anti-Pattern 6: Building the hybrid TUI+web two-client architecture up front

**What people do:** Design a shared-database, two-frontend system before the core loop is proven.
**Why it's wrong:** Doubles the capture-engine work (DOM *and* Kitty-protocol parsing) and forces
a client/server split before there is anything to validate.
**Do this instead:** One target for v1 (browser). If daily TUI use proves desirable, add a TUI
client against the already-existing Session Store backend as a later phase.

### Anti-Pattern 7: Coupling ingestion sources to the Trainer

**What people do:** The Trainer knows how to walk a git repo / read `~/.zsh_history`.
**Why it's wrong:** Every new source then touches the Trainer, and the privacy boundary (third-
party content stays local) is scattered.
**Do this instead:** Each source is an adapter that returns a normalized `Document`. The Trainer
only ever sees `Document` / `Kata`.

## Integration Points

### External Services / System Resources

| Resource | Integration Pattern | Notes |
|----------|---------------------|-------|
| Local filesystem (file upload) | Browser File API for v1 | No backend needed for paste/upload |
| Local filesystem (repo walk, shell history) | Backend (FastAPI / Node) reads files directly; read-only | Later phase. Introduced with the Session Store backend at step 5 |
| `git` | Shell out to `git` or use libgit2 bindings; read-only, local clone only | **Privacy constraint:** ingested repo content must never leave the machine — state this in docs |
| tree-sitter | `web-tree-sitter` (WASM) in browser, or native bindings in backend; bundle grammars per supported language | Later phase; grammar set grows with supported languages |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Capture Engine → State Machine | Ordered `KeystrokeEvent[]` (push or polled buffer) | The one platform-coupled seam. Keep the event shape stable |
| State Machine → Metrics Engine | `AnnotatedKeystroke[]` (pure value) | No shared mutable state; metrics is a pure fold |
| Metrics Engine → Session Store | `SessionRecord` value on session completion | Store never calls back into metrics |
| Ingestion → Chunker | `Document` value | All sources normalize to this shape |
| Chunker → Trainer UI | `Kata[]` value | `ChunkStrategy` interface hides naive-vs-tree-sitter |
| Drill Generator → Chunker | Synthetic `Document` | The only cycle; runs offline |
| Session Store → Dashboard UI | Read-only aggregate queries | Dashboard never writes |

## Sources

- [MDN — High precision timing (`performance.now`, DOMHighResTimeStamp)](https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/High_precision_timing) — HIGH
- [Chrome Developers — When milliseconds are not enough: performance.now](https://developer.chrome.com/blog/when-milliseconds-are-not-enough-performance-now) — HIGH
- [w3c/hr-time issue #56 — reducing DOMHighResTimeStamp resolution (Spectre clamping: 5µs isolated / 100µs non-isolated)](https://github.com/w3c/hr-time/issues/56) — HIGH
- [Mozilla bug 1427870 — reduce precision of performance.now() to 20us](https://bugzilla.mozilla.org/show_bug.cgi?id=1427870) — HIGH
- [Robert Elder — Why is it so hard to detect keyup events on the Linux terminal?](https://blog.robertelder.org/detect-keyup-event-linux-terminal/) — HIGH
- [Fun With Linux — Receiving key press and key release events in Linux terminal applications](https://www.funwithlinux.net/blog/receiving-key-press-and-key-release-events-in-linux-terminal-applications/) — MEDIUM
- [crossterm issue #950 — key release event not fired on Linux](https://github.com/crossterm-rs/crossterm/issues/950) — HIGH
- [crossterm issue #642 — keyboard input on key down instead of key release](https://github.com/crossterm-rs/crossterm/issues/642) — MEDIUM
- [kitty — Comprehensive keyboard handling in terminals (keyboard protocol, progressive enhancement, press/repeat/release)](https://sw.kovidgoyal.net/kitty/keyboard-protocol/) — HIGH
- [kitty/docs/keyboard-protocol.rst](https://github.com/kovidgoyal/kitty/blob/master/docs/keyboard-protocol.rst) — HIGH
- [Monkeytype — About (WPM / raw WPM / accuracy / consistency definitions)](https://monkeytype.com/about) — HIGH
- [Practical Keystroke Timing Attacks in Sandboxed JavaScript (context on browser timer resolution history)](https://mlq.me/download/keystroke_js.pdf) — MEDIUM

---
*Architecture research for: developer typing-trainer (keebdrill)*
*Researched: 2026-09-03*
