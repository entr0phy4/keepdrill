---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 0
total_count: 3
last_updated: 2026-09-04T11:57:08.854Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | stub | src/platform/isolation.ts |  | probeTimerResolutionUs() returns per-browser expected value; real measured delta wired by Plan 01-03 via recordMeasuredResolutionUs() hook (A10, intentional) | open |  | 2026-09-04T11:57:08.551Z |  |
| 2 | 01 | stub | src/ui/Banners.tsx |  | static banner shells only; degraded-timing gating, timer-readout formatting, no-layout-shift stacking + getLayoutMap() warning surfacing are Plan 01-03 | open |  | 2026-09-04T11:57:08.688Z |  |
| 3 | 01 | stub | src/ui/CorpusInput.tsx |  | paste path only; file input, empty/Nothing-to-load/Loading states + last-wins concurrency are Plan 01-02 | open |  | 2026-09-04T11:57:08.854Z |  |

````json
[
  {
    "id": 1,
    "kind": "stub",
    "phase": "01",
    "file": "src/platform/isolation.ts",
    "line": null,
    "description": "probeTimerResolutionUs() returns per-browser expected value; real measured delta wired by Plan 01-03 via recordMeasuredResolutionUs() hook (A10, intentional)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-04T11:57:08.551Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "stub",
    "phase": "01",
    "file": "src/ui/Banners.tsx",
    "line": null,
    "description": "static banner shells only; degraded-timing gating, timer-readout formatting, no-layout-shift stacking + getLayoutMap() warning surfacing are Plan 01-03",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-04T11:57:08.688Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "stub",
    "phase": "01",
    "file": "src/ui/CorpusInput.tsx",
    "line": null,
    "description": "paste path only; file input, empty/Nothing-to-load/Loading states + last-wins concurrency are Plan 01-02",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-04T11:57:08.854Z",
    "resolved_at": null
  }
]
````
