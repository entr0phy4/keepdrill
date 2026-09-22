import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { foldTree } from '@/github/tree'
import type { FileNode, GitTreeEntry } from '@/github/types'
import { RepoTree } from './RepoTree'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ENTRIES: GitTreeEntry[] = [
  { path: 'src', type: 'tree', sha: 'abc' },
  { path: 'src/nested', type: 'tree', sha: 'nest' },
  { path: 'src/nested/util.ts', type: 'blob', sha: 'util' },
  { path: 'src/App.tsx', type: 'blob', sha: 'def', size: 120 },
  { path: 'README.md', type: 'blob', sha: 'ghi', size: 50 },
]

function fileButton(container: HTMLElement, name: string): HTMLButtonElement {
  return Array.from(container.querySelectorAll('.repo-tree button')).find(
    (b) => b.textContent === name,
  ) as HTMLButtonElement
}

describe('RepoTree', () => {
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

  it('renders a nested disclosure tree with the top-level folder open', () => {
    act(() => {
      root.render(<RepoTree nodes={foldTree(ENTRIES)} onFileClick={() => undefined} />)
    })

    expect(container.querySelector('[aria-label="Repository files"]')).not.toBeNull()

    const src = Array.from(container.querySelectorAll('details')).find(
      (el) => el.querySelector('summary')?.textContent === 'src',
    )
    expect(src?.hasAttribute('open')).toBe(true)

    const nested = Array.from(container.querySelectorAll('details')).find(
      (el) => el.querySelector('summary')?.textContent === 'nested',
    )
    expect(nested?.hasAttribute('open')).toBe(false)

    expect(fileButton(container, 'README.md').classList.contains('text-muted')).toBe(true)
    expect(fileButton(container, 'App.tsx').classList.contains('text-muted')).toBe(false)
  })

  it('marks the selected file and notifies on click', () => {
    const onFileClick = vi.fn<(node: FileNode) => void>()
    act(() => {
      root.render(
        <RepoTree nodes={foldTree(ENTRIES)} selectedPath="src/App.tsx" onFileClick={onFileClick} />,
      )
    })

    const app = fileButton(container, 'App.tsx')
    expect(app.getAttribute('aria-current')).toBe('true')
    expect(fileButton(container, 'README.md').getAttribute('aria-current')).toBeNull()

    act(() => {
      app.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onFileClick).toHaveBeenCalledTimes(1)
    expect(onFileClick.mock.calls[0]![0].path).toBe('src/App.tsx')
  })
})
