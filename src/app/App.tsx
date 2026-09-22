import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { AppShell } from '@/shared/components'
import { CorpusInput, CorpusSourceTabs, type CorpusTab } from '@/features/corpus'
import { RepoBrowser, RepoBrowserProvider, RepoSidebarTree } from '@/features/repo-browser'
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
import { ROUTES, viewFromPathname } from './routes'

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

function LazyRoute({ children, fallback }: { children: ReactNode; fallback: string }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<p className="text-muted">{fallback}</p>}>{children}</Suspense>
    </ErrorBoundary>
  )
}

export function App() {
  const session = useTrainerSession()
  const pathname = useLocation().pathname
  const view = viewFromPathname(pathname)
  const [corpusTab, setCorpusTab] = useState<CorpusTab>('paste')

  return (
    <RepoBrowserProvider onPlanned={session.startScaffold}>
      <AppShell
        banners={
          <Banners
            crossOriginIsolated={session.crossOriginIsolated}
            timingResolutionUs={session.timingResolutionUs}
          />
        }
        afterNav={<RepoSidebarTree />}
      >
        {/* D-08: trainer stays mounted across routes; hide with display, never unmount. */}
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
            <RepoBrowser />
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

        <Routes>
          <Route path={ROUTES.trainer} element={null} />
          <Route path="/trainer" element={<Navigate to={ROUTES.trainer} replace />} />
          <Route
            path={ROUTES.history}
            element={
              <LazyRoute fallback="Loading history…">
                <HistoryView />
              </LazyRoute>
            }
          />
          <Route
            path={ROUTES.analytics}
            element={
              <LazyRoute fallback="Loading analytics…">
                <AnalyticsDashboard />
              </LazyRoute>
            }
          />
          <Route path="*" element={<Navigate to={ROUTES.trainer} replace />} />
        </Routes>
      </AppShell>
    </RepoBrowserProvider>
  )
}
