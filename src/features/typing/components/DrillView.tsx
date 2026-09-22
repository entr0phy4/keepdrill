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
      <CaptureSurface
        key={loadToken}
        plain
        text={text}
        language={language}
        onRestartRequested={onRestartRequested}
        onComplete={onComplete}
      />
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
      <FileSourceView
        text={session.exercise.text}
        sourceRef={session.exercise.sourceRef}
        loadToken={session.loadToken}
        language={session.exercise.language}
        onRestartRequested={session.handleRestart}
        onComplete={session.handleCompleteRendered}
      />
      {/* Unit scaffold stays mounted so the curriculum session remains.
          Its capture is off: the full file above is the only typing surface. */}
      <div className="drill-suspended">
        {session.curriculum !== null ? (
          <FileScaffold
            text={session.exercise.text}
            units={session.curriculum}
            unitIndex={session.unitIndex}
            loadToken={session.loadToken}
            complete={session.scaffoldComplete}
            interactive={false}
            onRestartRequested={session.handleRestart}
            onComplete={session.handleComplete}
          />
        ) : null}
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
    </div>
  )
}
