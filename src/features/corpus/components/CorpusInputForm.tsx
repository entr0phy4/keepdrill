import type { ChangeEvent } from 'react'
import { PASTE_LANGUAGE_OPTIONS } from '@/ingestion/language-map'
import { Button } from '@/components/ui/button'
import { NativeSelect, StatusMessage, TextareaField } from '@/shared/components'
import { CORPUS_COPY } from '../hooks/use-corpus-input'

export interface CorpusInputFormProps {
  value: string
  pasteLanguage: string
  fileError: string | null
  emptyError: string | null
  caption: string | null
  busy: boolean
  onPasteChange: (next: string) => void
  onLanguageChange: (language: string) => void
  onLoad: () => void
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void
}

const LANGUAGE_OPTIONS = [
  { value: 'plaintext', label: 'plaintext' },
  ...PASTE_LANGUAGE_OPTIONS.map((lang) => ({ value: lang, label: lang })),
]

export function CorpusInputForm({
  value,
  pasteLanguage,
  fileError,
  emptyError,
  caption,
  busy,
  onPasteChange,
  onLanguageChange,
  onLoad,
  onFileChange,
}: CorpusInputFormProps) {
  return (
    <section className="grid gap-4">
      <TextareaField
        id="corpus-paste"
        label="Paste code or text"
        value={value}
        onChange={(e) => onPasteChange(e.target.value)}
        placeholder="Paste a snippet, a file's contents, anything you want to drill…"
        rows={8}
        spellCheck={false}
      />

      <NativeSelect
        id="corpus-paste-language"
        label="Language"
        value={pasteLanguage}
        onChange={(e) => onLanguageChange(e.target.value)}
        options={LANGUAGE_OPTIONS}
      />

      <div className="grid gap-1">
        <label htmlFor="corpus-file" className="text-label">
          {CORPUS_COPY.fileLabel}
        </label>
        <input id="corpus-file" type="file" onChange={onFileChange} />
        <StatusMessage tone={fileError ? 'alert' : 'status'}>
          {fileError ?? (caption && <span className="text-label">{caption}</span>)}
        </StatusMessage>
      </div>

      <div className="grid gap-1">
        <div>
          <Button type="button" variant="primary" onClick={onLoad} disabled={busy} loading={busy}>
            {busy ? CORPUS_COPY.ctaBusy : CORPUS_COPY.cta}
          </Button>
        </div>
        <StatusMessage tone="alert">{emptyError}</StatusMessage>
      </div>
    </section>
  )
}
