import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Exercise } from '../ingestion/types'
import { fromPaste } from '../ingestion/paste'
import { fromFile, MAX_BYTES } from '../ingestion/upload'
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
  errTooLargePaste: 'This paste is over 100 KB. Trim it down, or upload a smaller file instead.',
  errNonUtf8: "This file isn't UTF-8 text. Save it as UTF-8, or paste the contents instead.",
  errNothing: 'Nothing to load yet. Paste text or choose a file first.',
  caption: (name: string) => `Loaded from ${name}`,
} as const

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

    // WR-04: apply the same size cap upload.ts enforces before ever reading a
    // file — pasted content had no limit at all, so an arbitrarily large
    // clipboard payload ran normalize() synchronously on the full string
    // with nothing to stop it (worse than the jank WR-03 addresses, since
    // there is no upper bound). Measured in bytes (TextEncoder), matching
    // MAX_BYTES' unit (file.size), not JS string length.
    if (new TextEncoder().encode(value).length > MAX_BYTES) {
      setEmptyError(COPY.errTooLargePaste)
      return
    }
    setEmptyError(null)

    // WR-03: fromPaste() is synchronous and can block the main thread for a
    // large paste. Setting busy AFTER running it (the old code measured
    // duration post-hoc) meant the jank had already happened by the time
    // "Loading…" appeared, for at most one already-too-late frame. Set busy
    // first and force a paint via requestAnimationFrame BEFORE running the
    // transform, so the disabled button is actually visible for the
    // duration of the blocking work it exists to signal.
    const token = ++loadTokenRef.current
    setBusy(true)
    requestAnimationFrame(() => {
      if (loadTokenRef.current !== token) {
        setBusy(false)
        return
      }
      const exercise = fromPaste(value, 'plaintext')
      setCaption(null)
      setFileError(null)
      onLoad(exercise)
      setBusy(false)
    })
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
        {/* Reserve the row so showing an error / caption causes no reflow.
            WR-05: role must track which branch is showing — "alert" is an
            assertive live region reserved for errors; the ordinary success
            caption ("Loaded from main.ts") used the same role and so was
            announced by screen readers with the same urgency as a real
            error every time a file loaded successfully. */}
        <p
          role={fileError ? 'alert' : 'status'}
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
