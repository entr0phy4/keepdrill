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
} as const

function fileLabel(sourceRef: string | undefined): string | null {
  if (!sourceRef) return null
  const colon = sourceRef.indexOf(':')
  return colon === -1 ? sourceRef : sourceRef.slice(colon + 1)
}

function FileSourceView({
  text,
  sourceRef,
  loadToken,
  language,
  onRestartRequested,
  onComplete,
}: {
  text: string
  sourceRef?: string
  loadToken: number
  language: string
  onRestartRequested?: () => void
  onComplete?: (completedAt: number) => void
}) {
  const label = fileLabel(sourceRef)
  return (
    <section className="file-source" aria-label={label ?? 'File contents'}>
      {label ? <p className="file-source-path text-label">{label}</p> : null}
      <div className="file-source-body">
        <div className="file-source-flow">
          <CaptureSurface
            key={loadToken}
            plain
            text={text}
            language={language}
            onRestartRequested={onRestartRequested}
            onComplete={onComplete}
          />
        </div>
      </div>
    </section>
  )
}

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
          plain
          pathLabel={fileLabel(session.exercise.sourceRef) ?? undefined}
          language={session.exercise.language}
          text={session.exercise.text}
          units={session.curriculum}
          unitIndex={session.unitIndex}
          loadToken={session.loadToken}
          complete={session.scaffoldComplete}
          onRestartRequested={session.handleRestart}
          onComplete={session.handleComplete}
          onSelectUnit={session.selectUnit}
        />
      ) : (
        <FileSourceView
          text={session.exercise.text}
          sourceRef={session.exercise.sourceRef}
          loadToken={session.loadToken}
          language={session.exercise.language}
          onRestartRequested={session.handleRestart}
          onComplete={session.handleComplete}
        />
      )}
      {session.metrics !== null && <ResultsView metrics={session.metrics} />}
      {session.metrics !== null && session.saveFailed && (
        <SaveFailedNotice onDismiss={session.dismissSaveFailed} />
      )}
      {!session.scaffoldComplete && session.curriculum === null && (
        <Button type="button" variant="primary" onClick={session.handleRestart}>
          {COPY.restartExercise}
        </Button>
      )}
    </div>
  )
}
