import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Exercise } from '../ingestion/types'
import { fromPaste } from '../ingestion/paste'
import { fromFile } from '../ingestion/upload'
import { CorpusTooLargeError, NonUtf8Error } from '../ingestion/errors'

// Handles paste (INPUT-01) and upload (INPUT-02) plus every error / empty /
// loading / concurrency state from 01-UI-SPEC.md. The onLoad(exercise) seam is
// unchanged from Plan 01-01 — App.tsx is not touched.
//
// Copy strings are verbatim from 01-UI-SPEC.md Copywriting Contract.
const COPY = {
  fileLabel: 'Or upload a file',
  cta: 'Load exercise',
  ctaBusy: 'Loading…',
  errTooLarge: 'This file is over 100 KB. Paste a smaller section, or trim the file first.',
  errNonUtf8: "This file isn't UTF-8 text. Save it as UTF-8, or paste the contents instead.",
  errNothing: 'Nothing to load yet. Paste text or choose a file first.',
  caption: (name: string) => `Loaded from ${name}`,
} as const

// A normalize() transform that outlasts one animation frame (~16ms) is the only
// case that shows the disabled "Loading…" button state (backstop truth).
const FRAME_MS = 16

interface CorpusInputProps {
  onLoad: (exercise: Exercise) => void
}

export function CorpusInput({ onLoad }: CorpusInputProps) {
  const [value, setValue] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [emptyError, setEmptyError] = useState<string | null>(null)
  const [caption, setCaption] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Monotonic token: every new load attempt (paste or file) claims the next
  // value; a result only lands if its token is still current (last-wins).
  const loadTokenRef = useRef(0)

  const handlePasteChange = (next: string) => {
    setValue(next)
    setEmptyError(null)
  }

  const handleLoad = () => {
    if (value.trim() === '') {
      setEmptyError(COPY.errNothing)
      return
    }
    setEmptyError(null)

    const token = ++loadTokenRef.current
    const started = performance.now()
    const exercise = fromPaste(value)
    const slow = performance.now() - started > FRAME_MS

    const commit = () => {
      if (loadTokenRef.current !== token) return
      setCaption(null)
      setFileError(null)
      onLoad(exercise)
    }

    if (slow) {
      setBusy(true)
      requestAnimationFrame(() => {
        commit()
        setBusy(false)
      })
    } else {
      commit()
    }
  }

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const token = ++loadTokenRef.current
    setFileError(null)

    try {
      const exercise = await fromFile(file)
      if (loadTokenRef.current !== token) return
      setEmptyError(null)
      setFileError(null)
      setCaption(COPY.caption(file.name))
      onLoad(exercise)
    } catch (err) {
      if (loadTokenRef.current !== token) return
      if (err instanceof CorpusTooLargeError) {
        setFileError(COPY.errTooLarge)
      } else if (err instanceof NonUtf8Error) {
        setFileError(COPY.errNonUtf8)
      } else {
        throw err
      }
    }
  }

  return (
    <section style={{ display: 'grid', gap: 'var(--space-md)' }}>
      <div style={{ display: 'grid', gap: 'var(--space-xs)' }}>
        <label htmlFor="corpus-paste" className="text-label">
          Paste code or text
        </label>
        <textarea
          id="corpus-paste"
          value={value}
          onChange={(e) => handlePasteChange(e.target.value)}
          placeholder="Paste a snippet, a file's contents, anything you want to drill…"
          rows={8}
          spellCheck={false}
        />
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-xs)' }}>
        <label htmlFor="corpus-file" className="text-label">
          {COPY.fileLabel}
        </label>
        <input id="corpus-file" type="file" onChange={handleFileChange} />
        {/* Reserve the row so showing an error / caption causes no reflow. */}
        <p
          role="alert"
          className={fileError ? undefined : 'text-muted'}
          style={{
            margin: 0,
            minHeight: '1.4em',
            color: fileError ? 'var(--color-destructive)' : undefined,
          }}
        >
          {fileError ?? (caption && <span className="text-label">{caption}</span>)}
        </p>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-xs)' }}>
        <div>
          <button type="button" className="primary" onClick={handleLoad} disabled={busy}>
            {busy ? COPY.ctaBusy : COPY.cta}
          </button>
        </div>
        <p
          role="alert"
          style={{
            margin: 0,
            minHeight: '1.4em',
            color: 'var(--color-destructive)',
          }}
        >
          {emptyError}
        </p>
      </div>
    </section>
  )
}
