import { useState } from 'react'
import type { Exercise } from '../ingestion/types'
import { fromPaste } from '../ingestion/paste'

// Paste path only (INPUT-01). File input, empty state, "Nothing to load yet",
// Loading state and last-wins concurrency are Plan 01-02.

interface CorpusInputProps {
  onLoad: (exercise: Exercise) => void
}

export function CorpusInput({ onLoad }: CorpusInputProps) {
  const [value, setValue] = useState('')

  const handleLoad = () => {
    onLoad(fromPaste(value))
  }

  return (
    <section style={{ display: 'grid', gap: 'var(--space-sm)' }}>
      <label htmlFor="corpus-paste" className="text-label">
        Paste code or text
      </label>
      <textarea
        id="corpus-paste"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Paste a snippet, a file's contents, anything you want to drill…"
        rows={8}
        spellCheck={false}
      />
      <div>
        <button type="button" className="primary" onClick={handleLoad}>
          Load exercise
        </button>
      </div>
    </section>
  )
}
