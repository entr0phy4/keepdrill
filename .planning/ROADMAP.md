# Roadmap: keebdrill

## Milestones

- ✅ **v1.0 MVP** — Phases 1-3 (shipped 2026-09-05)
- 🚧 **v1.1 Persistencia y Analíticas** — Phases 4-6 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-3) — SHIPPED 2026-09-05</summary>

- [x] Phase 1: Corpus Input & Keystroke Capture (3/3 plans) — completed 2026-09-04
- [x] Phase 2: Interactive Typing Trainer (3/3 plans) — completed 2026-09-05
- [x] Phase 3: Session Metrics (2/2 plans) — completed 2026-09-05

Full detail archived to `.planning/milestones/v1.0-ROADMAP.md`.

</details>

### 🚧 v1.1 Persistencia y Analíticas (In Progress)

**Milestone Goal:** Persistir cada sesión localmente y exponer analíticas de dígrafo/trígrafo, heatmap de teclado, perfil por lenguaje y WPM ajustado por símbolos, para poder medir mejora real a través del tiempo.

- [x] **Phase 4: Session Persistence & History** - Sessions save automatically to IndexedDB and appear in a newest-first history list (completed 2026-09-12)
- [ ] **Phase 5: Symbol-Adjusted WPM & Language Tagging** - Results show a symbol-density-aware WPM and pasted exercises can be tagged with a real language
- [ ] **Phase 6: Cross-Session Analytics** - Digraph latency, keyboard heatmap, and per-language profile computed across accumulated session history

## Phase Details

### Phase 4: Session Persistence & History

**Goal**: The user's completed sessions persist locally with no explicit save action, and are browsable as a history list.
**Depends on**: Nothing new (builds on v1.0 Phase 3's existing session/metrics pipeline)
**Requirements**: PERS-01, PERS-02, PERS-03
**Success Criteria** (what must be TRUE):

  1. After finishing a typing exercise, the user's full session (raw log, not just summary numbers) is saved to IndexedDB automatically and is still present after reloading the page.
  2. The user can open a history view listing past sessions newest-first, each showing its date, WPM, and accuracy.
  3. If the save fails (e.g. storage unavailable/quota exceeded), the user still sees the results screen immediately, with a small non-blocking notice that the session wasn't saved.

**Plans**: 2/2 plans executed

- [x] 04-01-PLAN.md — Persistence seam (Dexie 4) + automatic fire-and-forget session write + dismissible save-failure notice (PERS-01, PERS-03)
- [x] 04-02-PLAN.md — Full History view: newest-first rows with date/WPM/accuracy/source/language/length/slowest-key, recompute-if-stale guard, styling, D-08 hide-not-unmount verification (PERS-02)

**UI hint**: yes

### Phase 5: Symbol-Adjusted WPM & Language Tagging

**Goal**: The user sees a code-symbol-aware WPM alongside net WPM, and pasted exercises carry an accurate language tag instead of always defaulting to plaintext.
**Depends on**: Phase 4 (extends the same session/metrics record with new fields shown live and in history)
**Requirements**: ANLY-01, ANLY-02
**Success Criteria** (what must be TRUE):

  1. The user sees a symbol-density-adjusted WPM shown next to net WPM on the results screen.
  2. The user sees the same symbol-adjusted WPM value when reviewing a session in history.
  3. When pasting text (not uploading), the user can pick or confirm the exercise's language, so pasted sessions are no longer stuck tagged as `'plaintext'`.

**Plans**: 2/2 plans executed

- [x] 05-01-PLAN.md — Symbol-adjusted WPM: pure classifier/formula module, metrics.ts schema bump to 2, ResultsView/HistoryRow display (ANLY-01)
- [x] 05-02-PLAN.md — Paste language picker: PASTE_LANGUAGE_OPTIONS export, fromPaste signature change, CorpusInput `<select>` (ANLY-02)

**UI hint**: yes

### Phase 6: Cross-Session Analytics

**Goal**: The user can see patterns across their accumulated typing history: which digraphs and physical keys are slowest, and how they perform by language.
**Depends on**: Phase 4 (persisted history to read from), Phase 5 (real language tags for per-language profile)
**Requirements**: ANLY-03, ANLY-04, ANLY-05
**Success Criteria** (what must be TRUE):

  1. The user can view a ranked table of their slowest digraphs accumulated across all persisted sessions, with digraphs below a minimum-sample threshold excluded from the ranking.
  2. The user can view a keyboard heatmap highlighting which physical keys have the highest median latency across their session history.
  3. The user can view a per-language profile showing WPM and accuracy grouped by tagged language, with untagged/plaintext sessions kept in their own distinct bucket rather than mixed into a real language.

**Plans:** 3 plans

Plans:
**Wave 1**

- [ ] 06-01-PLAN.md — Extract latency-stats + move resolveMetrics so analytics stays pure (ANLY-03/04/05 foundation)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 06-02-PLAN.md — Pure analytics folds: digraph ranking, keyboard heatmap, language profile

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 06-03-PLAN.md — Analytics sibling view: stacked dashboard tables + US-ANSI heatmap (ANLY-03, ANLY-04, ANLY-05)

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 4 → 5 → 6

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|-----------------|--------|-----------|
| 1. Corpus Input & Keystroke Capture | v1.0 | 3/3 | Complete | 2026-09-04 |
| 2. Interactive Typing Trainer | v1.0 | 3/3 | Complete | 2026-09-05 |
| 3. Session Metrics | v1.0 | 2/2 | Complete | 2026-09-05 |
| 4. Session Persistence & History | v1.1 | 2/2 | Complete    | 2026-09-12 |
| 5. Symbol-Adjusted WPM & Language Tagging | v1.1 | 2/2 | In Progress|  |
| 6. Cross-Session Analytics | v1.1 | 0/? | Not started | - |
