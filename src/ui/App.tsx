import { useEffect, useMemo, useRef, useState } from 'react'
import type { Exercise } from '../ingestion/types'
import type { FilePlan, PlanUnit } from '../parse/types'
import type { Session } from '../capture/types'
import { buildSession, assembleSessionFromLogs } from '../session'
import { readCrossOriginIsolated, probeTimerResolutionUs } from '../platform/isolation'
import { resetCapture, getEvents, getCharLog, getMarkers } from '../capture/capture'
import { computeSessionMetrics } from '../metrics/metrics'
import type { MetricsResult } from '../metrics/metrics'
import { saveSession } from '../persistence/repository'
import { flattenSnapshots, type UnitSnapshot } from '../scaffold/flatten'
import { joinUnitSlices } from '../scaffold/slice'
import { Banners } from './Banners'
import { CorpusInput } from './CorpusInput'
import { RepoBrowser } from './RepoBrowser'
import { CaptureSurface } from './CaptureSurface'
import { FileScaffold } from './FileScaffold'
import { ResultsView } from './ResultsView'
import { SaveFailedNotice } from './SaveFailedNotice'
import { HistoryView } from './HistoryView'
import { AnalyticsDashboard } from './AnalyticsDashboard'

const COPY = {
  emptyHeading: 'No exercise loaded',
  emptyBody:
    'Paste code or text and choose Load exercise, or import a GitHub repo and click a TypeScript or JavaScript file to begin.',
  restartExercise: 'Restart exercise',
  restartUnit: 'Restart unit',
} as const

declare global {
  interface Window {
    __keebdrillSession?: Session
  }
}

// CR-01: session.buildSession() is a live snapshot, not a one-time event —
// re-read it on a cadence tied to actual typing so sessionRef and the
// dev-only window.__keebdrillSession inspection point reflect real keystrokes
// instead of the empty buffer that existed the instant an exercise loaded.
// Same order of magnitude as useCapture's own THROTTLE_MS.
const SESSION_REFRESH_MS = 250

export function App() {
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [filePlan, setFilePlan] = useState<FilePlan | null>(null)
  const [curriculum, setCurriculum] = useState<PlanUnit[] | null>(null)
  const [unitIndex, setUnitIndex] = useState(0)
  const [scaffoldComplete, setScaffoldComplete] = useState(false)
  const snapshotsRef = useRef<UnitSnapshot[]>([])
  const curriculumRef = useRef(curriculum)
  const unitIndexRef = useRef(unitIndex)
  const scaffoldCompleteRef = useRef(scaffoldComplete)
  curriculumRef.current = curriculum
  unitIndexRef.current = unitIndex
  scaffoldCompleteRef.current = scaffoldComplete
  // CR-02: a monotonic token, not exercise content, so CaptureSurface remounts
  // on every load — including loading the *same* text/file twice in a row,
  // which a content-derived key would miss. The remount discards the stale
  // uncontrolled <textarea> DOM node (and its stale value/IME state) rather
  // than leaving it mounted with the previous exercise's typed text still
  // visible against the new prompt.
  const [loadToken, setLoadToken] = useState(0)

  // crossOriginIsolated does not change over the lifetime of the document
  // (D-16), so it is read once. timingResolutionUs DOES change — it starts as
  // a static per-browser expectation and is meant to update once real
  // keystrokes are measured (A10) — so, unlike crossOriginIsolated, it is
  // state kept fresh by the same refresh interval that re-snapshots the
  // session below (WR-01: previously read once via this same useMemo and
  // frozen forever, so the Banner's "Timer resolution" text never reflected
  // an actual measurement no matter how much the user typed).
  const crossOriginIsolated = useMemo(() => readCrossOriginIsolated(), [])
  const [timingResolutionUs, setTimingResolutionUs] = useState(() => probeTimerResolutionUs())

  const sessionRef = useRef<Session | null>(null)
  const loadRef = useRef<{ exercise: Exercise; startedAt: number } | null>(null)
  const [metrics, setMetrics] = useState<MetricsResult | null>(null)
  // PERS-03/D-15: reflects only the most-recent completion's write outcome —
  // cleared at the start of every handleComplete and on any fresh load/restart.
  const [saveFailed, setSaveFailed] = useState(false)
  // D-07/D-01: no router — a plain useState view flip among Trainer, History,
  // and Analytics. Trainer subtree hides via display, never unmounts (D-08).
  const [view, setView] = useState<'trainer' | 'history' | 'analytics'>('trainer')
  const [corpusTab, setCorpusTab] = useState<'paste' | 'github'>('paste')

  const handleLoad = (loaded: Exercise) => {
    snapshotsRef.current = []
    setCurriculum(null)
    setUnitIndex(0)
    setFilePlan(null)
    setScaffoldComplete(false)
    resetCapture() // fresh buffer per exercise
    setExercise(loaded)
    setLoadToken((token) => token + 1)
    setMetrics(null) // no stale results panel survives a fresh load
    setSaveFailed(false) // a stale save-failure notice never survives a fresh load
    const startedAt = Date.now()
    loadRef.current = { exercise: loaded, startedAt }
    const session = buildSession(loaded, startedAt)
    sessionRef.current = session
    setTimingResolutionUs(session.timingResolutionUs)
    if (import.meta.env.DEV) {
      window.__keebdrillSession = session
    }
  }

  const startScaffold = (plan: FilePlan) => {
    snapshotsRef.current = []
    resetCapture()
    setFilePlan(plan)
    setExercise(plan.exercise)
    setCurriculum(plan.units)
    setUnitIndex(0)
    setScaffoldComplete(false)
    setLoadToken((token) => token + 1)
    setMetrics(null)
    setSaveFailed(false)
    const startedAt = Date.now()
    loadRef.current = { exercise: plan.exercise, startedAt }
    sessionRef.current = null
  }

  // Computes a fresh MetricsResult the instant CaptureSurface reports
  // completion (D-07's fire-once guarantee). Re-reads the exercise/startedAt
  // from loadRef (never a stale closure) and builds a LIVE session snapshot
  // (session.ts's CR-01) rather than reading the interval-refreshed
  // sessionRef, since completion can happen between refresh ticks.
  const handleComplete = (completedAt: number) => {
    const units = curriculumRef.current
    if (units !== null) {
      if (scaffoldCompleteRef.current) return
      snapshotsRef.current.push({
        events: getEvents(),
        charLog: getCharLog(),
        markers: getMarkers(),
      })
      resetCapture()
      const idx = unitIndexRef.current
      if (idx < units.length - 1) {
        setUnitIndex(idx + 1)
        setLoadToken((token) => token + 1)
        return
      }
      const current = loadRef.current
      if (!current) return
      const logs = flattenSnapshots(snapshotsRef.current)
      const session = assembleSessionFromLogs(current.exercise, logs, current.startedAt)
      const typedTarget = joinUnitSlices(current.exercise.text, units)
      const result = computeSessionMetrics(typedTarget, session.charLog, session.markers, completedAt)
      setMetrics(result)
      setSaveFailed(false)
      setScaffoldComplete(true)
      scaffoldCompleteRef.current = true
      void saveSession({ session, completedAt, metricsSnapshot: result }).catch((err: unknown) => {
        console.warn('[keebdrill] session not persisted:', err)
        setSaveFailed(true)
      })
      return
    }

    const current = loadRef.current
    if (!current) return
    const session = buildSession(current.exercise, current.startedAt)
    const result = computeSessionMetrics(current.exercise.text, session.charLog, session.markers, completedAt)
    setMetrics(result)
    setSaveFailed(false)
    void saveSession({ session, completedAt, metricsSnapshot: result }).catch((err: unknown) => {
      console.warn('[keebdrill] session not persisted:', err)
      setSaveFailed(true)
    })
  }

  const handleRestart = () => {
    const current = loadRef.current
    if (!current) return
    if (curriculumRef.current !== null) {
      if (scaffoldCompleteRef.current) return
      resetCapture()
      setLoadToken((token) => token + 1)
      setSaveFailed(false)
      return
    }
    resetCapture()
    setLoadToken((token) => token + 1)
    setMetrics(null)
    setSaveFailed(false)
    const startedAt = Date.now()
    loadRef.current = { exercise: current.exercise, startedAt }
    const session = buildSession(current.exercise, startedAt)
    sessionRef.current = session
    setTimingResolutionUs(session.timingResolutionUs)
    if (import.meta.env.DEV) {
      window.__keebdrillSession = session
    }
  }

  // Re-snapshot on an interval while an exercise is loaded, so sessionRef and
  // the dev inspection point pick up keystrokes typed after load instead of
  // staying frozen at the empty buffer captured the instant the exercise
  // loaded (CR-01). Cleared on unmount / when the exercise changes.
  useEffect(() => {
    if (exercise === null || curriculum !== null) return
    const id = setInterval(() => {
      const current = loadRef.current
      if (!current) return
      const session = buildSession(current.exercise, current.startedAt)
      sessionRef.current = session
      setTimingResolutionUs(session.timingResolutionUs)
      if (import.meta.env.DEV) {
        window.__keebdrillSession = session
      }
    }, SESSION_REFRESH_MS)
    return () => clearInterval(id)
  }, [exercise, curriculum])

  return (
    <main style={{ display: 'grid', gap: 'var(--space-lg)' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 'var(--space-md)',
          flexWrap: 'wrap',
        }}
      >
        <h1>keebdrill</h1>
        <nav style={{ display: 'inline-flex', gap: 'var(--space-xs)' }}>
          <button
            type="button"
            aria-current={view === 'trainer' ? 'page' : undefined}
            onClick={() => setView('trainer')}
          >
            Trainer
          </button>
          <button
            type="button"
            aria-current={view === 'history' ? 'page' : undefined}
            onClick={() => setView('history')}
          >
            History
          </button>
          <button
            type="button"
            aria-current={view === 'analytics' ? 'page' : undefined}
            onClick={() => setView('analytics')}
          >
            Analytics
          </button>
        </nav>
      </header>

      <Banners
        crossOriginIsolated={crossOriginIsolated}
        timingResolutionUs={timingResolutionUs}
      />

      <div style={{ display: view === 'trainer' ? 'grid' : 'none', gap: 'var(--space-md)' }}>
        <div
          role="tablist"
          aria-label="Corpus source"
          style={{ display: 'inline-flex', gap: 'var(--space-xs)' }}
        >
          <button
            type="button"
            role="tab"
            id="corpus-tab-paste"
            aria-controls="corpus-panel-paste"
            aria-selected={corpusTab === 'paste' ? 'true' : 'false'}
            onClick={() => setCorpusTab('paste')}
          >
            Paste
          </button>
          <button
            type="button"
            role="tab"
            id="corpus-tab-github"
            aria-controls="corpus-panel-github"
            aria-selected={corpusTab === 'github' ? 'true' : 'false'}
            onClick={() => setCorpusTab('github')}
          >
            GitHub
          </button>
        </div>
        <div
          id="corpus-panel-paste"
          role="tabpanel"
          style={{ display: corpusTab === 'paste' ? 'grid' : 'none' }}
        >
          <CorpusInput onLoad={handleLoad} />
        </div>
        <div
          id="corpus-panel-github"
          role="tabpanel"
          data-file-plan={filePlan !== null ? 'true' : undefined}
          style={{ display: corpusTab === 'github' ? 'grid' : 'none' }}
        >
          <RepoBrowser onPlanned={startScaffold} />
        </div>
      </div>

      {exercise === null ? (
        view === 'trainer' && (
          <section>
            <h2>{COPY.emptyHeading}</h2>
            <p className="text-muted">{COPY.emptyBody}</p>
          </section>
        )
      ) : (
        // D-08: hide, don't unmount — toggling `display` directly (never the
        // `hidden` attribute, which inline `display` would override; never a
        // conditional unmount, which would drop the uncontrolled <textarea>'s
        // DOM node and caret/IME state). CaptureSurface's key={loadToken} is
        // untouched by this toggle.
        //
        // Residual assumption (RESEARCH Open Question 1 / A1, 04-UI-SPEC.md
        // "unresolved" row): happy-dom has no layout engine and cannot verify
        // real uncontrolled-<textarea> selection/IME behavior across a real
        // display:none toggle — that is proven here only in happy-dom
        // (App.test.tsx's D-08 regression block). The real verification is a
        // Chromium human-check (queued end-of-phase). Fallback if it fails:
        // lift the capture buffer into a React ref that survives a
        // CaptureSurface remount and let the trainer unmount instead.
        <div style={{ display: view === 'trainer' ? 'grid' : 'none', gap: 'var(--space-md)' }}>
          {curriculum !== null ? (
            <FileScaffold
              text={exercise.text}
              units={curriculum}
              unitIndex={unitIndex}
              loadToken={loadToken}
              complete={scaffoldComplete}
              onRestartRequested={handleRestart}
              onComplete={handleComplete}
            />
          ) : (
            <CaptureSurface
              key={loadToken}
              text={exercise.text}
              onRestartRequested={handleRestart}
              onComplete={handleComplete}
            />
          )}
          {metrics !== null && <ResultsView metrics={metrics} />}
          {metrics !== null && saveFailed && (
            <SaveFailedNotice onDismiss={() => setSaveFailed(false)} />
          )}
          {!scaffoldComplete && (
            <button type="button" className="primary" onClick={handleRestart}>
              {curriculum !== null ? COPY.restartUnit : COPY.restartExercise}
            </button>
          )}
        </div>
      )}
      {view === 'history' && <HistoryView />}
      {view === 'analytics' && <AnalyticsDashboard />}
    </main>
  )
}
