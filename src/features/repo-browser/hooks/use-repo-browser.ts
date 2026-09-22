import { useRef, useState } from 'react'
import { fetchGithubBlob, fetchRepoTree } from '@/github/client'
import {
  EmptyRepoError,
  GithubHttpError,
  InvalidGithubUrlError,
  RateLimitedError,
  RepoNotFoundError,
} from '@/github/errors'
import { foldTree, isLoadablePath } from '@/github/tree'
import { parseGithubRef } from '@/github/url'
import type { FileNode, RepoRef, TreeNode } from '@/github/types'
import { CorpusTooLargeError, NonUtf8Error } from '@/ingestion/errors'
import { fromGithubBlob } from '@/ingestion/github'
import { MAX_BYTES } from '@/ingestion/upload'
import { fallbackPlan, planUnits } from '@/parse/plan'
import type { FilePlan } from '@/parse/types'
import { dialectForPath, ensureParser, parseSource } from '@/parse/wasm'

export const REPO_COPY = {
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

export interface StatusState {
  kind: 'alert' | 'status'
  text: string
  invalidUrl?: boolean
}

function formatCaption(owner: string, repo: string, defaultBranch: string): string {
  return `${owner}/${repo}@${defaultBranch}`
}

function formatRateLimit(resetEpochS: number | undefined): string {
  if (typeof resetEpochS !== 'number') return REPO_COPY.rateLimitedUnknown
  const time = new Date(resetEpochS * 1000).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
  return REPO_COPY.rateLimited.replace('{time}', time)
}

export interface UseRepoBrowserResult {
  url: string
  setUrl: (url: string) => void
  busy: boolean
  status: StatusState | null
  caption: string
  nodes: TreeNode[] | null
  selectedPath: string | null
  onFileClick: (node: FileNode) => Promise<void>
  onImport: () => Promise<void>
}

export function useRepoBrowser(onPlanned?: (plan: FilePlan) => void): UseRepoBrowserResult {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<StatusState | null>(null)
  const [caption, setCaption] = useState('')
  const [nodes, setNodes] = useState<TreeNode[] | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [importedRef, setImportedRef] = useState<RepoRef | null>(null)
  const clickGenRef = useRef(0)
  const importGenRef = useRef(0)

  const onFileClick = async (node: FileNode) => {
    const token = ++clickGenRef.current
    setSelectedPath(node.path)
    if (node.entryType === 'commit' || !isLoadablePath(node.path)) {
      setStatus({ kind: 'status', text: REPO_COPY.blocked })
      return
    }

    setStatus({ kind: 'status', text: REPO_COPY.loading.replace('{path}', node.path) })

    if ((node.size ?? 0) > MAX_BYTES) {
      if (clickGenRef.current !== token) return
      setStatus({ kind: 'alert', text: REPO_COPY.errTooLarge })
      return
    }

    const ref = importedRef
    if (!ref) return

    try {
      const blob = await fetchGithubBlob(ref, node.sha)
      if (clickGenRef.current !== token) return

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
          plan = fallbackPlan(exercise, REPO_COPY.fallback.replace('{path}', node.path))
        }
      } catch {
        plan = fallbackPlan(exercise, REPO_COPY.fallback.replace('{path}', node.path))
      }

      if (clickGenRef.current !== token) return
      onPlanned?.(plan)
      const count = plan.units.length
      const text = plan.fallback
        ? REPO_COPY.fallback.replace('{path}', node.path)
        : count === 1
          ? REPO_COPY.plannedOne.replace('{path}', node.path)
          : REPO_COPY.plannedMany.replace('{count}', String(count)).replace('{path}', node.path)
      setStatus({ kind: 'status', text })
    } catch (err) {
      if (clickGenRef.current !== token) return
      if (err instanceof CorpusTooLargeError) {
        setStatus({ kind: 'alert', text: REPO_COPY.errTooLarge })
      } else if (err instanceof NonUtf8Error) {
        setStatus({ kind: 'alert', text: REPO_COPY.errNonUtf8 })
      } else if (err instanceof RepoNotFoundError) {
        setStatus({ kind: 'alert', text: REPO_COPY.blobMissing })
      } else if (err instanceof RateLimitedError) {
        setStatus({ kind: 'alert', text: formatRateLimit(err.resetEpochS) })
      } else if (err instanceof GithubHttpError) {
        setStatus({ kind: 'alert', text: REPO_COPY.otherHttp })
      } else if (err instanceof TypeError) {
        setStatus({ kind: 'alert', text: REPO_COPY.unreachable })
      } else {
        throw err
      }
    }
  }

  const onImport = async () => {
    const importToken = ++importGenRef.current
    ++clickGenRef.current
    setBusy(true)
    setStatus(null)

    try {
      let ref
      try {
        ref = parseGithubRef(url)
      } catch (err) {
        if (importGenRef.current !== importToken) return
        if (err instanceof InvalidGithubUrlError) {
          setStatus({ kind: 'alert', text: REPO_COPY.invalidUrl, invalidUrl: true })
          return
        }
        throw err
      }

      const result = await fetchRepoTree(ref)
      if (importGenRef.current !== importToken) return

      setImportedRef({ owner: result.owner, repo: result.repo })
      setSelectedPath(null)
      setCaption(formatCaption(result.owner, result.repo, result.defaultBranch))
      if (result.entries.length === 0) {
        setNodes([])
        setStatus({ kind: 'status', text: REPO_COPY.emptyRepo })
      } else {
        setNodes(foldTree(result.entries))
        setStatus(result.truncated ? { kind: 'status', text: REPO_COPY.truncated } : null)
      }
    } catch (err) {
      if (importGenRef.current !== importToken) return

      if (err instanceof EmptyRepoError) {
        setCaption(formatCaption(err.owner, err.repo, err.defaultBranch))
        setSelectedPath(null)
        setNodes([])
        setStatus({ kind: 'status', text: REPO_COPY.emptyRepo })
      } else if (err instanceof RepoNotFoundError) {
        setStatus({ kind: 'alert', text: REPO_COPY.notFound })
      } else if (err instanceof RateLimitedError) {
        setStatus({ kind: 'alert', text: formatRateLimit(err.resetEpochS) })
      } else if (err instanceof GithubHttpError) {
        setStatus({ kind: 'alert', text: REPO_COPY.otherHttp })
      } else if (err instanceof TypeError) {
        setStatus({ kind: 'alert', text: REPO_COPY.unreachable })
      } else {
        throw err
      }
    } finally {
      if (importGenRef.current === importToken) setBusy(false)
    }
  }

  return { url, setUrl, busy, status, caption, nodes, selectedPath, onFileClick, onImport }
}
