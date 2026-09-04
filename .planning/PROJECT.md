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

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can paste text or upload a file to use as the typing exercise source
- [ ] User can type the exercise with keydown/keyup capture at high-resolution timestamps
- [ ] User sees WPM for the completed exercise
- [ ] User sees accuracy (error rate) for the completed exercise
- [ ] User sees the five slowest keys/keystrokes from the session

### Out of Scope

- User accounts / authentication — not needed for single-user self-validation in v1
- Multiplayer / competitive modes — not core to the training value
- Gamification (streaks, badges, XP) — deferred until the core loop proves useful
- Historical progress dashboard and evolution charts — v1 proves the loop first; dashboard is a later phase
- Syntactic chunking with tree-sitter (function/YAML-block boundaries) — later phase; v1 uses whole pasted/uploaded content
- Adaptive drill generation from detected weaknesses — later phase
- Repo ingestion (local/remote Git), docs mode, shell-history mode — later phases
- Non-US-ANSI keyboard layout support — deferred; v1 assumes US ANSI
- Self-hosted deployment, Docker/Traefik packaging — later phase

## Context

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

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| v1 = minimal paste/type/metrics loop, no accounts or gamification | Validate the idea with a week of self-use before investing further | — Pending |
| Platform architecture (Web vs TUI vs Hybrid) | Conditions the design of the capture engine | — Pending (resolve before Phase 1 build) |
| Mandatory vs free error correction | Forcing correction of every error changes the state engine completely | — Pending |
| Indentation handling (auto-indent like an editor vs manual) | Auto-indent is realistic but removes Tab/space training | — Pending |
| Content scope (structural code only vs including comments and long strings) | Affects what the exercise measures | — Pending |
| Keyboard layout support (US ANSI only vs es-LA / US-International) | Changes the symbol map | — Pending (v1 assumes US ANSI) |

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
*Last updated: 2026-09-03 after initialization*
