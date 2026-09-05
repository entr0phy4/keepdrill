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

  it('an untrusted (script-dispatched) Escape keydown does not call onRestartRequested (WR-2, T-02-09)', () => {
    let calls = 0
    const spy = () => {
      calls += 1
    }

    act(() => {
      root.render(<CaptureSurface text="ab" onRestartRequested={spy} />)
    })

    const textarea = container.querySelector('textarea')!
    textarea.focus()

    // Plain `new KeyboardEvent(...)` (NOT wrapped by trustedKeyEvent/keyDown)
    // defaults isTrusted to false — exactly what an untrusted-event
    // regression test needs, with no new helper required.
    act(() => {
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))
    })

    expect(calls).toBe(0)
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

// Gap closure (02-VERIFICATION.md gap #1 / 02-REVIEW.md WR-1, T-02-08): the
// caret-resync effect (D-10/T-02-04) was previously keyed on `[cursor]`
// alone, so it never corrected native-selection drift from ArrowLeft/Right/
// Home/End/click — none of which change `cursor` or trigger any other
// re-render. happy-dom has no layout engine and does not implement real
// arrow-key/click-driven text-selection navigation, so drift is reproduced
// directly by assigning selectionStart/selectionEnd (mirroring this suite's
// existing convention of hand-dispatching events rather than relying on
// browser-native editing behavior). React 19's onSelect prop is a polyfill
// dispatched from focusout/contextmenu/dragend/focusin/keydown/keyup/
// mousedown/mouseup/selectionchange (registered on `document`), NOT from a
// native "select" event on the element — so the test fires a native
// `selectionchange` event on `document` (which is exactly what a real
// browser fires after ArrowLeft/Right/Home/End/click drift) to trigger it.
//
// happy-dom also does not implement `beforeinput`'s native default action
// (it never mutates `textarea.value` on dispatch, unlike a real browser), so
// `textarea.selectionStart`/`selectionEnd` would otherwise stay clamped to 0
// (a selection index can never exceed `value.length`). The production code
// never reads `textarea.value` (CaptureSurface's overlay renders purely from
// `computeTrainerState(text, getCharLog())` — D-01/D-02), so setting
// `textarea.value` directly in these tests is a test-environment-only
// workaround to make non-zero `selectionStart`/`selectionEnd` assignments
// observable; it does not touch any code path these tests are verifying.
describe('CaptureSurface — caret resync on selection drift (gap closure, T-02-04)', () => {
  it('a native "selectionchange" event after selectionStart/selectionEnd drift resyncs them back to cursor synchronously (no rAF wait)', async () => {
    act(() => {
      root.render(<CaptureSurface text="ab" />)
    })

    const textarea = container.querySelector('textarea')! as HTMLTextAreaElement
    // happy-dom workaround (see describe-block comment) — lets
    // selectionStart/selectionEnd hold a non-zero value below.
    textarea.value = 'ab'

    // Commit "a" so cursor advances to 1 and the post-commit effect resyncs
    // native selection to 1.
    beforeInput(textarea, { inputType: 'insertText', data: 'a' })

    await act(async () => {
      await nextFrame()
    })

    expect(textarea.selectionStart).toBe(1)
    expect(textarea.selectionEnd).toBe(1)

    // Simulate ArrowLeft/click drift with no accompanying cursor change:
    // manually move native selection to 0.
    act(() => {
      textarea.selectionStart = 0
      textarea.selectionEnd = 0
      document.dispatchEvent(new Event('selectionchange', { bubbles: true }))
    })

    // No nextFrame()/act(async ...) wait here — the fix must resync
    // synchronously inside React's onSelect dispatch, independent of any
    // cursor-driven render.
    expect(textarea.selectionStart).toBe(1)
    expect(textarea.selectionEnd).toBe(1)
  })

  it('a delete-type commit after a drift-and-resync sequence still reopens the correct logical position to pending', async () => {
    act(() => {
      root.render(<CaptureSurface text="ab" />)
    })

    const textarea = container.querySelector('textarea')! as HTMLTextAreaElement
    // happy-dom workaround (see describe-block comment).
    textarea.value = 'ab'

    beforeInput(textarea, { inputType: 'insertText', data: 'a' })

    await act(async () => {
      await nextFrame()
    })

    expect(container.querySelector('[data-status="correct"]')?.textContent).toBe('a')

    // Drift-and-resync sequence.
    act(() => {
      textarea.selectionStart = 0
      textarea.selectionEnd = 0
      document.dispatchEvent(new Event('selectionchange', { bubbles: true }))
    })

    expect(textarea.selectionStart).toBe(1)
    expect(textarea.selectionEnd).toBe(1)

    beforeInput(textarea, { inputType: 'deleteContentBackward', data: null })

    await act(async () => {
      await nextFrame()
    })

    const caret = container.querySelector('.trainer-caret')
    expect(caret?.nextElementSibling?.getAttribute('data-status')).toBe('pending')
    expect(caret?.nextElementSibling?.textContent).toBe('a')
  })
})
