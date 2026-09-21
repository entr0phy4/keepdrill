import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { resetCapture, getCharLog } from '@/capture/capture'
import { db } from '@/persistence/db'
import { listNewestFirst } from '@/persistence/repository'
import type { FilePlan } from '@/parse/types'
import { App } from './App'

let capturedOnPlanned: ((plan: FilePlan) => void) | undefined

vi.mock('@/features/repo-browser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/repo-browser')>()
  function WrappedRepoBrowser(props: { onPlanned?: (plan: FilePlan) => void }) {
    capturedOnPlanned = props.onPlanned
    return actual.RepoBrowser(props)
  }
  return { RepoBrowser: WrappedRepoBrowser }
})

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

function trustedKeyEvent(type: string, init: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  const evt = new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init })
  Object.defineProperty(evt, 'isTrusted', { value: true, configurable: true })
  return evt
}

async function typeSlice(el: HTMLTextAreaElement, target: string, t0: number): Promise<void> {
  const chars = Array.from(target)
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!
    if (ch === '\n') {
      beforeInputAt(el, { inputType: 'insertLineBreak', data: '\n' }, t0 + i * 20)
    } else {
      beforeInputAt(el, { inputType: 'insertText', data: ch }, t0 + i * 20)
    }
    await act(async () => {
      await nextFrame()
    })
  }
}

async function waitForLiveQuery(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
      await nextFrame()
    })
  }
}

async function waitForHeading(text: string): Promise<void> {
  for (let i = 0; i < 20; i++) {
    if (container.querySelector('section[role="status"] h2')?.textContent === text) return
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
      await nextFrame()
    })
  }
}

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

function fallbackGithubPlan(): FilePlan {
  return {
    exercise: {
      text: 'function a() {}\n',
      language: 'typescript',
      sourceType: 'github',
      sourceRef: 'o/r:src/App.tsx',
    },
    units: [{ id: 'file', kind: 'file', start: 0, end: 16, dependsOn: [] }],
    fallback: true,
  }
}

function twoUnitGithubPlan(sourceRef = 'o/r:src/a.ts'): FilePlan {
  const text = 'function a() {}\nfunction b() {}\n'
  return {
    exercise: {
      text,
      language: 'typescript',
      sourceType: 'github',
      sourceRef,
    },
    units: [
      { id: 'b', kind: 'function', name: 'b', start: 16, end: 32, dependsOn: [] },
      { id: 'a', kind: 'function', name: 'a', start: 0, end: 16, dependsOn: [] },
    ],
    fallback: false,
  }
}

const EMPTY_BODY =
  'Paste code or text and choose Load exercise, or import a GitHub repo and click a TypeScript or JavaScript file to begin.'

beforeEach(async () => {
  capturedOnPlanned = undefined
  resetCapture()
  HTMLElement.prototype.scrollIntoView = vi.fn()
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
  it('exactly one of three nav buttons carries aria-current="page"; Analytics takes it when clicked', () => {
    act(() => {
      root.render(<App />)
    })

    const navButtons = Array.from(container.querySelectorAll('nav button'))
    expect(navButtons.map((b) => b.textContent)).toEqual(['Trainer', 'History', 'Analytics'])

    const trainerButton = navButtons[0]!
    const historyButton = navButtons[1]!
    const analyticsButton = navButtons[2]!

    expect(trainerButton.getAttribute('aria-current')).toBe('page')
    expect(historyButton.getAttribute('aria-current')).toBeNull()
    expect(analyticsButton.getAttribute('aria-current')).toBeNull()

    act(() => {
      historyButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(historyButton.getAttribute('aria-current')).toBe('page')
    expect(trainerButton.getAttribute('aria-current')).toBeNull()
    expect(analyticsButton.getAttribute('aria-current')).toBeNull()

    act(() => {
      analyticsButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(analyticsButton.getAttribute('aria-current')).toBe('page')
    expect(trainerButton.getAttribute('aria-current')).toBeNull()
    expect(historyButton.getAttribute('aria-current')).toBeNull()

    act(() => {
      trainerButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(trainerButton.getAttribute('aria-current')).toBe('page')
    expect(historyButton.getAttribute('aria-current')).toBeNull()
    expect(analyticsButton.getAttribute('aria-current')).toBeNull()
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
    await waitForHeading('History')
    expect(document.querySelector('#corpus-paste')).not.toBeNull()
    expect(document.querySelector('#github-url')).not.toBeNull()
    expect((container.querySelector('#corpus-panel-paste') as HTMLElement).parentElement!.style.display).toBe(
      'none',
    )

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

  it('typing, switching to Analytics, then back to Trainer preserves textarea identity and caret; CorpusInput stays mounted', async () => {
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

    const analyticsButton = Array.from(container.querySelectorAll('nav button')).find(
      (b) => b.textContent === 'Analytics',
    )!
    act(() => {
      analyticsButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const wrapper = captureAreaBefore.closest('div[style]') as HTMLElement
    expect(wrapper.style.display).toBe('none')
    await waitForHeading('Analytics')
    expect(document.querySelector('#corpus-paste')).not.toBeNull()
    expect(document.querySelector('#github-url')).not.toBeNull()
    expect((container.querySelector('#corpus-panel-paste') as HTMLElement).parentElement!.style.display).toBe(
      'none',
    )

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
    expect(captureAreaAfter).toBe(captureAreaBefore)
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

describe('App — Trainer-only Paste | GitHub corpus shell (D-01..D-04)', () => {
  it('selects Paste on first paint and keeps #corpus-paste in the Paste tabpanel', () => {
    act(() => {
      root.render(<App />)
    })

    const pasteTab = container.querySelector('#corpus-tab-paste')
    const githubTab = container.querySelector('#corpus-tab-github')
    expect(pasteTab?.getAttribute('aria-selected')).toBe('true')
    expect(githubTab?.getAttribute('aria-selected')).toBe('false')
    expect(container.querySelector('#corpus-panel-paste #corpus-paste')).not.toBeNull()
    expect((container.querySelector('#corpus-panel-paste') as HTMLElement).style.display).toBe('grid')
    expect((container.querySelector('#corpus-panel-github') as HTMLElement).style.display).toBe('none')
  })

  it('reveals #github-url on the GitHub tab and hides the Paste panel', () => {
    act(() => {
      root.render(<App />)
    })

    act(() => {
      container
        .querySelector('#corpus-tab-github')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect((container.querySelector('#corpus-panel-paste') as HTMLElement).style.display).toBe('none')
    expect((container.querySelector('#corpus-panel-github') as HTMLElement).style.display).toBe('grid')
    expect(container.querySelector('#github-url')).not.toBeNull()
    expect(container.querySelector('#corpus-tab-github')?.getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('#corpus-tab-paste')?.getAttribute('aria-selected')).toBe('false')
  })

  it('keeps paste text when switching to GitHub and back', () => {
    act(() => {
      root.render(<App />)
    })

    const pasteArea = container.querySelector<HTMLTextAreaElement>('#corpus-paste')!
    act(() => {
      setControlledTextareaValue(pasteArea, 'kept across tabs')
    })

    act(() => {
      container
        .querySelector('#corpus-tab-github')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    act(() => {
      container
        .querySelector('#corpus-tab-paste')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.querySelector<HTMLTextAreaElement>('#corpus-paste')?.value).toBe(
      'kept across tabs',
    )
  })

  it('does not persist the corpus tab in localStorage or cookies', () => {
    localStorage.clear()
    act(() => {
      root.render(<App />)
    })
    act(() => {
      container
        .querySelector('#corpus-tab-github')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    act(() => {
      container
        .querySelector('#corpus-tab-paste')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(localStorage.getItem('corpus-tab')).toBeNull()
    expect(localStorage.getItem('corpusTab')).toBeNull()
    const tabKeys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter(
      (key) => key !== null && /corpus/i.test(key),
    )
    expect(tabKeys).toEqual([])
    expect(document.cookie).not.toMatch(/corpus/i)
  })

  it('does not mount #capture-surface when switching to GitHub', () => {
    act(() => {
      root.render(<App />)
    })
    act(() => {
      container
        .querySelector('#corpus-tab-github')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('#capture-surface')).toBeNull()
    expect(container.textContent).toContain('Paste code')
    expect(container.textContent).toContain('Load exercise')
  })

  it('empty state names the GitHub door verbatim', () => {
    act(() => {
      root.render(<App />)
    })
    expect(container.querySelector('h2')?.textContent).toBe('No exercise loaded')
    expect(container.textContent).toContain(EMPTY_BODY)
  })
})

describe('App — startScaffold onPlanned (D-07, D-09, D-10, SCAF-01, SCAF-05)', () => {
  it('starts typing immediately on a fallback FilePlan with a 1 / 1 landmark', () => {
    act(() => {
      root.render(<App />)
    })
    expect(typeof capturedOnPlanned).toBe('function')

    act(() => {
      capturedOnPlanned!(fallbackGithubPlan())
    })

    expect(container.querySelector('#capture-surface')).not.toBeNull()
    expect(container.textContent).toContain('1 / 1')
    expect(container.textContent).not.toContain(EMPTY_BODY)
    expect(container.querySelector('#corpus-panel-github')?.getAttribute('data-file-plan')).toBe(
      'true',
    )
  })

  it('puts the first curriculum slice into CaptureSurface, not the full two-unit file', () => {
    act(() => {
      root.render(<App />)
    })
    act(() => {
      capturedOnPlanned!(twoUnitGithubPlan())
    })

    const overlay = container.querySelector('[data-scaffold-current] .trainer-rendered-layer')
    expect(overlay?.textContent).toContain('function·b()·{}')
    expect(overlay?.textContent).not.toContain('function·a()·{}')
    expect(container.textContent).toContain('1 / 2')
  })

  it('handleLoad after a scaffold unmounts FileScaffold and mounts whole-file CaptureSurface', async () => {
    act(() => {
      root.render(<App />)
    })
    act(() => {
      capturedOnPlanned!(twoUnitGithubPlan())
    })
    expect(container.querySelector('[data-scaffold-current]')).not.toBeNull()

    act(() => {
      container
        .querySelector('#corpus-tab-paste')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const pasteArea = container.querySelector<HTMLTextAreaElement>('#corpus-paste')!
    act(() => {
      setControlledTextareaValue(pasteArea, 'hello')
    })
    const loadButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Load exercise',
    )!
    await act(async () => {
      loadButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextFrame()
    })

    expect(container.querySelector('[data-scaffold-current]')).toBeNull()
    expect(container.querySelector('#capture-surface')).not.toBeNull()
    const overlay = container.querySelector('.trainer-rendered-layer')
    expect(overlay?.textContent).toContain('hello')
    expect(overlay?.textContent).not.toContain('function·b')
  })

  it('switching Paste | GitHub tabs does not clear an in-progress scaffold', () => {
    act(() => {
      root.render(<App />)
    })
    act(() => {
      capturedOnPlanned!(fallbackGithubPlan())
    })
    expect(container.querySelector('#capture-surface')).not.toBeNull()

    act(() => {
      container
        .querySelector('#corpus-tab-paste')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    act(() => {
      container
        .querySelector('#corpus-tab-github')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.querySelector('#capture-surface')).not.toBeNull()
    expect(container.textContent).toContain('1 / 1')
  })

  it('a second onPlanned replaces the first: landmark returns to 1 / M of the new plan', () => {
    act(() => {
      root.render(<App />)
    })
    act(() => {
      capturedOnPlanned!(twoUnitGithubPlan())
    })
    expect(container.textContent).toContain('1 / 2')

    act(() => {
      capturedOnPlanned!(fallbackGithubPlan())
    })

    expect(container.textContent).toContain('1 / 1')
    expect(container.textContent).not.toContain('1 / 2')
  })

  it('hides the trainer with display none on History, never the hidden attribute', () => {
    act(() => {
      root.render(<App />)
    })
    act(() => {
      capturedOnPlanned!(fallbackGithubPlan())
    })
    const capture = container.querySelector<HTMLTextAreaElement>('#capture-surface')!
    expect(capture.hasAttribute('hidden')).toBe(false)

    const historyButton = Array.from(container.querySelectorAll('nav button')).find(
      (b) => b.textContent === 'History',
    )!
    act(() => {
      historyButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    let el: HTMLElement | null = capture
    let hiddenWrapper: HTMLElement | null = null
    while (el) {
      if (el.style.display === 'none') {
        hiddenWrapper = el
        break
      }
      el = el.parentElement
    }
    expect(hiddenWrapper).not.toBeNull()
    expect(hiddenWrapper!.hasAttribute('hidden')).toBe(false)
    expect(container.querySelector('#capture-surface')).toBe(capture)
    expect(document.body.querySelector('[hidden]')).toBeNull()
  })
})

const UNIT_B = 'function b() {}\n'
const UNIT_A = 'function a() {}\n'
const TWO_UNIT_FILE = 'function a() {}\nfunction b() {}\n'

describe('App — unit advance, persist, restart (D-12, D-14, D-16, D-18, SCAF-02..04)', () => {
  it('completing unit 0 does not persist or show results; landmark becomes 2 / 2', async () => {
    act(() => {
      root.render(<App />)
    })
    act(() => {
      capturedOnPlanned!(twoUnitGithubPlan())
    })
    expect(container.textContent).toContain('Restart unit')

    await typeSlice(container.querySelector<HTMLTextAreaElement>('#capture-surface')!, UNIT_B, 0)

    expect(await listNewestFirst()).toHaveLength(0)
    expect(container.querySelector('.results-panel')).toBeNull()
    expect(container.textContent).toContain('2 / 2')
    const overlay = container.querySelector('[data-scaffold-current] .trainer-rendered-layer')
    expect(overlay?.textContent).toContain('function·a()·{}')
    expect(overlay?.textContent).not.toContain('function·b()·{}')
  })

  it('Escape after unit 0 keeps unitIndex at 1 and does not persist', async () => {
    act(() => {
      root.render(<App />)
    })
    act(() => {
      capturedOnPlanned!(twoUnitGithubPlan())
    })
    await typeSlice(container.querySelector<HTMLTextAreaElement>('#capture-surface')!, UNIT_B, 0)

    const capture = container.querySelector<HTMLTextAreaElement>('#capture-surface')!
    act(() => {
      capture.dispatchEvent(trustedKeyEvent('keydown', { key: 'Escape' }))
    })
    await act(async () => {
      await nextFrame()
    })

    expect(container.textContent).toContain('2 / 2')
    const overlay = container.querySelector('[data-scaffold-current] .trainer-rendered-layer')
    expect(overlay?.textContent).toContain('function·a()·{}')
    expect(overlay?.textContent).not.toContain('function·b()·{}')
    expect(await listNewestFirst()).toHaveLength(0)
  })

  it('Restart unit remounts the current slice and keeps completed snapshots', async () => {
    act(() => {
      root.render(<App />)
    })
    act(() => {
      capturedOnPlanned!(twoUnitGithubPlan())
    })
    await typeSlice(container.querySelector<HTMLTextAreaElement>('#capture-surface')!, UNIT_B, 0)

    const restart = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Restart unit',
    )!
    act(() => {
      restart.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      await nextFrame()
    })

    expect(container.textContent).toContain('2 / 2')
    const overlay = container.querySelector('[data-scaffold-current] .trainer-rendered-layer')
    expect(overlay?.textContent).toContain('function·a()·{}')
    expect(await listNewestFirst()).toHaveLength(0)
  })

  it('last unit persist writes one github History row with full file text and both slices', async () => {
    act(() => {
      root.render(<App />)
    })
    act(() => {
      capturedOnPlanned!(twoUnitGithubPlan('o/r:src/a.ts'))
    })
    await typeSlice(container.querySelector<HTMLTextAreaElement>('#capture-surface')!, UNIT_B, 0)
    await typeSlice(container.querySelector<HTMLTextAreaElement>('#capture-surface')!, UNIT_A, 400)

    expect(container.querySelector('.results-panel')).not.toBeNull()
    expect(container.querySelector('#capture-surface')).toBeNull()
    expect(Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Restart unit')).toBeUndefined()
    expect(Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Restart exercise')).toBeUndefined()

    const rows = await listNewestFirst()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.exercise.text).toBe(TWO_UNIT_FILE)
    expect(rows[0]?.exercise.sourceType).toBe('github')
    expect(rows[0]?.exercise.sourceRef).toBe('o/r:src/a.ts')
    const datas = (rows[0]?.charLog ?? []).map((c) => c.data).join('')
    expect(datas).toContain('b')
    expect(datas).toContain('a')
  })

  it('after scaffold persist, History shows sourceRef and not Pasted snippet', async () => {
    act(() => {
      root.render(<App />)
    })
    act(() => {
      capturedOnPlanned!(twoUnitGithubPlan('o/r:src/a.ts'))
    })
    await typeSlice(container.querySelector<HTMLTextAreaElement>('#capture-surface')!, UNIT_B, 0)
    await typeSlice(container.querySelector<HTMLTextAreaElement>('#capture-surface')!, UNIT_A, 400)

    const historyButton = Array.from(container.querySelectorAll('nav button')).find(
      (b) => b.textContent === 'History',
    )!
    act(() => {
      historyButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await waitForLiveQuery()

    expect(container.textContent).toContain('o/r:src/a.ts')
    expect(container.textContent).not.toContain('Pasted snippet')
  })

  it('does not write a second History row after last-unit persist', async () => {
    act(() => {
      root.render(<App />)
    })
    act(() => {
      capturedOnPlanned!(twoUnitGithubPlan())
    })
    await typeSlice(container.querySelector<HTMLTextAreaElement>('#capture-surface')!, UNIT_B, 0)
    await typeSlice(container.querySelector<HTMLTextAreaElement>('#capture-surface')!, UNIT_A, 400)

    expect(await listNewestFirst()).toHaveLength(1)
    document.body.dispatchEvent(trustedKeyEvent('keydown', { key: 'Escape' }))
    await act(async () => {
      await nextFrame()
    })
    expect(await listNewestFirst()).toHaveLength(1)
  })

  it('paste path still persists one row and shows Restart exercise', async () => {
    await loadAndCompleteExercise()
    expect(await listNewestFirst()).toHaveLength(1)
    expect(container.querySelector('.results-panel')).not.toBeNull()
    expect(
      Array.from(container.querySelectorAll('button')).some((b) => b.textContent === 'Restart exercise'),
    ).toBe(true)
  })
})
