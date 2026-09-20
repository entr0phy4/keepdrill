// Platform seam — the ONLY module that may fetch (GitHub listing). Kept out of
// the hot path. Callers receive RepoTreeResult or a typed Error. TypeError from
// fetch (CSP/COEP/offline) is not wrapped; the UI maps unreachable copy.

import {
  EmptyRepoError,
  GithubHttpError,
  RateLimitedError,
  RepoNotFoundError,
} from './errors'
import type { GitTreeEntry, RepoRef, RepoTreeResult } from './types'

const inflight = new Map<string, Promise<RepoTreeResult>>()
const cache = new Map<string, RepoTreeResult | string>()

export function resetGithubCache(): void {
  inflight.clear()
  cache.clear()
}

function githubGet(path: string): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    headers: { Accept: 'application/vnd.github+json' },
  })
}

function enc(value: string): string {
  return encodeURIComponent(value)
}

function refKey(ref: RepoRef): string {
  return `${ref.owner}/${ref.repo}`
}

async function readGithub(res: Response): Promise<unknown> {
  if (res.status === 404) throw new RepoNotFoundError()
  const remaining = res.headers.get('x-ratelimit-remaining')
  const reset = res.headers.get('x-ratelimit-reset')
  if (res.status === 429 || (res.status === 403 && remaining === '0')) {
    throw new RateLimitedError({
      remaining: remaining === null ? 0 : Number(remaining),
      resetEpochS: reset === null ? undefined : Number(reset),
    })
  }
  if (!res.ok) throw new GithubHttpError(res.status)
  return res.json()
}

async function loadRepoTree(ref: RepoRef): Promise<RepoTreeResult> {
  const owner = enc(ref.owner)
  const repo = enc(ref.repo)
  const repoRes = await githubGet(`/repos/${owner}/${repo}`)
  const repoBody = (await readGithub(repoRes)) as { default_branch: string }
  const defaultBranch = repoBody.default_branch

  const treeRes = await githubGet(
    `/repos/${owner}/${repo}/git/trees/${enc(defaultBranch)}?recursive=1`,
  )
  if (treeRes.status === 409) {
    throw new EmptyRepoError({
      owner: ref.owner,
      repo: ref.repo,
      defaultBranch,
    })
  }
  const treeBody = (await readGithub(treeRes)) as {
    sha: string
    truncated?: boolean
    tree?: GitTreeEntry[]
  }
  const result: RepoTreeResult = {
    owner: ref.owner,
    repo: ref.repo,
    defaultBranch,
    sha: treeBody.sha,
    entries: treeBody.tree ?? [],
    truncated: treeBody.truncated === true,
  }
  cache.set(`${refKey(ref)}@${result.sha}`, result)
  cache.set(`${refKey(ref)}:${defaultBranch}`, result.sha)
  cache.set(refKey(ref), result)
  return result
}

export function fetchRepoTree(ref: RepoRef): Promise<RepoTreeResult> {
  const key = refKey(ref)
  const cached = cache.get(key)
  if (cached !== undefined && typeof cached !== 'string') {
    return Promise.resolve(cached)
  }
  const existing = inflight.get(key)
  if (existing) return existing
  const pending = loadRepoTree(ref).finally(() => {
    inflight.delete(key)
  })
  inflight.set(key, pending)
  return pending
}
