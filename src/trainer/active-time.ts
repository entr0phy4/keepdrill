// PURE — zero DOM access, zero runtime imports (only `import type`). D-09.
// Toggle-state-machine over CaptureMarker[] (02-RESEARCH.md Pattern 4,
// verbatim), NOT pair-matching by index — robust to overlapping/duplicate
// blur+hidden pairs and out-of-order/duplicate focus/visible markers, since a
// second "go inactive" marker while already inactive (or a stray "go active"
// marker while already active) is a no-op. Locked by the golden cases in
// active-time.test.ts. Phase 2 does not display this value to the user
// (D-09) — Phase 3 consumes it directly.

import type { CommittedChar, CaptureMarker } from '../capture/types'

export function computeActiveElapsedMs(
  charLog: readonly CommittedChar[],
  markers: readonly CaptureMarker[],
  now: number,
): number {
  const first = charLog[0]
  if (first === undefined) return 0 // no keystroke yet — D-09: elapsed is 0

  const t0 = first.tMs
  let inactiveSince: number | null = null
  let totalInactiveMs = 0

  for (const m of markers) {
    if (m.tMs < t0) continue // marker before the session started: irrelevant
    const goesInactive = m.kind === 'blur' || m.kind === 'hidden'
    const goesActive = m.kind === 'focus' || m.kind === 'visible'
    if (goesInactive && inactiveSince === null) {
      inactiveSince = m.tMs
    } else if (goesActive && inactiveSince !== null) {
      totalInactiveMs += m.tMs - inactiveSince
      inactiveSince = null
    }
    // a second "inactive" marker while already inactive, or a stray "active"
    // marker while already active, is a no-op — this is what makes the
    // function robust to overlapping/duplicate blur+hidden pairs.
  }

  if (inactiveSince !== null) {
    totalInactiveMs += Math.max(0, now - inactiveSince)
  }

  return Math.max(0, now - t0 - totalInactiveMs)
}
