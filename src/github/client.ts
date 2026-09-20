// Platform seam — the ONLY module that may fetch (GitHub listing and blob
// contents). Kept out of the hot path. Callers receive RepoTreeResult, blob
// bytes, or a typed Error. TypeError from fetch (CSP/COEP/offline) is not
// wrapped; the UI maps unreachable copy.

import {
  EmptyRepoError,
  GithubHttpError,
  RateLimitedError,
  RepoNotFoundError,
} from './errors'
import { CorpusTooLargeError } from '../ingestion/errors'
import { MAX_BYTES } from '../ingestion/upload'
import type { GitTreeEntry, RepoRef, RepoTreeResult } from './types'

export type GithubBlobResult = {
  sha: string
  size: number
  bytes: Uint8Array
}

const inflight = new Map<string, Promise<RepoTreeResult>>()
const cache = new Map<string, RepoTreeResult | string>()
const blobInflight = new Map<string, Promise<GithubBlobResult>>()
const blobCache = new Map<string, GithubBlobResult>()

export function resetGithubCache(): void {
  inflight.clear()
  cache.clear()
  blobInflight.clear()
  blobCache.clear()
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

async function loadGithubBlob(ref: RepoRef, sha: string): Promise<GithubBlobResult> {
  const res = await githubGet(
    `/repos/${enc(ref.owner)}/${enc(ref.repo)}/git/blobs/${enc(sha)}`,
  )
  const body = (await readGithub(res)) as {
    content?: string
    encoding?: string
    size?: number | null
    sha?: string
  }
  if (typeof body.content !== 'string') {
    throw new GithubHttpError(422)
  }
  const size = body.size ?? 0
  if (size > MAX_BYTES) throw new CorpusTooLargeError(size)
  const b64 = body.content.replace(/\n/g, '')
  const binary = atob(b64)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  if (bytes.byteLength > MAX_BYTES) {
    throw new CorpusTooLargeError(bytes.byteLength)
  }
  const out: GithubBlobResult = {
    sha: body.sha ?? sha,
    size: bytes.byteLength,
    bytes,
  }
  blobCache.set(sha, out)
  return out
}

export function fetchGithubBlob(
  ref: RepoRef,
  sha: string,
): Promise<GithubBlobResult> {
  const cached = blobCache.get(sha)
  if (cached) return Promise.resolve(cached)
  const existing = blobInflight.get(sha)
  if (existing) return existing
  const pending = loadGithubBlob(ref, sha).finally(() => {
    blobInflight.delete(sha)
  })
  blobInflight.set(sha, pending)
  return pending
}
