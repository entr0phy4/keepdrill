---
phase: 04-session-persistence-history
verified: 2026-09-08T18:20:00Z
status: passed
score: 9/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:

  - test: "Task 2 (04-02) — Visual check of the History list in Chromium: run `pnpm dev`, complete two short exercises, open History."
    expected: "Rows render as bordered secondary-surface cards, newest-first, each showing relative date + WPM + accuracy + source label + language chip + \"N chars\" + slowest-key chip. The active toggle button is surface-filled and bold (NOT green/accent). No WPM or accuracy value is colored green or red. The empty state reads \"No sessions yet — finish a typing exercise and it'll show up here.\" under an always-present \"History\" heading."
    why_human: "happy-dom has no layout/paint engine — actual color rendering, card visuals, and cross-browser CSS application cannot be verified by static analysis or DOM assertions. Deliberately deferred to end-of-phase human-verify batch per workflow.human_verify_mode=end-of-phase (04-02-PLAN.md Task 2 human-check)."

  - test: "Task 3 (04-02) — D-08 caret/IME preservation across a real view toggle in Chromium: type ~10 characters including one correction, click History, click Trainer, and (if available) test an in-progress CJK/pinyin IME composition across the switch."
    expected: "Caret sits at the exact same character position; per-character correct/incorrect coloring is identical; clicking the trainer surface still reclaims focus; an IME composition begun before the switch still resolves correctly after returning."
    why_human: "happy-dom has no layout engine and cannot verify real uncontrolled-<textarea> selection/IME behavior across a genuine display:none toggle (RESEARCH Open Question 1 / Assumption A1). The happy-dom regression test (App.test.tsx D-08 block) proves charLog/status/node-identity/caret-index invariants hold in the test DOM, but real-browser caret/IME rendering requires a human check. Deliberately deferred per workflow.human_verify_mode=end-of-phase (04-02-PLAN.md Task 3 human-check). Documented fallback if this fails: lift the capture buffer into a React ref that survives a CaptureSurface remount and let the trainer unmount."
---

# Phase 4: Session Persistence & History Verification Report

**Phase Goal:** The user's completed sessions persist locally with no explicit save action, and are browsable as a history list.
**Verified:** 2026-09-08T18:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Completing a typing exercise auto-persists the full raw `Session` (events, charLog, markers, exercise, timingResolutionUs, crossOriginIsolated, startedAt) + cached `MetricsResult` to IndexedDB, no save button, no user action (PERS-01/D-02/D-04) | ✓ VERIFIED | `src/persistence/repository.ts:12-31` builds a `StoredSession` copying every raw field; `src/ui/App.tsx:88-94` fires `void saveSession(...)` inline in `handleComplete`, never awaited, never gated. `App.test.tsx` "renders the results panel synchronously and writes one row readable via listNewestFirst" — passes; row's `exercise.text` matches typed content. |
| 2 | A persisted session survives a page reload (PERS-01) | ✓ VERIFIED | `src/persistence/db.test.ts` reload-survival proxy (seed → `db.close()` → `db.open()` → `listNewestFirst()` still returns the row) — passes under the `persistence` vitest project. |
| 3 | Results screen renders synchronously on completion regardless of write outcome (PERS-03/D-04) | ✓ VERIFIED | `App.tsx:88` calls `setMetrics(result)` before the fire-and-forget `saveSession` call; `App.test.tsx` "renders the results panel synchronously even when the persistence write rejects" — forces DB closed, drives completion, asserts `.results-panel` present. |
| 4 | A rejected write shows a small, non-blocking, dismissible `role="status"` notice near results; never blocks/covers the panel (PERS-03/D-15/D-16/D-17) | ✓ VERIFIED | `SaveFailedNotice.tsx` — single generic message, `role="status"`, `aria-label="Dismiss notice"` button; rendered in `App.tsx` between `<ResultsView>` and Restart button, gated on `metrics !== null && saveFailed`. `SaveFailedNotice.test.tsx` + `App.test.tsx` write-rejection test both pass. |
| 5 | `db.ts` is the sole `dexie` import site; `repository.ts` imports only `./db`+`./types`; `metrics.ts`/future `analytics.ts` never import `persistence/` (D-03) | ✓ VERIFIED | `grep -rl "from 'dexie'" src/` → exactly `src/persistence/db.ts`; `grep -rl "from 'dexie-react-hooks'" src/` → exactly `src/ui/HistoryView.tsx`; `repository.ts` imports only `./db`, `./types`. |
| 6 | Dexie schema is `version(1).stores({ sessions: '++id, startedAt' })`; blobs never indexed (D-05) | ✓ VERIFIED | `src/persistence/db.ts:14-18` — exact stores string, with an inline comment locking the "never edit in place" discipline. |
| 7 | User can open History (header toggle), see past sessions newest-first, each row showing date, WPM, accuracy, source label, language, length, slowest-key chip (PERS-02/D-11/D-12) | ✓ VERIFIED | `HistoryRow` in `HistoryView.tsx:37-67` renders all seven fields via `resolveMetrics`/`relativeTime`/`glyphFor`; `HistoryView.test.tsx` asserts full-row fidelity, newest-first + `++id` tiebreak ordering (per `04-02-SUMMARY.md` coverage D1, and `repository.test.ts`/`db.test.ts` at the data layer). |
| 8 | Loading (`undefined`) vs. empty (`[]`) states are distinct; three-way branch never conflated (RESEARCH Pitfall 5) | ✓ VERIFIED | `HistoryView.tsx:17-25` explicit three-way ternary; `HistoryView.test.tsx` covers loading-then-empty and loading-then-populated per 04-02-SUMMARY coverage D1(f). |
| 9 | Switching to History hides (never unmounts) the trainer; in-progress capture state (charLog, per-char status, textarea DOM identity, caret index) survives a round trip (D-08) | ✓ VERIFIED | `App.tsx:200-215` toggles inline `display` on the wrapper, `CaptureSurface key={loadToken}` untouched, no `resetCapture()`/`loadToken` bump reachable from `setView`. `App.test.tsx` "D-08 hide-not-unmount contract" test types with one correction, toggles History→Trainer, and asserts identical `charLog.length`, identical per-char `[data-status]` array, same `<textarea>` node reference, and identical caret index — passes. (Real-browser caret/IME confirmation is a deferred human-check, see below.) |

**Score:** 9/9 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/persistence/types.ts` | `StoredSession`, `NewSession`, `STORED_SESSION_SCHEMA_VERSION` | ✓ VERIFIED | All present, correctly shaped, imports upstream types only (no re-declaration). |
| `src/persistence/db.ts` | `KeebdrillDB` Dexie subclass, `db` singleton, sole Dexie import site | ✓ VERIFIED | Matches exactly; version(1) discipline comment present. |
| `src/persistence/repository.ts` | `saveSession`, `listNewestFirst`; imports only `./db`+`./types` | ✓ VERIFIED | Confirmed no `dexie`/React import; `navigator.storage.persist()` one-shot latch present (D-06). |
| `src/persistence/{db,repository}.test.ts` | Round-trip, empty-charLog, tiebreak, ordering, schema-version-1, reload-survival | ✓ VERIFIED | Both files present, passing under `persistence` vitest project. |
| `src/test/setup-fake-indexeddb.ts` | `fake-indexeddb/auto` side-effect import | ✓ VERIFIED | Wired into `persistence` and `ui` vitest projects' `setupFiles`. |
| `src/ui/SaveFailedNotice.tsx` + `.test.tsx` | Dismissible `role="status"` notice | ✓ VERIFIED | Single generic message (D-17), no retry control, dismiss button wired. |
| `src/ui/HistoryView.tsx` + `.test.tsx` | Full-fidelity `useLiveQuery`-bound list with `HistoryRow` | ✓ VERIFIED | All seven D-11/D-12 fields, three-way branch, inert rows (no onClick/href/tabIndex). |
| `src/ui/history-metrics.ts` + `.test.ts` | `resolveMetrics` recompute-if-stale guard | ✓ VERIFIED | Lives in `ui/`, no `dexie`/`persistence/db` import; recompute's 4th arg is `completedAtTMs`, never `startedAt`. |
| `src/ui/relative-time.ts` + `.test.ts` | `relativeTime(startedAt, now?)` | ✓ VERIFIED | Single module-level `Intl.RelativeTimeFormat`, descending unit ladder, no new dependency. |
| `src/ui/App.tsx` (modified) | `saveFailed`+`view` state, fire-and-forget write, hide-not-unmount wrapper, header nav, notice+HistoryView mount | ✓ VERIFIED | All wiring present and correctly ordered (see truths 1, 3, 4, 9 above). |
| `vite.config.ts` (modified) | New `persistence` project; `setupFiles` on `ui`; `persistence` excluded from `unit` | ✓ VERIFIED | Exact match to plan spec. |
| `package.json` (modified) | `dexie@4.4.4`, `dexie-react-hooks@4.4.0` deps; `fake-indexeddb@6.2.5` devDep | ✓ VERIFIED | Pinned versions confirmed via grep. |
| `README.md` (modified) | Privacy section reflects IndexedDB persistence, local-only, no network/sync/export | ✓ VERIFIED | Section rewritten correctly; structural no-fetch/XHR/WebSocket claim preserved. |
| `src/index.css` (modified) | `.save-failed-dismiss`, `.history-*` classes, toggle active-state via `[aria-current="page"]` | ✓ VERIFIED | All selectors present; no new `--*` custom property introduced. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `App.tsx::handleComplete` | `persistence/repository.ts` | `void saveSession(...).catch(setSaveFailed)` | ✓ WIRED | Confirmed inline, after `setMetrics`, never awaited. |
| `persistence/repository.ts` | `persistence/db.ts` | `db.sessions.add` / `.orderBy('startedAt').reverse()` | ✓ WIRED | Confirmed. |
| `ui/HistoryView.tsx` | `persistence/repository.ts` | `useLiveQuery(listNewestFirst)` | ✓ WIRED | Confirmed — stable module-level function reference, not an inline arrow. |
| `App.tsx` | `ui/SaveFailedNotice.tsx` | conditional render gated on `metrics !== null && saveFailed` | ✓ WIRED | Confirmed, positioned between ResultsView and Restart button. |
| `ui/HistoryView.tsx` | `ui/history-metrics.ts` | `resolveMetrics(session)` per row | ✓ WIRED | Confirmed. |
| `ui/history-metrics.ts` | `metrics/metrics.ts` | `computeSessionMetrics(text, charLog, markers, completedAtTMs)` | ✓ WIRED | Confirmed 4th arg is `completedAtTMs`, not `startedAt`. |
| `ui/HistoryView.tsx` | `trainer/state.ts` | `glyphFor(entry.char)` | ✓ WIRED | Confirmed, reused not reimplemented. |
| `ui/HistoryView.tsx` | `ui/relative-time.ts` | `relativeTime(session.startedAt)` + `title` absolute | ✓ WIRED | Confirmed. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PERS-01 | 04-01 | Auto-persist full raw session, no save button, survives reload | ✓ SATISFIED | Truths 1, 2, 5, 6 above |
| PERS-02 | 04-02 | View newest-first list of past sessions: date, WPM, accuracy | ✓ SATISFIED | Truths 7, 8 above |
| PERS-03 | 04-01 | Non-blocking notice on save failure; results screen never blocked | ✓ SATISFIED | Truths 3, 4 above |

No orphaned requirements — REQUIREMENTS.md maps only PERS-01/02/03 to Phase 4, and all three are claimed and satisfied.

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX` debt markers, no placeholder/stub returns, and no hardcoded-empty data paths found in the phase's modified files. `pnpm lint` reports one pre-existing warning in `src/ui/CaptureSurface.tsx` (`react-hooks/exhaustive-deps`) — that file is not in this phase's `files_modified` list for either plan and predates this phase; not attributable to Phase 4.

**Advisory (from 04-REVIEW.md, non-blocking per task instructions — 0 critical, 2 warnings, 3 info):**

- **WR-01** (`App.tsx` `handleComplete`/`handleRestart`): no per-completion token guards the `.catch(setSaveFailed)` callback, so a slow first write's rejection settling *after* a second completion/restart has already reset `saveFailed` could re-flip the notice for a stale outcome. The literal must-have text ("each completion sets `saveFailed` to false before firing its own write") is satisfied and tested; the broader ordering guarantee under out-of-order async settlement is not covered by any test and is a real, documented edge case. Not treated as a gap here because (a) it requires a specific rare interleaving (a second completion starting while the first write is still pending), (b) the code review explicitly scored it as a Warning not a Blocker, and (c) no must-have or acceptance criterion in either PLAN explicitly required a token-guarded implementation — only the "sets false before firing" mechanism, which is present.
- **WR-02** (`HistoryView.tsx`): no error boundary around `useLiveQuery(listNewestFirst)` — an IndexedDB failure on the read path could blank the whole app render tree, a materially larger blast radius than the already-mitigated write-path failure. Not a must-have in either PLAN; flagged for awareness only.
- IN-01/IN-02/IN-03 (dead CSS class reference, shared-not-copied `exercise` object reference, optional `id` in row `key`): all low-severity code-quality nits with no user-facing effect; not must-haves.

### Human Verification Required

Two `<human-check>` items from `04-02-PLAN.md` were deliberately deferred to the end-of-phase human-verify batch per project config `workflow.human_verify_mode=end-of-phase` (confirmed intentional plan design, not missed work — both 04-02-SUMMARY.md and the PLAN's own `<verify>` blocks document this deferral explicitly):

### 1. History list visual check in Chromium (04-02 Task 2)

**Test:** Run `pnpm dev`, complete two short exercises, open History.
**Expected:** Rows render as bordered secondary-surface cards, newest-first, each showing relative date + WPM + accuracy + source label + language chip + "N chars" + slowest-key chip. The active toggle button is surface-filled and bold (NOT green/accent). No WPM or accuracy value is colored green or red. The empty state reads "No sessions yet — finish a typing exercise and it'll show up here." under an always-present "History" heading.
**Why human:** Actual paint/color/card-visual rendering cannot be verified by happy-dom (no layout engine) or static analysis; this is a visual-fidelity check against 04-UI-SPEC.md.

### 2. D-08 caret/IME preservation in Chromium (04-02 Task 3)

**Test:** Type ~10 characters including one correction (wrong char → backspace → right char), click "History", click "Trainer", and (if a CJK/pinyin IME is available) test an in-progress IME composition across the switch.
**Expected:** Caret sits at the exact same character position; per-character correct/incorrect coloring is identical; clicking the trainer surface reclaims focus; an IME composition begun before the switch resolves correctly after returning. If any of these fail, the documented fallback (lift the capture buffer into a React ref that survives a `CaptureSurface` remount, let the trainer unmount) must be applied and re-verified.
**Why human:** happy-dom has no layout engine and cannot exercise real uncontrolled-`<textarea>` selection/IME behavior across a genuine `display:none` toggle (RESEARCH Open Question 1 / Assumption A1). The automated `App.test.tsx` D-08 regression test already proves the DOM-observable invariants (charLog length, per-char status array, textarea node identity, caret index) hold in happy-dom — this human check confirms the same holds with real browser layout/IME.

### Gaps Summary

No gaps. All 9 must-have truths verified against the actual codebase (not SUMMARY.md claims): the `persistence/` platform seam correctly isolates Dexie, the fire-and-forget write is correctly ordered relative to `setMetrics`, the save-failure notice is correctly gated and dismissible, the History view renders full D-11/D-12 row fidelity from real `useLiveQuery` data (not a stub), and the D-08 hide-not-unmount mechanism is proven in happy-dom with a targeted regression test. `pnpm typecheck && pnpm test && pnpm lint && pnpm build` all pass (162/162 tests green). Both requirement-blocking items are the two `<human-check>` items already known and explicitly deferred by the plans themselves — this is intentional project workflow, not an implementation shortfall, so status resolves to `human_needed` rather than `gaps_found`.

---

_Verified: 2026-09-08T18:20:00Z_
_Verifier: Claude (gsd-verifier)_
