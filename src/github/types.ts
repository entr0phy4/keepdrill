// Named types only — no runtime, no Dexie, no React. Loaded GitHub trees
// are held in memory this phase; sourceType stays 'paste' | 'upload' until
// Phase 8 actually builds an Exercise.

export interface RepoRef {
  owner: string
  repo: string
}

export interface GitTreeEntry {
  path: string
  type: 'tree' | 'blob' | 'commit'
  sha: string
  size?: number
}

export interface RepoTreeResult {
  owner: string
  repo: string
  defaultBranch: string
  sha: string
  entries: GitTreeEntry[]
  truncated: boolean
}

export interface DirNode {
  kind: 'dir'
  name: string
  path: string
  children: TreeNode[]
}

export interface FileNode {
  kind: 'file'
  name: string
  path: string
  sha: string
  entryType: 'blob' | 'commit'
}

export type TreeNode = DirNode | FileNode
