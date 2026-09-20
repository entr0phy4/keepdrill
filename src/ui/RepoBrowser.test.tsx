import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EmptyRepoError,
  GithubHttpError,
  RateLimitedError,
  RepoNotFoundError,
} from '../github/errors'
import type { GitTreeEntry, RepoTreeResult } from '../github/types'
import { RepoBrowser } from './RepoBrowser'

const { fetchRepoTree } = vi.hoisted(() => ({
  fetchRepoTree: vi.fn(),
}))

vi.mock('../github/client', () => ({
  fetchRepoTree,
}))

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const COPY = {
  invalidUrl: 'Paste a GitHub URL or owner/repo.',
  notFound: 'No public GitHub repository matches that URL.',
  rateLimitedUnknown: 'GitHub rate-limited this browser. Try again in a few minutes.',
  otherHttp: 'GitHub refused this request. Try again later.',
  unreachable: "Couldn't reach GitHub. Check the connection and try again.",
  truncated: 'GitHub returned a partial file list (repository too large). Showing what arrived.',
  blocked: "This file can't be split yet. No exercise loaded.",
  notYet:
    'TypeScript/JavaScript files open as scaffolded exercises in the next step. Browsing only for now.',
  emptyRepo: 'This repository has no files on the default branch.',
} as const

const NESTED_ENTRIES: GitTreeEntry[] = [
  { path: 'src', type: 'tree', sha: 'abc' },
  { path: 'src/nested', type: 'tree', sha: 'nest' },
  { path: 'src/nested/util.ts', type: 'blob', sha: 'util' },
  { path: 'src/App.tsx', type: 'blob', sha: 'def', size: 120 },
  { path: 'README.md', type: 'blob', sha: 'ghi', size: 50 },
  { path: 'index.mjs', type: 'blob', sha: 'mjs' },
]

function treeResult(overrides: Partial<RepoTreeResult> = {}): RepoTreeResult {
  return {
    owner: 'o',
    repo: 'r',
    defaultBranch: 'main',
    sha: 'sha1',
    entries: NESTED_ENTRIES,
    truncated: false,
    ...overrides,
  }
}

function setControlledInputValue(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  fetchRepoTree.mockReset()
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

function renderBrowser(): void {
  act(() => {
    root.render(<RepoBrowser />)
  })
}

function urlInput(): HTMLInputElement {
  return container.querySelector<HTMLInputElement>('#github-url')!
}

function statusRegion(): HTMLElement {
  return container.querySelector('.repo-status')!
}

async function importValue(value: string): Promise<void> {
  act(() => {
    setControlledInputValue(urlInput(), value)
  })
  const form = urlInput().closest('form')!
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('RepoBrowser — import form and locked copy', () => {
  it('shows invalid-URL alert and does not call fetchRepoTree for gist, gitlab, or whitespace', async () => {
    renderBrowser()

    for (const value of ['https://gist.github.com/owner/abc', 'https://gitlab.com/owner/repo', '   ']) {
      fetchRepoTree.mockClear()
      await importValue(value)
      const alert = container.querySelector('[role="alert"]')
      expect(alert?.textContent).toBe(COPY.invalidUrl)
      expect(urlInput().getAttribute('aria-invalid')).toBe('true')
      expect(fetchRepoTree).not.toHaveBeenCalled()
    }
  })

  it('renders caption, open top-level folder, muted README, and full-color App.tsx on success', async () => {
    fetchRepoTree.mockResolvedValue(treeResult())
    renderBrowser()
    await importValue('o/r')

    expect(container.querySelector('.repo-caption')?.textContent).toBe('o/r@main')
    const srcDetails = Array.from(container.querySelectorAll('details')).find((el) =>
      el.querySelector('summary')?.textContent === 'src',
    )
    expect(srcDetails).toBeDefined()
    expect(srcDetails?.hasAttribute('open')).toBe(true)

    const nestedDetails = Array.from(container.querySelectorAll('details')).find((el) =>
      el.querySelector('summary')?.textContent === 'nested',
    )
    expect(nestedDetails).toBeDefined()
    expect(nestedDetails?.hasAttribute('open')).toBe(false)

    const readme = Array.from(container.querySelectorAll('.repo-tree button')).find(
      (b) => b.textContent === 'README.md',
    )!
    expect(readme.classList.contains('text-muted')).toBe(true)

    const app = Array.from(container.querySelectorAll('.repo-tree button')).find(
      (b) => b.textContent === 'App.tsx',
    )!
    expect(app.classList.contains('text-muted')).toBe(false)
  })

  it('shows blocked copy on README.md click and not-yet copy on App.tsx click', async () => {
    fetchRepoTree.mockResolvedValue(treeResult())
    renderBrowser()
    await importValue('o/r')

    const readme = Array.from(container.querySelectorAll('.repo-tree button')).find(
      (b) => b.textContent === 'README.md',
    )!
    act(() => {
      readme.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(statusRegion().getAttribute('role')).toBe('status')
    expect(statusRegion().textContent).toBe(COPY.blocked)

    const app = Array.from(container.querySelectorAll('.repo-tree button')).find(
      (b) => b.textContent === 'App.tsx',
    )!
    act(() => {
      app.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(statusRegion().getAttribute('role')).toBe('status')
    expect(statusRegion().textContent).toBe(COPY.notYet)
    expect(COPY.blocked).not.toBe(COPY.notYet)
  })

  it('shows blocked copy for .mjs, not the not-yet string', async () => {
    fetchRepoTree.mockResolvedValue(treeResult())
    renderBrowser()
    await importValue('o/r')

    const mjs = Array.from(container.querySelectorAll('.repo-tree button')).find(
      (b) => b.textContent === 'index.mjs',
    )!
    act(() => {
      mjs.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(statusRegion().textContent).toBe(COPY.blocked)
    expect(statusRegion().textContent).not.toBe(COPY.notYet)
  })

  it('renders truncated listings plus the truncated notice', async () => {
    fetchRepoTree.mockResolvedValue(treeResult({ truncated: true }))
    renderBrowser()
    await importValue('o/r')

    expect(container.textContent).toContain('App.tsx')
    expect(container.textContent).toContain('README.md')
    expect(statusRegion().getAttribute('role')).toBe('status')
    expect(statusRegion().textContent).toBe(COPY.truncated)
  })

  it('maps EmptyRepoError to caption from error fields, no tree ul, empty-repo status', async () => {
    fetchRepoTree.mockRejectedValue(
      new EmptyRepoError({ owner: 'acme', repo: 'empty', defaultBranch: 'develop' }),
    )
    renderBrowser()
    await importValue('acme/empty')

    expect(container.querySelector('.repo-caption')?.textContent).toBe('acme/empty@develop')
    expect(container.querySelector('.repo-tree')).toBeNull()
    expect(container.querySelector('ul')).toBeNull()
    expect(statusRegion().getAttribute('role')).toBe('status')
    expect(statusRegion().textContent).toBe(COPY.emptyRepo)
  })

  it('maps tree [] RepoTreeResult the same as empty-repo success', async () => {
    fetchRepoTree.mockResolvedValue(
      treeResult({ owner: 'z', repo: 'none', defaultBranch: 'main', entries: [], truncated: false }),
    )
    renderBrowser()
    await importValue('z/none')

    expect(container.querySelector('.repo-caption')?.textContent).toBe('z/none@main')
    expect(container.querySelector('.repo-tree')).toBeNull()
    expect(statusRegion().getAttribute('role')).toBe('status')
    expect(statusRegion().textContent).toBe(COPY.emptyRepo)
  })

  it('keeps the previous tree on RepoNotFoundError and shows the 404 alert', async () => {
    fetchRepoTree.mockResolvedValueOnce(treeResult()).mockRejectedValueOnce(new RepoNotFoundError())
    renderBrowser()
    await importValue('o/r')
    expect(container.querySelector('.repo-caption')?.textContent).toBe('o/r@main')

    await importValue('missing/repo')
    expect(statusRegion().getAttribute('role')).toBe('alert')
    expect(statusRegion().textContent).toBe(COPY.notFound)
    expect(container.querySelector('.repo-caption')?.textContent).toBe('o/r@main')
    expect(container.textContent).toContain('App.tsx')
  })

  it('interpolates rate-limit reset time when resetEpochS is present', async () => {
    const resetEpochS = 1_700_000_000
    fetchRepoTree.mockRejectedValue(new RateLimitedError({ remaining: 0, resetEpochS }))
    renderBrowser()
    await importValue('o/r')

    const time = new Date(resetEpochS * 1000).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
    expect(statusRegion().getAttribute('role')).toBe('alert')
    expect(statusRegion().textContent).toBe(`GitHub rate-limited this browser. Try again after ${time}.`)
  })

  it('uses the unknown-reset string when RateLimitedError has no resetEpochS', async () => {
    fetchRepoTree.mockRejectedValue(new RateLimitedError({ remaining: 0 }))
    renderBrowser()
    await importValue('o/r')

    expect(statusRegion().getAttribute('role')).toBe('alert')
    expect(statusRegion().textContent).toBe(COPY.rateLimitedUnknown)
  })

  it('maps TypeError from fetchRepoTree to unreachable copy', async () => {
    fetchRepoTree.mockRejectedValue(new TypeError('Failed to fetch'))
    renderBrowser()
    await importValue('o/r')

    expect(statusRegion().getAttribute('role')).toBe('alert')
    expect(statusRegion().textContent).toBe(COPY.unreachable)
    expect(statusRegion().textContent).not.toContain('Failed to fetch')
  })

  it('maps GithubHttpError to the other-HTTP copy', async () => {
    fetchRepoTree.mockRejectedValue(new GithubHttpError(403))
    renderBrowser()
    await importValue('o/r')

    expect(statusRegion().getAttribute('role')).toBe('alert')
    expect(statusRegion().textContent).toBe(COPY.otherHttp)
  })

  it('clears status on Import start and last-wins overlapping Imports', async () => {
    let resolveFirst!: (value: RepoTreeResult) => void
    const first = new Promise<RepoTreeResult>((resolve) => {
      resolveFirst = resolve
    })
    fetchRepoTree.mockReturnValueOnce(first).mockResolvedValueOnce(
      treeResult({ owner: 'second', repo: 'win', defaultBranch: 'main' }),
    )
    renderBrowser()

    await importValue('o/r')
    expect(statusRegion().textContent).toBe('')

    await importValue('second/win')
    expect(container.querySelector('.repo-caption')?.textContent).toBe('second/win@main')

    await act(async () => {
      resolveFirst(treeResult({ owner: 'first', repo: 'lose', defaultBranch: 'main' }))
      await Promise.resolve()
    })
    expect(container.querySelector('.repo-caption')?.textContent).toBe('second/win@main')
  })

  it('clears a file-click notice when a new Import starts', async () => {
    let resolveSecond!: (value: RepoTreeResult) => void
    fetchRepoTree.mockResolvedValueOnce(treeResult()).mockReturnValueOnce(
      new Promise<RepoTreeResult>((resolve) => {
        resolveSecond = resolve
      }),
    )
    renderBrowser()
    await importValue('o/r')

    const readme = Array.from(container.querySelectorAll('.repo-tree button')).find(
      (b) => b.textContent === 'README.md',
    )!
    act(() => {
      readme.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(statusRegion().textContent).toBe(COPY.blocked)

    await importValue('o/r')
    expect(statusRegion().textContent).toBe('')

    await act(async () => {
      resolveSecond(treeResult())
      await Promise.resolve()
    })
  })

  it('does not change status text when a folder summary is clicked', async () => {
    fetchRepoTree.mockResolvedValue(treeResult())
    renderBrowser()
    await importValue('o/r')

    const readme = Array.from(container.querySelectorAll('.repo-tree button')).find(
      (b) => b.textContent === 'README.md',
    )!
    act(() => {
      readme.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(statusRegion().textContent).toBe(COPY.blocked)

    const summary = Array.from(container.querySelectorAll('summary')).find(
      (el) => el.textContent === 'src',
    )!
    act(() => {
      summary.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(statusRegion().textContent).toBe(COPY.blocked)
  })

  it('submits the form on Enter in #github-url', async () => {
    fetchRepoTree.mockResolvedValue(treeResult())
    renderBrowser()
    act(() => {
      setControlledInputValue(urlInput(), 'o/r')
    })
    await act(async () => {
      urlInput().form!.requestSubmit()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(fetchRepoTree).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.repo-caption')?.textContent).toBe('o/r@main')
  })

  it('disables Import while busy, keeps the URL field enabled, and sets aria-busy on the form', async () => {
    let resolveImport!: (value: RepoTreeResult) => void
    fetchRepoTree.mockReturnValue(
      new Promise<RepoTreeResult>((resolve) => {
        resolveImport = resolve
      }),
    )
    renderBrowser()
    act(() => {
      setControlledInputValue(urlInput(), 'o/r')
    })
    await act(async () => {
      urlInput().closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })

    const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(submit.textContent).toBe('Importing…')
    expect(submit.disabled).toBe(true)
    expect(urlInput().disabled).toBe(false)
    expect(urlInput().closest('form')?.getAttribute('aria-busy')).toBe('true')

    await act(async () => {
      resolveImport(treeResult())
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(submit.textContent).toBe('Import')
    expect(submit.disabled).toBe(false)
    expect(urlInput().closest('form')?.getAttribute('aria-busy')).toBe('false')
  })

  it('labels the tree wrapper Repository files and does not invent a getting-started paragraph', () => {
    renderBrowser()
    expect(container.textContent).not.toContain('get started')
    expect(container.querySelector('label[for="github-url"]')?.textContent).toBe(
      'GitHub URL or owner/repo',
    )
  })
})
