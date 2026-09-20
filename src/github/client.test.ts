import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchRepoTree, resetGithubCache } from './client'
import {
  EmptyRepoError,
  GithubHttpError,
  RateLimitedError,
  RepoNotFoundError,
} from './errors'
import type { GitTreeEntry } from './types'

const ACCEPT = { Accept: 'application/vnd.github+json' } as const
const REF = { owner: 'o', repo: 'r' } as const

const FIXTURE_TREE: GitTreeEntry[] = [
  { path: 'src', type: 'tree', sha: 'abc' },
  { path: 'src/App.tsx', type: 'blob', sha: 'def', size: 120 },
  { path: 'README.md', type: 'blob', sha: 'ghi', size: 50 },
]

function jsonRes(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Pick<Response, 'ok' | 'status' | 'headers' | 'json'> {
  const map = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  )
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => map.get(name.toLowerCase()) ?? null,
    } as Headers,
    json: async () => body,
  }
}

function mockedFetch() {
  return vi.mocked(fetch)
}

function stubSuccess(
  options: {
    defaultBranch?: string
    sha?: string
    tree?: GitTreeEntry[]
    truncated?: boolean
  } = {},
): void {
  const defaultBranch = options.defaultBranch ?? 'main'
  const sha = options.sha ?? 'aaa'
  const tree = options.tree ?? []
  const truncated = options.truncated ?? false
  mockedFetch()
    .mockResolvedValueOnce(jsonRes({ default_branch: defaultBranch }) as Response)
    .mockResolvedValueOnce(jsonRes({ sha, truncated, tree }) as Response)
}

function assertListingFetch(call: unknown[]): void {
  const url = String(call[0])
  const init = call[1] as RequestInit
  expect(url.startsWith('https://api.github.com/')).toBe(true)
  expect(init.method).toBe('GET')
  expect(init.mode).toBe('cors')
  expect(init.credentials).toBe('omit')
  expect(init.headers).toEqual(ACCEPT)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  resetGithubCache()
  vi.unstubAllGlobals()
})

describe('fetchRepoTree', () => {
  it('issues repo then recursive tree GETs on a cold import', async () => {
    stubSuccess({ tree: FIXTURE_TREE })
    const result = await fetchRepoTree(REF)
    const mock = mockedFetch()

    expect(mock).toHaveBeenCalledTimes(2)
    const repoUrl = String(mock.mock.calls[0]?.[0])
    const treeUrl = String(mock.mock.calls[1]?.[0])
    expect(repoUrl).toBe('https://api.github.com/repos/o/r')
    expect(treeUrl).toContain('/git/trees/')
    expect(treeUrl).toContain('recursive=1')
    expect(treeUrl.startsWith('https://api.github.com/')).toBe(true)
    for (const call of mock.mock.calls) {
      assertListingFetch(call)
    }
    expect(result).toEqual({
      owner: 'o',
      repo: 'r',
      defaultBranch: 'main',
      sha: 'aaa',
      entries: FIXTURE_TREE,
      truncated: false,
    })
  })

  it('does not call fetch again on a second import of the same ref', async () => {
    stubSuccess()
    await fetchRepoTree(REF)
    await fetchRepoTree(REF)
    expect(mockedFetch()).toHaveBeenCalledTimes(2)
  })

  it('shares one in-flight pair for overlapping cold calls', async () => {
    stubSuccess()
    const [first, second] = await Promise.all([
      fetchRepoTree(REF),
      fetchRepoTree(REF),
    ])
    expect(mockedFetch()).toHaveBeenCalledTimes(2)
    expect(first).toEqual(second)
  })

  it('maps 404 to RepoNotFoundError', async () => {
    mockedFetch().mockResolvedValueOnce(jsonRes({}, 404) as Response)
    await expect(fetchRepoTree(REF)).rejects.toBeInstanceOf(RepoNotFoundError)
  })

  it('maps 403 with remaining 0 to RateLimitedError remaining 0', async () => {
    mockedFetch().mockResolvedValueOnce(
      jsonRes({}, 403, { 'x-ratelimit-remaining': '0' }) as Response,
    )
    const err = await fetchRepoTree(REF).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RateLimitedError)
    expect(err).toMatchObject({ remaining: 0 })
    expect((err as RateLimitedError).resetEpochS).toBeUndefined()
  })

  it('maps 429 to RateLimitedError and stores resetEpochS seconds', async () => {
    mockedFetch().mockResolvedValueOnce(
      jsonRes({}, 429, { 'x-ratelimit-reset': '1700000000' }) as Response,
    )
    const err = await fetchRepoTree(REF).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RateLimitedError)
    expect(err).toMatchObject({ remaining: 0, resetEpochS: 1_700_000_000 })
  })

  it('maps 403 with remaining 12 to GithubHttpError 403', async () => {
    mockedFetch().mockResolvedValueOnce(
      jsonRes({}, 403, { 'x-ratelimit-remaining': '12' }) as Response,
    )
    const err = await fetchRepoTree(REF).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(GithubHttpError)
    expect(err).toMatchObject({ status: 403 })
  })

  it('maps tree GET 409 to EmptyRepoError from the repo payload', async () => {
    mockedFetch()
      .mockResolvedValueOnce(jsonRes({ default_branch: 'main' }) as Response)
      .mockResolvedValueOnce(jsonRes({}, 409) as Response)

    const err = await fetchRepoTree(REF).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(EmptyRepoError)
    expect(err).toMatchObject({
      owner: 'o',
      repo: 'r',
      defaultBranch: 'main',
    })
    expect(err).not.toMatchObject({ entries: expect.anything() })
  })

  it('returns truncated true with the fixture tree[] on 200', async () => {
    stubSuccess({ truncated: true, tree: FIXTURE_TREE, sha: 'trunc' })
    const result = await fetchRepoTree(REF)
    expect(result.truncated).toBe(true)
    expect(result.entries).toHaveLength(FIXTURE_TREE.length)
    expect(result.sha).toBe('trunc')
  })

  it('encodes a slashed default branch in the tree URL', async () => {
    stubSuccess({ defaultBranch: 'feature/foo' })
    await fetchRepoTree(REF)
    const treeUrl = String(mockedFetch().mock.calls[1]?.[0])
    expect(treeUrl).toBe(
      'https://api.github.com/repos/o/r/git/trees/feature%2Ffoo?recursive=1',
    )
  })
})
