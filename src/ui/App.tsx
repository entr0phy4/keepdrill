import { useMemo, useRef, useState } from 'react'
import type { Exercise } from '../ingestion/types'
import type { Session } from '../capture/types'
import { startSession } from '../session'
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

  const handleLoad = (loaded: Exercise) => {
    resetCapture() // fresh buffer per exercise
    setExercise(loaded)
    const session = startSession(loaded)
    sessionRef.current = session
    if (import.meta.env.DEV) {
      window.__keebdrillSession = session
    }
  }

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
