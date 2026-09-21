import { describe, expect, it } from 'vitest'
import type { PlanUnit } from '../parse/types'
import { coverFile } from './cover'
import { sliceUnit } from './slice'

// U+1F600 is one Unicode code point and two UTF-16 code units.
const EMOJI = '😀'

function unit(
  start: number,
  end: number,
  extras: Partial<Pick<PlanUnit, 'id' | 'kind' | 'name'>> = {},
): PlanUnit {
  return {
    id: extras.id ?? `${start}-${end}`,
    kind: extras.kind ?? 'function',
    start,
    end,
    dependsOn: [],
    name: extras.name,
  }
}

describe('coverFile — source-order segments and gaps (D-01 / SCAF-01)', () => {
  it('emits one gap whose slice equals the blank line between two units', () => {
    const text = 'aa\n\nbb\n'
    const units = [unit(0, 3, { id: 'a', name: 'a' }), unit(4, 7, { id: 'b', name: 'b' })]
    const segments = coverFile(text, units, 0)
    const gaps = segments.filter((s) => s.kind === 'gap')
    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toEqual({ kind: 'gap', start: 3, end: 4 })
    expect(sliceUnit(text, gaps[0]!.start, gaps[0]!.end)).toBe('\n')
  })

  it('emits only the fallback unit and zero gaps for a full-cover [0, code-point length)', () => {
    const text = 'function a() {}\n'
    const end = Array.from(text).length
    const units = [unit(0, end, { id: 'file', kind: 'file' })]
    const segments = coverFile(text, units, 0)
    expect(segments).toEqual([{ kind: 'unit', unit: units[0], role: 'current' }])
    expect(segments.filter((s) => s.kind === 'gap')).toHaveLength(0)
  })

  it('paints source-order a then b while unitIndex 0 keeps leaves-first b current and a future', () => {
    const text = 'function a() {}\nfunction b() {}\n'
    const a = unit(0, 16, { id: 'a', name: 'a' })
    const b = unit(16, 32, { id: 'b', name: 'b' })
    const curriculum = [b, a]
    const segments = coverFile(text, curriculum, 0)
    const unitsOnly = segments.filter((s) => s.kind === 'unit')
    expect(unitsOnly.map((s) => s.unit.id)).toEqual(['a', 'b'])
    expect(unitsOnly.find((s) => s.unit.id === 'b')?.role).toBe('current')
    expect(unitsOnly.find((s) => s.unit.id === 'a')?.role).toBe('future')
  })

  it('marks b done and a current when unitIndex is 1 on that leaves-first pair', () => {
    const text = 'function a() {}\nfunction b() {}\n'
    const a = unit(0, 16, { id: 'a', name: 'a' })
    const b = unit(16, 32, { id: 'b', name: 'b' })
    const segments = coverFile(text, [b, a], 1)
    const unitsOnly = segments.filter((s) => s.kind === 'unit')
    expect(unitsOnly.find((s) => s.unit.id === 'a')?.role).toBe('current')
    expect(unitsOnly.find((s) => s.unit.id === 'b')?.role).toBe('done')
  })

  it('marks every unit done when unitIndex is at or past the curriculum length', () => {
    const text = 'function a() {}\nfunction b() {}\n'
    const a = unit(0, 16, { id: 'a' })
    const b = unit(16, 32, { id: 'b' })
    const segments = coverFile(text, [b, a], 2)
    const roles = segments.filter((s) => s.kind === 'unit').map((s) => s.role)
    expect(roles).toEqual(['done', 'done'])
  })

  it('emits one whole-file gap when units are empty and text is not', () => {
    const text = 'hello'
    const segments = coverFile(text, [], 0)
    expect(segments).toEqual([{ kind: 'gap', start: 0, end: 5 }])
  })

  it('counts an emoji inside a gap as one code point, not two UTF-16 units', () => {
    const text = `aa${EMOJI}bb`
    const units = [unit(0, 2, { id: 'a' }), unit(3, 5, { id: 'b' })]
    const segments = coverFile(text, units, 0)
    const gaps = segments.filter((s) => s.kind === 'gap')
    expect(gaps).toEqual([{ kind: 'gap', start: 2, end: 3 }])
    expect(sliceUnit(text, 2, 3)).toBe(EMOJI)
    expect(text.length).toBe(6)
    expect(Array.from(text).length).toBe(5)
  })

  it('does not mutate the input units array', () => {
    const text = 'function a() {}\nfunction b() {}\n'
    const a = unit(0, 16, { id: 'a' })
    const b = unit(16, 32, { id: 'b' })
    const curriculum = [b, a]
    const before = curriculum.slice()
    coverFile(text, curriculum, 0)
    expect(curriculum).toEqual(before)
    expect(curriculum[0]).toBe(b)
  })
})
