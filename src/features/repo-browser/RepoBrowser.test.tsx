import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EmptyRepoError,
  GithubHttpError,
  RateLimitedError,
  RepoNotFoundError,
} from '@/github/errors'
import type { GithubBlobResult } from '@/github/client'
import type { GitTreeEntry, RepoTreeResult } from '@/github/types'
import type { FilePlan, TsNode } from '@/parse/types'
import { RepoBrowser } from './RepoBrowser'

const { fetchRepoTree, fetchGithubBlob } = vi.hoisted(() => ({
  fetchRepoTree: vi.fn(),
  fetchGithubBlob: vi.fn(),
}))

const { parseSource, ensureParser } = vi.hoisted(() => ({
  parseSource: vi.fn(),
  ensureParser: vi.fn(),
}))

vi.mock('@/github/client', () => ({
  fetchRepoTree,
  fetchGithubBlob,
}))

vi.mock('@/parse/wasm', () => ({
  parseSource,
  ensureParser,
  loadDialect: vi.fn(),
  dialectForPath: (path: string) => {
    const base = path.slice(path.lastIndexOf('/') + 1).toLowerCase()
    return base.endsWith('.tsx') || base.endsWith('.jsx') ? 'tsx' : 'typescript'
  },
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
  loading: 'Loading {path}…',
  plannedOne: 'Planned 1 unit from {path}.',
  plannedMany: 'Planned {count} units from {path}.',
  fallback: "Couldn't split {path}. You'll type the whole file as one unit.",
  errTooLarge: 'This file is over 100 KB. Paste a smaller section, or trim the file first.',
  blobMissing: "That file isn't on GitHub anymore.",
  emptyRepo: 'This repository has no files on the default branch.',
} as const

const SOURCE_TEXT = 'function a() {}\nfunction b() {}\n'
const SOURCE_BYTES = new TextEncoder().encode(SOURCE_TEXT)

function twoFnTree(text: string): TsNode {
  const first = 'function a() {}'
  const second = 'function b() {}'
  const aAt = text.indexOf('a')
  const bAt = text.indexOf('b')
  return {
    type: 'program',
    startIndex: 0,
    endIndex: text.length,
    namedChildren: [
      {
        type: 'function_declaration',
        startIndex: text.indexOf(first),
        endIndex: text.indexOf(first) + first.length,
        namedChildren: [],
        childForFieldName: (field) =>
          field === 'name'
            ? { type: 'identifier', startIndex: aAt, endIndex: aAt + 1, namedChildren: [] }
            : null,
      },
      {
        type: 'function_declaration',
        startIndex: text.indexOf(second),
        endIndex: text.indexOf(second) + second.length,
        namedChildren: [],
        childForFieldName: (field) =>
          field === 'name'
            ? { type: 'identifier', startIndex: bAt, endIndex: bAt + 1, namedChildren: [] }
            : null,
      },
    ],
  }
}

function blobResult(sha: string): GithubBlobResult {
  return { sha, size: SOURCE_BYTES.byteLength, bytes: SOURCE_BYTES }
}

const NESTED_ENTRIES: GitTreeEntry[] = [
  { path: 'src', type: 'tree', sha: 'abc' },
  { path: 'src/nested', type: 'tree', sha: 'nest' },
  { path: 'src/nested/util.ts', type: 'blob', sha: 'util' },
  { path: 'src/App.tsx', type: 'blob', sha: 'def', size: 120 },
  { path: 'src/huge.ts', type: 'blob', sha: 'huge', size: 100_001 },
  { path: 'vendor/mod.ts', type: 'commit', sha: 'sub' },
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
  fetchGithubBlob.mockReset()
  parseSource.mockReset()
  ensureParser.mockReset()
  ensureParser.mockResolvedValue(undefined)
  parseSource.mockResolvedValue(twoFnTree(SOURCE_TEXT))
  fetchGithubBlob.mockResolvedValue(blobResult('def'))
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

function renderBrowser(onPlanned?: (plan: FilePlan) => void): void {
  act(() => {
    root.render(<RepoBrowser onPlanned={onPlanned} />)
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

  it('shows blocked copy on README.md click and does not fetch the blob', async () => {
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
    expect(fetchGithubBlob).not.toHaveBeenCalled()
  })

  it('shows blocked copy for .mjs, not the planned or fallback strings', async () => {
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
    expect(statusRegion().textContent).not.toBe(COPY.fallback.replace('{path}', 'index.mjs'))
    expect(statusRegion().textContent).not.toContain('Planned')
    expect(fetchGithubBlob).not.toHaveBeenCalled()
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

async function clickTreeFile(name: string): Promise<void> {
  const btn = Array.from(container.querySelectorAll('.repo-tree button')).find(
    (b) => b.textContent === name,
  )!
  await act(async () => {
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('RepoBrowser — loadable click plans units', () => {
  it('plans App.tsx via blob → corpus → parse, calls onPlanned, and does not mount CaptureSurface', async () => {
    const onPlanned = vi.fn()
    fetchRepoTree.mockResolvedValue(treeResult())
    renderBrowser(onPlanned)
    await importValue('o/r')

    await clickTreeFile('App.tsx')

    expect(fetchGithubBlob).toHaveBeenCalledWith({ owner: 'o', repo: 'r' }, 'def')
    expect(onPlanned).toHaveBeenCalledTimes(1)
    const plan = onPlanned.mock.calls[0]![0] as FilePlan
    expect(plan.fallback).toBe(false)
    expect(plan.units.length).toBe(2)
    expect(plan.exercise.sourceType).toBe('github')
    expect(plan.exercise.sourceRef).toBe('o/r:src/App.tsx')
    expect(statusRegion().getAttribute('role')).toBe('status')
    expect(statusRegion().textContent).toBe('Planned 2 units from src/App.tsx.')
    expect(container.querySelector('#capture-surface')).toBeNull()
    expect(COPY.fallback).not.toBe(COPY.blocked)
  })

  it('calls onPlanned with fallback and distinct notice when parseSource rejects', async () => {
    const onPlanned = vi.fn()
    fetchRepoTree.mockResolvedValue(treeResult())
    parseSource.mockRejectedValue(new Error('Language.load failed'))
    renderBrowser(onPlanned)
    await importValue('o/r')

    await clickTreeFile('App.tsx')

    expect(onPlanned).toHaveBeenCalledTimes(1)
    const plan = onPlanned.mock.calls[0]![0] as FilePlan
    expect(plan.fallback).toBe(true)
    expect(plan.units).toHaveLength(1)
    expect(plan.units[0]?.kind).toBe('file')
    expect(statusRegion().getAttribute('role')).toBe('status')
    expect(statusRegion().textContent).toBe(
      "Couldn't split src/App.tsx. You'll type the whole file as one unit.",
    )
    expect(statusRegion().textContent).not.toBe(COPY.blocked)
  })

  it('last-wins overlapping clicks: slow first sha cannot overwrite the second', async () => {
    const onPlanned = vi.fn()
    let resolveFirst!: (value: GithubBlobResult) => void
    const first = new Promise<GithubBlobResult>((resolve) => {
      resolveFirst = resolve
    })
    fetchRepoTree.mockResolvedValue(treeResult())
    fetchGithubBlob.mockReturnValueOnce(first).mockResolvedValueOnce(blobResult('util'))
    renderBrowser(onPlanned)
    await importValue('o/r')

    const app = Array.from(container.querySelectorAll('.repo-tree button')).find(
      (b) => b.textContent === 'App.tsx',
    )!
    const util = Array.from(container.querySelectorAll('.repo-tree button')).find(
      (b) => b.textContent === 'util.ts',
    )!
    await act(async () => {
      app.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })
    await act(async () => {
      util.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onPlanned).toHaveBeenCalledTimes(1)
    expect((onPlanned.mock.calls[0]![0] as FilePlan).exercise.sourceRef).toBe(
      'o/r:src/nested/util.ts',
    )
    expect(statusRegion().textContent).toBe('Planned 2 units from src/nested/util.ts.')

    await act(async () => {
      resolveFirst(blobResult('def'))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(onPlanned).toHaveBeenCalledTimes(1)
    expect(statusRegion().textContent).toBe('Planned 2 units from src/nested/util.ts.')
  })

  it('last-wins overlapping clicks: slow first loadable cannot overwrite a later blocked README click', async () => {
    const onPlanned = vi.fn()
    let resolveFirst!: (value: GithubBlobResult) => void
    const first = new Promise<GithubBlobResult>((resolve) => {
      resolveFirst = resolve
    })
    fetchRepoTree.mockResolvedValue(treeResult())
    fetchGithubBlob.mockReturnValueOnce(first)
    renderBrowser(onPlanned)
    await importValue('o/r')

    const app = Array.from(container.querySelectorAll('.repo-tree button')).find(
      (b) => b.textContent === 'App.tsx',
    )!
    const readme = Array.from(container.querySelectorAll('.repo-tree button')).find(
      (b) => b.textContent === 'README.md',
    )!
    await act(async () => {
      app.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })
    await act(async () => {
      readme.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(statusRegion().textContent).toBe(COPY.blocked)
    expect(fetchGithubBlob).toHaveBeenCalledTimes(1)
    expect(onPlanned).not.toHaveBeenCalled()

    await act(async () => {
      resolveFirst(blobResult('def'))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(statusRegion().textContent).toBe(COPY.blocked)
    expect(fetchGithubBlob).toHaveBeenCalledTimes(1)
    expect(onPlanned).not.toHaveBeenCalled()
  })

  it('last-wins overlapping clicks: slow first loadable cannot overwrite a later commit mod.ts click', async () => {
    const onPlanned = vi.fn()
    let resolveFirst!: (value: GithubBlobResult) => void
    const first = new Promise<GithubBlobResult>((resolve) => {
      resolveFirst = resolve
    })
    fetchRepoTree.mockResolvedValue(treeResult())
    fetchGithubBlob.mockReturnValueOnce(first)
    renderBrowser(onPlanned)
    await importValue('o/r')

    const app = Array.from(container.querySelectorAll('.repo-tree button')).find(
      (b) => b.textContent === 'App.tsx',
    )!
    const mod = Array.from(container.querySelectorAll('.repo-tree button')).find(
      (b) => b.textContent === 'mod.ts',
    )!
    await act(async () => {
      app.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })
    await act(async () => {
      mod.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(statusRegion().textContent).toBe(COPY.blocked)
    expect(fetchGithubBlob).toHaveBeenCalledTimes(1)
    expect(onPlanned).not.toHaveBeenCalled()

    await act(async () => {
      resolveFirst(blobResult('def'))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(statusRegion().textContent).toBe(COPY.blocked)
    expect(fetchGithubBlob).toHaveBeenCalledTimes(1)
    expect(onPlanned).not.toHaveBeenCalled()
  })

  it('file click during Import still re-enables Import when the tree fetch resolves', async () => {
    fetchRepoTree.mockResolvedValueOnce(treeResult())
    renderBrowser()
    await importValue('o/r')

    let resolveTree!: (value: RepoTreeResult) => void
    fetchRepoTree.mockReturnValue(
      new Promise<RepoTreeResult>((resolve) => {
        resolveTree = resolve
      }),
    )
    fetchGithubBlob.mockReturnValue(
      new Promise<GithubBlobResult>(() => {
        /* hang so the loadable click stays in-flight */
      }),
    )

    await importValue('o/r')
    const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(submit.textContent).toBe('Importing…')
    expect(submit.disabled).toBe(true)

    const app = Array.from(container.querySelectorAll('.repo-tree button')).find(
      (b) => b.textContent === 'App.tsx',
    )!
    await act(async () => {
      app.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    await act(async () => {
      resolveTree(treeResult())
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(submit.disabled).toBe(false)
    expect(submit.textContent).toBe('Import')
  })

  it('refuses a 100001-byte node with the too-large alert and skips the blob GET', async () => {
    const onPlanned = vi.fn()
    fetchRepoTree.mockResolvedValue(treeResult())
    renderBrowser(onPlanned)
    await importValue('o/r')

    await clickTreeFile('huge.ts')

    expect(fetchGithubBlob).not.toHaveBeenCalled()
    expect(onPlanned).not.toHaveBeenCalled()
    expect(statusRegion().getAttribute('role')).toBe('alert')
    expect(statusRegion().textContent).toBe(COPY.errTooLarge)
  })

  it('maps blob 404 RepoNotFoundError to blobMissing alert', async () => {
    const onPlanned = vi.fn()
    fetchRepoTree.mockResolvedValue(treeResult())
    fetchGithubBlob.mockRejectedValue(new RepoNotFoundError())
    renderBrowser(onPlanned)
    await importValue('o/r')

    await clickTreeFile('App.tsx')

    expect(onPlanned).not.toHaveBeenCalled()
    expect(statusRegion().getAttribute('role')).toBe('alert')
    expect(statusRegion().textContent).toBe(COPY.blobMissing)
  })

  it('blocks commit entries even when the path looks loadable', async () => {
    fetchRepoTree.mockResolvedValue(treeResult())
    renderBrowser()
    await importValue('o/r')

    await clickTreeFile('mod.ts')

    expect(statusRegion().textContent).toBe(COPY.blocked)
    expect(fetchGithubBlob).not.toHaveBeenCalled()
  })

  it('does not take a paste/upload load callback and never renders #capture-surface', async () => {
    fetchRepoTree.mockResolvedValue(treeResult())
    renderBrowser()
    await importValue('o/r')
    await clickTreeFile('App.tsx')
    expect(container.querySelector('#capture-surface')).toBeNull()
    expect(RepoBrowser.length).toBeLessThanOrEqual(1)
  })
})
