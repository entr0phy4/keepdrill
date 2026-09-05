import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, it, expect } from 'vitest'
import { resetCapture } from '../capture/capture'
import { CaptureSurface } from './CaptureSurface'

// React-DOM + happy-dom end-to-end render test — proves the tracer's single
// happy path (load "ab", type "a" correctly) without manual verification.
// Reuses the exact trusted-event-construction convention already established
// in src/capture/capture.test.ts (isTrusted forced via Object.defineProperty).

function trustedInputEvent(type: string, init: InputEventInit = {}): InputEvent {
  const evt = new InputEvent(type, { bubbles: true, cancelable: true, ...init })
  Object.defineProperty(evt, 'isTrusted', { value: true, configurable: true })
  return evt
}

function beforeInput(el: HTMLElement, init: InputEventInit = {}): InputEvent {
  const evt = trustedInputEvent('beforeinput', init)
  el.dispatchEvent(evt)
  return evt
}

// React 19's act() requires this flag set outside of jest/testing-library
// environments (happy-dom + Vitest here).
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** Waits for one requestAnimationFrame tick — the trainer's useCharLogTick
 *  hook (D-13) re-renders on rAF, not synchronously with the DOM event. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  resetCapture()
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

describe('CaptureSurface — tracer end-to-end (TYPE-01)', () => {
  it('a trusted beforeinput commit renders correct/pending status and advances the caret', async () => {
    act(() => {
      root.render(<CaptureSurface text="ab" />)
    })

    const textarea = container.querySelector('textarea')
    expect(textarea).not.toBeNull()

    beforeInput(textarea!, { inputType: 'insertText', data: 'a' })

    // The trainer re-renders on the next rAF tick (useCharLogTick, D-13), not
    // synchronously with the beforeinput event.
    await act(async () => {
      await nextFrame()
    })

    const firstSpan = container.querySelector('[data-status="correct"]')
    expect(firstSpan?.textContent).toBe('a')

    const rendered = container.querySelector('.trainer-rendered-layer')
    expect(rendered).not.toBeNull()
    const caret = rendered!.querySelector('.trainer-caret')
    expect(caret).not.toBeNull()
    expect(caret?.nextElementSibling?.textContent).toBe('b')
    expect(caret?.nextElementSibling?.getAttribute('data-status')).toBe('pending')
  })
})
