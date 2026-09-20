# Roadmap: keebdrill

## Milestones

- ✅ **v1.0 MVP** — Phases 1-3 (shipped 2026-09-05)
- ✅ **v1.1 Persistencia y Analíticas** — Phases 4-6 (shipped 2026-09-20)
- 📋 **v2.0 Katas desde GitHub** — Phases 7-9 (planned)

## Overview

v2.0 adds the first corpus source that is not paste/upload: the user pastes a public GitHub URL, browses the repo as a filesystem tree, opens a TypeScript/JavaScript file, and types it in place as a scaffolded exercise — full file visible, only the current syntactic unit typeable, units ordered leaves-first by in-file dependencies until the file is complete. Paste and upload stay as the whole-file fallback. Click-to-type-the-whole-file is never the happy path.

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-3) — SHIPPED 2026-09-05</summary>

- [x] Phase 1: Corpus Input & Keystroke Capture (3/3 plans) — completed 2026-09-04
- [x] Phase 2: Interactive Typing Trainer (3/3 plans) — completed 2026-09-05
- [x] Phase 3: Session Metrics (2/2 plans) — completed 2026-09-05

Full detail archived to `.planning/milestones/v1.0-ROADMAP.md`.

</details>

<details>
<summary>✅ v1.1 Persistencia y Analíticas (Phases 4-6) — SHIPPED 2026-09-20</summary>

- [x] Phase 4: Session Persistence & History (2/2 plans) — completed 2026-09-12
- [x] Phase 5: Symbol-Adjusted WPM & Language Tagging (2/2 plans) — completed 2026-09-13
- [x] Phase 6: Cross-Session Analytics (3/3 plans) — completed 2026-09-20

Full detail archived to `.planning/milestones/v1.1-ROADMAP.md`.

</details>

### 📋 v2.0 Katas desde GitHub (Planned)

**Milestone Goal:** The user can paste a public GitHub URL, browse the repo as a file tree, open a TypeScript/JavaScript file, and type it in-place as a scaffolded exercise that proceeds function-by-function in dependency order until the file is complete.

- [ ] **Phase 7: GitHub URL & Repo Tree** - Import a public repo by URL and browse the default-branch filesystem; non-TS/JS files are blocked; TS/JS clicks do not start a whole-file exercise
- [ ] **Phase 8: Parse & Dependency Units** - Clicking a TS/JS file fetches the blob, splits it into non-overlapping syntactic units, and orders them leaves-first (whole-file fallback with a notice)
- [ ] **Phase 9: Scaffolded Trainer** - Type the file in place: full text visible, current unit only typeable, advance until complete; paste/upload remain whole-file

## Phase Details

### Phase 7: GitHub URL & Repo Tree

**Goal**: The user can import a public GitHub repository by URL and browse it as a filesystem tree, with honest blocked-file and error copy — without starting a typing session from the tree.
**Depends on**: Nothing new (builds on shipped v1.1 trainer, persistence, and paste/upload)
**Requirements**: REPO-01, REPO-02, REPO-03, REPO-04
**Success Criteria** (what must be TRUE):

  1. User can paste a public GitHub URL or `owner/repo` and see the repository as a filesystem tree of the default branch.
  2. User can expand and collapse folders in that tree and see every file path GitHub returns (not only TS/JS).
  3. User who clicks a non-`.ts`/`.tsx`/`.js`/`.jsx` file sees a notice that the file cannot be split yet, and no exercise loads.
  4. User sees specific, non-generic copy when the repo is missing (404), GitHub rate-limits the client, or the recursive tree is truncated.
  5. Selecting a TypeScript or JavaScript file in the tree does not load a whole-file typing session — the tree stays browse-only until units exist.

**Plans**: 3/3 plans executed
Plans:
**Wave 1**

- [x] 07-01-PLAN.md — CSP, types, URL parse, tree fold

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 07-02-PLAN.md — GitHub client fetch, error mapping, cache

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 07-03-PLAN.md — Paste | GitHub switch, browse-only RepoBrowser

**UI hint**: yes

### Phase 8: Parse & Dependency Units

**Goal**: The user's clicked TypeScript/JavaScript file becomes a planned, dependency-ordered set of syntactic units (or a labeled whole-file fallback), tagged as GitHub corpus — still not a click-to-type-the-whole-file path.
**Depends on**: Phase 7
**Requirements**: FILE-01, FILE-02, PLAN-01, PLAN-02, PLAN-03
**Success Criteria** (what must be TRUE):

  1. User who clicks a `.ts`/`.tsx`/`.js`/`.jsx` file gets that blob loaded as corpus under the same 100 KB cap and UTF-8 rules as upload, then normalized like paste/upload — not started as a whole-file typing session.
  2. User's resulting exercise is tagged `sourceType: 'github'` with repo and path in `sourceRef`, so History can show where it came from.
  3. User's TS/JS file is split into non-overlapping syntactic units (top-level functions, import/type blocks; a class is one unit; nested functions stay inside their parent).
  4. Those units are ordered by in-file dependencies: indispensable/leaf units first, then units that depend on them.
  5. User still gets an exercise if the file cannot be split: the whole file is the single unit, with a notice — never a silent no-op.

**Plans**: TBD

### Phase 9: Scaffolded Trainer

**Goal**: The user types a GitHub file in place as a scaffolded exercise — full file visible, current unit only typeable — until the file is complete; paste and upload stay whole-file drills.
**Depends on**: Phase 8
**Requirements**: SCAF-01, SCAF-02, SCAF-03, SCAF-04, SCAF-05
**Success Criteria** (what must be TRUE):

  1. User sees the full file, including future units; only the current syntactic unit is typeable.
  2. User who completes the current unit advances to the next until the file is done.
  3. User who finishes the last unit sees the existing results screen and gets one persisted session for the whole file (full `Exercise.text`).
  4. User who presses Escape restarts the current unit, not the entire file.
  5. User can still paste text or upload a file as the corpus path for ad-hoc and non-TS/JS drills; that path stays a whole-file exercise.

**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Corpus Input & Keystroke Capture | v1.0 | 3/3 | Complete | 2026-09-04 |
| 2. Interactive Typing Trainer | v1.0 | 3/3 | Complete | 2026-09-05 |
| 3. Session Metrics | v1.0 | 2/2 | Complete | 2026-09-05 |
| 4. Session Persistence & History | v1.1 | 2/2 | Complete | 2026-09-12 |
| 5. Symbol-Adjusted WPM & Language Tagging | v1.1 | 2/2 | Complete | 2026-09-13 |
| 6. Cross-Session Analytics | v1.1 | 3/3 | Complete | 2026-09-20 |
| 7. GitHub URL & Repo Tree | v2.0 | 3/3 | In Progress|  |
| 8. Parse & Dependency Units | v2.0 | 0/? | Not started | - |
| 9. Scaffolded Trainer | v2.0 | 0/? | Not started | - |
