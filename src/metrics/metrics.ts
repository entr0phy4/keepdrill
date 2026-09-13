// PURE — zero DOM access, zero non-`import type` runtime imports besides a
// direct call to computeActiveElapsedMs (METR-04). Re-runnable over any
// {target, charLog, markers, now} tuple with no side effects; safe to call
// repeatedly (no shared mutable module state). Golden cases locking these
// formulas live in metrics.test.ts.
//
// Do NOT read TrainerState.perCharStatus for accuracy (D-02) — it collapses
// corrected-over history into one final state per position, losing every
// attempt that was later overwritten by a backspace-and-retype.
// Do NOT pass Session.startedAt or a fresh timestamp read as `now` (Pitfall
// 1) — it is the wrong clock domain vs. charLog/markers' event.timeStamp-
// based tMs values; `now` must come from the same tMs domain (e.g. the
// completedAt value from computeTrainerState).
// Do NOT round any number inside this module (Pitfall 5) — round only at the
// display layer (ResultsView.tsx).
//
// Formulas (D-01/D-02), verbatim:
//   wpm = correctAttempts / 5 / (elapsedMs / 60000)
//   accuracy = correctAttempts / (correctAttempts + incorrectAttempts)
//
// Slowest-5 aggregation (D-03/D-04, METR-03): group latency-gap samples by
// the logical character committed (CommittedChar.data code point), discard
// samples outside the exclusive (25ms, 1000ms) window, require >=3 samples
// remaining POST-filter before a character is eligible, then rank by median
// gap descending and cap at 5 entries. Do NOT group by KeyboardEvent.code
// (D-03) and do NOT gate the minimum-sample count on raw pre-filter
// occurrence count (Pitfall 4).

import type { CommittedChar, CaptureMarker } from '../capture/types'
import { computeActiveElapsedMs } from '../trainer/active-time'
import { classifySymbolDensity, computeSymbolAdjustedWpm } from './symbol-density'

export const METRICS_SCHEMA_VERSION = 2 // was 1 — D-06

export interface SlowestKeyEntry {
  char: string
  medianMs: number
}

export interface MetricsResult {
  schemaVersion: number
  wpm: number
  accuracy: number
  slowest5: SlowestKeyEntry[]
  symbolAdjustedWpm: number // NEW — D-06
}

const MIN_GAP_MS = 25
const MAX_GAP_MS = 1000
const MIN_SAMPLES = 3

/** Mirrors computeTrainerState's delete/insert branching exactly (D-02), but
 *  replays every insert-branch attempt individually — including attempts
 *  later overwritten by a backspace-and-retype — rather than collapsing to
 *  one final status per position. Also accumulates per-character latency-gap
 *  samples (D-03) — the gap between this record's tMs and the previous
 *  record's tMs (of any type), attributed only to the LAST codepoint of a
 *  multi-codepoint (IME) insert record (Pitfall 7). */
function replayAttempts(
  target: string,
  charLog: readonly CommittedChar[],
): {
  correctAttempts: number
  incorrectAttempts: number
  latencySamplesByChar: Map<string, number[]>
} {
  // Code-point array, not raw string indexing — mirrors state.ts's identical
  // fix: `target[cursor]`/`target.length` are UTF-16-code-unit semantics,
  // but `cursor` advances one per Unicode code point. A supplementary-plane
  // character (surrogate pair) in `target` would otherwise desync the two.
  const targetChars = Array.from(target)
  let cursor = 0
  let correctAttempts = 0
  let incorrectAttempts = 0
  const latencySamplesByChar = new Map<string, number[]>()
  let prevTMs: number | null = null

  for (const rec of charLog) {
    if (rec.inputType.startsWith('delete')) {
      if (cursor > 0) cursor -= 1
      prevTMs = rec.tMs
      continue
    }

    const codepoints = Array.from(rec.data ?? '')
    codepoints.forEach((ch, i) => {
      if (cursor >= targetChars.length) return
      if (ch === targetChars[cursor]) {
        correctAttempts += 1
      } else {
        incorrectAttempts += 1
      }

      if (i === codepoints.length - 1 && prevTMs !== null) {
        const gap = rec.tMs - prevTMs
        const arr = latencySamplesByChar.get(ch) ?? []
        arr.push(gap)
        latencySamplesByChar.set(ch, arr)
      }
      cursor += 1
    })
    prevTMs = rec.tMs
  }

  return { correctAttempts, incorrectAttempts, latencySamplesByChar }
}

/** Guards samples.length === 0 -> 0 (unreachable in practice, since callers
 *  only invoke this after the >=MIN_SAMPLES gate); every indexed read is
 *  guarded against `undefined` for noUncheckedIndexedAccess safety, without
 *  a non-null assertion. */
function median(samples: readonly number[]): number {
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

/** D-03/D-04, METR-03: filters each character's samples to the exclusive
 *  (MIN_GAP_MS, MAX_GAP_MS) window, requires >=MIN_SAMPLES POST-filter
 *  samples (Pitfall 4), computes the median of the survivors, sorts
 *  descending by median, and caps the result at 5 entries. */
function slowestFive(latencySamplesByChar: Map<string, number[]>): SlowestKeyEntry[] {
  const eligible: SlowestKeyEntry[] = []
  for (const [char, samples] of latencySamplesByChar) {
    const filtered = samples.filter((gap) => gap > MIN_GAP_MS && gap < MAX_GAP_MS)
    if (filtered.length < MIN_SAMPLES) continue
    eligible.push({ char, medianMs: median(filtered) })
  }
  return eligible.sort((a, b) => b.medianMs - a.medianMs).slice(0, 5)
}

/** Guard elapsedMs <= 0 -> 0 (Pitfall 2) so a degenerate active-time never
 *  renders Infinity/NaN. */
export function computeWpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0
  return correctChars / 5 / (elapsedMs / 60000)
}

/** Guard totalAttempts === 0 -> 1 (a pure-function safety default; the UI
 *  can never actually reach the results panel with zero attempts). */
export function computeAccuracy(correctAttempts: number, totalAttempts: number): number {
  if (totalAttempts === 0) return 1
  return correctAttempts / totalAttempts
}

export function computeSessionMetrics(
  target: string,
  charLog: readonly CommittedChar[],
  markers: readonly CaptureMarker[],
  now: number,
): MetricsResult {
  const elapsedMs = computeActiveElapsedMs(charLog, markers, now)
  const { correctAttempts, incorrectAttempts, latencySamplesByChar } = replayAttempts(target, charLog)
  const wpm = computeWpm(correctAttempts, elapsedMs)
  const symbolDensity = classifySymbolDensity(target)

  return {
    schemaVersion: METRICS_SCHEMA_VERSION,
    wpm,
    accuracy: computeAccuracy(correctAttempts, correctAttempts + incorrectAttempts),
    slowest5: slowestFive(latencySamplesByChar),
    symbolAdjustedWpm: computeSymbolAdjustedWpm(wpm, symbolDensity),
  }
}
