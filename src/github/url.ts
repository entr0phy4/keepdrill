// PURE — zero network, zero DOM. D-09 / D-10. Host allowlist is github.com
// and www.github.com only. Extra pathname after owner/repo is ignored (D-09);
// gist, GitLab, raw.githubusercontent.com, and other hosts throw before fetch.

import { InvalidGithubUrlError } from './errors'
import type { RepoRef } from './types'

export function parseGithubRef(raw: string): RepoRef {
  const trimmed = raw.trim()
  const nwo = /^([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9._-]+)$/
  const nwoMatch = nwo.exec(trimmed)
  const nwoOwner = nwoMatch?.[1]
  const nwoRepo = nwoMatch?.[2]
  if (nwoOwner !== undefined && nwoRepo !== undefined) {
    return { owner: nwoOwner, repo: stripGit(nwoRepo) }
  }

  let url: URL
  try {
    url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
  } catch {
    throw new InvalidGithubUrlError()
  }
  const host = url.hostname.toLowerCase()
  if (host === 'gist.github.com' || host === 'raw.githubusercontent.com') {
    throw new InvalidGithubUrlError()
  }
  if (host !== 'github.com' && host !== 'www.github.com') {
    throw new InvalidGithubUrlError()
  }
  const parts = url.pathname.split('/').filter(Boolean)
  const owner = parts[0]
  const repo = parts[1]
  if (owner === undefined || repo === undefined) throw new InvalidGithubUrlError()
  return { owner, repo: stripGit(repo) }
}

function stripGit(repo: string): string {
  return repo.replace(/\.git$/i, '')
}
