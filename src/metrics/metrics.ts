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

import type { CommittedChar, CaptureMarker } from '../capture/types'
import { computeActiveElapsedMs } from '../trainer/active-time'

export const METRICS_SCHEMA_VERSION = 1

export interface MetricsResult {
  schemaVersion: number
  wpm: number
  accuracy: number
}

/** Mirrors computeTrainerState's delete/insert branching exactly (D-02), but
 *  replays every insert-branch attempt individually — including attempts
 *  later overwritten by a backspace-and-retype — rather than collapsing to
 *  one final status per position. */
function replayAttempts(
  target: string,
  charLog: readonly CommittedChar[],
): { correctAttempts: number; incorrectAttempts: number } {
  let cursor = 0
  let correctAttempts = 0
  let incorrectAttempts = 0

  for (const rec of charLog) {
    if (rec.inputType.startsWith('delete')) {
      if (cursor > 0) cursor -= 1
      continue
    }

    for (const ch of rec.data ?? '') {
      if (cursor >= target.length) break
      if (ch === target[cursor]) {
        correctAttempts += 1
      } else {
        incorrectAttempts += 1
      }
      cursor += 1
    }
  }

  return { correctAttempts, incorrectAttempts }
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
  const { correctAttempts, incorrectAttempts } = replayAttempts(target, charLog)

  return {
    schemaVersion: METRICS_SCHEMA_VERSION,
    wpm: computeWpm(correctAttempts, elapsedMs),
    accuracy: computeAccuracy(correctAttempts, correctAttempts + incorrectAttempts),
  }
}
