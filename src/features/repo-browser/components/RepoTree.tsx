import type { CSSProperties } from 'react'
import { File } from 'lucide-react'
import type { DirNode, FileNode, TreeNode } from '@/github/types'
import { isLoadablePath } from '@/github/tree'
import { useIcon } from '@/lib/icon-context'
import { SizeProvider, useSize } from '@/lib/size-context'
import { cn } from '@/lib/utils'

export interface RepoTreeProps {
  nodes: TreeNode[]
  onFileClick: (node: FileNode) => void
  selectedPath?: string | null
}

function treeIndexStyle(index: number): CSSProperties {
  return { '--tree-i': index } as CSSProperties
}

function FileLi({
  node,
  selected,
  index,
  onFileClick,
}: {
  node: FileNode
  selected: boolean
  index: number
  onFileClick: (node: FileNode) => void
}) {
  const { icon, gap, text } = useSize()
  const loadable = isLoadablePath(node.path)

  return (
    <li style={treeIndexStyle(index)}>
      <button
        type="button"
        title={node.path}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'flex items-center',
          gap,
          text,
          !loadable && 'text-muted',
          selected && 'bg-muted',
        )}
        onClick={() => onFileClick(node)}
      >
        <File size={icon} strokeWidth={2} className="shrink-0 opacity-70" aria-hidden />
        {node.name}
      </button>
    </li>
  )
}

function Dir({
  node,
  depth,
  selectedPath,
  index,
  onFileClick,
}: {
  node: DirNode
  depth: number
  selectedPath?: string | null
  index: number
  onFileClick: (node: FileNode) => void
}) {
  const Folder = useIcon('folder')
  const { icon, gap, text } = useSize()

  return (
    <li style={treeIndexStyle(index)}>
      <details open={depth === 0 ? true : undefined}>
        <summary className={cn('flex cursor-pointer items-center', gap, text)} title={node.path}>
          <Folder size={icon} strokeWidth={2} className="shrink-0 opacity-70" aria-hidden />
          {node.name}
        </summary>
        <div className="repo-tree-fold">
          <ul>
            {node.children.map((child, childIndex) =>
              child.kind === 'dir' ? (
                <Dir
                  key={child.path}
                  node={child}
                  depth={depth + 1}
                  selectedPath={selectedPath}
                  index={childIndex}
                  onFileClick={onFileClick}
                />
              ) : (
                <FileLi
                  key={child.path}
                  node={child}
                  selected={selectedPath === child.path}
                  index={childIndex}
                  onFileClick={onFileClick}
                />
              ),
            )}
          </ul>
        </div>
      </details>
    </li>
  )
}

/** Native disclosure tree — @fluid/accordion cannot preserve details/summary tests. */
export function RepoTree({ nodes, onFileClick, selectedPath }: RepoTreeProps) {
  return (
    <SizeProvider size="compact">
      <div className="repo-tree" aria-label="Repository files">
        <ul>
          {nodes.map((node, index) =>
            node.kind === 'dir' ? (
              <Dir
                key={node.path}
                node={node}
                depth={0}
                selectedPath={selectedPath}
                index={index}
                onFileClick={onFileClick}
              />
            ) : (
              <FileLi
                key={node.path}
                node={node}
                selected={selectedPath === node.path}
                index={index}
                onFileClick={onFileClick}
              />
            ),
          )}
        </ul>
      </div>
    </SizeProvider>
  )
}
