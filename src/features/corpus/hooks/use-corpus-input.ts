import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Exercise } from '@/ingestion/types'
import { fromPaste } from '@/ingestion/paste'
import { fromFile, MAX_BYTES } from '@/ingestion/upload'
import { CorpusTooLargeError, NonUtf8Error } from '@/ingestion/errors'

export const CORPUS_COPY = {
  fileLabel: 'Or upload a file',
  cta: 'Load exercise',
  ctaBusy: 'Loading…',
  errTooLarge: 'This file is over 100 KB. Paste a smaller section, or trim the file first.',
  errTooLargePaste: 'This paste is over 100 KB. Trim it down, or upload a smaller file instead.',
  errNonUtf8: "This file isn't UTF-8 text. Save it as UTF-8, or paste the contents instead.",
  errNothing: 'Nothing to load yet. Paste text or choose a file first.',
  caption: (name: string) => `Loaded from ${name}`,
} as const

export interface UseCorpusInputResult {
  value: string
  pasteLanguage: string
  fileError: string | null
  emptyError: string | null
  caption: string | null
  busy: boolean
  handlePasteChange: (next: string) => void
  setPasteLanguage: (language: string) => void
  handleLoad: () => void
  handleFileChange: (e: ChangeEvent<HTMLInputElement>) => Promise<void>
}

export function useCorpusInput(onLoad: (exercise: Exercise) => void): UseCorpusInputResult {
  const [value, setValue] = useState('')
  const [pasteLanguage, setPasteLanguage] = useState('plaintext')
  const [fileError, setFileError] = useState<string | null>(null)
  const [emptyError, setEmptyError] = useState<string | null>(null)
  const [caption, setCaption] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const loadTokenRef = useRef(0)

  const handlePasteChange = (next: string) => {
    setValue(next)
    setEmptyError(null)
  }

  const handleLoad = () => {
    if (value.trim() === '') {
      setEmptyError(CORPUS_COPY.errNothing)
      return
    }

    if (new TextEncoder().encode(value).length > MAX_BYTES) {
      setEmptyError(CORPUS_COPY.errTooLargePaste)
      return
    }
    setEmptyError(null)

    const token = ++loadTokenRef.current
    setBusy(true)
    requestAnimationFrame(() => {
      if (loadTokenRef.current !== token) {
        setBusy(false)
        return
      }
      const exercise = fromPaste(value, pasteLanguage)
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
      setCaption(CORPUS_COPY.caption(file.name))
      onLoad(exercise)
    } catch (err) {
      if (loadTokenRef.current !== token) return
      if (err instanceof CorpusTooLargeError) {
        setFileError(CORPUS_COPY.errTooLarge)
      } else if (err instanceof NonUtf8Error) {
        setFileError(CORPUS_COPY.errNonUtf8)
      } else {
        throw err
      }
    }
  }

  return {
    value,
    pasteLanguage,
    fileError,
    emptyError,
    caption,
    busy,
    handlePasteChange,
    setPasteLanguage,
    handleLoad,
    handleFileChange,
  }
}
