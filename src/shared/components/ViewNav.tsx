import { NavLink, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { ROUTES, viewFromPathname, type AppView } from '@/app/routes'

export type { AppView }

const VIEWS: readonly { id: AppView; label: string; to: string; end?: boolean }[] = [
  { id: 'trainer', label: 'Trainer', to: ROUTES.trainer, end: true },
  { id: 'history', label: 'History', to: ROUTES.history },
  { id: 'analytics', label: 'Analytics', to: ROUTES.analytics },
]

export function ViewNav() {
  const view = viewFromPathname(useLocation().pathname)

  return (
    <nav className="inline-flex gap-1" aria-label="Primary">
      {VIEWS.map((item) => (
        <Button key={item.id} asChild variant="ghost" active={view === item.id}>
          <NavLink to={item.to} end={item.end}>
            {item.label}
          </NavLink>
        </Button>
      ))}
    </nav>
  )
}
