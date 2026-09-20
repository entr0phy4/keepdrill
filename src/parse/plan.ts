// PURE — zero DOM, zero network, zero WASM. Walks program namedChildren only
// (PLAN-01): nested functions stay inside the parent range; class is one unit.

import type { Exercise } from '../ingestion/types'
import type { FilePlan, PlanUnit, PlanUnitKind, TsNode } from './types'
import { utf16ToCodePoint } from './utf16'

const FALLBACK_NOTICE = 'Could not split this file into units.'

const FUNCTION_VALUES = new Set(['arrow_function', 'function', 'function_expression'])

const EXPORT_INNER = new Set([
  'function_declaration',
  'generator_function_declaration',
  'class_declaration',
  'abstract_class_declaration',
  'interface_declaration',
  'type_alias_declaration',
  'enum_declaration',
  'lexical_declaration',
  'variable_declaration',
])

export function fallbackPlan(exercise: Exercise, notice: string): FilePlan {
  const end = Array.from(exercise.text).length
  return {
    exercise,
    fallback: true,
    notice,
    units: [{ id: 'file', kind: 'file', start: 0, end, dependsOn: [] }],
  }
}

export function planUnits(root: TsNode, exercise: Exercise): FilePlan {
  const units = collectUnits(root, exercise.text)
  if (units.length === 0) return fallbackPlan(exercise, FALLBACK_NOTICE)
  return { exercise, units, fallback: false }
}

function collectUnits(root: TsNode, text: string): PlanUnit[] {
  const children = root.namedChildren
  const units: PlanUnit[] = []
  let i = 0
  while (i < children.length) {
    const child = children[i]!
    if (child.type === 'ERROR') {
      i += 1
      continue
    }
    if (child.type === 'import_statement') {
      let end = i
      while (end + 1 < children.length && children[end + 1]!.type === 'import_statement') {
        end += 1
      }
      units.push(makeUnit('import', children[i]!.startIndex, children[end]!.endIndex, text))
      i = end + 1
      continue
    }
    const classified = classify(child, text)
    units.push(
      makeUnit(classified.kind, classified.startIndex, classified.endIndex, text, classified.name),
    )
    i += 1
  }
  return units
}

function classify(
  node: TsNode,
  text: string,
): { kind: PlanUnitKind; startIndex: number; endIndex: number; name?: string } {
  if (node.type === 'export_statement') {
    const inner = node.namedChildren.find((c) => EXPORT_INNER.has(c.type))
    if (inner) {
      const classified = classify(inner, text)
      return { ...classified, startIndex: node.startIndex, endIndex: node.endIndex }
    }
    return { kind: 'other', startIndex: node.startIndex, endIndex: node.endIndex }
  }

  switch (node.type) {
    case 'function_declaration':
    case 'generator_function_declaration':
      return {
        kind: 'function',
        startIndex: node.startIndex,
        endIndex: node.endIndex,
        name: fieldName(node, text),
      }
    case 'class_declaration':
    case 'abstract_class_declaration':
      return {
        kind: 'class',
        startIndex: node.startIndex,
        endIndex: node.endIndex,
        name: fieldName(node, text),
      }
    case 'interface_declaration':
    case 'type_alias_declaration':
    case 'enum_declaration':
      return {
        kind: 'type',
        startIndex: node.startIndex,
        endIndex: node.endIndex,
        name: fieldName(node, text),
      }
    case 'lexical_declaration':
    case 'variable_declaration':
      if (isFunctionBinding(node)) {
        return {
          kind: 'function',
          startIndex: node.startIndex,
          endIndex: node.endIndex,
          name: bindingName(node, text),
        }
      }
      return { kind: 'other', startIndex: node.startIndex, endIndex: node.endIndex }
    default:
      return { kind: 'other', startIndex: node.startIndex, endIndex: node.endIndex }
  }
}

function isFunctionBinding(node: TsNode): boolean {
  for (const child of node.namedChildren) {
    if (child.type === 'variable_declarator' && hasFunctionValue(child)) return true
  }
  return hasFunctionValue(node)
}

function hasFunctionValue(declarator: TsNode): boolean {
  const value = declarator.childForFieldName?.('value')
  if (value && FUNCTION_VALUES.has(value.type)) return true
  return declarator.namedChildren.some((c) => FUNCTION_VALUES.has(c.type))
}

function fieldName(node: TsNode, text: string): string | undefined {
  return nodeText(node.childForFieldName?.('name') ?? null, text)
}

function bindingName(node: TsNode, text: string): string | undefined {
  for (const child of node.namedChildren) {
    if (child.type !== 'variable_declarator') continue
    const nameNode =
      child.childForFieldName?.('name') ?? child.namedChildren.find((c) => c.type === 'identifier')
    const name = nodeText(nameNode ?? null, text)
    if (name) return name
  }
  return undefined
}

function nodeText(node: TsNode | null, text: string): string | undefined {
  if (!node) return undefined
  if (node.type !== 'identifier' && node.type !== 'type_identifier') return undefined
  return text.slice(node.startIndex, node.endIndex)
}

function makeUnit(
  kind: PlanUnitKind,
  startIndex: number,
  endIndex: number,
  text: string,
  name?: string,
): PlanUnit {
  const start = utf16ToCodePoint(text, startIndex)
  const end = utf16ToCodePoint(text, endIndex)
  const unit: PlanUnit = {
    id: `${kind}-${start}`,
    kind,
    start,
    end,
    dependsOn: [],
  }
  if (name) unit.name = name
  return unit
}
