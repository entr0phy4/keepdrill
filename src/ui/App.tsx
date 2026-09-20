import { useEffect, useMemo, useRef, useState } from 'react'
import type { Exercise } from '../ingestion/types'
import type { Session } from '../capture/types'
import { buildSession } from '../session'
import { readCrossOriginIsolated, probeTimerResolutionUs } from '../platform/isolation'
import { resetCapture } from '../capture/capture'
import { computeSessionMetrics } from '../metrics/metrics'
import type { MetricsResult } from '../metrics/metrics'
import { saveSession } from '../persistence/repository'
import { Banners } from './Banners'
import { CorpusInput } from './CorpusInput'
import { CaptureSurface } from './CaptureSurface'
import { ResultsView } from './ResultsView'
import { SaveFailedNotice } from './SaveFailedNotice'
import { HistoryView } from './HistoryView'
import { AnalyticsDashboard } from './AnalyticsDashboard'

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

  const handleLoad = (loaded: Exercise) => {
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

  // Computes a fresh MetricsResult the instant CaptureSurface reports
  // completion (D-07's fire-once guarantee). Re-reads the exercise/startedAt
  // from loadRef (never a stale closure) and builds a LIVE session snapshot
  // (session.ts's CR-01) rather than reading the interval-refreshed
  // sessionRef, since completion can happen between refresh ticks.
  const handleComplete = (completedAt: number) => {
    const current = loadRef.current
    if (!current) return
    const session = buildSession(current.exercise, current.startedAt)
    const result = computeSessionMetrics(current.exercise.text, session.charLog, session.markers, completedAt)
    setMetrics(result)
    // D-04/PERS-03: fire-and-forget, AFTER setMetrics, never awaited — the
    // results screen renders synchronously regardless of write outcome.
    setSaveFailed(false)
    void saveSession({ session, completedAt, metricsSnapshot: result }).catch((err: unknown) => {
      console.warn('[keebdrill] session not persisted:', err)
      setSaveFailed(true)
    })
  }

  // D-08: Restart keeps the SAME loaded exercise content — only the session
  // state resets. Never calls setExercise; only resetCapture() + a loadToken
  // bump (remounting CaptureSurface to discard stale DOM/IME state) plus a
  // fresh startedAt for the session snapshot, mirroring handleLoad's shape
  // without loading new content.
  const handleRestart = () => {
    const current = loadRef.current
    if (!current) return
    resetCapture()
    setLoadToken((token) => token + 1)
    setMetrics(null) // discard the just-computed metrics (D-06)
    setSaveFailed(false) // a stale save-failure notice never survives a restart
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
    if (exercise === null) return
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
  }, [exercise])

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

      <CorpusInput onLoad={handleLoad} />

      {exercise === null ? (
        view === 'trainer' && (
          <section>
            <h2>No exercise loaded</h2>
            <p className="text-muted">
              Paste code or text below, or upload a file, then choose{' '}
              <strong>Load exercise</strong> to begin.
            </p>
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
          <CaptureSurface
            key={loadToken}
            text={exercise.text}
            onRestartRequested={handleRestart}
            onComplete={handleComplete}
          />
          {metrics !== null && <ResultsView metrics={metrics} />}
          {metrics !== null && saveFailed && (
            <SaveFailedNotice onDismiss={() => setSaveFailed(false)} />
          )}
          <button type="button" className="primary" onClick={handleRestart}>
            Restart exercise
          </button>
        </div>
      )}
      {view === 'history' && <HistoryView />}
      {view === 'analytics' && <AnalyticsDashboard />}
    </main>
  )
}
