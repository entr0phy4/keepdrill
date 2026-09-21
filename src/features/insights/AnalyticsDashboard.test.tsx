import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/persistence/db'
import { saveSession } from '@/persistence/repository'
import { METRICS_SCHEMA_VERSION } from '@/metrics/metrics'
import type { MetricsResult } from '@/metrics/metrics'
import type { NewSession } from '@/persistence/types'
import type { Exercise } from '@/ingestion/types'
import type { Session } from '@/capture/types'
import type { DigraphEntry, LanguageProfileRow } from '@/analytics/types'
import { AnalyticsDashboard } from './AnalyticsDashboard'
import { DigraphLatencyView } from './components/DigraphLatencyView'
import { LanguageProfileView } from './components/LanguageProfileView'

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
  slowest5: [],
  symbolAdjustedWpm: 78.2,
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

describe('AnalyticsDashboard — three-way branch (D-02/D-04)', () => {
  it('shows Loading analytics… before the query resolves, not the empty copy or section titles', () => {
    act(() => {
      root.render(<AnalyticsDashboard />)
    })
    expect(container.querySelector('h2')?.textContent).toBe('Analytics')
    expect(container.textContent).toContain('Loading analytics…')
    expect(container.textContent).not.toContain('No sessions yet')
    expect(container.textContent).not.toContain('Slowest digraphs')
  })

  it('shows the History-matching empty sentence and no section titles once resolved to []', async () => {
    act(() => {
      root.render(<AnalyticsDashboard />)
    })
    await waitForLiveQuery()
    expect(container.querySelector('h2')?.textContent).toBe('Analytics')
    expect(container.textContent).toContain(
      'No sessions yet — finish a typing exercise and it\u2019ll show up here.',
    )
    expect(container.textContent).not.toContain('Slowest digraphs')
    expect(container.textContent).not.toContain('Keyboard heatmap')
    expect(container.textContent).not.toContain('Language profile')
  })

  it('mounts Slowest digraphs, Keyboard heatmap, then Language profile when a session exists', async () => {
    await saveSession(buildInput())
    act(() => {
      root.render(<AnalyticsDashboard />)
    })
    await waitForLiveQuery()

    const headings = Array.from(container.querySelectorAll('h3')).map((el) => el.textContent)
    expect(headings).toEqual(['Slowest digraphs', 'Keyboard heatmap', 'Language profile'])
    expect(container.textContent).not.toContain('Loading analytics…')
    expect(container.textContent).toContain(
      'Not enough digraph samples yet. Pairs need at least 5 in-window observations across your history.',
    )
    expect(container.querySelector('.keyboard-heatmap')).not.toBeNull()
  })
})

describe('DigraphLatencyView', () => {
  it('shows the locked empty copy and no table when rows is empty', () => {
    act(() => {
      root.render(<DigraphLatencyView rows={[]} />)
    })
    expect(container.textContent).toContain(
      'Not enough digraph samples yet. Pairs need at least 5 in-window observations across your history.',
    )
    expect(container.querySelector('table')).toBeNull()
  })

  it('renders a semantic table with glyph, rounded ms, and sample count', () => {
    const rows: DigraphEntry[] = [
      { pair: 'a ', medianMs: 214.6, sampleCount: 12 },
      { pair: '{\n', medianMs: 99.2, sampleCount: 5 },
    ]
    act(() => {
      root.render(<DigraphLatencyView rows={rows} />)
    })

    const table = container.querySelector('table.analytics-table')
    expect(table).not.toBeNull()
    const headers = Array.from(table!.querySelectorAll('thead th')).map((th) => th.textContent)
    expect(headers).toEqual(['Digraph', 'Median', 'Samples'])

    const bodyRows = table!.querySelectorAll('tbody tr')
    expect(bodyRows).toHaveLength(2)
    expect(bodyRows[0]?.querySelector('.key-chip')?.textContent).toBe('a·')
    expect(bodyRows[0]?.textContent).toContain('215 ms')
    expect(bodyRows[0]?.textContent).toContain('12')
    expect(bodyRows[1]?.querySelector('.key-chip')?.textContent).toBe('{↵')
    expect(bodyRows[1]?.textContent).toContain('99 ms')

    expect(table!.querySelectorAll('[href], [onclick], [tabindex]')).toHaveLength(0)
  })
})

describe('LanguageProfileView', () => {
  it('renders plaintext as a raw key-chip and rounded companion metrics', () => {
    const rows: LanguageProfileRow[] = [
      { language: 'plaintext', wpm: 62.4, symbolAdjustedWpm: 78.2, accuracy: 0.9432, sessionCount: 3 },
      { language: 'rust', wpm: 40, symbolAdjustedWpm: 55.4, accuracy: 0.9, sessionCount: 1 },
    ]
    act(() => {
      root.render(<LanguageProfileView rows={rows} />)
    })

    const table = container.querySelector('table.analytics-table')
    expect(table).not.toBeNull()
    const headers = Array.from(table!.querySelectorAll('thead th')).map((th) => th.textContent)
    expect(headers).toEqual(['Language', 'WPM', 'Adj. WPM', 'Accuracy', 'Sessions'])

    const bodyRows = table!.querySelectorAll('tbody tr')
    expect(bodyRows).toHaveLength(2)
    expect(bodyRows[0]?.querySelector('.key-chip')?.textContent).toBe('plaintext')
    expect(bodyRows[0]?.textContent).toContain('62')
    expect(bodyRows[0]?.textContent).toContain('78')
    expect(bodyRows[0]?.textContent).toContain('94%')
    expect(bodyRows[0]?.textContent).toContain('3')
    expect(bodyRows[1]?.querySelector('.key-chip')?.textContent).toBe('rust')
    expect(bodyRows[1]?.textContent).toContain('90%')

    expect(table!.querySelectorAll('[href], [onclick], [tabindex]')).toHaveLength(0)
  })
})
