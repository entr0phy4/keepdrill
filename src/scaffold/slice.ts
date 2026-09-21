// PURE — zero DOM, zero React, zero WASM. PlanUnit start/end are exclusive
// code-point offsets into Array.from(exercise.text) (parse/types.ts).

import type { PlanUnit } from '../parse/types'

export function sliceUnit(text: string, start: number, end: number): string {
  return Array.from(text).slice(start, end).join('')
}

export function joinUnitSlices(text: string, units: readonly PlanUnit[]): string {
  return units.map((u) => sliceUnit(text, u.start, u.end)).join('')
}
