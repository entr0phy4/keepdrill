import { lazy, Suspense, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AppShell, ViewNav, type AppView } from '@/shared/components'
import { CorpusInput, CorpusSourceTabs, type CorpusTab } from '@/features/corpus'
import { RepoBrowser } from '@/features/repo-browser'
import {
  CaptureSurface,
  FileScaffold,
  ResultsView,
  SaveFailedNotice,
  TrainerEmptyState,
  useTrainerSession,
} from '@/features/typing'
import { Banners } from '@/features/status'
import { ErrorBoundary } from './ErrorBoundary'

const HistoryView = lazy(async () => {
  const mod = await import('@/features/history')
  return { default: mod.HistoryView }
})

const AnalyticsDashboard = lazy(async () => {
  const mod = await import('@/features/insights')
  return { default: mod.AnalyticsDashboard }
})

const COPY = {
  restartExercise: 'Restart exercise',
  restartUnit: 'Restart unit',
} as const

export function App() {
  const session = useTrainerSession()
  const [view, setView] = useState<AppView>('trainer')
  const [corpusTab, setCorpusTab] = useState<CorpusTab>('paste')

  return (
    <AppShell
      title="keebdrill"
      nav={<ViewNav view={view} onViewChange={setView} />}
      banners={
        <Banners
          crossOriginIsolated={session.crossOriginIsolated}
          timingResolutionUs={session.timingResolutionUs}
        />
      }
    >
      <div style={{ display: view === 'trainer' ? 'grid' : 'none' }} className="gap-4">
        <CorpusSourceTabs tab={corpusTab} onTabChange={setCorpusTab} />
        <div
          id="corpus-panel-paste"
          role="tabpanel"
          aria-labelledby="corpus-tab-paste"
          style={{ display: corpusTab === 'paste' ? 'grid' : 'none' }}
        >
          <CorpusInput onLoad={session.handleLoad} />
        </div>
        <div
          id="corpus-panel-github"
          role="tabpanel"
          aria-labelledby="corpus-tab-github"
          data-file-plan={session.filePlan !== null ? 'true' : undefined}
          style={{ display: corpusTab === 'github' ? 'grid' : 'none' }}
        >
          <RepoBrowser onPlanned={session.startScaffold} />
        </div>
      </div>

      {session.exercise === null ? (
        view === 'trainer' && <TrainerEmptyState />
      ) : (
        <div style={{ display: view === 'trainer' ? 'grid' : 'none' }} className="gap-4">
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
      )}

      {view === 'history' && (
        <ErrorBoundary>
          <Suspense fallback={<p className="text-muted">Loading history…</p>}>
            <HistoryView />
          </Suspense>
        </ErrorBoundary>
      )}
      {view === 'analytics' && (
        <ErrorBoundary>
          <Suspense fallback={<p className="text-muted">Loading analytics…</p>}>
            <AnalyticsDashboard />
          </Suspense>
        </ErrorBoundary>
      )}
    </AppShell>
  )
}
