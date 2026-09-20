// Named types only — no runtime, no Dexie, no React, no WASM package.
// PlanUnit start/end are exclusive code-point offsets into Array.from(exercise.text),
// matching trainer/state.ts (Phase 3 Unicode contract).

import type { Exercise } from '../ingestion/types'

export type PlanUnitKind = 'import' | 'function' | 'class' | 'type' | 'other' | 'file'

export interface PlanUnit {
  id: string
  kind: PlanUnitKind
  start: number
  end: number
  dependsOn: string[]
  name?: string
}

export interface FilePlan {
  exercise: Exercise
  units: PlanUnit[]
  fallback: boolean
  notice?: string
}

/** Structural subset of a tree-sitter SyntaxNode. Tests inject fixtures; do not re-export WASM types. */
export interface TsNode {
  type: string
  startIndex: number
  endIndex: number
  namedChildren: TsNode[]
  childForFieldName?(field: string): TsNode | null
}
