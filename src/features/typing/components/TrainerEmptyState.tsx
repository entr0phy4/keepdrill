export const TRAINER_EMPTY_COPY = {
  emptyHeading: 'No exercise loaded',
  emptyBody:
    'Paste code or text and choose Load exercise, or import a GitHub repo and click a TypeScript or JavaScript file to begin.',
} as const

export function TrainerEmptyState() {
  return (
    <section>
      <h2>{TRAINER_EMPTY_COPY.emptyHeading}</h2>
      <p className="text-muted">{TRAINER_EMPTY_COPY.emptyBody}</p>
    </section>
  )
}
