---
phase: 04-session-persistence-history
plan: 01
subsystem: persistence
tags: [dexie, indexeddb, react, dexie-react-hooks, fake-indexeddb, vitest]

requires:
  - phase: 03-session-metrics
    provides: "buildSession()/computeSessionMetrics() completion boundary in App.tsx::handleComplete"
provides:
  - "persistence/ platform seam (types.ts, db.ts, repository.ts) — the sole Dexie import site"
  - "StoredSession on-disk record shape (D-02): raw Session + cached MetricsResult snapshot"
  - "Fire-and-forget auto-persist wired into App.tsx::handleComplete (PERS-01/D-04)"
  - "Dismissible role=status save-failure notice (PERS-03/D-15..D-17)"
  - "Minimal HistoryView bound to useLiveQuery, header Trainer/History toggle hiding (not unmounting) the trainer (D-07/D-08)"
affects: [05-symbol-adjusted-wpm, 06-cross-session-analytics]

tech-stack:
  added: ["dexie@4.4.4", "dexie-react-hooks@4.4.0", "fake-indexeddb@6.2.5 (dev)"]
  patterns:
    - "Platform-seam isolation: only persistence/db.ts imports dexie; only ui/HistoryView.tsx imports dexie-react-hooks (D-03)"
    - "Fire-and-forget completion write: void saveSession(...).catch(setSaveFailed) placed after setMetrics, never awaited (D-04)"
    - "Hide, don't unmount: view toggle sets the trainer wrapper's inline display between grid/none, key={loadToken} untouched (D-08)"

key-files:
  created:
    - src/persistence/types.ts
    - src/persistence/db.ts
    - src/persistence/repository.ts
    - src/persistence/db.test.ts
    - src/persistence/repository.test.ts
    - src/test/setup-fake-indexeddb.ts
    - src/ui/HistoryView.tsx
    - src/ui/SaveFailedNotice.tsx
    - src/ui/SaveFailedNotice.test.tsx
    - src/ui/App.test.tsx
  modified:
    - src/ui/App.tsx
    - vite.config.ts
    - package.json
    - src/index.css
    - README.md

key-decisions:
  - "Task 1 checkpoint:decision auto-selected option-a (raw Session + cached MetricsResult snapshot) — identical to CONTEXT.md D-02, auto-mode active for this run"
  - "Pinned dexie@4.4.4 (not 4.4.5) to clear the package-legitimacy seam's too-new/patch-recency flag, zero API difference (RESEARCH Package Legitimacy Audit)"
  - "Primary key: ++id auto-increment, single index on startedAt only — blob fields (events/charLog/markers/exercise/metricsSnapshot) never indexed (D-05)"

patterns-established:
  - "Dexie schema-versioning discipline: version(1).stores() carries an inline comment stating it is never edited in place; future changes are new version(n+1) blocks (D-05)"
  - "Clock-domain naming discipline in persisted records: startedAt (wall clock) vs. completedAtTMs (event.timeStamp/tMs domain) — never mixed in recompute math (RESEARCH Pitfall 2)"

requirements-completed: [PERS-01, PERS-03]

coverage:
  - id: D1
    description: "Completing a typing exercise auto-persists the full raw Session + cached MetricsResult to IndexedDB with no save button, survives a DB connection reopen"
    requirement: "PERS-01"
    verification:
      - kind: unit
        ref: "src/persistence/repository.test.ts — round-trip-by-value, empty-charLog, ++id tiebreak, newest-first ordering"
        status: pass
      - kind: unit
        ref: "src/persistence/db.test.ts — db.verno===1, seed→close→open→read survives"
        status: pass
      - kind: automated_ui
        ref: "src/ui/App.test.tsx — 'renders the results panel synchronously and writes one row readable via listNewestFirst'"
        status: pass
    human_judgment: false
  - id: D2
    description: "A rejected persistence write never blocks/delays the results screen; a dismissible role=status notice appears and clears on dismiss/load/restart"
    requirement: "PERS-03"
    verification:
      - kind: unit
        ref: "src/ui/SaveFailedNotice.test.tsx — role=status, generic body text, dismiss button calls onDismiss"
        status: pass
      - kind: automated_ui
        ref: "src/ui/App.test.tsx — 'renders the results panel synchronously even when the persistence write rejects...' and 'restarting the exercise clears a save-failure notice'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Header Trainer/History toggle; minimal History list (loading/empty/populated) bound via useLiveQuery; trainer hidden (not unmounted) when History is showing"
    verification: []
    human_judgment: true
    rationale: "happy-dom cannot verify real-browser uncontrolled-textarea caret/IME preservation across the display:none toggle (D-08/A1) — deferred to plan 04-02's real-browser verification task per RESEARCH Open Question 1"

duration: 45min
completed: 2026-09-08
status: complete
---

# Phase 4 Plan 1: Session Persistence Tracer Summary

**Dexie 4 platform seam persisting the full raw Session + cached MetricsResult to IndexedDB on every completion, fire-and-forget from `App.tsx::handleComplete`, with a minimal `useLiveQuery`-bound History view and a dismissible save-failure notice.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-09-08T22:47:34Z
- **Completed:** 2026-09-08T23:32:00Z
- **Tasks:** 3 (1 checkpoint:decision auto-selected, 2 auto)
- **Files modified:** 17 (12 created, 5 modified)

## Accomplishments

- New `persistence/` platform seam (`types.ts`, `db.ts`, `repository.ts`) — `db.ts` is the only module in `src/` importing `dexie`; `repository.ts` imports only `./db` and `./types`.
- `StoredSession` record shape persists the full raw `Session` (events, charLog, markers, exercise, timingResolutionUs, crossOriginIsolated, startedAt) plus a cached `MetricsResult` snapshot — never derived-metrics-only (D-02).
- `App.tsx::handleComplete` fires `void saveSession(...).catch(...)` immediately after `setMetrics(result)`, never awaited — the results screen renders synchronously regardless of write outcome (D-04/PERS-03).
- Header `Trainer`/`History` toggle; the trainer wrapper's inline `display` flips between `grid`/`none` (never unmounted, never the `hidden` attribute) so `CaptureSurface`'s `key={loadToken}` and in-progress capture state survive a view switch (D-08).
- Minimal `HistoryView` bound to `useLiveQuery(listNewestFirst)` with the three-way loading/empty/populated branch (RESEARCH Pitfall 5).
- Dismissible `role="status"` `SaveFailedNotice` with a single generic message (D-17), cleared on dismiss, load, and restart.
- Full test coverage: Dexie round-trip/ordering/schema-version tests, an end-to-end `<App/>` completion test proving exactly one persisted row, and a write-rejection test proving the results panel renders regardless of the write's outcome.

## Task Commits

1. **Task 1: Confirm the persisted-record format (checkpoint:decision, auto-selected)** — no commit (decision only; auto-mode selected `option-a`, identical to CONTEXT.md D-02).
2. **Task 2: End-to-end automatic persistence tracer** — `3734ba2` (feat)
3. **Task 3: Save-failure notice + persistence test suite + README privacy update** — `2551c25` (test)

_Note: Task 3's commit type is `test` because its net diff is dominated by test files, CSS, and docs — `SaveFailedNotice.tsx` itself (the only source addition strictly scoped to Task 3) was pulled forward into Task 2's commit; see Deviations below._

## Files Created/Modified

- `src/persistence/types.ts` — `StoredSession`/`NewSession`, `STORED_SESSION_SCHEMA_VERSION`
- `src/persistence/db.ts` — `KeebdrillDB` Dexie subclass, `version(1).stores({ sessions: '++id, startedAt' })`
- `src/persistence/repository.ts` — `saveSession()`, `listNewestFirst()`, one-shot `navigator.storage.persist()` latch
- `src/persistence/db.test.ts`, `src/persistence/repository.test.ts` — Dexie layer test suite (persistence vitest project)
- `src/test/setup-fake-indexeddb.ts` — `fake-indexeddb/auto` registration
- `src/ui/HistoryView.tsx` — minimal `useLiveQuery`-bound list
- `src/ui/SaveFailedNotice.tsx` + `.test.tsx` — dismissible warning notice
- `src/ui/App.tsx` — `saveFailed`/`view` state, fire-and-forget write, header nav, hide-not-unmount wrapper
- `src/ui/App.test.tsx` — end-to-end completion + write-rejection tests
- `vite.config.ts` — new `persistence` vitest project, `setupFiles` on `ui`
- `package.json`/`pnpm-lock.yaml` — `dexie@4.4.4`, `dexie-react-hooks@4.4.0`, `fake-indexeddb@6.2.5` (dev)
- `src/index.css` — `.save-failed-notice`, `.save-failed-dismiss` (no new tokens)
- `README.md` — `## Privacy` section rewritten for v1.1 IndexedDB persistence

## Decisions Made

- **Task 1 checkpoint auto-selected `option-a`** (raw `Session` + cached `MetricsResult` snapshot) per the orchestrator's auto-mode instruction — identical to `04-CONTEXT.md` D-02, which was already locked. No re-planning triggered.
- Pinned `dexie@4.4.4` instead of the latest `4.4.5` to clear the package-legitimacy seam's `too-new` (patch-recency-only) flag, with zero functional difference (RESEARCH Package Legitimacy Audit).
- `++id` auto-increment primary key with a single `startedAt` index — matches RESEARCH's Data Model recommendation; avoids a same-millisecond `startedAt` collision on a fast restart-then-refinish (D-20 explicitly allows two rows for the same text).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pulled `SaveFailedNotice.tsx` creation forward from Task 3 into Task 2**
- **Found during:** Task 2 (End-to-end tracer)
- **Issue:** Task 2's plan text adds `const [saveFailed, setSaveFailed] = useState(false)` and sets it in `handleComplete`'s `.catch`, but never renders it — `SaveFailedNotice` is scoped to Task 3. With `saveFailed` never read anywhere, `tsc --noEmit` (`noUnusedLocals: true`) fails with `TS6133: 'saveFailed' is declared but its value is never read`, which blocks Task 2's own required gate (`pnpm typecheck && pnpm test && pnpm lint && pnpm build`, all must exit 0).
- **Fix:** Created a minimal `src/ui/SaveFailedNotice.tsx` (final D-15/D-16/D-17 copy and structure, not a throwaway stub) in Task 2 and wired its render into `App.tsx` (`{metrics !== null && saveFailed && <SaveFailedNotice .../>}`), so `saveFailed` has a real reader and every gate passes at the Task 2 boundary. Task 3 then added its dedicated test file, the `.save-failed-notice`/`.save-failed-dismiss` CSS, and the README update as planned — no functional rework was needed in Task 3.
- **Files modified:** `src/ui/SaveFailedNotice.tsx` (created in Task 2's commit instead of Task 3's), `src/ui/App.tsx`
- **Verification:** `pnpm typecheck && pnpm test && pnpm lint && pnpm build` all exit 0 at both the Task 2 and Task 3 boundary
- **Committed in:** `3734ba2` (Task 2 commit)

**2. [Rule 1 - Bug] `App.test.tsx`'s completion harness needed a third keystroke because `normalize()` appends a trailing newline**
- **Found during:** Task 2 (writing the end-to-end `<App/>` test)
- **Issue:** The test drove a paste of `"ab"` through `<CorpusInput>`, but `fromPaste()` → `normalize()` unconditionally appends exactly one trailing `"\n"` (an existing, correct v1.0 behavior — not a bug in application code). The test initially only dispatched two `beforeinput` commits (`"a"`, `"b"`), so `cursor` (2) never reached `textChars.length` (3) and the exercise never completed — `ResultsView` never rendered, and the test's own assertion failed with a false "no persistence" signal.
- **Fix:** Added a third `beforeinput` commit (`inputType: 'insertLineBreak', data: '\n'`) to the test harness and updated the row assertion to expect `exercise.text === 'ab\n'`. No application code changed.
- **Files modified:** `src/ui/App.test.tsx` (test-only)
- **Verification:** `pnpm test` — the completion + persistence test passes; full suite green (144/144)
- **Committed in:** `3734ba2` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking-gate fix, 1 test-only bug fix)
**Impact on plan:** Both were necessary to keep every task boundary's gates green as literally required by the plan; no scope creep — `SaveFailedNotice.tsx`'s final content matches Task 3's spec exactly, and Task 3 still added its own dedicated test/CSS/README work untouched.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## Known Stubs

None — `HistoryView` is intentionally minimal (date + wpm + accuracy only) per Task 2's explicit scope; plan 04-02 expands it to full row fidelity (D-11). This is documented in the plan itself, not an undocumented stub.

## Threat Flags

None. No new network/auth/file-access surface was introduced beyond what `04-PLAN.md`'s `<threat_model>` already anticipated (T-04-01..T-04-05, T-04-SC) — all dispositions (`mitigate`/`accept`) match the implementation: React text-node rendering only (no `dangerouslySetInnerHTML`), generic `.catch` message (no raw `DOMException` surfaced), pinned exact dependency versions.

## User Setup Required

None — no external service configuration required. `dexie`/`dexie-react-hooks`/`fake-indexeddb` are npm packages already installed via `pnpm add`/`pnpm add -D` during execution.

## Next Phase Readiness

- Plan 04-02 can proceed: it inherits a working `persistence/` seam, a minimal `HistoryView` to expand to full row fidelity (D-11: source label, language tag, exercise length, slowest-key chip), and the D-08 hide-not-unmount mechanism ready for its real-browser/Playwright verification task (Open Question 1 / coverage item D3 above, `human_judgment: true`).
- No blockers. The one open item carried forward is the D-08 real-browser caret/IME preservation check, already scoped to 04-02 per the plan's own `must_haves` flagged assumption.

---
*Phase: 04-session-persistence-history*
*Completed: 2026-09-08*

## Self-Check: PASSED

All created files verified present on disk (`src/persistence/{types,db,repository}.ts`, `src/test/setup-fake-indexeddb.ts`, `src/ui/HistoryView.tsx`, `src/ui/SaveFailedNotice.tsx`, this SUMMARY.md); all task/summary commit hashes (`3734ba2`, `2551c25`, `b990734`) verified present in `git log --oneline --all`.
