// PURE — zero DOM access, zero IndexedDB imports. This fold groups by
// physical KeystrokeEvent.code (ARCHITECTURE.md Anti-Pattern 4 — the inverse
// of slowestFive's do-not-group-by-code rule). Zero rounding; relative color
// interpolation lives in the UI leaf, not here.
// Latency samples live in the tMs domain only — never startedAt.
// Walk events only — never the committed-character log.

import { gatedMedian, DIGRAPH_MIN_SAMPLES } from '../metrics/latency-stats'
import { US_ANSI_KEYS, isSampleable } from './keyboard-geometry'
import type { AnalyticsSession, HeatmapCell } from './types'

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
