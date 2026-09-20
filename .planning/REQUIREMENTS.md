# Requirements: keebdrill v2.0

**Defined:** 2026-09-20
**Core Value:** The user can paste or upload a real code/text file, type it with keystroke capture, and see WPM, accuracy, and their five slowest keys — useful enough for a week of daily self-use.
**Milestone Goal:** The user can paste a public GitHub URL, browse the repo as a file tree, open a TypeScript/JavaScript file, and type it in-place as a scaffolded exercise that proceeds function-by-function in dependency order until the file is complete.

## v2.0 Requirements

### Repo

- [ ] **REPO-01**: User can paste a public GitHub URL or `owner/repo` and see the repository as a filesystem tree of the default branch
- [ ] **REPO-02**: User can expand and collapse folders in that tree and see every file path GitHub returns (not only TS/JS)
- [ ] **REPO-03**: User who clicks a non-`.ts`/`.tsx`/`.js`/`.jsx` file sees a notice that the file cannot be split yet, and no exercise loads
- [ ] **REPO-04**: User sees specific, non-generic copy when the repo is missing (404), GitHub rate-limits the client, or the recursive tree is truncated

### File

- [ ] **FILE-01**: User who clicks a TypeScript or JavaScript file gets that blob loaded as corpus — same 100 KB cap and UTF-8 rules as upload — then normalized like paste/upload
- [ ] **FILE-02**: User's resulting exercise is tagged `sourceType: 'github'` with repo and path in `sourceRef`, so History can show where it came from

### Plan

- [ ] **PLAN-01**: User's TS/JS file is split into non-overlapping syntactic units (top-level functions, import/type blocks; a class is one unit; nested functions stay inside their parent)
- [ ] **PLAN-02**: User types those units in dependency order: indispensable/leaf units first, then units that depend on them
- [ ] **PLAN-03**: User still gets an exercise if the file cannot be split: the whole file is the single unit, with a notice — never a silent no-op

### Scaffold

- [ ] **SCAF-01**: User sees the full file, including future units; only the current unit is typeable
- [ ] **SCAF-02**: User who completes the current unit advances to the next until the file is done
- [ ] **SCAF-03**: User who finishes the last unit sees the existing results screen and gets one persisted session for the whole file (full `Exercise.text`)
- [ ] **SCAF-04**: User who presses Escape restarts the current unit, not the entire file
- [ ] **SCAF-05**: User can still paste text or upload a file as the corpus path for ad-hoc and non-TS/JS drills; that path stays a whole-file exercise

## Future Requirements

Deferred to a later milestone. Tracked but not in this roadmap.

### Repo

- **REPO-05**: User can pick a branch, tag, or SHA instead of the default branch
- **REPO-06**: User can open a private GitHub repository (auth)

### Plan

- **PLAN-04**: User can split Python / Go / YAML / other languages the same way as TS/JS
- **PLAN-05**: User can type class methods as separate dependency-ordered units

### Analytics (carried from v1.1)

- **ANLY-06**: User can see trigraph latency across persisted sessions, gated so sparse triples are not ranked
- **ANLY-07**: User can drill into a single past session's own metrics from its raw log
- **ANLY-08**: User can filter the keyboard heatmap or digraph table by language
- **ANLY-09**: Pasted exercises get automatic language detection

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Local folder / Tauri / GitLab / generic git clone | v2.0 is public GitHub REST only |
| Typing the whole file as the happy path | User locked scaffolded units; whole-file is fallback only |
| Cloze / hidden future units | User chose full file visible |
| Monaco / CodeMirror as the trainer | Would break capture timing and IME invariants |
| Prefetching every blob on import | Unauthenticated 60 req/h budget |
| Private repos / PAT in localStorage | Auth is a later milestone |
| Adaptive drills from heatmap | Own milestone |
| Trend charts, extra analytics (ANLY-06..09) | v2.0 is repo katas, not more analytics |
| Accounts, multiplayer, gamification | Unchanged project boundary |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| REPO-01 | Phase 7 | Pending |
| REPO-02 | Phase 7 | Pending |
| REPO-03 | Phase 7 | Pending |
| REPO-04 | Phase 7 | Pending |
| FILE-01 | Phase 8 | Pending |
| FILE-02 | Phase 8 | Pending |
| PLAN-01 | Phase 8 | Pending |
| PLAN-02 | Phase 8 | Pending |
| PLAN-03 | Phase 8 | Pending |
| SCAF-01 | Phase 9 | Pending |
| SCAF-02 | Phase 9 | Pending |
| SCAF-03 | Phase 9 | Pending |
| SCAF-04 | Phase 9 | Pending |
| SCAF-05 | Phase 9 | Pending |

**Coverage:**

- v2.0 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓
- Not mapped (deferred): ANLY-06..09, REPO-05/06, PLAN-04/05 (Future Requirements)

---
*Requirements defined: 2026-09-20*
*Last updated: 2026-09-20 after v2.0 roadmap*
