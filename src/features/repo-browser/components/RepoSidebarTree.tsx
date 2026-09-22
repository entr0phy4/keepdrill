import { useNavigate } from 'react-router'
import { ROUTES } from '@/app/routes'
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from '@/components/ui/sidebar'
import { useRepoBrowserContext } from '../RepoBrowserContext'
import { RepoTree } from './RepoTree'

export function RepoTreePanel() {
  const { nodes, selectedPath, onFileClick } = useRepoBrowserContext()
  if (nodes === null || nodes.length === 0) return null
  return (
    <RepoTree
      nodes={nodes}
      selectedPath={selectedPath}
      onFileClick={(node) => void onFileClick(node)}
    />
  )
}

export function RepoSidebarTree() {
  const { nodes, caption, selectedPath, onFileClick } = useRepoBrowserContext()
  const navigate = useNavigate()

  if (nodes === null || nodes.length === 0) return null

  return (
    <SidebarGroup className="min-h-0">
      <SidebarGroupLabel>{caption || 'Repository'}</SidebarGroupLabel>
      <SidebarGroupContent>
        <RepoTree
          nodes={nodes}
          selectedPath={selectedPath}
          onFileClick={(node) => {
            navigate(ROUTES.drill)
            void onFileClick(node)
          }}
        />
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
