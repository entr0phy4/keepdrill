import { useEffect, useMemo, useRef, useState } from 'react'
import type { Exercise } from '../ingestion/types'
import type { Session } from '../capture/types'
import { buildSession } from '../session'
import { readCrossOriginIsolated, probeTimerResolutionUs } from '../platform/isolation'
import { resetCapture } from '../capture/capture'
import { computeSessionMetrics } from '../metrics/metrics'
import type { MetricsResult } from '../metrics/metrics'
import { Banners } from './Banners'
import { CorpusInput } from './CorpusInput'
import { CaptureSurface } from './CaptureSurface'
import { ResultsView } from './ResultsView'

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

  const handleLoad = (loaded: Exercise) => {
    resetCapture() // fresh buffer per exercise
    setExercise(loaded)
    setLoadToken((token) => token + 1)
    setMetrics(null) // no stale results panel survives a fresh load
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
      <header>
        <h1>keebdrill</h1>
      </header>

      <Banners
        crossOriginIsolated={crossOriginIsolated}
        timingResolutionUs={timingResolutionUs}
      />

      <CorpusInput onLoad={handleLoad} />

      {exercise === null ? (
        <section>
          <h2>No exercise loaded</h2>
          <p className="text-muted">
            Paste code or text below, or upload a file, then choose{' '}
            <strong>Load exercise</strong> to begin.
          </p>
        </section>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
          <CaptureSurface
            key={loadToken}
            text={exercise.text}
            onRestartRequested={handleRestart}
            onComplete={handleComplete}
          />
          {metrics !== null && <ResultsView metrics={metrics} />}
          <button type="button" className="primary" onClick={handleRestart}>
            Restart exercise
          </button>
        </div>
      )}
    </main>
  )
}
