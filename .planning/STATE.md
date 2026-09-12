---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Persistencia y Analíticas
current_phase: 5
current_phase_name: Symbol-Adjusted WPM & Language Tagging
status: planning
stopped_at: Fase 5 UI-SPEC aprobado
last_updated: "2026-09-12T19:41:15.541Z"
last_activity: 2026-09-12
last_activity_desc: Phase 04 complete, transitioned to Phase 5
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-12)

**Core value:** The user can paste or upload a real code/text file, type it with keystroke capture, and see WPM, accuracy, and their five slowest keys — useful enough for a week of daily self-use.
**Current focus:** Phase 5 — Symbol-Adjusted WPM & Language Tagging

## Current Position

Phase: 5 — Symbol-Adjusted WPM & Language Tagging
Plan: Not started
Status: Ready to plan
Last activity: 2026-09-12 — Phase 04 complete, transitioned to Phase 5

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 10
- Average duration: ~13 min
- Total execution time: ~1.7 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | - | - |
| 02 | 3 | - | - |
| 03 | 2 | - | - |
| 04 | 2 | - | - |
| 05 | TBD | - | - |
| 06 | TBD | - | - |

**Recent Trend:**

- Last 5 plans: 15min, 5min, 12min, ~15min, ~20min
- Trend: Stable

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 04 P01 | 45min | 3 tasks | 17 files |
| Phase 04 P02 | 35min | 3 tasks | 10 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap v1.1]: 3 phases derived from research's proposed structure — Phase 4 (persistence foundation, blocks everything), Phase 5 (symbol-adjusted WPM + paste-language-picker prerequisite, no persistence dependency beyond Phase 4's stored fields), Phase 6 (cross-session analytics: digraph, heatmap, per-language profile — mutually independent, share one `analytics.ts` module, depends on Phase 5 for real language tags).
- [Roadmap v1.1]: Trigraph latency (ANLY-06) explicitly deferred — needs more accumulated session volume than digraphs to clear a meaningful sample gate; tracked in REQUIREMENTS.md Future Requirements.
- [Phase 3]: Symbol-adjusted WPM was out of v1.0 scope, now in-scope as Phase 5 (ANLY-01) — must remain a companion metric to net WPM, never a silent replacement.
- [Phase 1]: Platform locked: Vite 8 + React 19 + TS 5.9 strict browser SPA, pnpm, no backend; pure-core / platform-seam / hot-path module split established — v1.1's `persistence/` and `analytics/` modules should follow this same seam discipline.
- [Phase 2]: Free-correction typing policy locked (D-04); corrected/uncorrected attempts tracked separately — relevant to any v1.1 metric that touches accuracy.
- [Phase 4]: Task 1 checkpoint auto-seleccionó option-a (Session cruda + snapshot MetricsResult) — idéntico a D-02
- [Phase 4]: Se fijó dexie@4.4.4 (no 4.4.5) para evitar la señal too-new del seam de legitimidad de paquetes, sin diferencia funcional
- [Phase 4]: Clave primaria ++id con índice único en startedAt; los campos blob (events/charLog/markers/exercise/metricsSnapshot) nunca se indexan (D-05)
- [Phase 4]: HistoryRow expandido a las 7 columnas D-11/D-12 via resolveMetrics/relativeTime/glyphFor; toggle activo distinguido por relleno de superficie + peso 600 (sin --color-accent, 04-UI-SPEC.md)
- [Phase 4]: threats_open: 0 confirmado en 04-SECURITY.md (ASVS L1, register autorado en plan-time); 2 riesgos aceptados documentados (D-18 keep-forever, almacenamiento local sin cifrar)

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- [Roadmap v1.1]: Phase 5's symbol-adjusted WPM weighting formula (which characters count as "symbol," linear vs. non-linear) has no external standard — resolve as a phase-discussion decision, not an implementation-time judgment call.
- [Roadmap v1.1]: Phase 6's digraph/trigraph minimum-sample threshold likely needs to be higher than the existing single-char `MIN_SAMPLES = 3` — pick provisionally, revisit once real accumulated data exists.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-09-12T19:41:15.519Z
Stopped at: Fase 5 UI-SPEC aprobado
Resume file: .planning/phases/05-symbol-adjusted-wpm-language-tagging/05-UI-SPEC.md

## Operator Next Steps

- Run `/gsd-discuss-phase 5` to gather context before planning Symbol-Adjusted WPM & Language Tagging (no CONTEXT.md exists yet)
- Or run `/gsd-plan-phase 5` to skip discussion and plan directly
