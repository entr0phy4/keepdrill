import { useNavigate } from 'react-router'
import { ROUTES } from '@/app/routes'
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from '@/components/ui/sidebar'
import { useRepoBrowserContext } from '../RepoBrowserContext'
import { RepoTree } from './RepoTree'
import { RepoTreeFilterToggle } from './RepoTreeFilterToggle'

export function RepoTreePanel() {
  const { nodes, selectedPath, exercisesOnly, onFileClick } = useRepoBrowserContext()
  if (nodes === null || nodes.length === 0) return null
  return (
    <RepoTree
      nodes={nodes}
      selectedPath={selectedPath}
      exercisesOnly={exercisesOnly}
      onFileClick={(node) => void onFileClick(node)}
    />
  )
}

export function RepoSidebarTree() {
  const {
    nodes,
    caption,
    selectedPath,
    exercisesOnly,
    setExercisesOnly,
    onFileClick,
  } = useRepoBrowserContext()
  const navigate = useNavigate()

  if (nodes === null || nodes.length === 0) return null

  return (
    <SidebarGroup className="min-h-0">
      <SidebarGroupLabel>
        {caption || 'Repository'}
        <RepoTreeFilterToggle
          exercisesOnly={exercisesOnly}
          onExercisesOnlyChange={setExercisesOnly}
        />
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <RepoTree
          nodes={nodes}
          selectedPath={selectedPath}
          exercisesOnly={exercisesOnly}
          onFileClick={(node) => {
            navigate(ROUTES.drill)
            void onFileClick(node)
          }}
        />
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
