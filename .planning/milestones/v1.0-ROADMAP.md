# Roadmap: keebdrill

## Overview

keebdrill v1 is a hard serial chain that delivers exactly one loop: paste or upload real code, type it under high-resolution keystroke capture, and see WPM, accuracy, and your five slowest keys. Phase 1 lays the foundation — the corpus input pipeline and the append-only keystroke capture engine that every later metric depends on. Phase 2 builds the interactive trainer: live per-character feedback, free-correction typing, backspace, visible whitespace, restart, and honest session timing. Phase 3 closes the loop with a pure, golden-tested metrics engine and an end-of-session results panel. Session persistence and code-specific analytics are deliberately v2 — out of this roadmap until a week of daily self-use proves the loop is worth continuing.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Corpus Input & Keystroke Capture** - Load real code/text as a typing-ready exercise and record every keystroke as a high-resolution, append-only event log (completed 2026-09-04)
- [x] **Phase 2: Interactive Typing Trainer** - Type a loaded exercise with live per-character feedback and natural editing under a free-correction policy (completed 2026-09-05)
- [x] **Phase 3: Session Metrics** - On finishing an exercise, see trustworthy WPM, accuracy, and five-slowest-key numbers (completed 2026-09-05)

## Phase Details

### Phase 1: Corpus Input & Keystroke Capture

**Goal**: The app loads real code or text as a typing-ready exercise and records every keystroke as a high-resolution, append-only event log that all later metrics derive from.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: INPUT-01, INPUT-02, INPUT-03, CAPT-01, CAPT-02, CAPT-03, CAPT-04, CAPT-05
**Success Criteria** (what must be TRUE):

  1. User can paste a code snippet into the app and see it loaded as the exercise source.
  2. User can upload a local file and see its contents loaded as the exercise source.
  3. Loaded content is normalized before display (CRLF becomes LF, configurable tab width, trailing whitespace stripped, single trailing newline) and the normalizer has passing unit tests.
  4. While the user types, committed characters are captured via `input`/`beforeinput` (no blanket `preventDefault`) and every keydown/keyup is recorded with a monotonic high-resolution `event.timeStamp`, with OS key-repeat events ignored.
  5. The full raw keystroke log (seq, key, code, modifiers, timestamp, isRepeat) is retained as the session's single source of truth; the app verifies `crossOriginIsolated === true`, records the achieved timer resolution with the session, and shows a "US ANSI layout only" notice.

**Plans**: 3/3 plans executed (2 waves)
**Wave 1**

- [x] 01-01-PLAN.md — Walking skeleton: scaffold + end-to-end tracer (paste → normalize → inert preview → focused capture `<textarea>` → append-only KeystrokeEvent[]) served cross-origin-isolated; + SKELETON.md

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Corpus file upload: `File.text()` → size + UTF-8 guards → typed errors → `Exercise{sourceType:'upload'}`; all CorpusInput empty/error/loading states
- [x] 01-03-PLAN.md — Full capture semantics: `beforeinput`/`input` char stream, key-repeat + blur/visibility hardening, IME, paste-block flag, both chrome banners, README host/privacy posture

### Phase 2: Interactive Typing Trainer

**Goal**: The user can type a loaded exercise with live per-character feedback and natural editing under a free-correction policy, with honest session timing.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: TYPE-01, TYPE-02, TYPE-03, TYPE-04, TYPE-05, TYPE-06
**Success Criteria** (what must be TRUE):

  1. User sees the exercise text with a caret and live per-character coloring (correct / incorrect / pending) that updates while typing.
  2. User can advance past a mistyped character without fixing it, and both corrected and uncorrected errors are tracked separately.
  3. User can press backspace to return to and correct earlier characters.
  4. Whitespace characters (spaces, tabs, newlines) render as visible glyphs and must be typed explicitly to advance.
  5. User can restart the current exercise (content preserved, all session state reset); session timing starts on the first keystroke, pauses while the window is blurred or hidden, and pasting into the exercise is blocked or flagged.

**Plans**: 3/3 plans executed (2 waves)

Plans:

- [x] 02-03-PLAN.md

**Wave 1**

- [x] 02-01-PLAN.md — Tracer: trainer reducer (computeTrainerState) + transparent overlay rendering + whitespace glyphs (TYPE-01..04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Restart control + Tab no-op/caret motion + computeActiveElapsedMs (TYPE-05, TYPE-06)

**UI hint**: yes

### Phase 3: Session Metrics

**Goal**: On finishing an exercise, the user sees trustworthy speed, accuracy, and slowest-key numbers from a pure, re-runnable metrics engine.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: METR-01, METR-02, METR-03, METR-04
**Success Criteria** (what must be TRUE):

  1. On completion, user sees net WPM using the industry-standard formula (correct chars / 5 / minutes), matching Monkeytype's definition.
  2. On completion, user sees accuracy / error rate (correct keypresses / total keypresses, with corrections in the denominator).
  3. On completion, user sees the five slowest keystrokes — gated by a minimum sample count, using median/trimmed aggregation with outlier gaps (>1000ms and <25ms) discarded — or a "not enough data" message when below threshold.
  4. The metrics engine is a pure module with no I/O, re-runnable over any keystroke log; the WPM and accuracy formulas are documented in the repo, the metric schema is versioned, and golden-file unit tests pass.

**Plans**: 2/2 plans executed (2 waves)

Plans:

- [x] 03-01-PLAN.md — Tracer: completion signal -> WPM + accuracy, auto-revealed results panel (METR-01, METR-02, METR-04)
- [x] 03-02-PLAN.md — Slowest-5 keystrokes + full visual polish (METR-03, METR-04)

**Wave 1**

- [x] 03-01-PLAN.md — Tracer: completion signal -> WPM + accuracy, auto-revealed results panel

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — Slowest-5 keystrokes + full visual polish

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Corpus Input & Keystroke Capture | 3/3 | Complete    | 2026-09-04 |
| 2. Interactive Typing Trainer | 3/3 | Complete    | 2026-09-05 |
| 3. Session Metrics | 2/2 | Complete    | 2026-09-05 |
