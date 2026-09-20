import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { fetchGithubBlob, fetchRepoTree } from '../github/client'
import {
  EmptyRepoError,
  GithubHttpError,
  InvalidGithubUrlError,
  RateLimitedError,
  RepoNotFoundError,
} from '../github/errors'
import { foldTree, isLoadablePath } from '../github/tree'
import { parseGithubRef } from '../github/url'
import type { DirNode, FileNode, RepoRef, TreeNode } from '../github/types'
import { CorpusTooLargeError, NonUtf8Error } from '../ingestion/errors'
import { fromGithubBlob } from '../ingestion/github'
import { MAX_BYTES } from '../ingestion/upload'
import { fallbackPlan, planUnits } from '../parse/plan'
import type { FilePlan } from '../parse/types'
import { dialectForPath, ensureParser, parseSource } from '../parse/wasm'

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
  loading: 'Loading {path}…',
  plannedOne: 'Planned 1 unit from {path}.',
  plannedMany: 'Planned {count} units from {path}.',
  fallback: "Couldn't split {path}. You'll type the whole file as one unit.",
  errTooLarge: 'This file is over 100 KB. Paste a smaller section, or trim the file first.',
  errNonUtf8: "This file isn't UTF-8 text. Save it as UTF-8, or paste the contents instead.",
  blobMissing: "That file isn't on GitHub anymore.",
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

export function RepoBrowser({ onPlanned }: { onPlanned?: (plan: FilePlan) => void } = {}) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<StatusState | null>(null)
  const [caption, setCaption] = useState('')
  const [nodes, setNodes] = useState<TreeNode[] | null>(null)
  const [importedRef, setImportedRef] = useState<RepoRef | null>(null)
  const tokenRef = useRef(0)

  const onFileClick = async (node: FileNode) => {
    if (node.entryType === 'commit' || !isLoadablePath(node.path)) {
      setStatus({ kind: 'status', text: COPY.blocked })
      return
    }

    const token = ++tokenRef.current
    setStatus({ kind: 'status', text: COPY.loading.replace('{path}', node.path) })

    if ((node.size ?? 0) > MAX_BYTES) {
      if (tokenRef.current !== token) return
      setStatus({ kind: 'alert', text: COPY.errTooLarge })
      return
    }

    const ref = importedRef
    if (!ref) return

    try {
      const blob = await fetchGithubBlob(ref, node.sha)
      if (tokenRef.current !== token) return

      const exercise = fromGithubBlob(blob.bytes, {
        owner: ref.owner,
        repo: ref.repo,
        path: node.path,
      })

      let plan: FilePlan
      try {
        await ensureParser()
        const root = await parseSource(exercise.text, dialectForPath(node.path))
        plan = planUnits(root, exercise)
        if (plan.fallback) {
          plan = fallbackPlan(exercise, COPY.fallback.replace('{path}', node.path))
        }
      } catch {
        plan = fallbackPlan(exercise, COPY.fallback.replace('{path}', node.path))
      }

      if (tokenRef.current !== token) return
      onPlanned?.(plan)
      const count = plan.units.length
      const text = plan.fallback
        ? COPY.fallback.replace('{path}', node.path)
        : count === 1
          ? COPY.plannedOne.replace('{path}', node.path)
          : COPY.plannedMany.replace('{count}', String(count)).replace('{path}', node.path)
      setStatus({ kind: 'status', text })
    } catch (err) {
      if (tokenRef.current !== token) return
      if (err instanceof CorpusTooLargeError) {
        setStatus({ kind: 'alert', text: COPY.errTooLarge })
      } else if (err instanceof NonUtf8Error) {
        setStatus({ kind: 'alert', text: COPY.errNonUtf8 })
      } else if (err instanceof RepoNotFoundError) {
        setStatus({ kind: 'alert', text: COPY.blobMissing })
      } else if (err instanceof RateLimitedError) {
        setStatus({ kind: 'alert', text: formatRateLimit(err.resetEpochS) })
      } else if (err instanceof GithubHttpError) {
        setStatus({ kind: 'alert', text: COPY.otherHttp })
      } else if (err instanceof TypeError) {
        setStatus({ kind: 'alert', text: COPY.unreachable })
      } else {
        throw err
      }
    }
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

      setImportedRef({ owner: result.owner, repo: result.repo })
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
