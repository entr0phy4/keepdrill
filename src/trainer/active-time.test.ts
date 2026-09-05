import { describe, it, expect } from 'vitest'
import { computeActiveElapsedMs } from './active-time'
import type { CommittedChar, CaptureMarker } from '../capture/types'

// Golden-case table locking D-09's toggle-state-machine behavior against
// every marker-ordering edge case 02-RESEARCH.md Pattern 4 calls out.
// Convention matches src/ingestion/normalize.test.ts's Case/it.each table.

function char(tMs: number): CommittedChar {
  return { seq: 0, inputType: 'insertText', data: 'a', tMs }
}

function marker(kind: CaptureMarker['kind'], tMs: number): CaptureMarker {
  return { seq: 0, kind, tMs }
}

describe('computeActiveElapsedMs() — golden cases (D-09)', () => {
  it('case 1: no keystroke yet -> 0', () => {
    expect(computeActiveElapsedMs([], [], 1000)).toBe(0)
  })

  it('case 2: no blur/hidden at all -> full elapsed since first keystroke', () => {
    const charLog = [char(0)]
    expect(computeActiveElapsedMs(charLog, [], 500)).toBe(500)
  })

  it('case 3: one full blur/focus pair subtracts its interval', () => {
    const charLog = [char(0)]
    const markers = [marker('blur', 100), marker('focus', 200)]
    expect(computeActiveElapsedMs(charLog, markers, 500)).toBe(400)
  })

  it('case 4: a hidden marker with no matching visible counts the open interval up to now', () => {
    const charLog = [char(0)]
    const markers = [marker('hidden', 300)]
    // active 0-300 (300ms) + inactive 300-500 (200ms, uncounted) -> elapsed = 500 - 200 = 300
    expect(computeActiveElapsedMs(charLog, markers, 500)).toBe(300)
  })

  it('case 5: overlapping blur+hidden at the same instant, closed by one focus, subtracts only once', () => {
    const charLog = [char(0)]
    const overlapping = [marker('blur', 100), marker('hidden', 100), marker('focus', 200)]
    const single = [marker('blur', 100), marker('focus', 200)]
    expect(computeActiveElapsedMs(charLog, overlapping, 500)).toBe(computeActiveElapsedMs(charLog, single, 500))
    expect(computeActiveElapsedMs(charLog, overlapping, 500)).toBe(400)
  })

  it('case 6: a duplicate/out-of-order focus marker while already active is a no-op', () => {
    const charLog = [char(0)]
    const markers = [marker('focus', 50), marker('blur', 100), marker('focus', 200)]
    expect(computeActiveElapsedMs(charLog, markers, 500)).toBe(400)
  })

  it('markers before the first keystroke are ignored', () => {
    const charLog = [char(100)]
    const markers = [marker('blur', 0), marker('focus', 50)]
    expect(computeActiveElapsedMs(charLog, markers, 600)).toBe(500)
  })
})
