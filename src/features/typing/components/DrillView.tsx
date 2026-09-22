import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { CaptureSurface } from '../CaptureSurface'
import { FileScaffold } from '../FileScaffold'
import type { TrainerSession } from '../hooks/use-trainer-session'
import { ResultsView } from './ResultsView'
import { SaveFailedNotice } from './SaveFailedNotice'
import { TrainerEmptyState } from './TrainerEmptyState'

const COPY = {
  restartExercise: 'Restart exercise',
  restartUnit: 'Restart unit',
} as const

export function DrillView({ session, visible }: { session: TrainerSession; visible: boolean }) {
  useEffect(() => {
    if (!visible || session.exercise === null) return
    document.getElementById('capture-surface')?.focus()
  }, [visible, session.exercise, session.loadToken])

  if (session.exercise === null) {
    return visible ? <TrainerEmptyState /> : null
  }

  return (
    <div style={{ display: visible ? 'grid' : 'none' }} className="gap-4">
      {session.curriculum !== null ? (
        <FileScaffold
          text={session.exercise.text}
          units={session.curriculum}
          unitIndex={session.unitIndex}
          loadToken={session.loadToken}
          complete={session.scaffoldComplete}
          onRestartRequested={session.handleRestart}
          onComplete={session.handleComplete}
        />
      ) : (
        <CaptureSurface
          key={session.loadToken}
          text={session.exercise.text}
          onRestartRequested={session.handleRestart}
          onComplete={session.handleComplete}
        />
      )}
      {session.metrics !== null && <ResultsView metrics={session.metrics} />}
      {session.metrics !== null && session.saveFailed && (
        <SaveFailedNotice onDismiss={session.dismissSaveFailed} />
      )}
      {!session.scaffoldComplete && (
        <Button type="button" variant="primary" onClick={session.handleRestart}>
          {session.curriculum !== null ? COPY.restartUnit : COPY.restartExercise}
        </Button>
      )}
    </div>
  )
}
