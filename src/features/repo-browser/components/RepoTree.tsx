import type { DirNode, FileNode, TreeNode } from '@/github/types'
import { isLoadablePath } from '@/github/tree'

export interface RepoTreeProps {
  nodes: TreeNode[]
  onFileClick: (node: FileNode) => void
}

function FileLi({ node, onFileClick }: { node: FileNode; onFileClick: (node: FileNode) => void }) {
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

/** Native disclosure tree — @fluid/accordion cannot preserve details/summary tests. */
export function RepoTree({ nodes, onFileClick }: RepoTreeProps) {
  return (
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
  )
}
