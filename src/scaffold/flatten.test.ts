import { describe, expect, it } from 'vitest'
import type { CaptureMarker, CommittedChar, KeystrokeEvent } from '../capture/types'
import { flattenSnapshots } from './flatten'
import type { UnitSnapshot } from './flatten'

function char(seq: number, data: string): CommittedChar {
  return Object.freeze({ seq, inputType: 'insertText', data, tMs: seq * 10 })
}

function event(seq: number, key: string): KeystrokeEvent {
  return Object.freeze({
    seq,
    type: 'keydown',
    key,
    code: `Key${key.toUpperCase()}`,
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
    tMs: seq * 10,
    isRepeat: false,
  })
}

function marker(seq: number, kind: CaptureMarker['kind'] = 'blur'): CaptureMarker {
  return Object.freeze({ seq, kind, tMs: seq * 10 })
}

function snap(partial: Partial<UnitSnapshot>): UnitSnapshot {
  return {
    events: partial.events ?? [],
    charLog: partial.charLog ?? [],
    markers: partial.markers ?? [],
  }
}

describe('flattenSnapshots — concat and remap seq (D-15 / SCAF-03)', () => {
  it("concatenates two snapshots' charLog in snapshot order", () => {
    const unit0 = snap({ charLog: [char(0, 'a'), char(1, 'a')] })
    const unit1 = snap({ charLog: [char(0, 'b')] })
    const flat = flattenSnapshots([unit0, unit1])
    expect(flat.charLog.map((c) => c.data)).toEqual(['a', 'a', 'b'])
  })

  it('remaps seq so values are unique within events, charLog, and markers', () => {
    const unit0 = snap({
      events: [event(0, 'a')],
      charLog: [char(0, 'a')],
      markers: [marker(0, 'focus')],
    })
    const unit1 = snap({
      events: [event(0, 'b')],
      charLog: [char(0, 'b')],
      markers: [marker(0, 'blur')],
    })
    const flat = flattenSnapshots([unit0, unit1])
    const unique = (seq: number[]) => new Set(seq).size === seq.length
    expect(unique(flat.events.map((e) => e.seq))).toBe(true)
    expect(unique(flat.charLog.map((c) => c.seq))).toBe(true)
    expect(unique(flat.markers.map((m) => m.seq))).toBe(true)
    expect(flat.events).toHaveLength(2)
    expect(flat.charLog).toHaveLength(2)
    expect(flat.markers).toHaveLength(2)
  })

  it('does not mutate frozen input rows when remapping seq', () => {
    const original = char(7, 'x')
    const flat = flattenSnapshots([snap({ charLog: [original] })])
    expect(original.seq).toBe(7)
    expect(flat.charLog[0]).not.toBe(original)
    expect(() => {
      ;(original as { seq: number }).seq = 99
    }).toThrow()
    expect(original.seq).toBe(7)
  })

  it('omits in-progress restart rows that were never pushed as a snapshot (D-15)', () => {
    const unit0 = snap({ charLog: [char(0, 'typed')] })
    const discardedInProgress = snap({ charLog: [char(0, 'NOPE')] })
    const flat = flattenSnapshots([unit0])
    expect(flat.charLog.map((c) => c.data)).toEqual(['typed'])
    expect(flat.charLog.map((c) => c.data)).not.toContain('NOPE')
    expect(discardedInProgress.charLog[0]?.data).toBe('NOPE')
  })
})
