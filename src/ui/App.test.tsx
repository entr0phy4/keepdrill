import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, it, expect } from 'vitest'
import { resetCapture, getCharLog } from '../capture/capture'
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

describe('App — view toggle single-active invariant (04-UI-SPEC.md H1)', () => {
  it('exactly one nav toggle button carries aria-current="page", flipping between Trainer and History', () => {
    act(() => {
      root.render(<App />)
    })

    const trainerButton = Array.from(container.querySelectorAll('nav button')).find(
      (b) => b.textContent === 'Trainer',
    )!
    const historyButton = Array.from(container.querySelectorAll('nav button')).find(
      (b) => b.textContent === 'History',
    )!

    expect(trainerButton.getAttribute('aria-current')).toBe('page')
    expect(historyButton.getAttribute('aria-current')).toBeNull()

    act(() => {
      historyButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(historyButton.getAttribute('aria-current')).toBe('page')
    expect(trainerButton.getAttribute('aria-current')).toBeNull()

    act(() => {
      trainerButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(trainerButton.getAttribute('aria-current')).toBe('page')
    expect(historyButton.getAttribute('aria-current')).toBeNull()
  })
})

describe('App — D-08 hide-not-unmount contract across a view switch', () => {
  it('typing, switching to History, then back to Trainer preserves charLog length, per-char status, textarea identity, and caret index', async () => {
    act(() => {
      root.render(<App />)
    })

    const pasteArea = container.querySelector<HTMLTextAreaElement>('#corpus-paste')!
    act(() => {
      setControlledTextareaValue(pasteArea, 'abcdef')
    })

    const loadButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Load exercise',
    )!
    await act(async () => {
      loadButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextFrame()
    })

    const captureAreaBefore = container.querySelector<HTMLTextAreaElement>('#capture-surface')!

    // Type "a", "x" (wrong), delete, "b" — one correction, mirroring the
    // human-check script (RESEARCH Open Question 1).
    beforeInputAt(captureAreaBefore, { inputType: 'insertText', data: 'a' }, 0)
    await act(async () => {
      await nextFrame()
    })
    beforeInputAt(captureAreaBefore, { inputType: 'insertText', data: 'x' }, 100)
    await act(async () => {
      await nextFrame()
    })
    beforeInputAt(captureAreaBefore, { inputType: 'deleteContentBackward', data: null }, 200)
    await act(async () => {
      await nextFrame()
    })
    beforeInputAt(captureAreaBefore, { inputType: 'insertText', data: 'b' }, 300)
    await act(async () => {
      await nextFrame()
    })

    const charLogLengthBefore = getCharLog().length
    const statusesBefore = Array.from(
      container.querySelectorAll('.trainer-rendered-layer [data-status]'),
    ).map((el) => el.getAttribute('data-status'))
    const caretIndexBefore = Array.from(
      container.querySelectorAll('.trainer-rendered-layer > *'),
    ).findIndex((el) => el.classList.contains('trainer-caret'))

    const historyButton = Array.from(container.querySelectorAll('nav button')).find(
      (b) => b.textContent === 'History',
    )!
    act(() => {
      historyButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // The wrapper's computed display is 'none'; HistoryView markup is present.
    const wrapper = captureAreaBefore.closest('div[style]') as HTMLElement
    expect(wrapper.style.display).toBe('none')
    expect(container.querySelector('section[role="status"] h2')?.textContent).toBe('History')

    const trainerButton = Array.from(container.querySelectorAll('nav button')).find(
      (b) => b.textContent === 'Trainer',
    )!
    act(() => {
      trainerButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const captureAreaAfter = container.querySelector<HTMLTextAreaElement>('#capture-surface')!
    const statusesAfter = Array.from(
      container.querySelectorAll('.trainer-rendered-layer [data-status]'),
    ).map((el) => el.getAttribute('data-status'))
    const caretIndexAfter = Array.from(
      container.querySelectorAll('.trainer-rendered-layer > *'),
    ).findIndex((el) => el.classList.contains('trainer-caret'))

    expect(getCharLog().length).toBe(charLogLengthBefore)
    expect(statusesAfter).toEqual(statusesBefore)
    expect(captureAreaAfter).toBe(captureAreaBefore) // same DOM node — no remount
    expect(caretIndexAfter).toBe(caretIndexBefore)
  })
})

describe('App — save-failure notice (PERS-03, D-15/D-16/D-17)', () => {
  it('renders the results panel synchronously even when the persistence write rejects, then shows a dismissible notice', async () => {
    // Force the write to reject by closing the DB connection before completion.
    await db.close()

    await loadAndCompleteExercise()

    // The results panel is present synchronously — the write's outcome never
    // gates it (D-04).
    const panel = container.querySelector('.results-panel')
    expect(panel).not.toBeNull()

    const notice = container.querySelector('[role="status"].save-failed-notice')
    expect(notice).not.toBeNull()

    const dismissButton = container.querySelector('button[aria-label="Dismiss notice"]')
    expect(dismissButton).not.toBeNull()

    act(() => {
      dismissButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.querySelector('.save-failed-notice')).toBeNull()

    await db.open()
  })

  it('restarting the exercise clears a save-failure notice', async () => {
    await db.close()
    await loadAndCompleteExercise()

    expect(container.querySelector('.save-failed-notice')).not.toBeNull()

    await db.open()

    const restartButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Restart exercise',
    )!
    act(() => {
      restartButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.querySelector('.save-failed-notice')).toBeNull()
  })
})
