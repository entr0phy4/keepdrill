import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PASTE_LANGUAGE_OPTIONS } from '../ingestion/language-map'
import type { Exercise } from '../ingestion/types'
import { CorpusInput } from './CorpusInput'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

/** Bypass React's tracked-value setter so a native `input` event reaches onChange. */
function setControlledTextareaValue(el: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function setControlledSelectValue(el: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

let container: HTMLDivElement
let root: Root
let loaded: Exercise[]

beforeEach(() => {
  loaded = []
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

function renderCorpus(): void {
  act(() => {
    root.render(<CorpusInput onLoad={(exercise) => loaded.push(exercise)} />)
  })
}

function languageSelect(): HTMLSelectElement {
  return container.querySelector<HTMLSelectElement>('#corpus-paste-language')!
}

async function clickLoad(): Promise<void> {
  const loadButton = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent === 'Load exercise',
  )!
  await act(async () => {
    loadButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextFrame()
  })
}

describe('CorpusInput — paste language select (D-11/D-13/D-14)', () => {
  it('renders with plaintext selected on initial mount', () => {
    renderCorpus()
    const select = languageSelect()
    expect(select).not.toBeNull()
    expect(select.value).toBe('plaintext')
  })

  it('lists plaintext plus every PASTE_LANGUAGE_OPTIONS value, each once', () => {
    renderCorpus()
    const values = Array.from(languageSelect().querySelectorAll('option')).map((o) => o.value)
    expect(values[0]).toBe('plaintext')
    expect(values.slice(1)).toEqual([...PASTE_LANGUAGE_OPTIONS])
    expect(new Set(values).size).toBe(values.length)
  })

  it('loads pasted text as plaintext when the select is never touched', async () => {
    renderCorpus()
    const select = languageSelect()
    expect(select).not.toBeNull()
    expect(select.value).toBe('plaintext')
    const pasteArea = container.querySelector<HTMLTextAreaElement>('#corpus-paste')!
    act(() => {
      setControlledTextareaValue(pasteArea, 'const x = 1')
    })
    expect(select.value).toBe('plaintext')
    await clickLoad()
    expect(loaded).toHaveLength(1)
    expect(loaded[0]?.language).toBe('plaintext')
    expect(loaded[0]?.sourceType).toBe('paste')
  })

  it('passes the newly selected language into fromPaste on Load exercise', async () => {
    renderCorpus()
    const pasteArea = container.querySelector<HTMLTextAreaElement>('#corpus-paste')!
    act(() => {
      setControlledTextareaValue(pasteArea, 'def f():\n    return 1')
      setControlledSelectValue(languageSelect(), 'python')
    })
    await clickLoad()
    expect(loaded).toHaveLength(1)
    expect(loaded[0]?.language).toBe('python')
    expect(loaded[0]?.sourceType).toBe('paste')
  })

  it('never disables the select and Load exercise does not require touching it (D-14)', async () => {
    renderCorpus()
    const select = languageSelect()
    expect(select.disabled).toBe(false)
    const loadButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Load exercise',
    )!
    expect(loadButton?.disabled).toBe(false)

    const pasteArea = container.querySelector<HTMLTextAreaElement>('#corpus-paste')!
    act(() => {
      setControlledTextareaValue(pasteArea, 'hello')
    })
    await clickLoad()
    expect(loaded).toHaveLength(1)
    expect(loaded[0]?.language).toBe('plaintext')
  })

  it('does not let the select override the upload path language tag', async () => {
    renderCorpus()
    act(() => {
      setControlledSelectValue(languageSelect(), 'python')
    })

    const file = new File(['const x = 1\n'], 'main.ts', { type: 'text/plain' })
    const input = container.querySelector<HTMLInputElement>('#corpus-file')!
    Object.defineProperty(input, 'files', { configurable: true, value: [file] })

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
      await nextFrame()
    })

    expect(loaded).toHaveLength(1)
    expect(loaded[0]?.language).toBe('typescript')
    expect(loaded[0]?.sourceType).toBe('upload')
  })
})
