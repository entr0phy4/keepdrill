import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { HeatmapCell } from '../analytics/types'
import { KeyboardHeatmap } from './KeyboardHeatmap'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
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

function cell(partial: Partial<HeatmapCell> & Pick<HeatmapCell, 'code' | 'label'>): HeatmapCell {
  return {
    row: 0,
    col: 0,
    span: 1,
    medianMs: null,
    sampleCount: 0,
    ...partial,
  }
}

describe('KeyboardHeatmap', () => {
  it('always mounts a figure group with the locked caption, even when every cell is ungated', () => {
    act(() => {
      root.render(
        <KeyboardHeatmap
          cells={[
            cell({ code: 'KeyA', label: 'A', row: 2, col: 2 }),
            cell({ code: 'KeyS', label: 'S', row: 2, col: 3 }),
          ]}
        />,
      )
    })

    expect(container.querySelector('h3')?.textContent).toBe('Keyboard heatmap')

    const figure = container.querySelector('figure[role="group"]')
    expect(figure).not.toBeNull()
    expect(figure?.getAttribute('aria-label')).toBe(
      'US ANSI keyboard, median latency in milliseconds',
    )
    expect(container.textContent).toContain(
      'Median latency in ms. Darker amber is slower, relative to keys with at least 5 samples.',
    )
    expect(container.textContent).toContain('No keys have 5 samples yet.')

    const keys = container.querySelectorAll('div.kb-key')
    expect(keys).toHaveLength(2)
    expect(container.querySelectorAll('button')).toHaveLength(0)
    expect(container.querySelector('[tabindex]')).toBeNull()
  })

  it('paints sampled keys with relative amber, on-key rounded ms, and unused keys as surface with no number', () => {
    act(() => {
      root.render(
        <KeyboardHeatmap
          cells={[
            cell({ code: 'KeyA', label: 'A', row: 2, col: 2, medianMs: 100.4, sampleCount: 5 }),
            cell({ code: 'KeyS', label: 'S', row: 2, col: 3, medianMs: 200.6, sampleCount: 8 }),
            cell({ code: 'KeyD', label: 'D', row: 2, col: 4, medianMs: null, sampleCount: 0 }),
          ]}
        />,
      )
    })

    expect(container.textContent).not.toContain('No keys have 5 samples yet.')

    const sampledA = container.querySelector('[aria-label="A, 100 milliseconds"]') as HTMLElement | null
    const sampledS = container.querySelector('[aria-label="S, 201 milliseconds"]') as HTMLElement | null
    const unused = container.querySelector('[aria-label="D, not enough samples"]') as HTMLElement | null

    expect(sampledA).not.toBeNull()
    expect(sampledS).not.toBeNull()
    expect(unused).not.toBeNull()

    expect(sampledA?.className).toContain('kb-key')
    expect(sampledA?.tagName).toBe('DIV')
    expect(sampledA?.textContent).toContain('A')
    expect(sampledA?.textContent).toContain('100')
    expect(sampledA?.textContent).not.toContain('ms')
    expect(sampledA?.style.background).toBe(
      'color-mix(in srgb, var(--heatmap-hi) 0%, var(--heatmap-lo))',
    )
    expect(sampledA?.style.color).toBe('var(--heatmap-key-fg)')

    expect(sampledS?.textContent).toContain('201')
    expect(sampledS?.style.background).toBe(
      'color-mix(in srgb, var(--heatmap-hi) 100%, var(--heatmap-lo))',
    )

    expect(unused?.textContent).toContain('D')
    expect(unused?.textContent).not.toMatch(/\d/)
    expect(unused?.style.background).toBe('var(--color-surface)')
    expect(unused?.style.color).toBe('var(--color-text)')
  })

  it('uses the mid-scale mix when every gated key shares the same median', () => {
    act(() => {
      root.render(
        <KeyboardHeatmap
          cells={[cell({ code: 'KeyA', label: 'A', medianMs: 150, sampleCount: 5 })]}
        />,
      )
    })

    const sampled = container.querySelector('[aria-label="A, 150 milliseconds"]') as HTMLElement | null
    expect(sampled?.style.background).toBe(
      'color-mix(in srgb, var(--heatmap-hi) 50%, var(--heatmap-lo))',
    )
  })
})
