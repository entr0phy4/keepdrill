// Platform seam — the ONLY module that imports Dexie (D-03). Kept out of the
// hot path.

import Dexie, { type Table } from 'dexie'
import type { StoredSession } from './types'

class KeebdrillDB extends Dexie {
  sessions!: Table<StoredSession, number>

  constructor() {
    super('keebdrill')
    // D-05: version(1) is the FIRST and FINAL definition of the v1 schema.
    // Any future change = a NEW db.version(2).stores({...}).upgrade(tx => ...)
    // block. NEVER edit this line after it ships. Only indexed fields are
    // listed here; events/charLog/markers/exercise/metricsSnapshot are stored
    // but NOT indexed.
    this.version(1).stores({
      sessions: '++id, startedAt',
    })
  }
}

export const db = new KeebdrillDB()
