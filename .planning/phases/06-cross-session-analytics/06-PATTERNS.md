# Phase 6: Cross-Session Analytics - Pattern Map

**Mapped:** 2026-09-20
**Files analyzed:** 19 (14 new, 5 modified)
**Analogs found:** 18 / 19

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/metrics/latency-stats.ts` | utility | transform | `src/metrics/metrics.ts` (`MIN_GAP_MS` / `median` / `slowestFive`) | exact (extract) |
| `src/metrics/metrics.ts` | service | transform | itself — `slowestFive` becomes a `gatedMedian` caller | exact (in-place) |
| `src/metrics/resolve-metrics.ts` | utility | transform | `src/ui/history-metrics.ts` (`resolveMetrics`) | exact (move) |
| `src/ui/history-metrics.ts` | utility | transform | itself — re-export from `metrics/resolve-metrics` | exact (in-place) |
| `src/analytics/types.ts` | model | transform | `src/metrics/metrics.ts` (`SlowestKeyEntry`), `src/persistence/types.ts` (`StoredSession`) | exact |
| `src/analytics/analytics.ts` | service | batch / transform | `src/metrics/metrics.ts` (`replayAttempts` + `slowestFive`) | exact |
| `src/analytics/heatmap.ts` | service | batch / transform | `src/metrics/metrics.ts` (`slowestFive` filter→gate→median), grouping axis from `src/capture/types.ts` (`KeystrokeEvent.code`) | role-match |
| `src/analytics/keyboard-geometry.ts` | config / utility | transform (static lookup) | `src/ingestion/language-map.ts` (pure static table). **Not** `src/platform/layout.ts` | role-match |
| `src/ui/AnalyticsDashboard.tsx` | component | request-response | `src/ui/HistoryView.tsx` (`useLiveQuery(listNewestFirst)` + loading/empty/list) | exact |
| `src/ui/DigraphLatencyView.tsx` | component | request-response | `src/ui/ResultsView.tsx` (slowest-keys `<ol>` + `glyphFor` + `Math.round`) | exact |
| `src/ui/KeyboardHeatmap.tsx` | component | request-response | none for the diagram; display conventions from `src/ui/ResultsView.tsx` (`Math.round` ms labels) | none (diagram) / partial (labels) |
| `src/ui/LanguageProfileView.tsx` | component | request-response | `src/ui/HistoryView.tsx` `HistoryRow` (WPM / adj. WPM / accuracy / `key-chip` language) | exact |
| `src/ui/App.tsx` | component | event-driven (view toggle) | itself — `view` union + header `<nav>` + hide-not-unmount wrapper | exact (in-place) |
| `src/index.css` | config | — | itself — `:root` tokens + `.key-chip` / `.results-slowest-*` / `nav button[aria-current]` | exact (in-place) |
| `src/metrics/latency-stats.test.ts` | test | transform | `src/metrics/metrics.test.ts` (golden `Case[]` + `it.each`, cases n=7/8) | exact |
| `src/analytics/analytics.test.ts` | test | batch | `src/metrics/metrics.test.ts` (golden table, IME n=10, `{` vs `[` n=11) | exact |
| `src/analytics/heatmap.test.ts` | test | batch | `src/metrics/metrics.test.ts` (gate/filter) + `src/capture/capture.test.ts` (`isRepeat`) | role-match |
| `src/ui/AnalyticsDashboard.test.tsx` | test | request-response | `src/ui/HistoryView.test.tsx` (`waitForLiveQuery`, loading vs empty) | exact |
| `src/ui/App.test.tsx` | test | event-driven | itself — single-active invariant + D-08 hide-not-unmount | exact (in-place) |

## Pattern Assignments

### `src/metrics/latency-stats.ts` (utility, transform)

**Analog:** `src/metrics/metrics.ts` lines 48–50, 108–137 — extract, do not reinvent.

**File-lead comment** — copy the `metrics.ts:1-15` / `symbol-density.ts:1-9` PURE header: zero DOM, no rounding, named constants as one-line tunes.

**Named constants** (`metrics.ts:48-50`) — promote from `const` to `export const`. Keep the exclusive window and the two sample gates as named exports so digraphs/heatmap cannot copy-paste numbers (PITFALLS.md Pitfall 3):

```typescript
export const MIN_GAP_MS = 25
export const MAX_GAP_MS = 1000
export const CHAR_MIN_SAMPLES = 3      // existing slowestFive gate
export const DIGRAPH_MIN_SAMPLES = 5   // D-06 / D-13 — one-line tune
```

**Median with `noUncheckedIndexedAccess` guards** — copy `metrics.ts:112-123` verbatim (no `!` assertions):

```typescript
export function median(samples: readonly number[]): number {
  if (samples.length === 0) return 0
  const sorted = [...samples].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    const lo = sorted[mid - 1]
    const hi = sorted[mid]
    return lo !== undefined && hi !== undefined ? (lo + hi) / 2 : 0
  }
  const value = sorted[mid]
  return value !== undefined ? value : 0
}
```

**Core filter → gate → median** — lift the body of `slowestFive` (`metrics.ts:129-136`) into a reusable helper. The exclusive window (`>` / `<`, not `>=` / `<=`) is load-bearing — golden case n=8 locks 25ms and 1000ms as discarded:

```typescript
export function gatedMedian(
  samples: readonly number[],
  minSamples: number,
): { medianMs: number; sampleCount: number } | null {
  const filtered = samples.filter((gap) => gap > MIN_GAP_MS && gap < MAX_GAP_MS)
  if (filtered.length < minSamples) return null
  return { medianMs: median(filtered), sampleCount: filtered.length }
}
```

`sampleCount` is new vs `slowestFive` (D-08 needs `n` on the ranking row). Single-char ranking can ignore it.

**Do NOT** put this helper in `src/analytics/` — analytics would then own the METR-03 constants and `slowestFive` would import *up* from a later module.

---

### `src/metrics/metrics.ts` (service, transform — MODIFIED)

**Analog:** itself. After the extract, `slowestFive` is a thin caller. Existing `metrics.test.ts` golden cases n=7/8/9/10/11 **must stay green** — that is the extract's regression net.

**Imports addition:**

```typescript
import { CHAR_MIN_SAMPLES, gatedMedian } from './latency-stats'
```

**Replacement for `slowestFive`** (`metrics.ts:129-137`):

```typescript
function slowestFive(latencySamplesByChar: Map<string, number[]>): SlowestKeyEntry[] {
  const eligible: SlowestKeyEntry[] = []
  for (const [char, samples] of latencySamplesByChar) {
    const gated = gatedMedian(samples, CHAR_MIN_SAMPLES)
    if (gated) eligible.push({ char, medianMs: gated.medianMs })
  }
  return eligible.sort((a, b) => b.medianMs - a.medianMs).slice(0, 5)
}
```

Delete the now-duplicated private `MIN_GAP_MS` / `MAX_GAP_MS` / `MIN_SAMPLES` / `median`. Keep `replayAttempts` here — it is single-char + accuracy, not a shared analytics fold.

**Do NOT** change `SlowestKeyEntry` to include `sampleCount` — ResultsView / HistoryRow do not show `n` for per-session slowest-5.

---

### `src/metrics/resolve-metrics.ts` (utility, transform)

**Analog:** `src/ui/history-metrics.ts:1-21` — move the implementation so `analytics/` never imports `ui/` (ARCHITECTURE.md Anti-Pattern 3 inverted: layering, not Dexie).

**Copy the whole module**, including the clock-domain comment. Only the path of type imports changes:

```typescript
import { computeSessionMetrics, METRICS_SCHEMA_VERSION } from './metrics'
import type { MetricsResult } from './metrics'
import type { StoredSession } from '../persistence/types'

export function resolveMetrics(s: StoredSession): MetricsResult {
  if (s.metricsSnapshot.schemaVersion === METRICS_SCHEMA_VERSION) return s.metricsSnapshot
  return computeSessionMetrics(s.exercise.text, s.charLog, s.markers, s.completedAtTMs)
}
```

**Load-bearing:** `now` is `s.completedAtTMs`, never `s.startedAt` (`history-metrics.ts:10-11`, `metrics.ts:10-12`).

`AnalyticsSession` (see types) must be structurally compatible with `StoredSession` on `exercise` / `charLog` / `markers` / `completedAtTMs` / `metricsSnapshot` so this function can accept the projection without a Dexie `id`.

---

### `src/ui/history-metrics.ts` (utility — MODIFIED)

**Analog:** itself. Become a one-line re-export so existing `HistoryView.tsx:3` and `history-metrics.test.ts:2` keep compiling:

```typescript
export { resolveMetrics } from '../metrics/resolve-metrics'
```

Do not duplicate the schema-guard body. `history-metrics.test.ts` (vi.mock of `computeSessionMetrics`, identity-vs-recompute cases) must keep passing via the re-export.

---

### `src/analytics/types.ts` (model, transform)

**Analogs:** `src/metrics/metrics.ts:35-46` (`SlowestKeyEntry` / `MetricsResult`), `src/persistence/types.ts:14-34` (`StoredSession`), `src/capture/types.ts:5-51` (house style: decision-ID comment + clock-domain field docs).

**Do NOT** re-declare `StoredSession` / `CommittedChar` / `KeystrokeEvent` / `Exercise` — import them. New types are the fold outputs plus a structural read projection:

```typescript
import type { CommittedChar, KeystrokeEvent, CaptureMarker } from '../capture/types'
import type { Exercise } from '../ingestion/types'
import type { MetricsResult } from '../metrics/metrics'

/** Read projection of StoredSession — enough for the three folds, no Dexie `id`. */
export interface AnalyticsSession {
  completedAtTMs: number
  exercise: Exercise
  events: readonly KeystrokeEvent[]
  charLog: readonly CommittedChar[]
  markers: readonly CaptureMarker[]
  metricsSnapshot: MetricsResult
}

export interface DigraphEntry {
  pair: string
  medianMs: number
  sampleCount: number
}

export interface HeatmapCell {
  code: string
  row: number
  col: number
  span: number
  label: string
  medianMs: number | null  // null → unused / below gate (D-13)
  sampleCount: number
}

export interface LanguageProfileRow {
  language: string
  wpm: number
  symbolAdjustedWpm: number
  accuracy: number
  sessionCount: number
}
```

`StoredSession` is assignable to `AnalyticsSession` (extra `id` / `startedAt` / `schemaVersion` are fine). Folds take `readonly AnalyticsSession[]` so golden tests never need Dexie.

**Do NOT** round `medianMs` / `wpm` / `accuracy` in these types' producers — display layer only (`metrics.ts:14-15`).

---

### `src/analytics/analytics.ts` (service, batch / transform)

**Analog:** `src/metrics/metrics.ts:52-137` (`replayAttempts` consecutive-record gaps + `slowestFive` rank/cap). Sibling-module shape: `src/metrics/symbol-density.ts` (PURE header, named constants imported, no DOM).

**File-lead comment** — copy `metrics.ts:1-15`: PURE, zero DOM, zero Dexie, no rounding, two clock domains (`tMs` only). Explicitly name Anti-Pattern 4: this file groups by committed codepoint pairs, never `KeyboardEvent.code`.

**Imports pattern** (match `metrics.ts:29-31` — `import type` then local):

```typescript
import { gatedMedian, DIGRAPH_MIN_SAMPLES } from '../metrics/latency-stats'
import { resolveMetrics } from '../metrics/resolve-metrics'
import type { AnalyticsSession, DigraphEntry, LanguageProfileRow } from './types'
```

**Core digraph walk** — generalize `replayAttempts` (`metrics.ts:78-102`). Same delete branch, same `Array.from(rec.data ?? '')`, same "gap attaches only to the LAST codepoint of a multi-codepoint insert" (metrics.test.ts n=10). Extra state: `prevInsertChar`. On delete, clear `prevInsertChar` (do not emit a pair across a delete — RESEARCH Pitfall 7) and still set `prevTMs`:

```typescript
export function computeDigraphLatency(sessions: readonly AnalyticsSession[]): DigraphEntry[] {
  const samplesByPair = new Map<string, number[]>()

  for (const session of sessions) {
    let prevTMs: number | null = null
    let prevInsertChar: string | null = null
    for (const rec of session.charLog) {
      if (rec.inputType.startsWith('delete')) {
        prevInsertChar = null
        prevTMs = rec.tMs
        continue
      }
      const codepoints = Array.from(rec.data ?? '')
      codepoints.forEach((ch, i) => {
        const isLast = i === codepoints.length - 1
        if (isLast && prevInsertChar !== null && prevTMs !== null) {
          const pair = prevInsertChar + ch
          const arr = samplesByPair.get(pair) ?? []
          arr.push(rec.tMs - prevTMs)
          samplesByPair.set(pair, arr)
        }
        prevInsertChar = ch
      })
      prevTMs = rec.tMs
    }
  }

  const eligible: DigraphEntry[] = []
  for (const [pair, samples] of samplesByPair) {
    const gated = gatedMedian(samples, DIGRAPH_MIN_SAMPLES)
    if (gated) eligible.push({ pair, medianMs: gated.medianMs, sampleCount: gated.sampleCount })
  }
  return eligible.sort((a, b) => b.medianMs - a.medianMs).slice(0, 10)
}
```

Cap is 10 after sort (`slowestFive` uses `.slice(0, 5)` at `metrics.ts:136`). Pairs that fail the gate are omitted, not returned greyed (D-07).

**Core language profile** — group by the stored string `exercise.language` (`ingestion/types.ts:8-9`, displayed raw in `HistoryView.tsx:58`). Always `resolveMetrics` (never raw `metricsSnapshot` when stale). Unweighted mean of per-session values; sort by `sessionCount` descending; `plaintext` is a normal key:

```typescript
export function computeLanguageProfile(sessions: readonly AnalyticsSession[]): LanguageProfileRow[] {
  const buckets = new Map<string, { wpm: number[]; adj: number[]; acc: number[] }>()
  for (const s of sessions) {
    const m = resolveMetrics(s as /* structurally StoredSession */)
    const lang = s.exercise.language
    const b = buckets.get(lang) ?? { wpm: [], adj: [], acc: [] }
    b.wpm.push(m.wpm)
    b.adj.push(m.symbolAdjustedWpm)
    b.acc.push(m.accuracy)
    buckets.set(lang, b)
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  return [...buckets.entries()]
    .map(([language, b]) => ({
      language,
      wpm: mean(b.wpm),
      symbolAdjustedWpm: mean(b.adj),
      accuracy: mean(b.acc),
      sessionCount: b.wpm.length,
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount)
}
```

If `resolveMetrics` is typed on `StoredSession`, either widen it to `AnalyticsSession` or pass a value that satisfies `StoredSession` (tests can include dummy `id`/`startedAt`/`schemaVersion`). Prefer widening the parameter to the structural projection so analytics stays Dexie-free.

**Do NOT** import `../persistence/db`, `dexie`, or anything from `../ui/`.
**Do NOT** use `startedAt` as a sample or as `now`.

---

### `src/analytics/heatmap.ts` (service, batch / transform)

**Analog:** `src/metrics/metrics.ts:129-137` for filter→gate→median + rank shape; grouping key from `src/capture/types.ts:8` (`code: string`) and skip-repeat from `src/capture/capture.ts:40,63`. Inverse of `slowestFive`'s D-03 ("do NOT group by `KeyboardEvent.code`") — that prohibition is for *character* ranking, not this file (ARCHITECTURE.md Anti-Pattern 4).

**Imports:**

```typescript
import { gatedMedian, DIGRAPH_MIN_SAMPLES } from '../metrics/latency-stats'
import { US_ANSI_KEYS, isSampleable } from './keyboard-geometry'
import type { AnalyticsSession, HeatmapCell } from './types'
```

**Core IKI walk** — keydown only, `!isRepeat`, sampleable codes only. Modifiers are drawn but never sampled **and never used as the previous-timestamp anchor** (RESEARCH Pitfall 2: Shift→key would look ~40ms):

```typescript
export function computeKeyboardHeatmap(sessions: readonly AnalyticsSession[]): HeatmapCell[] {
  const samplesByCode = new Map<string, number[]>()

  for (const session of sessions) {
    let prevTMs: number | null = null
    for (const ev of session.events) {
      if (ev.type !== 'keydown' || ev.isRepeat) continue
      if (!isSampleable(ev.code)) continue
      if (prevTMs !== null) {
        const arr = samplesByCode.get(ev.code) ?? []
        arr.push(ev.tMs - prevTMs)
        samplesByCode.set(ev.code, arr)
      }
      prevTMs = ev.tMs
    }
  }

  return US_ANSI_KEYS.map((key) => {
    const gated = gatedMedian(samplesByCode.get(key.code) ?? [], DIGRAPH_MIN_SAMPLES)
    return {
      code: key.code,
      row: key.row,
      col: key.col,
      span: key.span,
      label: key.label,
      medianMs: gated?.medianMs ?? null,
      sampleCount: gated?.sampleCount ?? 0,
    }
  })
}
```

Always return the full geometry (D-13) — unused / below-gate keys stay with `medianMs: null`. Relative color lerp lives in the UI leaf, not here (keep the fold numeric).

**Do NOT** walk `charLog` / `CommittedChar.data`. Golden fixture: the same `code: 'Digit9'` producing `9` and `(` accumulates on Digit9.

---

### `src/analytics/keyboard-geometry.ts` (config / utility, static lookup)

**Analog:** `src/ingestion/language-map.ts:6-47` — a PURE static table + a tiny lookup helper, computed once, no DOM, no platform APIs.

**Anti-analog (do not copy):** `src/platform/layout.ts` — that file is a Chromium `navigator.keyboard.getLayoutMap()` warning seam (`layout.ts:20-45`). Heatmap geometry is a `code → {row, col, span, label, sampleable}` table, not a runtime layout probe (CONTEXT D-10).

**Table style** — copy `language-map.ts`'s "named constant + derived helper, do not leak the raw map if a helper is cleaner." W3C `KeyboardEvent.code` strings only (`KeyA`, `BracketLeft`, `Digit9`) — never `"A"` / `"oem_4"`.

```typescript
export interface KeyGeometry {
  code: string
  row: number // 0 = number row … 4 = space row
  col: number
  span: number
  label: string
  sampleable: boolean
}

export const US_ANSI_KEYS: readonly KeyGeometry[] = [
  // alphanumeric block only — no F-row, arrows, nav, numpad, Intl*
  // sampleable: letters, digits, punctuation, Space, Enter, Backspace, Tab
  // drawn, sampleable:false: ShiftLeft/Right, Control*, Alt*, Meta*, CapsLock
]

export function isSampleable(code: string): boolean {
  return US_ANSI_KEYS.some((k) => k.code === code && k.sampleable)
}
```

Canonical codes (RESEARCH): `Backquote`, `Digit0`–`Digit9`, `Minus`, `Equal`, `Backspace`, `Tab`, `KeyQ`–`KeyP`, `BracketLeft`, `BracketRight`, `Backslash`, `CapsLock`, `KeyA`–`KeyL`, `Semicolon`, `Quote`, `Enter`, `ShiftLeft`, `KeyZ`–`KeyM`, `Comma`, `Period`, `Slash`, `ShiftRight`, `ControlLeft`, `MetaLeft`, `AltLeft`, `Space`, `AltRight`, `MetaRight`, `ControlRight`.

---

### `src/ui/AnalyticsDashboard.tsx` (component, request-response)

**Analog:** `src/ui/HistoryView.tsx:1-34` — identical read path, identical three-way branch.

**Imports** — copy HistoryView's "querier, never dexie / `../persistence/db`" rule (`HistoryView.tsx:8-12`):

```typescript
import { useLiveQuery } from 'dexie-react-hooks'
import { listNewestFirst } from '../persistence/repository'
import { computeDigraphLatency, computeLanguageProfile } from '../analytics/analytics'
import { computeKeyboardHeatmap } from '../analytics/heatmap'
import { DigraphLatencyView } from './DigraphLatencyView'
import { KeyboardHeatmap } from './KeyboardHeatmap'
import { LanguageProfileView } from './LanguageProfileView'
```

**Core loading / empty / content** — copy `HistoryView.tsx:13-33` structure. `undefined` ≠ `[]` (HistoryView header comment + HistoryView.test.tsx:77-94). Sections mount **only** when `sessions.length > 0` (D-04):

```typescript
export function AnalyticsDashboard() {
  const sessions = useLiveQuery(listNewestFirst)

  return (
    <section role="status" style={{ display: 'grid', gap: 'var(--space-lg)' }}>
      <h2>Analytics</h2>
      {sessions === undefined ? (
        <p className="text-muted">Loading analytics…</p>
      ) : sessions.length === 0 ? (
        <p className="text-muted">
          No sessions yet — finish a typing exercise and it&rsquo;ll show up here.
        </p>
      ) : (
        <>
          <DigraphLatencyView rows={computeDigraphLatency(sessions)} />
          <KeyboardHeatmap cells={computeKeyboardHeatmap(sessions)} />
          <LanguageProfileView rows={computeLanguageProfile(sessions)} />
        </>
      )}
    </section>
  )
}
```

Stack order is locked: digraph → heatmap → language (D-02). No jump links (D-03). `CorpusInput` stays mounted in `App.tsx` (match History — `App.tsx:173` is outside the view switch).

Empty-copy for the page matches HistoryView (`HistoryView.tsx:22-24`). Per-section empty is the leaf's job, and only when sessions exist (D-07).

---

### `src/ui/DigraphLatencyView.tsx` (component, request-response)

**Analog:** `src/ui/ResultsView.tsx:37-54` — ranked list, section-level empty when the array is empty, `glyphFor` for whitespace, `Math.round` only here.

**Imports:**

```typescript
import { glyphFor } from '../trainer/state'
import type { DigraphEntry } from '../analytics/types'
```

**Glyph helper** — copy `ResultsView.tsx:47-48` / `HistoryView.tsx:61-63`, mapped over both codepoints of the pair:

```typescript
function digraphGlyph(pair: string): string {
  return Array.from(pair)
    .map((ch) => (ch === ' ' || ch === '\n' ? glyphFor(ch) : ch))
    .join('')
}
```

**Core render** — `ResultsView.tsx:37-54` shape, plus `n` (D-08). Empty copy is section-level ("not enough digraph samples…"), not the page empty:

```typescript
export function DigraphLatencyView({ rows }: { rows: DigraphEntry[] }) {
  return (
    <section className="results-slowest">
      <h3>Slowest digraphs</h3>
      {rows.length === 0 ? (
        <p className="text-muted">
          Not enough digraph samples yet. Pairs need at least 5 in-window observations across your history.
        </p>
      ) : (
        <ol className="results-slowest-list">
          {rows.map((entry) => (
            <li key={entry.pair} className="results-slowest-row">
              <span className="key-chip">{digraphGlyph(entry.pair)}</span>
              <span>{Math.round(entry.medianMs)} ms</span>
              <span className="text-muted">n={entry.sampleCount}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
```

Reuse `.results-slowest-list` / `.results-slowest-row` / `.key-chip` (`index.css:363-388`) rather than inventing a new table skin. No performance-threshold color (`ResultsView.tsx:6-8`).

---

### `src/ui/KeyboardHeatmap.tsx` (component, request-response)

**Analog:** **none** for a US-ANSI diagram — nothing in `src/ui` is a keyboard layout (CONTEXT D-10). Closest display conventions: `ResultsView.tsx:50` (`Math.round(entry.medianMs) ms` on the cell) and `index.css:382-388` (`.key-chip` bordered surface). Relative scale is display-layer only (D-14).

**Planner should use RESEARCH.md Pattern 2 + geometry table**, not invent from `platform/layout.ts`.

**Color lerp (display layer):**

```typescript
const sampled = cells.filter((c): c is typeof c & { medianMs: number } => c.medianMs !== null)
const lo = Math.min(...sampled.map((c) => c.medianMs))
const hi = Math.max(...sampled.map((c) => c.medianMs))
const t = cell.medianMs === null || hi === lo ? null : (cell.medianMs - lo) / (hi - lo)
// unused / below gate: background var(--color-surface), no number (D-13)
// gated: lerp(--heatmap-lo, --heatmap-hi, t) + Math.round(cell.medianMs)
```

Always mount the diagram when the parent mounted this leaf (sessions exist). If zero keys clear the gate, all-neutral keys + muted caption — do **not** replace the diagram with a paragraph (D-13). Sequential amber tokens only; **never** `--color-accent` / `--color-destructive` (03/04/05-UI-SPEC no score coloring).

Hand-rolled CSS grid / staggered rows. Last-resort `overflow-x: auto` on the diagram if 15 keys exceed `--column-max: 45rem` (`index.css:37,103`) — no page-level jump nav (D-03).

---

### `src/ui/LanguageProfileView.tsx` (component, request-response)

**Analog:** `src/ui/HistoryView.tsx:39-67` `HistoryRow` — same four numbers, same `key-chip` for the raw language tag, same `Math.round` at render, adj. WPM as companion with `.results-stat-label.text-muted` "adj." (`HistoryView.tsx:50-54`).

```typescript
export function LanguageProfileView({ rows }: { rows: LanguageProfileRow[] }) {
  return (
    <section>
      <h3>Per language</h3>
      <ol className="history-list">
        {rows.map((row) => (
          <li key={row.language} className="history-row">
            <div className="history-row-primary">
              <span className="key-chip">{row.language}</span>
              <span>
                {Math.round(row.wpm)} / {Math.round(row.symbolAdjustedWpm)}{' '}
                <span className="results-stat-label text-muted">adj.</span>
              </span>
              <span>{Math.round(row.accuracy * 100)}%</span>
              <span className="text-muted">n={row.sessionCount}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
```

No session-count gate (D-19) — if this leaf mounted, `rows.length >= 1`. `plaintext` is not special-cased. Reuse `.history-list` / `.history-row` / `.history-row-primary` (`index.css:435-459`).

---

### `src/ui/App.tsx` (component — MODIFIED)

**Analog:** itself, lines 57-59, 150-165, 186-217.

**View union** (`App.tsx:59`) — extend, do not replace:

```typescript
const [view, setView] = useState<'trainer' | 'history' | 'analytics'>('trainer')
```

**Header nav** — copy the existing two-button block (`App.tsx:150-165`) and add a third sibling. Exactly one `aria-current="page"`. Active style is already CSS-keyed on that attribute (`index.css:421-431`) — no new nav CSS required for the third button.

**Trainer wrapper** — leave `App.tsx:200` unchanged:

```typescript
<div style={{ display: view === 'trainer' ? 'grid' : 'none', gap: 'var(--space-md)' }}>
```

Hide-not-unmount applies to Analytics the same way it applies to History (D-08). Mount the dashboard as a sibling of HistoryView (`App.tsx:216`):

```typescript
{view === 'history' && <HistoryView />}
{view === 'analytics' && <AnalyticsDashboard />}
```

`CorpusInput` (`App.tsx:173`) stays outside the view switch (visible on Analytics, matching History).

---

### `src/index.css` (config — MODIFIED)

**Analog:** itself. Token pattern: declare on `:root` (`index.css:42-59`) and override inside `@media (prefers-color-scheme: dark)` (`index.css:62-79`). History/results skins were "reused rather than re-invented" (`index.css:333-334, 443-444`) — heatmap tokens follow the same comment style.

**Add sequential heatmap tokens** (UI-SPEC owns exact hex; planner stubs names):

```css
:root {
  --heatmap-lo: /* UI-SPEC */;
  --heatmap-hi: /* UI-SPEC */;
  --heatmap-key-fg: var(--color-text);
}
```

Unused keys use existing `--color-surface` (`index.css:44`), not a "fast" color. **Do not** bind heatmap fill to `--color-accent` or `--color-destructive`.

Keyboard grid CSS is new (no analog). Keep labels at `--text-label-size` (`index.css:24-26`). Prefer fitting `--column-max: 45rem`; `overflow-x: auto` on the diagram only as last resort.

---

### `src/metrics/latency-stats.test.ts` (test, transform)

**Analog:** `src/metrics/metrics.test.ts:7-10, 90-120` — golden `Case[]` + `it.each`. Also `src/metrics/symbol-density.test.ts:9-44` for a dedicated helper-module table.

Mandatory cases (PITFALLS.md / RESEARCH Pitfall 1):

| Case | Input | Expected |
|------|--------|----------|
| POST-filter gate | 4 in-window samples | `gatedMedian(..., 5)` → `null` |
| Gate inclusive | 5 in-window samples | non-null, `sampleCount === 5` |
| Exclusive window | gaps `25` and `1000` | discarded (copy metrics.test.ts n=8) |
| Exclusive window keep | gaps `26`, `999` | kept |
| Empty | `[]` | `median` → `0`; `gatedMedian` → `null` |
| Even median | `[100, 200]` after filter | `(100+200)/2` (copy `metrics.ts:116-119`) |

Existing `metrics.test.ts` n=7 (`'b'` with 2 samples excluded, `'a'` with 3 included) stays the CHAR_MIN_SAMPLES regression; do not weaken it.

---

### `src/analytics/analytics.test.ts` (test, batch)

**Analog:** `src/metrics/metrics.test.ts` — frozen `CommittedChar` fixtures via a `char()` helper (`metrics.test.ts:12-14`), golden table, Unicode `Array.from` case n=12.

**Fixture style** — build `AnalyticsSession` objects as plain literals (no Dexie), matching `history-metrics.test.ts:23-38` `makeStoredSession`.

Mandatory golden cases:

- 4 in-window samples of pair `"ab"` → omitted; 5th → appears (D-06).
- Sort by median descending, cap 10 (mirror metrics.test.ts n=9 cap-at-5).
- Delete between inserts does not emit a pair (RESEARCH Pitfall 7).
- IME multi-codepoint: gap attaches to last codepoint only (metrics.test.ts n=10 generalized).
- Supplementary-plane codepoint is one `Array.from` element in the pair key (metrics.test.ts n=12).
- `{` vs `[` are distinct pairs (metrics.test.ts n=11) — heatmap counterpart uses `code`.
- Language profile: two `rust` + one `plaintext` → two rows, `plaintext` present, sorted by `n` desc.
- Language profile: `metricsSnapshot.schemaVersion !== METRICS_SCHEMA_VERSION` → `resolveMetrics` recomputes and `symbolAdjustedWpm` is defined (copy `history-metrics.test.ts:47-59`).

---

### `src/analytics/heatmap.test.ts` (test, batch)

**Analogs:** `src/metrics/metrics.test.ts` n=7/8 (gate + exclusive window); `src/capture/capture.test.ts:118-131` (`isRepeat: true` is recorded and must be skipped).

Mandatory golden cases:

- Same `code: 'Digit9'` with `key: '9'` then `key: '('` pools on Digit9 (Anti-Pattern 4).
- `isRepeat: true` keydowns contribute neither a sample nor a `prevTMs` update.
- `ShiftLeft` (`sampleable: false`) is not an IKI anchor — `Digit1` after Shift measures from the previous *sampleable* keydown.
- Below-gate / unused codes still appear in the returned array with `medianMs: null` (D-13) — array length === `US_ANSI_KEYS.length`.
- No `startedAt` involved; samples are `tMs` deltas only.

---

### `src/ui/AnalyticsDashboard.test.tsx` (test, request-response)

**Analog:** `src/ui/HistoryView.test.tsx:13-94` — `IS_REACT_ACT_ENVIRONMENT`, `createRoot`, `waitForLiveQuery` polling, `db.delete()` / `db.open()` in `beforeEach`.

Copy the loading-vs-empty split exactly:

```typescript
it('shows the loading line before the query resolves, not the empty state', () => {
  // render AnalyticsDashboard
  expect(container.textContent).toContain('Loading analytics…')
  expect(container.textContent).not.toContain('No sessions yet')
})
```

When `[]` resolves: page empty copy, **no** digraph/heatmap/language headings mounted (D-04). When one saved session exists (`saveSession` + `buildInput` from HistoryView.test.tsx:59-75): all three sections mount even if digraph rows are empty (heatmap diagram present).

Uses `fake-indexeddb` via the existing `ui` vitest project — do not introduce a second IDB shim.

---

### `src/ui/App.test.tsx` (test — MODIFIED)

**Analog:** itself, lines 113-225.

**Single-active invariant** (`App.test.tsx:113-142`) — extend from two buttons to three. After clicking Analytics, `aria-current="page"` is only on Analytics; Trainer and History are `null`. Still exactly one current page.

**D-08 hide-not-unmount** (`App.test.tsx:145-224`) — keep the History round-trip. Add a parallel (or parameterized) case: type → switch to **Analytics** → back to Trainer preserves `charLog` length, per-char status, textarea identity, caret index. Wrapper `style.display === 'none'` while Analytics is showing.

Do not rewrite the test file; extend the existing describes.

---

## Shared Patterns

### Pure-core header + no rounding
**Source:** `src/metrics/metrics.ts:1-15`, `src/metrics/symbol-density.ts:1-9`
**Apply to:** `latency-stats.ts`, `resolve-metrics.ts`, `analytics.ts`, `heatmap.ts`, `keyboard-geometry.ts`

```typescript
// PURE — zero DOM access, zero Dexie. Do NOT round any number inside this
// module — round only at the display layer (ResultsView.tsx / HistoryView.tsx).
```

### Unicode-safe iteration
**Source:** `src/metrics/metrics.ts:67-71, 85` (`Array.from(target)`, `Array.from(rec.data ?? '')`)
**Apply to:** `computeDigraphLatency` pair window; any glyph walk over a digraph string.

```typescript
const codepoints = Array.from(rec.data ?? '')
```

Never `text[i] + text[i+1]` (UTF-16). `glyphFor` already maps one codepoint (`src/trainer/state.ts:91-95`).

### Consecutive-record gap + delete reset
**Source:** `src/metrics/metrics.ts:76-102`
**Apply to:** `computeDigraphLatency`. Heatmap is a different walker (events, not charLog) but the same `prevTMs` idiom.

```typescript
if (rec.inputType.startsWith('delete')) {
  // digraphs: also prevInsertChar = null
  prevTMs = rec.tMs
  continue
}
```

### Filter → gate → median (single helper)
**Source:** `src/metrics/metrics.ts:48-50, 125-136`
**Apply to:** `slowestFive` (`CHAR_MIN_SAMPLES = 3`), `computeDigraphLatency` and `computeKeyboardHeatmap` (`DIGRAPH_MIN_SAMPLES = 5`).

Exclusive window `gap > MIN_GAP_MS && gap < MAX_GAP_MS`. Gate is POST-filter length, never raw occurrence count (`metrics.ts:26-27`).

### Schema-aware recompute
**Source:** `src/ui/history-metrics.ts:18-21`
**Apply to:** `computeLanguageProfile` only (digraphs/heatmap re-fold raw logs and ignore `metricsSnapshot`).

```typescript
if (s.metricsSnapshot.schemaVersion === METRICS_SCHEMA_VERSION) return s.metricsSnapshot
return computeSessionMetrics(s.exercise.text, s.charLog, s.markers, s.completedAtTMs)
```

`now` = `completedAtTMs`, never `startedAt`.

### History read path (no Dexie in views/folds)
**Source:** `src/ui/HistoryView.tsx:1-12, 18-24`
**Apply to:** `AnalyticsDashboard.tsx`

```typescript
import { useLiveQuery } from 'dexie-react-hooks'
import { listNewestFirst } from '../persistence/repository'
const sessions = useLiveQuery(listNewestFirst)
// undefined → loading; [] → empty; length>0 → content
```

Analytics never imports `../persistence/db` or `dexie`. `listNewestFirst` stays the only querier (`src/persistence/repository.ts:38-40`).

### Hide-not-unmount view flip
**Source:** `src/ui/App.tsx:186-200, 216`
**Apply to:** adding `'analytics'` to the `view` union.

```typescript
<div style={{ display: view === 'trainer' ? 'grid' : 'none', gap: 'var(--space-md)' }}>
```

Never `hidden` attribute, never conditional unmount of `CaptureSurface`.

### Display-layer rounding + glyphs + chips
**Source:** `src/ui/ResultsView.tsx:28-50`, `src/ui/HistoryView.tsx:50-63`
**Apply to:** all three analytics leaves.

```typescript
Math.round(ms)           // latency
Math.round(wpm)          // WPM / adj. WPM
Math.round(accuracy * 100) + '%'
glyphFor(' ' | '\n')     // from trainer/state.ts:91-95
<span className="key-chip">
```

### `role="status"` panels
**Source:** `src/ui/HistoryView.tsx:17`, `src/ui/ResultsView.tsx:24`, `src/ui/Banners.tsx:19`
**Apply to:** `AnalyticsDashboard` page wrapper; section empties are muted `<p className="text-muted">` like ResultsView's "Not enough repeated characters…".

### Nav `aria-current="page"`
**Source:** `src/ui/App.tsx:151-164`, `src/index.css:421-431`
**Apply to:** the new Analytics button. CSS already keys active state on the attribute — do not color it with `--color-accent`.

### Clock domains
**Source:** `src/metrics/metrics.ts:10-12`, `src/persistence/types.ts:20-25`, `src/capture/types.ts:14-15, 49-50`
**Apply to:** every analytics sample.

| Field | Domain | Analytics use |
|-------|--------|----------------|
| `tMs` / `completedAtTMs` | `event.timeStamp` monotonic | latency gaps, `resolveMetrics` `now` |
| `startedAt` | `Date.now()` wall clock | **none** this phase (History sort/display only) |

### Repeat discarding
**Source:** `src/capture/capture.ts:40,63` + `src/capture/capture.test.ts:118-131`
**Apply to:** heatmap walker (`ev.isRepeat`). Digraphs read `charLog` (committed inserts), which does not carry OS-repeat.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/ui/KeyboardHeatmap.tsx` (diagram markup/CSS grid) | component | request-response | Nothing in `src/ui` is a keyboard layout (D-10). Use RESEARCH.md geometry + sequential `--heatmap-*` tokens. Copy only rounding/label conventions from `ResultsView.tsx:50`. **Do not** start from `src/platform/layout.ts`. |

`src/analytics/keyboard-geometry.ts` has a **role-match** analog (`language-map.ts` static table) but no analog whose *contents* are key positions — W3C code values come from RESEARCH.md, not the repo.

## Anti-Patterns (do not copy these files/idioms)

| Tempting analog | Why it is wrong for this phase |
|-----------------|--------------------------------|
| `src/platform/layout.ts` as heatmap geometry | Runtime `getLayoutMap()` warning seam, not a `code → {row,col}` table (D-10). |
| `slowestFive` as-is for the heatmap | Groups by `CommittedChar.data`, not `KeystrokeEvent.code` (Anti-Pattern 4). |
| Copy-pasting `MIN_GAP_MS = 25` into `analytics.ts` | Pitfall 3 — next constant tweak desyncs rankings. Import `latency-stats.ts`. |
| `metricsSnapshot.wpm` in the language profile | Pitfall 1 / stale schema v1. Always `resolveMetrics`. |
| `startedAt` as latency or `now` | Pitfall 2. Use `tMs` / `completedAtTMs`. |
| `--color-accent` / `--color-destructive` heatmap palette | 03/04/05-UI-SPEC forbid score coloring. Sequential `--heatmap-lo/hi` only. |
| Importing `db.ts` / `dexie` from `analytics/` | Anti-Pattern 3. Repository fetches; folds receive plain arrays. |
| Importing `src/ui/*` from `analytics/` | Layering inversion — that is why `resolveMetrics` moves to `metrics/`. |
| `react-simple-keyboard` / heatmap.js / d3-scale / Recharts | STACK.md rejected; no new packages this phase. |

## Metadata

**Analog search scope:** `src/metrics/`, `src/ui/`, `src/persistence/`, `src/capture/`, `src/trainer/`, `src/ingestion/`, `src/platform/`, `src/index.css`, `src/**/*.test.{ts,tsx}`
**Files scanned:** 50 source files under `src/` (18 test files)
**Pattern extraction date:** 2026-09-20
**Primary analogs (stop-at-5):** `src/metrics/metrics.ts`, `src/ui/HistoryView.tsx`, `src/ui/ResultsView.tsx`, `src/ui/history-metrics.ts`, `src/ui/App.tsx`
**Secondary:** `src/ingestion/language-map.ts`, `src/trainer/state.ts` (`glyphFor`), `src/persistence/{types,repository}.ts`, `src/capture/{types,capture}.ts`, `src/metrics/symbol-density.ts`, `src/index.css`
