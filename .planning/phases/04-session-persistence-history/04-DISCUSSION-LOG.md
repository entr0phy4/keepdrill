# Phase 4: Session Persistence & History - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-06
**Phase:** 4-session-persistence-history
**Areas discussed:** History view placement, History row content & interactivity, Save-failure notice presentation, Raw-log retention policy

---

## History View Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Separate view + toggle | Header link switches between trainer view and full-page history list | ✓ |
| Always-visible section below | History renders permanently under the trainer/results | |
| Collapsible panel below | Section below trainer, collapsed by default with disclosure toggle | |

**User's choice:** Separate view + toggle
**Notes:** Rationale offered in options — same navigation surface will be reused by Phase 6 analytics views.

| Option | Description | Selected |
|--------|-------------|----------|
| Live via useLiveQuery | New session appears immediately after fire-and-forget write resolves | ✓ |
| On view open / reload only | List queries once when opened | |

**User's choice:** Live via useLiveQuery

| Option | Description | Selected |
|--------|-------------|----------|
| Nothing — stay on results | Results screen shows as today; new row just there when user looks | ✓ |
| Stay, but flash/highlight | Stay on results, briefly highlight new row if history visible | |

**User's choice:** Nothing — stay on results

---

## History Row Content & Interactivity

| Option | Description | Selected |
|--------|-------------|----------|
| Source label | Filename for uploads / "Pasted snippet" for paste | ✓ |
| Language tag | exercise.language (mostly 'plaintext' until Phase 5) | ✓ |
| Exercise length | Character or line count of exercise text | ✓ |
| Slowest key | #1 slowest key from cached metrics snapshot, as a chip | ✓ |

**User's choice:** All four (in addition to required date / WPM / accuracy)

| Option | Description | Selected |
|--------|-------------|----------|
| Relative + absolute on hover | "2h ago" with full timestamp as tooltip | ✓ |
| Absolute only | e.g. "2026-09-06 14:32" | |

**User's choice:** Relative + absolute on hover

| Option | Description | Selected |
|--------|-------------|----------|
| Inert (read-only rows) | No click target; drill-down deferred to ANLY-07 | ✓ |
| Clickable, expand summary | Click expands row to show cached metrics snapshot inline | |

**User's choice:** Inert (read-only rows)

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve, resume on return | Trainer state survives view switch (hidden, not unmounted) | ✓ |
| Discard with confirm | Prompt before switching; progress lost | |
| You decide | Planner picks based on CaptureSurface lifecycle | |

**User's choice:** Preserve, resume on return
**Notes:** CONTEXT.md flags this as costly/verify — planner must confirm hiding (not unmounting) actually preserves the capture buffer.

---

## Save-Failure Notice Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Inline near results | Small banner attached to results panel, role="status", matches Banners.tsx | ✓ |
| Transient toast | Dismissible toast, auto-fades; needs new toast plumbing | |
| Persistent header banner | Adds to Banners stack until next successful save | |

**User's choice:** Inline near results

| Option | Description | Selected |
|--------|-------------|----------|
| Clears on next action | Disappears when user loads/restarts an exercise | |
| Manually dismissible | Has an X; user closes it | ✓ |
| Auto-hide after ~8s | Fades on its own | |

**User's choice:** Manually dismissible

| Option | Description | Selected |
|--------|-------------|----------|
| Single generic message | One line regardless of cause | ✓ |
| Distinguish quota vs unavailable | Tailored hint per error type | |

**User's choice:** Single generic message

---

## Raw-Log Retention Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Keep everything forever (v1.1) | No pruning; revisit only if storage visibly a problem | ✓ |
| Cap at N sessions | Ring-buffer; oldest deleted past a limit | |
| Keep snapshots forever, prune raw logs past N | Tiny snapshots kept; raw event arrays dropped for old sessions | |

**User's choice:** Keep everything forever (v1.1)
**Notes:** Aligns with the month-long improvement-measurement goal and research's "not a problem at single-user scale" assessment.

| Option | Description | Selected |
|--------|-------------|----------|
| Completed exercises only | Written only when CaptureSurface fires onComplete | ✓ |
| Completed + explicitly abandoned | Also save on restart / new-exercise mid-run | |

**User's choice:** Completed exercises only

| Option | Description | Selected |
|--------|-------------|----------|
| One (only the finished run) | Restarting mid-run persists nothing; completion = one row | ✓ |
| One per completion | Finish twice = two rows (natural consequence of "completed only") | |

**User's choice:** One (only the finished run) — equivalently, one row per completion

---

## Claude's Discretion

- `StoredSession` record shape, primary-key strategy, index definitions, `db.ts`/`repository.ts` API surface
- Exact wording of the empty state and save-failure message
- "Exercise length" shown as characters or lines
- Header toggle visual treatment (subject to `/gsd-ui-phase 4`)
- Relative-time string computation (hand-rolled vs `Intl.RelativeTimeFormat`)
- Dexie-layer test coverage depth (fake-indexeddb is the agreed harness)

## Deferred Ideas

- Per-session drill-down from raw log (ANLY-07, already in Future Requirements)
- Retention/prune policy — revisit if storage size becomes visible
- Distinguishing save-failure causes with tailored messaging
- Delete / clear-history controls
