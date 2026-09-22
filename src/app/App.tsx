import { lazy, Suspense, useCallback, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import { AppShell } from '@/shared/components'
import { CorpusInput, CorpusSourceTabs, type CorpusTab } from '@/features/corpus'
import { RepoBrowser, RepoBrowserProvider, RepoSidebarTree } from '@/features/repo-browser'
import { DrillView, useTrainerSession } from '@/features/typing'
import type { Exercise } from '@/ingestion/types'
import type { FilePlan } from '@/parse/types'
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

function LazyRoute({ children, fallback }: { children: ReactNode; fallback: string }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<p className="text-muted">{fallback}</p>}>{children}</Suspense>
    </ErrorBoundary>
  )
}

export function App() {
  const session = useTrainerSession()
  const navigate = useNavigate()
  const pathname = useLocation().pathname
  const view = viewFromPathname(pathname)
  const [corpusTab, setCorpusTab] = useState<CorpusTab>('paste')

  const handleLoad = useCallback(
    (loaded: Exercise) => {
      session.handleLoad(loaded)
      void navigate(ROUTES.drill)
    },
    [navigate, session.handleLoad],
  )

  const startScaffold = useCallback(
    (plan: FilePlan) => {
      session.startScaffold(plan)
      void navigate(ROUTES.drill)
    },
    [navigate, session.startScaffold],
  )

  return (
    <RepoBrowserProvider onPlanned={startScaffold}>
      <AppShell
        banners={<Banners crossOriginIsolated={session.crossOriginIsolated} />}
        afterNav={<RepoSidebarTree />}
      >
        {/* D-08: corpus + drill stay mounted across routes; hide with display, never unmount. */}
        <div style={{ display: view === 'trainer' ? 'grid' : 'none' }} className="gap-4">
          <CorpusSourceTabs tab={corpusTab} onTabChange={setCorpusTab} />
          <div
            id="corpus-panel-paste"
            role="tabpanel"
            aria-labelledby="corpus-tab-paste"
            style={{ display: corpusTab === 'paste' ? 'grid' : 'none' }}
          >
            <CorpusInput onLoad={handleLoad} />
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

        <DrillView session={session} visible={view === 'drill'} />

        <Routes>
          <Route path={ROUTES.trainer} element={null} />
          <Route path={ROUTES.drill} element={null} />
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
