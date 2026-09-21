// PURE — zero DOM, zero React, zero WASM. Concatenates per-unit capture
// snapshots for last-unit persist; remaps seq onto new objects (D-15).

import type { CaptureMarker, CommittedChar, KeystrokeEvent, Session } from '../capture/types'

export interface UnitSnapshot {
  events: readonly KeystrokeEvent[]
  charLog: readonly CommittedChar[]
  markers: readonly CaptureMarker[]
}

export function flattenSnapshots(
  snaps: readonly UnitSnapshot[],
): Pick<Session, 'events' | 'charLog' | 'markers'> {
  let seq = 0
  const events = snaps.flatMap((s) => s.events.map((e) => ({ ...e, seq: seq++ })))
  const charLog = snaps.flatMap((s) => s.charLog.map((c) => ({ ...c, seq: seq++ })))
  const markers = snaps.flatMap((s) => s.markers.map((m) => ({ ...m, seq: seq++ })))
  return { events, charLog, markers }
}
