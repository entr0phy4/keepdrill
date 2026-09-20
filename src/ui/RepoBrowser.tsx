import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { fetchRepoTree } from '../github/client'
import {
  EmptyRepoError,
  GithubHttpError,
  InvalidGithubUrlError,
  RateLimitedError,
  RepoNotFoundError,
} from '../github/errors'
import { foldTree, isLoadablePath } from '../github/tree'
import { parseGithubRef } from '../github/url'
import type { DirNode, FileNode, TreeNode } from '../github/types'

// Copy strings are verbatim from 07-UI-SPEC.md Copywriting Contract.
const COPY = {
  urlLabel: 'GitHub URL or owner/repo',
  urlPlaceholder: 'owner/repo or https://github.com/owner/repo',
  importIdle: 'Import',
  importBusy: 'Importing…',
  invalidUrl: 'Paste a GitHub URL or owner/repo.',
  notFound: 'No public GitHub repository matches that URL.',
  rateLimited: 'GitHub rate-limited this browser. Try again after {time}.',
  rateLimitedUnknown: 'GitHub rate-limited this browser. Try again in a few minutes.',
  otherHttp: 'GitHub refused this request. Try again later.',
  unreachable: "Couldn't reach GitHub. Check the connection and try again.",
  truncated: 'GitHub returned a partial file list (repository too large). Showing what arrived.',
  blocked: "This file can't be split yet. No exercise loaded.",
  notYet:
    'TypeScript/JavaScript files open as scaffolded exercises in the next step. Browsing only for now.',
  emptyRepo: 'This repository has no files on the default branch.',
} as const

interface StatusState {
  kind: 'alert' | 'status'
  text: string
  invalidUrl?: boolean
}

function formatCaption(owner: string, repo: string, defaultBranch: string): string {
  return `${owner}/${repo}@${defaultBranch}`
}

function formatRateLimit(resetEpochS: number | undefined): string {
  if (typeof resetEpochS !== 'number') return COPY.rateLimitedUnknown
  const time = new Date(resetEpochS * 1000).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
  return COPY.rateLimited.replace('{time}', time)
}

function FileLi({
  node,
  onFileClick,
}: {
  node: FileNode
  onFileClick: (node: FileNode) => void
}) {
  return (
    <li>
      <button
        type="button"
        className={isLoadablePath(node.path) ? undefined : 'text-muted'}
        onClick={() => onFileClick(node)}
      >
        {node.name}
      </button>
    </li>
  )
}

function Dir({
  node,
  depth,
  onFileClick,
}: {
  node: DirNode
  depth: number
  onFileClick: (node: FileNode) => void
}) {
  return (
    <li>
      <details open={depth === 0 ? true : undefined}>
        <summary>{node.name}</summary>
        <ul>
          {node.children.map((child) =>
            child.kind === 'dir' ? (
              <Dir key={child.path} node={child} depth={depth + 1} onFileClick={onFileClick} />
            ) : (
              <FileLi key={child.path} node={child} onFileClick={onFileClick} />
            ),
          )}
        </ul>
      </details>
    </li>
  )
}

export function RepoBrowser() {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<StatusState | null>(null)
  const [caption, setCaption] = useState('')
  const [nodes, setNodes] = useState<TreeNode[] | null>(null)
  const tokenRef = useRef(0)

  const onFileClick = (node: FileNode) => {
    setStatus({
      kind: 'status',
      text: isLoadablePath(node.path) ? COPY.notYet : COPY.blocked,
    })
  }

  const onImport = async () => {
    const token = ++tokenRef.current
    setBusy(true)
    setStatus(null)

    try {
      let ref
      try {
        ref = parseGithubRef(url)
      } catch (err) {
        if (tokenRef.current !== token) return
        if (err instanceof InvalidGithubUrlError) {
          setStatus({ kind: 'alert', text: COPY.invalidUrl, invalidUrl: true })
          return
        }
        throw err
      }

      const result = await fetchRepoTree(ref)
      if (tokenRef.current !== token) return

      setCaption(formatCaption(result.owner, result.repo, result.defaultBranch))
      if (result.entries.length === 0) {
        setNodes([])
        setStatus({ kind: 'status', text: COPY.emptyRepo })
      } else {
        setNodes(foldTree(result.entries))
        setStatus(result.truncated ? { kind: 'status', text: COPY.truncated } : null)
      }
    } catch (err) {
      if (tokenRef.current !== token) return

      if (err instanceof EmptyRepoError) {
        setCaption(formatCaption(err.owner, err.repo, err.defaultBranch))
        setNodes([])
        setStatus({ kind: 'status', text: COPY.emptyRepo })
      } else if (err instanceof RepoNotFoundError) {
        setStatus({ kind: 'alert', text: COPY.notFound })
      } else if (err instanceof RateLimitedError) {
        setStatus({ kind: 'alert', text: formatRateLimit(err.resetEpochS) })
      } else if (err instanceof GithubHttpError) {
        setStatus({ kind: 'alert', text: COPY.otherHttp })
      } else if (err instanceof TypeError) {
        setStatus({ kind: 'alert', text: COPY.unreachable })
      } else {
        throw err
      }
    } finally {
      if (tokenRef.current === token) setBusy(false)
    }
  }

  const showTree = nodes !== null && nodes.length > 0
  const isError = status?.kind === 'alert'

  return (
    <section style={{ display: 'grid', gap: 'var(--space-md)' }}>
      <form
        style={{ display: 'grid', gap: 'var(--space-sm)' }}
        aria-busy={busy ? 'true' : 'false'}
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          void onImport()
        }}
      >
        <label htmlFor="github-url" className="text-label">
          {COPY.urlLabel}
        </label>
        <input
          id="github-url"
          type="text"
          className="control"
          style={{ width: '100%' }}
          spellCheck={false}
          autoComplete="off"
          placeholder={COPY.urlPlaceholder}
          value={url}
          aria-invalid={status?.invalidUrl === true ? true : undefined}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div>
          <button type="submit" className="primary" disabled={busy}>
            {busy ? COPY.importBusy : COPY.importIdle}
          </button>
        </div>
      </form>

      <p className="repo-caption text-muted text-label">{caption}</p>

      {showTree && (
        <div className="repo-tree" aria-label="Repository files">
          <ul>
            {nodes.map((node) =>
              node.kind === 'dir' ? (
                <Dir key={node.path} node={node} depth={0} onFileClick={onFileClick} />
              ) : (
                <FileLi key={node.path} node={node} onFileClick={onFileClick} />
              ),
            )}
          </ul>
        </div>
      )}

      <p
        className={isError ? 'repo-status' : 'repo-status text-muted'}
        role={isError ? 'alert' : 'status'}
        style={{
          margin: 0,
          color: isError ? 'var(--color-destructive)' : undefined,
        }}
      >
        {status?.text ?? ''}
      </p>
    </section>
  )
}
