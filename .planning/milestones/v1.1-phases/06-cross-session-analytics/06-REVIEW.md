---
phase: 06-cross-session-analytics
reviewed: 2026-09-20T18:45:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/metrics/latency-stats.ts
  - src/metrics/resolve-metrics.ts
  - src/metrics/metrics.ts
  - src/analytics/analytics.ts
  - src/analytics/heatmap.ts
  - src/analytics/keyboard-geometry.ts
  - src/ui/AnalyticsDashboard.tsx
  - src/ui/DigraphLatencyView.tsx
  - src/ui/KeyboardHeatmap.tsx
  - src/ui/LanguageProfileView.tsx
  - src/ui/App.tsx
  - src/index.css
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-09-20T18:45:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

Reviewed the Phase 6 extract (`gatedMedian` / `resolveMetrics`), the three pure analytics folds, and the Analytics dashboard UI (third nav item, hide-not-unmount, stacked leaves). Shared latency ownership is intact: `slowestFive`, digraph ranking, and the heatmap all call `gatedMedian` with the named gates; language-profile WPM/accuracy go through `resolveMetrics` with `completedAtTMs` as `now`; analytics never imports `ui/` or Dexie.

ASVS L1 / T-06-07 holds on the new surfaces: digraph pairs, `exercise.language`, and key labels are React text children (or static geometry strings in `aria-label`). No `dangerouslySetInnerHTML`, `innerHTML`, or HTML concatenation. Heatmap keys are inert `div`s; table rows have no click/href/tabIndex. CaptureSurface still has no analytics import (D-15).

No Critical findings. Two Warnings: the locked 15-column CSS grid cannot contain the shift row as drawn (ShiftRight occupies an implicit 16th track, so the diagram overflows horizontally at every width, not only ≲360px), and non-geometry keydowns (Arrow/Delete/Escape) inherit modifier transparency, so in-window caret-key IKI is attributed to the next letter. One Info: Analytics loading/empty copy omits History’s padding classes.

## Warnings

### WR-01: Shift row spans 16 column units on a 15-column grid, so the heatmap always grows an implicit track

**File:** `src/analytics/keyboard-geometry.ts:67-78`, `src/index.css:526-530`, `src/ui/KeyboardHeatmap.tsx:36-37`
**Issue:** `.keyboard-heatmap` is `grid-template-columns: repeat(15, minmax(32px, 1fr))`. KeyboardHeatmap places keys with `gridColumn: \`${cell.col + 1} / span ${cell.span}\``. The bottom letter row is ShiftLeft `col: 0, span: 3` + ten unit keys (Z–/) + ShiftRight `col: 13, span: 3` = **16** units. ShiftRight therefore occupies CSS tracks 14–16. Track 16 is implicit (`grid-auto-columns: auto`), so the 15 explicit `1fr` columns already fill the container and the extra track sticks out to the right.

Number / QWERTY / home rows occupy tracks 1–15 only; the space row occupies 1–13. The shift row is the only one that does not share that right edge. UI-SPEC Pitfall 10 / Layout locks `overflow-x: auto` as last-resort at ≲360px; an implicit column makes that scrollbar a default, not a narrow-viewport fallback, and the US-ANSI silhouette (D-10) is no longer a 15-column block.

The span table in 06-UI-SPEC (`ShiftLeft` / `ShiftRight` both 3) is internally inconsistent with the same spec’s 15-column grid (`3 + 10 + 3 = 16`). The code implemented both numbers as written.

**Fix:** Keep the 15-column grid (load-bearing) and use the usual integer ANSI split — left shift 2, writing keys 10, right shift 3:

```ts
{ code: 'ShiftLeft', row: 3, col: 0, span: 2, label: 'Shift', sampleable: false },
{ code: 'KeyZ', row: 3, col: 2, span: 1, label: 'Z', sampleable: true },
{ code: 'KeyX', row: 3, col: 3, span: 1, label: 'X', sampleable: true },
{ code: 'KeyC', row: 3, col: 4, span: 1, label: 'C', sampleable: true },
{ code: 'KeyV', row: 3, col: 5, span: 1, label: 'V', sampleable: true },
{ code: 'KeyB', row: 3, col: 6, span: 1, label: 'B', sampleable: true },
{ code: 'KeyN', row: 3, col: 7, span: 1, label: 'N', sampleable: true },
{ code: 'KeyM', row: 3, col: 8, span: 1, label: 'M', sampleable: true },
{ code: 'Comma', row: 3, col: 9, span: 1, label: ',', sampleable: true },
{ code: 'Period', row: 3, col: 10, span: 1, label: '.', sampleable: true },
{ code: 'Slash', row: 3, col: 11, span: 1, label: '/', sampleable: true },
{ code: 'ShiftRight', row: 3, col: 12, span: 3, label: 'Shift', sampleable: false },
```

Update `keyboard-geometry.test.ts` so ShiftLeft’s expected span is `2`. Amend 06-UI-SPEC’s “both shifts span 3” line so the 15-column silhouette stays the source of truth.

### WR-02: Unknown keydowns are treated as transparent IKI, so Arrow/Delete pollute the next letter

**File:** `src/analytics/heatmap.ts:17-26`
**Issue:** The walk skips every non-sampleable keydown without clearing `prevTMs`:

```ts
if (ev.type !== 'keydown' || ev.isRepeat) continue
if (!isSampleable(ev.code)) continue
if (prevTMs !== null) {
  arr.push(ev.tMs - prevTMs)
}
prevTMs = ev.tMs
```

That is correct for **drawn modifiers** (ShiftLeft test: Digit1 after Shift measures from KeyA, not from Shift). `isSampleable` is also false for every code **not in** `US_ANSI_KEYS` — `ArrowLeft`/`ArrowRight`/`Delete`/`Escape`/`F1`. Capture still records those keydowns (CaptureSurface only `preventDefault`s Tab/Escape; arrows still move the textarea caret and land in `events`).

An in-window arrow then letter therefore attributes the caret-key gap to the letter. Gaps ≥1000ms are discarded by `gatedMedian`, but 26–999ms navigation is kept and can push a key over the n=5 gate with a median that is not that key’s typing IKI. RESEARCH Pitfall 2 only asked that **modifiers** be non-anchors; unknown codes should break the chain (next sampleable key becomes a fresh anchor, like the start of a session).

**Fix:** Reset `prevTMs` when the code is not on the geometry table; keep modifier transparency only for drawn `sampleable: false` keys:

```ts
import { US_ANSI_KEYS, isSampleable } from './keyboard-geometry'

const DRAWN_CODES = new Set(US_ANSI_KEYS.map((k) => k.code))

// inside the keydown loop:
if (ev.type !== 'keydown' || ev.isRepeat) continue
if (!isSampleable(ev.code)) {
  if (!DRAWN_CODES.has(ev.code)) prevTMs = null
  continue
}
```

Golden case: `KeyA` → `ArrowRight` (+80ms) → `KeyB` (+80ms) must not emit an 160ms sample on KeyB; `KeyA` → `ShiftLeft` → `Digit1` must keep the existing 140ms-from-A behavior.

## Info

### IN-01: Analytics loading/empty copy skips History’s padding classes

**File:** `src/ui/AnalyticsDashboard.tsx:19-24`
**Issue:** HistoryView uses `className="text-muted history-loading"` / `history-empty`, which `src/index.css:485-489` sets to `margin: 0; padding-block: var(--space-md)`. AnalyticsDashboard uses only `text-muted`, so the locked loading/empty sentences keep the UA `<p>` margin and miss the UI-SPEC “same class treatment as `.history-empty` / `.history-loading`” padding. Undefined vs `[]` branching itself is correct.
**Fix:** Reuse the existing classes (or a shared `analytics-empty` with the same two declarations):

```tsx
<p className="text-muted history-loading">Loading analytics…</p>
<p className="text-muted history-empty">
  No sessions yet — finish a typing exercise and it&rsquo;ll show up here.
</p>
```

---

_Reviewed: 2026-09-20T18:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
