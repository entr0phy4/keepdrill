// PURE — zero DOM, zero React, zero WASM. Source-order cover of PlanUnit
// ranges plus trivia gaps; roles come from curriculum index, not paint order.

import type { PlanUnit } from '../parse/types'

export type ScaffoldSegment =
  | { kind: 'gap'; start: number; end: number }
  | { kind: 'unit'; unit: PlanUnit; role: 'done' | 'current' | 'future' }

export function coverFile(
  text: string,
  units: readonly PlanUnit[],
  unitIndex: number,
): ScaffoldSegment[] {
  const cpLen = Array.from(text).length
  const byStart = [...units].sort((a, b) => a.start - b.start)
  const roleOf = (u: PlanUnit): 'done' | 'current' | 'future' => {
    const i = units.findIndex((x) => x.id === u.id)
    if (i < unitIndex) return 'done'
    if (i === unitIndex) return 'current'
    return 'future'
  }
  const out: ScaffoldSegment[] = []
  let cursor = 0
  for (const u of byStart) {
    if (u.start > cursor) out.push({ kind: 'gap', start: cursor, end: u.start })
    out.push({ kind: 'unit', unit: u, role: roleOf(u) })
    cursor = Math.max(cursor, u.end)
  }
  if (cursor < cpLen) out.push({ kind: 'gap', start: cursor, end: cpLen })
  return out
}
