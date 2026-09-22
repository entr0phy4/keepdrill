import { Link } from 'react-router'
import { ROUTES } from '@/app/routes'
import { Button } from '@/components/ui/button'

export const TRAINER_EMPTY_COPY = {
  emptyHeading: 'No exercise loaded',
  emptyBody:
    'Paste code or text and choose Load exercise, or import a GitHub repo and click a TypeScript or JavaScript file to begin.',
  openTrainer: 'Open Trainer',
} as const

export function TrainerEmptyState() {
  return (
    <section className="grid gap-4">
      <h2>{TRAINER_EMPTY_COPY.emptyHeading}</h2>
      <p className="text-muted">{TRAINER_EMPTY_COPY.emptyBody}</p>
      <div>
        <Button asChild variant="primary">
          <Link to={ROUTES.trainer}>{TRAINER_EMPTY_COPY.openTrainer}</Link>
        </Button>
      </div>
    </section>
  )
}
