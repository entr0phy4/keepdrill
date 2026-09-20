// PURE — zero DOM access, zero IndexedDB imports. Re-runnable over any
// readonly AnalyticsSession[] with no side effects. Latency samples live in
// the tMs (event.timeStamp) domain only — never startedAt (wall clock).
// Do NOT round any number inside this module — round only at the display
// layer (ResultsView.tsx / HistoryView.tsx).
//
// Anti-Pattern 4: this file groups by committed codepoint pairs
// (CommittedChar.data via Array.from), never by physical KeyboardEvent.code.
// The heatmap fold (heatmap.ts) is the inverse axis.

import { gatedMedian, DIGRAPH_MIN_SAMPLES } from '../metrics/latency-stats'
import { resolveMetrics } from '../metrics/resolve-metrics'
import type { AnalyticsSession, DigraphEntry, LanguageProfileRow } from './types'

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

export function computeLanguageProfile(sessions: readonly AnalyticsSession[]): LanguageProfileRow[] {
  const buckets = new Map<string, { wpm: number[]; adj: number[]; acc: number[] }>()
  for (const s of sessions) {
    const m = resolveMetrics(s)
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
    .sort((a, b) => b.sessionCount - a.sessionCount || (a.language < b.language ? -1 : a.language > b.language ? 1 : 0))
}
