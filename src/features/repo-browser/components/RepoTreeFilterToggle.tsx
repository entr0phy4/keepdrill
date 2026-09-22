import { Button } from '@/components/ui/button'

export function RepoTreeFilterToggle({
  exercisesOnly,
  onExercisesOnlyChange,
}: {
  exercisesOnly: boolean
  onExercisesOnlyChange: (value: boolean) => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="compact"
      active={exercisesOnly}
      aria-pressed={exercisesOnly}
      aria-label={
        exercisesOnly
          ? 'Showing exercise files only. Show all files.'
          : 'Showing all files. Show exercise files only.'
      }
      onClick={() => onExercisesOnlyChange(!exercisesOnly)}
    >
      {exercisesOnly ? 'Exercises' : 'All files'}
    </Button>
  )
}
