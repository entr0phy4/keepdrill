import type { CommittedChar, KeystrokeEvent, CaptureMarker } from '../capture/types'
import type { Exercise } from '../ingestion/types'
import type { MetricsResult } from '../metrics/metrics'

/** Read projection of StoredSession — enough for the three folds, no Dexie `id`.
 *  Extra producer fields (id, startedAt, schemaVersion) are fine; golden tests
 *  never need Dexie. Do NOT round medianMs / wpm / accuracy here — display
 *  layer only. */

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
  medianMs: number | null // null → unused / below gate (D-13)
  sampleCount: number
}

export interface LanguageProfileRow {
  language: string
  wpm: number
  symbolAdjustedWpm: number
  accuracy: number
  sessionCount: number
}
