import { History, Keyboard, ChartNoAxesColumn, FileCode, type LucideIcon } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'
import { ROUTES, viewFromPathname, type AppView } from '@/app/routes'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

export type { AppView }

const VIEWS: readonly {
  id: AppView
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
}[] = [
  { id: 'trainer', label: 'Trainer', to: ROUTES.trainer, icon: FileCode, end: true },
  { id: 'drill', label: 'Drill', to: ROUTES.drill, icon: Keyboard },
  { id: 'history', label: 'History', to: ROUTES.history, icon: History },
  { id: 'analytics', label: 'Analytics', to: ROUTES.analytics, icon: ChartNoAxesColumn },
]

export function ViewNav() {
  const view = viewFromPathname(useLocation().pathname)

  return (
    <nav aria-label="Primary">
      <SidebarMenu>
        {VIEWS.map((item) => (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton asChild isActive={view === item.id} icon={item.icon}>
              <NavLink to={item.to} end={item.end}>
                {item.label}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </nav>
  )
}
