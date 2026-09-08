import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, it, expect } from 'vitest'
import { resetCapture } from '../capture/capture'
import { db } from '../persistence/db'
import { listNewestFirst } from '../persistence/repository'
import { App } from './App'

// React-DOM + happy-dom end-to-end render test, mirroring
// CaptureSurface.test.tsx's conventions (trusted-event construction,
// nextFrame for the useCharLogTick-driven re-render).

function trustedInputEvent(type: string, init: InputEventInit = {}): InputEvent {
  const evt = new InputEvent(type, { bubbles: true, cancelable: true, ...init })
  Object.defineProperty(evt, 'isTrusted', { value: true, configurable: true })
  return evt
}

function beforeInputAt(el: HTMLElement, init: InputEventInit, tMs: number): InputEvent {
  const evt = trustedInputEvent('beforeinput', init)
  Object.defineProperty(evt, 'timeStamp', { value: tMs, configurable: true })
  el.dispatchEvent(evt)
  return evt
}

/** Standard React-testing trick: bypass React's tracked-value setter via the
 *  prototype's native setter, then dispatch a native `input` event so
 *  React's onChange fires with the new value (the controlled CorpusInput
 *  textarea otherwise never observes a direct `el.value = ...` assignment). */
function setControlledTextareaValue(el: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(async () => {
  resetCapture()
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

async function loadAndCompleteExercise(): Promise<void> {
  act(() => {
    root.render(<App />)
  })

  const pasteArea = container.querySelector<HTMLTextAreaElement>('#corpus-paste')!
  act(() => {
    setControlledTextareaValue(pasteArea, 'ab')
  })

  const loadButton = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent === 'Load exercise',
  )!

  await act(async () => {
    loadButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextFrame() // CorpusInput's handleLoad defers via requestAnimationFrame
  })

  const captureArea = container.querySelector<HTMLTextAreaElement>('#capture-surface')!

  // fromPaste() -> normalize() appends exactly one trailing "\n" (D-09), so
  // the pasted "ab" exercise text is actually "ab\n" (3 code points).
  beforeInputAt(captureArea, { inputType: 'insertText', data: 'a' }, 0)
  await act(async () => {
    await nextFrame()
  })

  beforeInputAt(captureArea, { inputType: 'insertText', data: 'b' }, 300)
  await act(async () => {
    await nextFrame()
  })

  beforeInputAt(captureArea, { inputType: 'insertLineBreak', data: '\n' }, 600)
  await act(async () => {
    await nextFrame()
  })
}

describe('App — completion persists exactly one row (PERS-01)', () => {
  it('renders the results panel synchronously and writes one row readable via listNewestFirst', async () => {
    await loadAndCompleteExercise()

    const panel = container.querySelector('.results-panel')
    expect(panel).not.toBeNull()

    const rows = await listNewestFirst()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.exercise.text).toBe('ab\n')
  })
})
