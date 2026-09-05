import { useEffect, useMemo, useRef, useState } from 'react'
import type { Exercise } from '../ingestion/types'
import type { Session } from '../capture/types'
import { buildSession } from '../session'
import { readCrossOriginIsolated, probeTimerResolutionUs } from '../platform/isolation'
import { resetCapture } from '../capture/capture'
import { Banners } from './Banners'
import { CorpusInput } from './CorpusInput'
import { CaptureSurface } from './CaptureSurface'

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

  // Read the platform environment once (D-16). These do not change over the
  // lifetime of the document.
  const platform = useMemo(
    () => ({
      crossOriginIsolated: readCrossOriginIsolated(),
      timingResolutionUs: probeTimerResolutionUs(),
    }),
    [],
  )

  const sessionRef = useRef<Session | null>(null)
  const loadRef = useRef<{ exercise: Exercise; startedAt: number } | null>(null)

  const handleLoad = (loaded: Exercise) => {
    resetCapture() // fresh buffer per exercise
    setExercise(loaded)
    const startedAt = Date.now()
    loadRef.current = { exercise: loaded, startedAt }
    const session = buildSession(loaded, startedAt)
    sessionRef.current = session
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
        crossOriginIsolated={platform.crossOriginIsolated}
        timingResolutionUs={platform.timingResolutionUs}
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
        <>
          <section style={{ display: 'grid', gap: 'var(--space-sm)' }}>
            <h2>Exercise</h2>
            <pre className="preview">{exercise.text}</pre>
          </section>
          <CaptureSurface />
        </>
      )}
    </main>
  )
}
