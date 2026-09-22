// PURE — zero DOM access, zero network. This fold walks every GitHub tree[]
// entry: type tree ensures a dir; blob and commit become file leaves (Pitfall 8).
// Sibling order is first-seen in the input array — no locale sort (REPO-02).
// Loadable allowlist is D-05 (.ts .tsx .js .jsx), not extToLang.

import type { DirNode, FileNode, GitTreeEntry, TreeNode } from './types'

const LOADABLE = new Set(['.ts', '.tsx', '.js', '.jsx'])

export function isLoadablePath(path: string): boolean {
  const base = path.slice(path.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return false
  return LOADABLE.has(base.slice(dot).toLowerCase())
}

/** Keep loadable blobs and folders that still have children after pruning. */
export function filterLoadableTree(nodes: readonly TreeNode[]): TreeNode[] {
  const out: TreeNode[] = []
  for (const node of nodes) {
    if (node.kind === 'file') {
      if (isLoadablePath(node.path)) out.push(node)
      continue
    }
    const children = filterLoadableTree(node.children)
    if (children.length > 0) out.push({ ...node, children })
  }
  return out
}

export function foldTree(entries: readonly GitTreeEntry[]): TreeNode[] {
  const roots: TreeNode[] = []
  const dirs = new Map<string, DirNode>()

  function basename(path: string): string {
    const slash = path.lastIndexOf('/')
    return slash === -1 ? path : path.slice(slash + 1)
  }

  function parentPath(path: string): string | undefined {
    const slash = path.lastIndexOf('/')
    if (slash <= 0) return undefined
    return path.slice(0, slash)
  }

  function attach(node: TreeNode, path: string): void {
    const parent = parentPath(path)
    if (parent === undefined) {
      roots.push(node)
      return
    }
    ensureDir(parent).children.push(node)
  }

  function ensureDir(path: string): DirNode {
    const existing = dirs.get(path)
    if (existing) return existing
    const node: DirNode = { kind: 'dir', name: basename(path), path, children: [] }
    dirs.set(path, node)
    attach(node, path)
    return node
  }

  for (const entry of entries) {
    if (entry.type === 'tree') {
      ensureDir(entry.path)
      continue
    }
    const file: FileNode = {
      kind: 'file',
      name: basename(entry.path),
      path: entry.path,
      sha: entry.sha,
      entryType: entry.type,
      size: entry.size,
    }
    attach(file, entry.path)
  }

  return roots
}
