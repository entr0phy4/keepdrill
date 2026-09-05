# Requirements: keebdrill

**Defined:** 2026-09-03
**Core Value:** The user can paste or upload a real code/text file, type it with keystroke capture, and see WPM, accuracy, and their five slowest keys — useful enough for a week of daily self-use.

## v1 Requirements

Requirements for the initial release. Each maps to a roadmap phase. Scope is
deliberately locked to this list (see PITFALLS.md — scope creep is the top
project-level risk).

### Input

- [x] **INPUT-01**: User can paste text into the app to use as the typing exercise source
- [x] **INPUT-02**: User can upload a local file to use as the typing exercise source
- [x] **INPUT-03**: Exercise content is normalized before typing (CRLF→LF, configurable tab width, trailing whitespace stripped, single trailing newline) and the normalizer is unit-tested

### Capture

- [x] **CAPT-01**: The app captures keydown and keyup events for the entire session, stamped from `event.timeStamp` (monotonic, high-resolution), with the listener doing nothing but appending to a buffer
- [x] **CAPT-02**: The app ignores OS key-repeat events (`event.repeat`) so a held key does not register as multiple keystrokes
- [x] **CAPT-03**: The full raw keystroke event log (seq, key, code, modifiers, timestamp, isRepeat) is retained for the session as the single source of truth from which all metrics are derived
- [x] **CAPT-04**: The app captures committed characters via `input`/`beforeinput` (not blanket `preventDefault` on keydown) and shows a "US ANSI layout only" notice
- [x] **CAPT-05**: The app is served cross-origin-isolated (COOP/COEP), verifies `crossOriginIsolated === true`, and records the achieved timer resolution with the session

### Typing

- [x] **TYPE-01**: User sees the exercise text with a caret and per-character correctness feedback (correct / incorrect / pending) updating live while typing
- [x] **TYPE-02**: User types under a free-correction policy — advancing past an error is allowed, and both corrected and uncorrected errors are tracked
- [x] **TYPE-03**: User can press backspace to correct earlier characters
- [x] **TYPE-04**: Whitespace characters (spaces, tabs, newlines) are rendered with visible glyphs and must be typed explicitly
- [x] **TYPE-05**: User can restart the current exercise, keeping the loaded content and resetting all session state
- [x] **TYPE-06**: Session timing starts on the first keystroke and excludes time while the window is blurred or hidden; pasting the exercise answer is blocked or flagged

### Metrics

- [x] **METR-01**: On completion, user sees net WPM for the exercise using the industry-standard formula (correct chars / 5 / minutes), matching Monkeytype's definition
- [x] **METR-02**: On completion, user sees accuracy / error rate for the exercise (correct keypresses / total keypresses, with corrections in the denominator)
- [ ] **METR-03**: On completion, user sees the five slowest keystrokes, gated by a minimum sample count, using median/trimmed aggregation with outlier filtering (>1000ms and <25ms gaps discarded); shows "not enough data" when below threshold
- [x] **METR-04**: The metrics engine is a pure module with no I/O, re-runnable over any keystroke log; the WPM/accuracy formulas are documented in the repo and the metric schema is versioned; covered by golden-file unit tests

## v2 Requirements

Deferred to a future release once the daily loop proves useful for a week.
Tracked but not in the current roadmap.

### Persistence

- **PERS-01**: Sessions persist to a local IndexedDB store (raw keystroke log + cached metrics + `{text, language, source_type, timestamp}`)
- **PERS-02**: Persistence is incremental so a crash or reload does not lose the in-progress session

### Analytics

- **ANLY-01**: User sees a per-digraph / bigram latency table (top slow transitions)
- **ANLY-02**: User sees a keyboard heatmap (speed + error per key, US ANSI)
- **ANLY-03**: User sees symbol-density-adjusted WPM and a correction/efficiency score, with weights tied to measured per-key latency
- **ANLY-04**: User sees historical progress charts (latency trend per digraph / language) — the one-month success metric
- **ANLY-05**: User can run a Symbols drill mode targeting `{}[]()<>`, `=>`, `::`, `!==`, `|>`, and the shifted number row

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| User accounts / auth / cloud sync | Single-user local tool; auth is weeks of work, attack surface, and a privacy risk for ingested repo content |
| Gamification (streaks, XP, badges, leaderboards) | Optimizes for engagement, not skill; no learning value for a one-user tool |
| Multiplayer / races (TypeRacer-style) | Not core to training value; needs realtime infra and an opponent pool that does not exist |
| Forced-correction typing mode in v1 | Fundamentally different state machine; doubles v1 engine scope. Add as a mode later |
| Full editor semantics (autocomplete, bracket auto-pair, multi-cursor) | Auto-pairing brackets removes the exact symbol training that is the point |
| Auto-indent replacing manual whitespace typing | Removes Tab/space/indentation from training; v1 requires explicit whitespace |
| Real-time keystroke streaming to a backend | Network jitter corrupts the timing data that is the whole product; also a privacy leak |
| Filesystem / all-repo auto-ingest | Mixed licenses + secrets; irrelevant generated code. Explicit per-source opt-in only |
| Repo kata mode (local/remote Git ingest) | Git plumbing + tree-sitter chunking + privacy guarantees are a milestone of their own (needs Tauri) |
| Docs mode / Shell-history mode | Parallel source adapters; only worth building once the exercise abstraction is proven |
| tree-sitter syntactic chunking (function/block reps) | v1 whole-content typing is good enough to validate the idea |
| Adaptive drill generation from detected weaknesses | Hardest feature; needs months of history plus a code-plausible fragment generator |
| Fixed 10-minute Daily session with adaptive progression | Composes multiple modes + adaptive selection + history |
| Non-US-ANSI keyboard layouts (es-LA, US-International, Dvorak, Colemak) | Each layout multiplies symbol-map / heatmap / digraph logic before the core idea is validated |
| Native app / TUI / Tauri packaging | v1 is a browser SPA; Tauri is the evolution path for the later source-ingest milestone |
| Backend server (FastAPI) and PostgreSQL | Single user, one machine — a server buys nothing for v1 |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INPUT-01 | Phase 1 | Complete |
| INPUT-02 | Phase 1 | Complete |
| INPUT-03 | Phase 1 | Complete |
| CAPT-01 | Phase 1 | Complete |
| CAPT-02 | Phase 1 | Complete |
| CAPT-03 | Phase 1 | Complete |
| CAPT-04 | Phase 1 | Complete |
| CAPT-05 | Phase 1 | Complete |
| TYPE-01 | Phase 2 | Complete |
| TYPE-02 | Phase 2 | Complete |
| TYPE-03 | Phase 2 | Complete |
| TYPE-04 | Phase 2 | Complete |
| TYPE-05 | Phase 2 | Complete |
| TYPE-06 | Phase 2 | Complete |
| METR-01 | Phase 3 | Complete |
| METR-02 | Phase 3 | Complete |
| METR-03 | Phase 3 | Pending |
| METR-04 | Phase 3 | Complete |

**Coverage:**

- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-03*
*Last updated: 2026-09-03 after roadmap creation (3 phases, 18/18 mapped)*
