import { Button } from '@/components/ui/button'

export type AppView = 'trainer' | 'history' | 'analytics'

const VIEWS: readonly { id: AppView; label: string }[] = [
  { id: 'trainer', label: 'Trainer' },
  { id: 'history', label: 'History' },
  { id: 'analytics', label: 'Analytics' },
]

export interface ViewNavProps {
  view: AppView
  onViewChange: (view: AppView) => void
}

export function ViewNav({ view, onViewChange }: ViewNavProps) {
  return (
    <nav className="inline-flex gap-1" aria-label="Primary">
      {VIEWS.map((item) => (
        <Button
          key={item.id}
          type="button"
          variant="ghost"
          active={view === item.id}
          aria-current={view === item.id ? 'page' : undefined}
          onClick={() => onViewChange(item.id)}
        >
          {item.label}
        </Button>
      ))}
    </nav>
  )
}
