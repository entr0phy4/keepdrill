import { db } from './db'
import { STORED_SESSION_SCHEMA_VERSION } from './types'
import type { NewSession, StoredSession } from './types'

// D-06: one-shot latch so navigator.storage.persist() is requested at most
// once per page lifetime, mirroring capture.ts / isolation.ts's module-level
// guard idiom.
let persistRequested = false

/** Does NOT catch Dexie errors — a rejection propagates to the caller
 *  (App.tsx::handleComplete's .catch drives the save-failure notice, D-15). */
export async function saveSession(input: NewSession): Promise<number> {
  const row: StoredSession = {
    schemaVersion: STORED_SESSION_SCHEMA_VERSION,
    startedAt: input.session.startedAt,
    completedAtTMs: input.completedAt,
    exercise: input.session.exercise,
    // Spread-copy each readonly/frozen array to a mutable copy (Session's
    // arrays are Object.freeze'd in capture.ts).
    events: [...input.session.events],
    charLog: [...input.session.charLog],
    markers: [...input.session.markers],
    timingResolutionUs: input.session.timingResolutionUs,
    crossOriginIsolated: input.session.crossOriginIsolated,
    metricsSnapshot: input.metricsSnapshot,
  }
  const id = await db.sessions.add(row)
  if (!persistRequested) {
    persistRequested = true
    // D-06: best-effort durable-storage request, never blocks/throws.
    void navigator.storage?.persist?.().catch(() => {})
  }
  return id
}

/** Stable module-level function (not an inline arrow) so useLiveQuery (D-09)
 *  can track it as a stable reference. Newest-first (D-12). */
export function listNewestFirst(): Promise<StoredSession[]> {
  return db.sessions.orderBy('startedAt').reverse().toArray()
}
