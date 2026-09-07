# Requirements: keebdrill v1.1

**Defined:** 2026-09-05
**Core Value:** The user can paste or upload a real code/text file, type it with keystroke capture, and see WPM, accuracy, and their five slowest keys — useful enough for a week of daily self-use.
**Milestone Goal:** Persistir cada sesión localmente y exponer analíticas de dígrafo/trígrafo, heatmap de teclado, perfil por lenguaje y WPM ajustado por símbolos, para poder medir mejora real a través del tiempo.

## v1.1 Requirements

### Persistence (PERS)

- [ ] **PERS-01**: User's completed session (full raw log, not just summary numbers) is automatically saved to local storage (IndexedDB) with no explicit "save" action, and survives a page reload
- [ ] **PERS-02**: User can view a list of past sessions (date, WPM, accuracy), newest first
- [ ] **PERS-03**: User sees a non-blocking notice if a session fails to persist (e.g. storage unavailable/quota exceeded) — the results screen is never blocked or delayed by the save

### Analytics (ANLY)

- [ ] **ANLY-01**: User can see a symbol-density-adjusted WPM shown as a companion metric next to net WPM, on the results screen and in session history
- [ ] **ANLY-02**: User can pick or confirm the language of a pasted exercise (not just uploads), so pasted sessions are tagged with a real language instead of always defaulting to `'plaintext'`
- [ ] **ANLY-03**: User can see a ranked table of their slowest digraphs (2-character sequences), accumulated across persisted sessions, with a minimum-sample gate so sparse/noisy pairs aren't shown as confident results
- [ ] **ANLY-04**: User can see a keyboard heatmap showing which physical keys are slowest, based on median latency accumulated across persisted sessions
- [ ] **ANLY-05**: User can see a per-language profile — WPM and accuracy grouped by tagged language — across their session history, with untagged/plaintext sessions shown as their own distinct bucket rather than mixed into a real language

## Future Requirements

Deferred to a later milestone. Tracked but not in this roadmap.

### Analytics (ANLY)

- **ANLY-06**: User can see trigraph (3-character sequence) latency, once enough accumulated session history exists to clear a meaningful sample gate
- **ANLY-07**: User can drill into a single past session's own detail (its own slowest-5/digraph breakdown), re-derived from its persisted raw log
- **ANLY-08**: User can filter the keyboard heatmap or digraph table by language
- **ANLY-09**: Pasted exercises get automatic language detection (heuristic or tree-sitter-based) instead of a manual picker

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Trend/evolution charts over session history | PROJECT.md explicitly defers rich charting; v1.1 ships a flat history list plus per-metric analytics tables, not chart visualizations |
| Cross-device sync of session history | No backend in scope for v1.1 — the app remains local-first/browser-only; would require the Tauri/native evolution path, not a browser feature |
| Trigraph latency (this milestone) | Sparser than digraphs — needs materially more accumulated session history to avoid single-occurrence "slowest sequence" noise; deferred to Future Requirements |
| Auto language detection for paste | Tree-sitter-based parsing is its own later phase (per PROJECT.md Out of Scope); a manual picker is the correct-for-now, low-cost answer |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PERS-01 | Phase 4 | Pending |
| PERS-02 | Phase 4 | Pending |
| PERS-03 | Phase 4 | Pending |
| ANLY-01 | Phase 5 | Pending |
| ANLY-02 | Phase 5 | Pending |
| ANLY-03 | Phase 6 | Pending |
| ANLY-04 | Phase 6 | Pending |
| ANLY-05 | Phase 6 | Pending |

**Coverage:**
- v1.1 requirements: 8 total
- Mapped to phases: 8/8 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-05*
*Last updated: 2026-09-06 after ROADMAP.md creation (Phases 4-6)*
