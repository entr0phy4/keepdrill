import { useState } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, it, expect } from 'vitest'
import { resetCapture, getCharLog } from '../capture/capture'
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

// Matches src/capture/capture.test.ts's trusted-keyboard-event convention.
function trustedKeyEvent(type: string, init: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  const evt = new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init })
  Object.defineProperty(evt, 'isTrusted', { value: true, configurable: true })
  return evt
}

function keyDown(el: HTMLElement, init: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  const evt = trustedKeyEvent('keydown', init)
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

describe('CaptureSurface — whitespace glyphs (TYPE-04, D-06 amended)', () => {
  it('a space target renders a .ws-glyph middle dot inside its status span', () => {
    act(() => {
      root.render(<CaptureSurface text="a b" />)
    })

    const spans = container.querySelectorAll('.trainer-rendered-layer [data-status]')
    // index 1 is the space target character.
    const spaceSpan = spans[1]
    expect(spaceSpan?.querySelector('.ws-glyph')?.textContent).toBe('·')
  })

  it('an incorrectly-typed space keeps the incorrect background/underline on the outer span, dimming only .ws-glyph', async () => {
    act(() => {
      root.render(<CaptureSurface text=" " />)
    })

    const textarea = container.querySelector('textarea')!
    beforeInput(textarea, { inputType: 'insertText', data: 'x' })

    await act(async () => {
      await nextFrame()
    })

    const incorrectSpan = container.querySelector('[data-status="incorrect"]')
    expect(incorrectSpan).not.toBeNull()
    expect(incorrectSpan?.querySelector('.ws-glyph')?.textContent).toBe('·')
  })
})

// Task 1 (D-08): a minimal harness mirroring App.tsx's restart wiring — a
// remount token bumped by handleRestart, exactly like App's loadToken — so
// this test proves the same "same exercise, fresh session" contract without
// depending on App.tsx's other concerns (banners, corpus input, sessionRef).
function RestartHarness({ text }: { text: string }) {
  const [token, setToken] = useState(0)
  const handleRestart = () => {
    resetCapture()
    setToken((t) => t + 1)
  }
  return (
    <div>
      <CaptureSurface key={token} text={text} onRestartRequested={handleRestart} />
      <button type="button" className="primary" onClick={handleRestart}>
        Restart exercise
      </button>
    </div>
  )
}

describe('CaptureSurface — Restart control (TYPE-05, D-08)', () => {
  it('clicking Restart resets all character spans to pending and moves the caret back to index 0', async () => {
    act(() => {
      root.render(<RestartHarness text="ab" />)
    })

    const textarea = container.querySelector('textarea')!
    beforeInput(textarea, { inputType: 'insertText', data: 'a' })

    await act(async () => {
      await nextFrame()
    })

    expect(container.querySelector('[data-status="correct"]')).not.toBeNull()

    const restartButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Restart exercise',
    )!
    expect(restartButton).toBeDefined()

    act(() => {
      restartButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await act(async () => {
      await nextFrame()
    })

    const statuses = container.querySelectorAll('.trainer-rendered-layer [data-status]')
    expect(statuses.length).toBe(2)
    statuses.forEach((span) => expect(span.getAttribute('data-status')).toBe('pending'))

    const caret = container.querySelector('.trainer-caret')
    expect(caret).not.toBeNull()
    expect(caret?.nextElementSibling?.getAttribute('data-status')).toBe('pending')
    expect(caret?.nextElementSibling?.textContent).toBe('a')
  })
})

describe('CaptureSurface — Tab no-op + Escape restart + caret active state (TYPE-04/05/06, D-07 amended)', () => {
  it('Tab keydown leaves focus and the char log unchanged (D-07 amended)', () => {
    act(() => {
      root.render(<CaptureSurface text="ab" />)
    })

    const textarea = container.querySelector('textarea')!
    textarea.focus()
    expect(document.activeElement).toBe(textarea)

    const lengthBefore = getCharLog().length

    act(() => {
      keyDown(textarea, { key: 'Tab', code: 'Tab' })
    })

    expect(document.activeElement).toBe(textarea)
    expect(getCharLog().length).toBe(lengthBefore)
  })

  it('Escape keydown calls the supplied onRestartRequested spy exactly once', () => {
    let calls = 0
    const spy = () => {
      calls += 1
    }

    act(() => {
      root.render(<CaptureSurface text="ab" onRestartRequested={spy} />)
    })

    const textarea = container.querySelector('textarea')!
    textarea.focus()

    act(() => {
      keyDown(textarea, { key: 'Escape', code: 'Escape' })
    })

    expect(calls).toBe(1)
  })

  it('Escape keydown without onRestartRequested supplied does not throw', () => {
    act(() => {
      root.render(<CaptureSurface text="ab" />)
    })

    const textarea = container.querySelector('textarea')!
    textarea.focus()

    expect(() => {
      act(() => {
        keyDown(textarea, { key: 'Escape', code: 'Escape' })
      })
    }).not.toThrow()
  })

  it('a blur event on the textarea flips .trainer-caret to data-active="false"', () => {
    act(() => {
      root.render(<CaptureSurface text="ab" />)
    })

    const textarea = container.querySelector('textarea')!

    // React 17+ delegates blur via the bubbling 'focusout' event (native
    // 'blur' does not bubble), so 'focusout' is what must be dispatched to
    // exercise the onBlur synthetic handler in this DOM-event-driven test.
    act(() => {
      textarea.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })

    const caret = container.querySelector('.trainer-caret')
    expect(caret?.getAttribute('data-active')).toBe('false')
  })
})
