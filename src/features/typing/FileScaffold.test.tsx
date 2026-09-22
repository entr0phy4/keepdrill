import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetCapture } from '@/capture/capture'
import type { PlanUnit } from '@/parse/types'
import { COPY, FileScaffold, KIND_LABEL } from './FileScaffold'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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

function mockMatchMedia(reduce: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion: reduce'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

let container: HTMLDivElement
let root: Root
let scrollIntoView: ReturnType<typeof vi.fn>

beforeEach(() => {
  resetCapture()
  mockMatchMedia(false)
  scrollIntoView = vi.fn()
  HTMLElement.prototype.scrollIntoView =
    scrollIntoView as typeof HTMLElement.prototype.scrollIntoView
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  vi.restoreAllMocks()
})

const TWO_UNIT_TEXT = 'function a() {}\nfunction b() {}\n'
const UNIT_A = unit(0, 16, { id: 'a', kind: 'function', name: 'a' })
const UNIT_B = unit(16, 32, { id: 'b', kind: 'function', name: 'b' })
const LEAVES_FIRST = [UNIT_B, UNIT_A]

describe('FileScaffold — COPY and KIND_LABEL (D-13)', () => {
  it('COPY.landmark uses spaces around the slash and KIND_LABEL.other is empty', () => {
    expect(COPY.landmark).toBe('{n} / {m}')
    expect(KIND_LABEL.other).toBe('')
  })
})

describe('FileScaffold — source-order chrome (D-01, D-02, D-04)', () => {
  it('puts #capture-surface only in the current card; static regions have zero textareas', () => {
    act(() => {
      root.render(
        <FileScaffold
          text={TWO_UNIT_TEXT}
          units={LEAVES_FIRST}
          unitIndex={0}
          loadToken={1}
          complete={false}
        />,
      )
    })

    const current = container.querySelector('[data-scaffold-current]')
    expect(current?.querySelector('#capture-surface')).not.toBeNull()
    expect(container.querySelectorAll('#capture-surface')).toHaveLength(1)

    for (const role of ['done', 'future', 'gap'] as const) {
      const regions = container.querySelectorAll(`[data-scaffold-role="${role}"]`)
      for (const region of regions) {
        expect(region.querySelectorAll('textarea')).toHaveLength(0)
      }
    }
  })

  it('paints source-order top-to-bottom so a later-source current unit sits below a future unit', () => {
    act(() => {
      root.render(
        <FileScaffold
          text={TWO_UNIT_TEXT}
          units={LEAVES_FIRST}
          unitIndex={0}
          loadToken={1}
          complete={false}
        />,
      )
    })

    const file = container.querySelector('[aria-label="File"]')
    expect(file).not.toBeNull()
    const kids = Array.from(file!.children)
    const futureIdx = kids.findIndex((el) => el.getAttribute('data-scaffold-role') === 'future')
    const currentIdx = kids.findIndex((el) => el.hasAttribute('data-scaffold-current'))
    expect(futureIdx).toBeGreaterThanOrEqual(0)
    expect(currentIdx).toBeGreaterThan(futureIdx)
    expect(kids[futureIdx]?.textContent).toContain('function·a')
    const overlay = kids[currentIdx]?.querySelector('.trainer-rendered-layer')
    expect(overlay?.textContent).toContain('function·b')
    expect(overlay?.textContent).not.toContain('function·a')
  })

  it('passes CaptureSurface the current unit slice, never the full multi-unit file', () => {
    act(() => {
      root.render(
        <FileScaffold
          text={TWO_UNIT_TEXT}
          units={LEAVES_FIRST}
          unitIndex={0}
          loadToken={1}
          complete={false}
        />,
      )
    })

    const overlay = container.querySelector('[data-scaffold-current] .trainer-rendered-layer')
    expect(overlay?.textContent).toContain('function·b()·{}')
    expect(overlay?.textContent).not.toContain('function·a()·{}')
    expect(TWO_UNIT_TEXT).toContain('function a() {}')
    expect(TWO_UNIT_TEXT).toContain('function b() {}')
  })
})

describe('FileScaffold — untrusted corpus as characters (D-06)', () => {
  it('renders markup-looking fixture as characters; querySelector(img) is null', () => {
    const payload = '<img src=x onerror=alert(1)>'
    const text = `ok\n${payload}`
    const okEnd = Array.from('ok\n').length
    const units = [
      unit(0, okEnd, { id: 'ok', kind: 'function', name: 'ok' }),
      unit(okEnd, Array.from(text).length, { id: 'xss', kind: 'function', name: 'xss' }),
    ]

    act(() => {
      root.render(
        <FileScaffold text={text} units={units} unitIndex={0} loadToken={1} complete={false} />,
      )
    })

    expect(container.querySelector('img')).toBeNull()
    const future = container.querySelector('[data-scaffold-role="future"]')
    expect(future?.textContent).toContain('<img')
    expect(future?.textContent).toContain('onerror=alert(1)>')
    expect(future?.innerHTML).not.toContain('<img src')
  })
})

describe('FileScaffold — whitespace glyphs in static regions', () => {
  it('renders glyphFor middle-dot and newline via .ws-glyph on a gap', () => {
    const text = 'aa \nbb\n'
    const units = [unit(0, 2, { id: 'aa' }), unit(4, 7, { id: 'bb' })]

    act(() => {
      root.render(
        <FileScaffold text={text} units={units} unitIndex={0} loadToken={1} complete={false} />,
      )
    })

    const gap = container.querySelector('[data-scaffold-role="gap"]')
    expect(gap).not.toBeNull()
    const glyphs = gap!.querySelectorAll('.ws-glyph')
    const chars = Array.from(glyphs).map((el) => el.textContent)
    expect(chars).toContain('·')
    expect(chars).toContain('↵')
  })
})

describe('FileScaffold — fallback 1 / 1 (D-09)', () => {
  it('shows a 1 / 1 landmark, one current card, and no future role', () => {
    const text = 'function a() {}\n'
    const units = [unit(0, Array.from(text).length, { id: 'file', kind: 'file' })]

    act(() => {
      root.render(
        <FileScaffold text={text} units={units} unitIndex={0} loadToken={1} complete={false} />,
      )
    })

    expect(container.textContent).toContain('1 / 1')
    expect(container.querySelectorAll('[data-scaffold-current]')).toHaveLength(1)
    expect(container.querySelector('#capture-surface')).not.toBeNull()
    expect(container.querySelector('[data-scaffold-role="future"]')).toBeNull()
  })

  it('omits other as a visible word and shows name-only subtitle', () => {
    const text = 'const x = 1\n'
    const units = [unit(0, Array.from(text).length, { id: 'x', kind: 'other', name: 'x' })]

    act(() => {
      root.render(
        <FileScaffold text={text} units={units} unitIndex={0} loadToken={1} complete={false} />,
      )
    })

    const landmark = container.querySelector('[role="status"]')
    expect(landmark?.getAttribute('aria-label')).toBe('1 / 1, x')
    expect(landmark?.textContent).not.toMatch(/\bother\b/)
  })
})

describe('FileScaffold — complete unmounts CaptureSurface (D-18)', () => {
  it('has zero #capture-surface and only done or gap roles when complete', () => {
    act(() => {
      root.render(
        <FileScaffold
          text={TWO_UNIT_TEXT}
          units={LEAVES_FIRST}
          unitIndex={1}
          loadToken={2}
          complete={true}
        />,
      )
    })

    expect(container.querySelector('#capture-surface')).toBeNull()
    expect(container.querySelector('[data-scaffold-current]')).toBeNull()
    expect(container.querySelector('[data-scaffold-role="future"]')).toBeNull()
    const roles = Array.from(container.querySelectorAll('[data-scaffold-role]')).map((el) =>
      el.getAttribute('data-scaffold-role'),
    )
    expect(roles.length).toBeGreaterThan(0)
    expect(roles.every((r) => r === 'done' || r === 'gap')).toBe(true)
  })
})

describe('FileScaffold — scrollIntoView (D-13)', () => {
  it('calls scrollIntoView on the current card on mount and when unitIndex changes', () => {
    act(() => {
      root.render(
        <FileScaffold
          text={TWO_UNIT_TEXT}
          units={LEAVES_FIRST}
          unitIndex={0}
          loadToken={1}
          complete={false}
        />,
      )
    })

    expect(scrollIntoView).toHaveBeenCalled()
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'center',
      inline: 'nearest',
      behavior: 'smooth',
    })
    const afterMount = scrollIntoView.mock.calls.length

    act(() => {
      root.render(
        <FileScaffold
          text={TWO_UNIT_TEXT}
          units={LEAVES_FIRST}
          unitIndex={1}
          loadToken={2}
          complete={false}
        />,
      )
    })

    expect(scrollIntoView.mock.calls.length).toBeGreaterThan(afterMount)
    expect(scrollIntoView).toHaveBeenLastCalledWith({
      block: 'center',
      inline: 'nearest',
      behavior: 'smooth',
    })
  })

  it('uses instant behavior when prefers-reduced-motion: reduce matches', () => {
    mockMatchMedia(true)
    act(() => {
      root.render(
        <FileScaffold
          text={TWO_UNIT_TEXT}
          units={LEAVES_FIRST}
          unitIndex={0}
          loadToken={1}
          complete={false}
        />,
      )
    })

    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'center',
      inline: 'nearest',
      behavior: 'instant',
    })
  })

  it('smooth-scrolls the current unit into view in plain mode when unitIndex changes', () => {
    act(() => {
      root.render(
        <FileScaffold
          plain
          text={TWO_UNIT_TEXT}
          units={LEAVES_FIRST}
          unitIndex={0}
          loadToken={1}
          complete={false}
        />,
      )
    })
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'center',
      inline: 'nearest',
      behavior: 'smooth',
    })
    const afterMount = scrollIntoView.mock.calls.length

    act(() => {
      root.render(
        <FileScaffold
          plain
          text={TWO_UNIT_TEXT}
          units={LEAVES_FIRST}
          unitIndex={1}
          loadToken={2}
          complete={false}
        />,
      )
    })
    expect(scrollIntoView.mock.calls.length).toBeGreaterThan(afterMount)
    expect(scrollIntoView).toHaveBeenLastCalledWith({
      block: 'center',
      inline: 'nearest',
      behavior: 'smooth',
    })
  })
})

describe('FileScaffold — plain file segments', () => {
  it('paints real source text, syntax tokens, and a single current capture', () => {
    act(() => {
      root.render(
        <FileScaffold
          plain
          language="typescript"
          text={TWO_UNIT_TEXT}
          units={LEAVES_FIRST}
          unitIndex={0}
          loadToken={1}
          complete={false}
        />,
      )
    })

    const file = container.querySelector('[aria-label="File"]')
    expect(file?.textContent).toContain('function a() {}')
    expect(file?.textContent).toContain('function b() {}')
    expect(file?.querySelector('.ws-glyph')).toBeNull()
    expect(container.querySelector('[data-scaffold-role="future"] [data-token="keyword"]')).not.toBeNull()
    expect(
      container.querySelector('[data-scaffold-current] .trainer-rendered-layer')?.textContent,
    ).toContain('function b() {}')
    expect(container.querySelectorAll('#capture-surface')).toHaveLength(1)
    expect(container.querySelector('[data-current-line]')).not.toBeNull()
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'center',
      inline: 'nearest',
      behavior: 'smooth',
    })
  })

  it('calls onSelectUnit when a non-current unit is clicked', () => {
    const onSelectUnit = vi.fn<(index: number) => void>()
    act(() => {
      root.render(
        <FileScaffold
          plain
          language="typescript"
          text={TWO_UNIT_TEXT}
          units={LEAVES_FIRST}
          unitIndex={0}
          loadToken={1}
          complete={false}
          onSelectUnit={onSelectUnit}
        />,
      )
    })

    // LEAVES_FIRST = [B, A]; unitIndex 0 → B is current, A is future in source order.
    const future = container.querySelector('[data-scaffold-role="future"]') as HTMLElement
    expect(future.getAttribute('data-unit-selectable')).toBe('')
    act(() => {
      future.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onSelectUnit).toHaveBeenCalledTimes(1)
    expect(onSelectUnit).toHaveBeenCalledWith(1)
  })

  it('does not select units when the scaffold is complete', () => {
    const onSelectUnit = vi.fn<(index: number) => void>()
    act(() => {
      root.render(
        <FileScaffold
          plain
          text={TWO_UNIT_TEXT}
          units={LEAVES_FIRST}
          unitIndex={1}
          loadToken={1}
          complete
          onSelectUnit={onSelectUnit}
        />,
      )
    })

    const done = container.querySelector('[data-scaffold-role="done"]') as HTMLElement
    expect(done.hasAttribute('data-unit-selectable')).toBe(false)
    act(() => {
      done.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onSelectUnit).not.toHaveBeenCalled()
  })
})
