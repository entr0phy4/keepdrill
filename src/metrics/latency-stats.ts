// PURE — zero DOM access, zero side effects, safe to call repeatedly (no
// shared mutable module state). This module owns the exclusive gap window
// and the post-filter sample gate so analytics cannot duplicate those
// numbers (D-09, PITFALLS.md Pitfall 3).
// Do NOT round any number inside this module — round only at the display
// layer (ResultsView.tsx / HistoryView.tsx).

/** Exclusive lower bound of the latency-gap window (D-09). One-line tune. */
export const MIN_GAP_MS = 25
/** Exclusive upper bound of the latency-gap window (D-09). One-line tune. */
export const MAX_GAP_MS = 1000
/** Existing slowestFive post-filter gate (METR-03). One-line tune. */
export const CHAR_MIN_SAMPLES = 3
/** Digraph/heatmap post-filter gate (D-06 / D-13). One-line tune. */
export const DIGRAPH_MIN_SAMPLES = 5

/** Guards samples.length === 0 -> 0 (unreachable in practice, since callers
 *  only invoke this after the >=minSamples gate); every indexed read is
 *  guarded against `undefined` for noUncheckedIndexedAccess safety, without
 *  a non-null assertion. Even length: arithmetic mean of the two middle
 *  values. Odd length: the middle value. Never rounds. */
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

/** Filter → gate → median. Discards samples that are not strictly greater
 *  than MIN_GAP_MS AND strictly less than MAX_GAP_MS (exclusive window is
 *  load-bearing — metrics.test.ts n=8). Returns null when fewer than
 *  minSamples remain POST-filter; otherwise { medianMs, sampleCount }. */
export function gatedMedian(
  samples: readonly number[],
  minSamples: number,
): { medianMs: number; sampleCount: number } | null {
  const filtered = samples.filter((gap) => gap > MIN_GAP_MS && gap < MAX_GAP_MS)
  if (filtered.length < minSamples) return null
  return { medianMs: median(filtered), sampleCount: filtered.length }
}
