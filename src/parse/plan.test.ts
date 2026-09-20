import { describe, expect, it } from 'vitest'
import type { Exercise } from '../ingestion/types'
import { fallbackPlan, planUnits } from './plan'
import type { PlanUnit, PlanUnitKind, TsNode } from './types'

function exercise(text: string): Exercise {
  return { text, language: 'typescript', sourceType: 'paste' }
}

function node(
  type: string,
  text: string,
  snippet: string,
  namedChildren: TsNode[] = [],
  fields?: Record<string, TsNode>,
): TsNode {
  const startIndex = text.indexOf(snippet)
  if (startIndex < 0) throw new Error(`snippet not found: ${JSON.stringify(snippet)}`)
  const n: TsNode = {
    type,
    startIndex,
    endIndex: startIndex + snippet.length,
    namedChildren,
  }
  if (fields) n.childForFieldName = (field) => fields[field] ?? null
  return n
}

function program(text: string, namedChildren: TsNode[]): TsNode {
  return { type: 'program', startIndex: 0, endIndex: text.length, namedChildren }
}

function ident(text: string, name: string, type = 'identifier'): TsNode {
  const match = new RegExp(`\\b${name}\\b`).exec(text)
  if (!match) throw new Error(`ident not found: ${name}`)
  return {
    type,
    startIndex: match.index,
    endIndex: match.index + name.length,
    namedChildren: [],
  }
}

interface CoverCase {
  n: number
  name: string
  text: string
  root: TsNode
  expected: ReadonlyArray<{ kind: PlanUnitKind; start: number; end: number }>
  fallback: boolean
}

const EMOJI = '😀'

const importText = "import a from 'a'\nimport b from 'b'\n"
const classText = 'class C {\n  m() {}\n}\n'
const nestedText = 'function outer() {\n  function inner() {}\n}\n'
const arrowText = 'const f = () => 1\n'
const exportText = 'export function f() {}\n'
const typesText = 'type A = number\ninterface B {}\nenum C {}\n'
const otherText = 'foo()\n'
const emptyText = ''
const errorText = '@@@'
const emojiText = `// ${EMOJI}\nfunction f() {}\n`
const generatorText = 'function* g() {}\n'
const abstractText = 'abstract class A {}\n'
const varFnText = 'var f = function () {}\n'

const classMethod = node('method_definition', classText, 'm() {}')
const innerFn = node(
  'function_declaration',
  nestedText,
  'function inner() {}',
  [],
  { name: ident(nestedText, 'inner') },
)
const arrowValue = node('arrow_function', arrowText, '() => 1')
const arrowDecl = node('variable_declarator', arrowText, 'f = () => 1', [ident(arrowText, 'f'), arrowValue], {
  name: ident(arrowText, 'f'),
  value: arrowValue,
})
const exportedFn = node(
  'function_declaration',
  exportText,
  'function f() {}',
  [],
  { name: ident(exportText, 'f') },
)
const fnValue = node('function', varFnText, 'function () {}')
const varDecl = node('variable_declarator', varFnText, 'f = function () {}', [ident(varFnText, 'f'), fnValue], {
  name: ident(varFnText, 'f'),
  value: fnValue,
})

const cases: CoverCase[] = [
  {
    n: 1,
    name: 'consecutive import_statement nodes merge into one import unit',
    text: importText,
    root: program(importText, [
      node('import_statement', importText, "import a from 'a'"),
      node('import_statement', importText, "import b from 'b'"),
    ]),
    expected: [{ kind: 'import', start: 0, end: importText.indexOf("import b from 'b'") + "import b from 'b'".length }],
    fallback: false,
  },
  {
    n: 2,
    name: 'class_declaration is one class unit; nested method is not a unit',
    text: classText,
    root: program(classText, [
      node('class_declaration', classText, 'class C {\n  m() {}\n}', [classMethod], {
        name: ident(classText, 'C'),
      }),
    ]),
    expected: [{ kind: 'class', start: 0, end: classText.lastIndexOf('}') + 1 }],
    fallback: false,
  },
  {
    n: 3,
    name: 'nested function_declaration stays inside the parent range',
    text: nestedText,
    root: program(nestedText, [
      node(
        'function_declaration',
        nestedText,
        'function outer() {\n  function inner() {}\n}',
        [innerFn],
        { name: ident(nestedText, 'outer') },
      ),
    ]),
    expected: [{ kind: 'function', start: 0, end: nestedText.lastIndexOf('}') + 1 }],
    fallback: false,
  },
  {
    n: 4,
    name: 'lexical_declaration whose value is arrow_function is kind function',
    text: arrowText,
    root: program(arrowText, [
      node('lexical_declaration', arrowText, 'const f = () => 1', [arrowDecl]),
    ]),
    expected: [{ kind: 'function', start: 0, end: 'const f = () => 1'.length }],
    fallback: false,
  },
  {
    n: 5,
    name: 'export_statement wrapping function_declaration starts at export',
    text: exportText,
    root: program(exportText, [
      node('export_statement', exportText, 'export function f() {}', [exportedFn]),
    ]),
    expected: [{ kind: 'function', start: 0, end: 'export function f() {}'.length }],
    fallback: false,
  },
  {
    n: 6,
    name: 'consecutive type/interface/enum stay separate type units',
    text: typesText,
    root: program(typesText, [
      node('type_alias_declaration', typesText, 'type A = number', [], {
        name: ident(typesText, 'A', 'type_identifier'),
      }),
      node('interface_declaration', typesText, 'interface B {}', [], {
        name: ident(typesText, 'B', 'type_identifier'),
      }),
      node('enum_declaration', typesText, 'enum C {}', [], {
        name: ident(typesText, 'C', 'type_identifier'),
      }),
    ]),
    expected: [
      { kind: 'type', start: 0, end: 'type A = number'.length },
      {
        kind: 'type',
        start: typesText.indexOf('interface B {}'),
        end: typesText.indexOf('interface B {}') + 'interface B {}'.length,
      },
      {
        kind: 'type',
        start: typesText.indexOf('enum C {}'),
        end: typesText.indexOf('enum C {}') + 'enum C {}'.length,
      },
    ],
    fallback: false,
  },
  {
    n: 7,
    name: 'unmatched expression_statement is kind other',
    text: otherText,
    root: program(otherText, [node('expression_statement', otherText, 'foo()')]),
    expected: [{ kind: 'other', start: 0, end: 'foo()'.length }],
    fallback: false,
  },
  {
    n: 8,
    name: 'empty namedChildren yields fallback file unit covering the whole text',
    text: emptyText,
    root: program(emptyText, []),
    expected: [{ kind: 'file', start: 0, end: 0 }],
    fallback: true,
  },
  {
    n: 9,
    name: 'only ERROR named children yield fallback file unit',
    text: errorText,
    root: program(errorText, [node('ERROR', errorText, '@@@')]),
    expected: [{ kind: 'file', start: 0, end: Array.from(errorText).length }],
    fallback: true,
  },
  {
    n: 10,
    name: 'emoji in a leading comment shifts function start by one code point not two',
    text: emojiText,
    root: program(emojiText, [
      node('function_declaration', emojiText, 'function f() {}', [], { name: ident(emojiText, 'f') }),
    ]),
    expected: [
      {
        kind: 'function',
        start: Array.from(`// ${EMOJI}\n`).length,
        end: Array.from(`// ${EMOJI}\nfunction f() {}`).length,
      },
    ],
    fallback: false,
  },
  {
    n: 11,
    name: 'generator_function_declaration is kind function',
    text: generatorText,
    root: program(generatorText, [
      node('generator_function_declaration', generatorText, 'function* g() {}', [], {
        name: ident(generatorText, 'g'),
      }),
    ]),
    expected: [{ kind: 'function', start: 0, end: 'function* g() {}'.length }],
    fallback: false,
  },
  {
    n: 12,
    name: 'abstract_class_declaration is kind class',
    text: abstractText,
    root: program(abstractText, [
      node('abstract_class_declaration', abstractText, 'abstract class A {}', [], {
        name: ident(abstractText, 'A'),
      }),
    ]),
    expected: [{ kind: 'class', start: 0, end: 'abstract class A {}'.length }],
    fallback: false,
  },
  {
    n: 13,
    name: 'variable_declaration whose value is function is kind function',
    text: varFnText,
    root: program(varFnText, [node('variable_declaration', varFnText, 'var f = function () {}', [varDecl])]),
    expected: [{ kind: 'function', start: 0, end: 'var f = function () {}'.length }],
    fallback: false,
  },
]

function assertNonOverlapping(units: PlanUnit[]): void {
  const sorted = [...units].sort((a, b) => a.start - b.start)
  for (let i = 1; i < sorted.length; i++) {
    expect(sorted[i]!.start).toBeGreaterThanOrEqual(sorted[i - 1]!.end)
  }
}

describe('planUnits — golden cover (PLAN-01, PLAN-03)', () => {
  it.each(cases)('case $n: $name', ({ text, root, expected, fallback }) => {
    const plan = planUnits(root, exercise(text))
    expect(plan.fallback).toBe(fallback)
    expect(plan.units).toHaveLength(expected.length)
    expect(plan.units.map((u) => ({ kind: u.kind, start: u.start, end: u.end }))).toEqual(expected)
    assertNonOverlapping(plan.units)
    expect(plan.units.some((u) => u.kind === 'function' && u.name === 'm')).toBe(false)
  })
})

describe('planUnits — fallback contract (PLAN-03)', () => {
  it('never returns an empty units array', () => {
    const plan = planUnits(program('', []), exercise(''))
    expect(plan.units).not.toEqual([])
    expect(plan.units).toHaveLength(1)
  })

  it('fallback file unit covers [0, Array.from(text).length) and dependsOn []', () => {
    const text = errorText
    const plan = planUnits(program(text, [node('ERROR', text, '@@@')]), exercise(text))
    expect(plan.fallback).toBe(true)
    expect(plan.notice).toEqual(expect.any(String))
    expect(plan.notice!.length).toBeGreaterThan(0)
    expect(plan.units).toEqual([
      { id: 'file', kind: 'file', start: 0, end: Array.from(text).length, dependsOn: [] },
    ])
  })
})

describe('fallbackPlan', () => {
  it('returns one file unit covering the whole exercise text', () => {
    const ex = exercise('hello 😀')
    const plan = fallbackPlan(ex, 'Could not split this file into units.')
    expect(plan).toEqual({
      exercise: ex,
      fallback: true,
      notice: 'Could not split this file into units.',
      units: [{ id: 'file', kind: 'file', start: 0, end: Array.from(ex.text).length, dependsOn: [] }],
    })
  })
})
