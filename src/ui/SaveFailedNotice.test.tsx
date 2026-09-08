import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SaveFailedNotice } from './SaveFailedNotice'

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

describe('SaveFailedNotice (D-15/D-16/D-17)', () => {
  it('renders role="status", the generic body text, and a dismiss button; clicking it calls onDismiss', () => {
    let calls = 0
    act(() => {
      root.render(<SaveFailedNotice onDismiss={() => (calls += 1)} />)
    })

    const notice = container.querySelector('[role="status"]')
    expect(notice).not.toBeNull()
    expect(notice?.textContent).toContain('This session couldn\u2019t be saved to your history.')

    const dismissButton = container.querySelector('button[aria-label="Dismiss notice"]')
    expect(dismissButton).not.toBeNull()

    act(() => {
      dismissButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(calls).toBe(1)
  })
})
