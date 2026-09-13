import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, it, expect } from 'vitest'
import { db } from '../persistence/db'
import { saveSession } from '../persistence/repository'
import { METRICS_SCHEMA_VERSION } from '../metrics/metrics'
import type { MetricsResult } from '../metrics/metrics'
import type { NewSession } from '../persistence/types'
import type { Exercise } from '../ingestion/types'
import type { Session } from '../capture/types'
import { HistoryView } from './HistoryView'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

/** useLiveQuery resolves its first read asynchronously via a microtask chain
 *  (Dexie's promise machinery), not necessarily within a single rAF tick —
 *  poll across a few frames/ticks until the DOM reflects a resolved query. */
async function waitForLiveQuery(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
      await nextFrame()
    })
  }
}

let container: HTMLDivElement
let root: Root

beforeEach(async () => {
  await db.delete()
  await db.open()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
})

const baseExercise: Exercise = { text: 'const x = 1', language: 'plaintext', sourceType: 'paste' }

const baseMetrics: MetricsResult = {
  schemaVersion: METRICS_SCHEMA_VERSION,
  wpm: 62.4,
  accuracy: 0.9432,
  slowest5: [{ char: 'x', medianMs: 210 }],
  symbolAdjustedWpm: 78,
}

function buildInput(overrides: { session?: Partial<Session>; metricsSnapshot?: MetricsResult } = {}): NewSession {
  const session: Session = {
    exercise: baseExercise,
    events: [],
    charLog: [],
    markers: [],
    timingResolutionUs: 5,
    crossOriginIsolated: true,
    startedAt: Date.now(),
    ...overrides.session,
  }
  return {
    session,
    completedAt: 1000,
    metricsSnapshot: overrides.metricsSnapshot ?? baseMetrics,
  }
}

describe('HistoryView — loading and empty states (Pitfall 5)', () => {
  it('shows the loading line before the query resolves, not the empty state', () => {
    act(() => {
      root.render(<HistoryView />)
    })
    expect(container.querySelector('h2')?.textContent).toBe('History')
    expect(container.textContent).toContain('Loading history…')
    expect(container.textContent).not.toContain('No sessions yet')
  })

  it('shows the empty-state copy with the History heading present once resolved to []', async () => {
    act(() => {
      root.render(<HistoryView />)
    })
    await waitForLiveQuery()
    expect(container.querySelector('h2')?.textContent).toBe('History')
    expect(container.textContent).toContain('No sessions yet — finish a typing exercise and it’ll show up here.')
  })
})

describe('HistoryView — fully populated row (D-11/D-12)', () => {
  it('renders all seven fields for a fully-populated session', async () => {
    await saveSession(
      buildInput({
        session: { startedAt: Date.now() - 2 * 3_600_000 },
      }),
    )

    act(() => {
      root.render(<HistoryView />)
    })
    await waitForLiveQuery()

    const row = container.querySelector('.history-row')
    expect(row).not.toBeNull()
    expect(row!.textContent).toContain('hours ago')
    expect(row!.textContent).toContain('62 ')
    expect(row!.textContent).toContain('wpm')
    expect(row!.textContent).toContain('94%')
    expect(row!.textContent).toContain('Pasted snippet')
    expect(row!.textContent).toContain('plaintext')
    expect(row!.textContent).toContain(`${'const x = 1'.length} chars`)
    expect(row!.textContent).toContain('x')

    const dateSpan = row!.querySelector('span[title]')
    expect(dateSpan).not.toBeNull()
    expect(dateSpan!.getAttribute('title')).not.toBe('')
  })

  it('omits the slowest-key chip when slowest5 is empty, and still renders every other field', async () => {
    await saveSession(
      buildInput({
        metricsSnapshot: { ...baseMetrics, slowest5: [] },
      }),
    )

    act(() => {
      root.render(<HistoryView />)
    })
    await waitForLiveQuery()

    const row = container.querySelector('.history-row')
    expect(row).not.toBeNull()
    expect(row!.textContent).toContain('wpm')
    expect(row!.textContent).toContain('94%')
    expect(row!.querySelectorAll('.key-chip')).toHaveLength(1) // only the language chip
  })

  it('renders a middle-dot glyph for a slowest char of " "', async () => {
    await saveSession(
      buildInput({
        metricsSnapshot: { ...baseMetrics, slowest5: [{ char: ' ', medianMs: 100 }] },
      }),
    )

    act(() => {
      root.render(<HistoryView />)
    })
    await waitForLiveQuery()

    const chips = container.querySelectorAll('.history-row .key-chip')
    const chipTexts = Array.from(chips).map((c) => c.textContent)
    expect(chipTexts).toContain('·')
  })
})

describe('HistoryView — ordering (PERS-02)', () => {
  it('renders newest-first and breaks an identical-startedAt tie by id descending', async () => {
    const startedAt = Date.now() - 10_000
    const id1 = await saveSession(
      buildInput({
        session: { startedAt, exercise: { ...baseExercise, sourceRef: 'first.ts', sourceType: 'upload' } },
      }),
    )
    const id2 = await saveSession(
      buildInput({
        session: { startedAt, exercise: { ...baseExercise, sourceRef: 'second.ts', sourceType: 'upload' } },
      }),
    )
    expect(id2).toBeGreaterThan(id1)

    act(() => {
      root.render(<HistoryView />)
    })
    await waitForLiveQuery()

    const rows = container.querySelectorAll('.history-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.textContent).toContain('second.ts')
    expect(rows[1]?.textContent).toContain('first.ts')
  })
})
