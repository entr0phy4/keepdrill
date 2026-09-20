# keebdrill

## What This Is

A typing trainer for developers that drills on **real technical corpus** — code
from Git repositories, technical documentation, pasted snippets, and shell
history — instead of English prose. It captures high-resolution keystroke events
and reports code-specific metrics (symbol-density-adjusted WPM, per-digraph
latency, keyboard heatmap, per-language profile, correction rate) that existing
platforms (Monkeytype, Keybr, 10FastFingers) do not measure.

## Core Value

The user can paste or upload a real code/text file, type it with keystroke
capture, and see WPM, accuracy, and their five slowest keys. If that single loop
is useful for a week of daily self-use, the project is worth continuing.

## Current State

**Shipped: v1.1 Persistencia y Analíticas** (2026-09-20)

The paste/type/metrics loop from v1.0 now persists every completed session to IndexedDB (full raw log + cached metrics snapshot) and exposes a History list plus a stacked Analytics view: symbol-adjusted WPM beside net WPM, ranked digraph latency, a US-ANSI keyboard heatmap, and a per-language profile (plaintext kept as its own bucket).

Closeout was `override_closeout`: Phase 5 UAT passed (10/10) and ANLY-01/02 shipped, but `05-VERIFICATION.md` was never written. See `.planning/MILESTONES.md` Known Gaps.

## Next Milestone Goals

Not yet planned. Candidates carried from v1.1 Future Requirements:

- Trigraph (3-character) latency once enough history exists to clear a sample gate (ANLY-06)
- Drill-down into a single past session's own metrics from its persisted raw log (ANLY-07)
- Filter heatmap / digraph table by language (ANLY-08)
- Automatic language detection for pasted exercises (ANLY-09)

Start with `/gsd-new-milestone`.

## Requirements

### Validated

- ✓ User can paste text or upload a file to use as the typing exercise source — Phase 1
- ✓ User can type the exercise with keydown/keyup capture at high-resolution timestamps — Phase 1
- ✓ User sees live per-character correctness feedback with a custom caret and whitespace glyphs, under a free-correction policy with backspace-to-correct, restart, and honest session timing (excludes blurred/hidden time) — Phase 2
- ✓ User sees net WPM, accuracy, and the five slowest keystrokes on completion, from a pure re-runnable metrics engine — Phase 3

- ✓ User's completed session (full raw log) automatically persists to local IndexedDB with no explicit save action, and survives a page reload — Phase 4
- ✓ User can view a list of past sessions (date, WPM, accuracy), newest first — Phase 4
- ✓ User sees a non-blocking notice if a session fails to persist; the results screen is never blocked or delayed by the save — Phase 4
- ✓ User sees a symbol-density-adjusted WPM as a companion next to net WPM on results and in history — Phase 5
- ✓ User can pick or confirm the language of a pasted exercise so sessions are tagged instead of stuck as plaintext — Phase 5
- ✓ User can view a ranked table of their slowest digraphs across persisted sessions, with a minimum-sample gate — Phase 6
- ✓ User can view a US-ANSI keyboard heatmap of physical-key median latency across session history — Phase 6
- ✓ User can view a per-language WPM/accuracy profile, with plaintext kept as its own bucket — Phase 6

### Active

- [ ] Trigraph latency across persisted sessions, gated so sparse triples are not ranked (ANLY-06)
- [ ] Drill-down into a single past session's own slowest-5 / digraph breakdown from its raw log (ANLY-07)
- [ ] Filter keyboard heatmap or digraph table by language (ANLY-08)
- [ ] Automatic language detection for pasted exercises (ANLY-09)

### Out of Scope

- User accounts / authentication — not needed for single-user self-validation in v1
- Multiplayer / competitive modes — not core to the training value
- Gamification (streaks, badges, XP) — deferred until the core loop proves useful
- Rich evolution charts / trend visualizations over the session history — v1.1 covers a basic session list plus per-metric analytics (digraph latency, heatmap); charted trend lines are a later phase
- Syntactic chunking with tree-sitter (function/YAML-block boundaries) — later phase; v1 uses whole pasted/uploaded content
- Adaptive drill generation from detected weaknesses — later phase
- Repo ingestion (local/remote Git), docs mode, shell-history mode — later phases
- Non-US-ANSI keyboard layout support — deferred; v1 assumes US ANSI
- Self-hosted deployment, Docker/Traefik packaging — later phase

## Context

- **v1.1 shipped 2026-09-20** (Sept 5 → Sept 20, ~15 days): Dexie 4.4.4
  persistence seam + `src/analytics/` pure folds + Analytics sibling view.
  ~5,966 LOC in `src/`. 3 phases, 7 plans, 19 tasks. Runtime deps beyond
  React: `dexie` / `dexie-react-hooks` (isolated to `persistence/db.ts` and
  `HistoryView`). Closeout: `override_closeout` (Phase 5 verification report
  missing).
- **v1.0 shipped 2026-09-05** (Sept 3 → Sept 5, ~2 days): Vite 8 / React 19 / TS
  5.9 browser SPA, ~3,156 LOC in `src/`, zero runtime dependencies beyond
  React itself. 3 phases, 8 plans, 15 tasks, 132 passing tests.
- Target user is the author (a developer) doing daily self-use; success is judged
  on personal data, not adoption metrics.
- Pain point: existing typing platforms train on English prose and barely
  penalize symbols. Real code-typing effort is in grouping characters (`{}` `[]`
  `()` `<>`), compound operators (`->` `=>` `::` `!==` `|>` `&&`), the
  shifted number row, underscores, backticks, pipes, and mixed quotes.
- Content sources envisioned long-term: Git repos (local/remote), technical docs
  (Markdown, reStructuredText, man pages, RFCs), pasted snippets, shell history
  (`~/.zsh_history`, `~/.bash_history`).
- Practice modes envisioned long-term: Repo kata, Docs, Symbols drills, Shell,
  and a fixed 10-minute Daily session with adaptive progression.
- Licensing concern: if third-party repos are ingested, their content must not
  leave the local environment — must be stated explicitly in documentation.

## Constraints

- **Scope**: v1.0 was the minimal paste/type/metrics loop. v1.1 added local
  persistence and cross-session analytics; still no accounts, sync, or charts.
- **Tech stack**: Local-first browser SPA (Vite 8 + React 19 + TypeScript, pnpm),
  no backend. Persistence is Dexie 4.4.4 isolated behind `persistence/db.ts`.
  No FastAPI/PostgreSQL, no TUI. Tauri v2 remains the evolution path if native
  filesystem/Git access is needed later.
- **Keystroke timing**: Capture uses `event.timeStamp` (DOMHighResTimeStamp),
  never `performance.now()` read inside the handler — per-digraph latency
  measurement is the core differentiator and depends on timing precision. Served
  cross-origin-isolated (COOP/COEP) for maximum timer resolution.
- **Privacy**: Ingested third-party content stays local — licensing / IP concern.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| v1 = minimal paste/type/metrics loop, no accounts or gamification | Validate the idea with a week of self-use before investing further | ✓ Shipped 2026-09-05 — daily-use validation still pending |
| WPM/accuracy time and denominator basis: active-time (excludes blurred/hidden periods) for WPM; every keypress attempt incl. corrections for accuracy denominator | "Honest session timing" over Monkeytype's simpler wall-clock model; ROADMAP explicitly required corrections to affect the accuracy denominator | ✓ Good — Phase 3 |
| Unicode indexing: iterate/index target text by code point (`Array.from`), never raw UTF-16 string indexing | Code review found a critical bug — code-unit indexing desynced scoring (and could make an exercise uncompletable) for any supplementary-plane character (emoji, etc.); fixed across state.ts/metrics.ts/CaptureSurface.tsx, independently re-verified | ✓ Good — Phase 3 (retroactive fix) |
| Platform architecture: browser SPA (Vite 8 + React 19 + TS), no backend | Browser is the only platform with guaranteed cross-OS keyup + sub-ms timestamps | ✓ Good — Phase 1 |
| Capture mechanism: `beforeinput`/`input` for committed chars, `keydown`/`keyup` for timing only, no blanket `preventDefault` | Preserves dead keys/IME/AltGr; keeps the hot-path handler to a single buffer push | ✓ Good — Phase 1 |
| Content scope: type corpus as-is, no stripping of comments/strings | v1 doesn't parse; structural filtering is a later tree-sitter concern | ✓ Good — Phase 1 |
| Mandatory vs free error correction | Forcing correction of every error changes the state engine completely | ✓ Good — free-correction locked (D-04); advancing past an error is never blocked, corrected/uncorrected tracked separately — Phase 2 |
| Indentation handling (auto-indent like an editor vs manual) | Auto-indent is realistic but removes Tab/space training | ✓ Good — Tab is fully absorbed as a no-op (no indent insertion, no synthetic character); Escape is the keyboard-only path to Restart since Tab can't reach it via tab-order (D-07 amended) — Phase 2 |
| Keyboard layout support (US ANSI only vs es-LA / US-International) | Changes the symbol map | ✓ Good — v1 assumes US ANSI only, static notice banner (Phase 1) |
| Persist full raw `Session` + cached `MetricsResult` snapshot, not just derived summary numbers | Every historical session stays fully recomputable when a formula improves — Phase 5/6 analytics apply retroactively with zero data migration | ✓ Good — Phase 4 |
| Hide (display:none), never unmount, the trainer subtree when switching to History | Preserves in-progress capture state (caret, per-char coloring, IME) across a view switch with no confirm dialog or lost progress | ✓ Good — Phase 4, verified in happy-dom + real-browser human-check |
| `persistence/db.ts` is the sole module importing `dexie`; `repository.ts` is the only seam other modules touch | Keeps Dexie as an isolated platform seam, matching the Phase 1 pure-core/platform-seam/hot-path split | ✓ Good — Phase 4 |
| `symbolAdjustedWpm` is an additive companion on `MetricsResult`; net WPM stays primary | Assumption-delta: add-alongside, never a silent replacement of WPM | ✓ Good — Phase 5 |
| `gatedMedian` owns the exclusive (25ms, 1000ms) window and both sample gates; `DIGRAPH_MIN_SAMPLES = 5` | Digraph ranking and heatmap cannot bury 5 as a magic number | ✓ Good — Phase 6 |
| Language profile is the unweighted mean of per-session `resolveMetrics`; heatmap IKI skips modifiers and `isRepeat` | RESEARCH A2 / A1; plaintext is a normal map key | ✓ Good — Phase 6 |
| Analytics is a third header sibling; trainer stays hide-not-unmount; heatmap fill via `--kb-fill` color-mix | Extends Phase 4 D-08; sequential amber, not score colors; inert keys | ✓ Good — Phase 6 |

## Success Criteria

After one month of use, the project can demonstrate — with the user's own data —
a measurable reduction in latency for the most frequent symbol digraphs of their
daily working stack.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-20 after v1.1 milestone*
