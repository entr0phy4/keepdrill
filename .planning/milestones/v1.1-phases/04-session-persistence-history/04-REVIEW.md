---
phase: 04-session-persistence-history
reviewed: 2026-09-08T23:59:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - package.json
  - pnpm-lock.yaml
  - vite.config.ts
  - src/persistence/types.ts
  - src/persistence/db.ts
  - src/persistence/repository.ts
  - src/persistence/db.test.ts
  - src/persistence/repository.test.ts
  - src/test/setup-fake-indexeddb.ts
  - src/ui/App.tsx
  - src/ui/App.test.tsx
  - src/ui/HistoryView.tsx
  - src/ui/HistoryView.test.tsx
  - src/ui/history-metrics.ts
  - src/ui/history-metrics.test.ts
  - src/ui/relative-time.ts
  - src/ui/relative-time.test.ts
  - src/ui/SaveFailedNotice.tsx
  - src/ui/SaveFailedNotice.test.tsx
  - src/index.css
  - README.md
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-09-08T23:59:00Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Reviewed the Dexie-based `persistence/` platform seam, the `App.tsx` fire-and-forget completion
write, the `SaveFailedNotice`/`HistoryView`/`history-metrics`/`relative-time` UI layer, and the
supporting config/docs changes across both Phase 4 plans (04-01, 04-02). `pnpm typecheck`,
`pnpm test` (162/162 passing across 14 files), and `pnpm lint` (no warnings introduced by this
phase's files) all pass locally. The platform-seam isolation contract holds (`dexie` is imported
only by `src/persistence/db.ts`; `dexie-react-hooks` only by `src/ui/HistoryView.tsx`), no
`dangerouslySetInnerHTML`/`eval`/raw-HTML rendering of any persisted field exists, and the
single-generic-message / no-raw-`DOMException` contract for the save-failure notice is honoured.

No Critical (security or data-loss) issues were found. Two Warnings concern gaps that the current
must-haves and tests don't cover: a stale-write race on the `saveFailed` flag, and a missing
error boundary around the `useLiveQuery`-driven `HistoryView` that could crash the whole app (not
just History) if IndexedDB is unavailable. Three Info items are minor quality nits.

## Warnings

### WR-01: `saveFailed` has no guard against an out-of-order/stale write settling after a newer completion or restart

**File:** `src/ui/App.tsx:88-93` (`handleComplete`), `src/ui/App.tsx:105-110` (`handleRestart`)
**Issue:** Every `handleComplete` call does `setSaveFailed(false)` and then fires
`void saveSession(...).catch(() => setSaveFailed(true))` unconditionally, with no per-completion
token/id carried into the `.catch`. If a first completion's `saveSession(...)` promise is still
pending (e.g. a slow/contended IndexedDB write — precisely the condition under which a rejection
is likely) and the user restarts or completes a second exercise before it settles,
`handleRestart`/the second `handleComplete` will call `setSaveFailed(false)` first, but the
*first* write's delayed rejection can still land afterwards and flip `saveFailed` back to `true` —
showing a stale "couldn't be saved" notice for a session that actually saved fine (or vice-versa,
a genuine failure being masked if the ordering runs the other way). This violates the documented
must-have "the save-failure notice reflects only the most recent completion's write outcome"
(PERS-03 concurrency edge) in the case where settlement order does not match call order. No test
in `App.test.tsx` exercises this ordering (all current tests either let a write resolve fully or
reject before the next action starts).
**Fix:** Carry a monotonically-increasing completion token (e.g. a ref bumped in `handleComplete`/
`handleRestart`/`handleLoad`) and ignore a `.catch` callback whose captured token no longer matches
the latest one:
```tsx
const completionTokenRef = useRef(0)

const handleComplete = (completedAt: number) => {
  // ...
  const token = ++completionTokenRef.current
  setSaveFailed(false)
  void saveSession({ session, completedAt, metricsSnapshot: result }).catch((err: unknown) => {
    console.warn('[keebdrill] session not persisted:', err)
    if (completionTokenRef.current === token) setSaveFailed(true)
  })
}
```
(`handleLoad`/`handleRestart` should also bump `completionTokenRef.current` so any in-flight write
from a discarded session can never resurrect the notice.)

### WR-02: `HistoryView` has no error handling around `useLiveQuery(listNewestFirst)` — an IndexedDB failure can crash the whole app, not just History

**File:** `src/ui/HistoryView.tsx:14` (`useLiveQuery(listNewestFirst)`)
**Issue:** `listNewestFirst()` returns a promise that can reject (e.g. Safari private-browsing
mode where IndexedDB throws/is disabled, a blocked/failed `db.open()`, or a quota/storage error).
`dexie-react-hooks`'s `useLiveQuery` re-throws a querier rejection during render on the next tick.
There is no `ErrorBoundary` anywhere in the component tree (`App.tsx` renders `HistoryView`
directly, unwrapped). An uncaught render-time error unmounts the nearest ancestor boundary — here,
the React root — which would blank the entire app, including the trainer, the moment a user opens
History under a failing IndexedDB, not just degrade the History view. This is a materially larger
blast radius than the `saveSession` write-path failure, which is already correctly isolated by a
`.catch` (D-15/D-17); the read path has no equivalent safety net.
**Fix:** Wrap `HistoryView` (or its `<section>` body) in a small error boundary, or catch the
`listNewestFirst()` rejection inside the query and surface a generic degraded-state message
instead of letting it propagate:
```tsx
const sessions = useLiveQuery(() => listNewestFirst().catch(() => [] as StoredSession[]))
```
(or a dedicated `<ErrorBoundary>` around `{view === 'history' && <HistoryView />}` in `App.tsx`,
consistent with the "results screen is never blocked/crashed" spirit already applied to the write
path).

## Info

### IN-01: `.results-stat-label` class is applied but never defined in `index.css`

**File:** `src/ui/HistoryView.tsx:51`
**Issue:** `HistoryRow` renders `<span className="results-stat-label text-muted">wpm</span>`,
copying the exact class pair `ResultsView.tsx` already uses (`src/ui/ResultsView.tsx:28,31`). No
`.results-stat-label` selector exists anywhere in `src/index.css` — only `.text-muted` actually
applies a style. The label currently renders correctly because `.text-muted` alone satisfies the
visual requirement (per 04-02's own key-decisions note), but the `results-stat-label` class is
dead weight that could mislead a future contributor searching for its styling rule, or silently
pick up an unintended style if the selector is ever added for `ResultsView` alone without
considering `HistoryView` reuses it.
**Fix:** Either add a (currently no-op) `.results-stat-label {}` rule with a comment explaining it
intentionally carries no styling beyond `.text-muted`, or drop the class from both `HistoryView.tsx`
and `ResultsView.tsx` and rely on `.text-muted` alone.

### IN-02: `saveSession` shares the persisted `exercise` object by reference instead of copying it

**File:** `src/persistence/repository.ts:20-25`
**Issue:** `saveSession` spread-copies `events`/`charLog`/`markers` into fresh arrays (per the
in-code comment, because `Session`'s arrays are frozen) but assigns `exercise: input.session.exercise`
directly, sharing the same object reference between the in-memory `Session` and the persisted
`StoredSession` row. There is no current code path that mutates an `Exercise` after load, so this
is not exploitable today, but it is an inconsistency with the surrounding "copy everything, never
share" discipline the comment block otherwise documents, and would silently corrupt an
already-written row if any future code mutated the live `Exercise` in place (e.g. a hypothetical
in-place `sourceRef` normalization).
**Fix:** Shallow-copy for consistency: `exercise: { ...input.session.exercise }`.

### IN-03: `HistoryRow`'s React `key` relies on `StoredSession.id`, which is typed optional

**File:** `src/ui/HistoryView.tsx:27` (`sessions.map((s) => <HistoryRow key={s.id} session={s} />)`)
**Issue:** `StoredSession.id?: number` is optional in `src/persistence/types.ts` (Dexie fills it on
`add`). In practice every row returned by `listNewestFirst()` has already been persisted and thus
always has an `id`, so this isn't reachable today — but the type system does not enforce it at this
call site, and `key={undefined}` would silently degrade to positional keys (masking reorders) if
that invariant were ever broken by a future refactor (e.g. an optimistic-render path that renders
an unsaved `NewSession` through the same component).
**Fix:** Either narrow the type at the `listNewestFirst()` boundary (e.g. a `StoredSessionSaved`
type with `id: number`) or assert/guard defensively: `key={s.id ?? \`${s.startedAt}-fallback\`}`.

---

_Reviewed: 2026-09-08T23:59:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
