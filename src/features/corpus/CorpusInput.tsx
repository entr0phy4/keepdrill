import type { Exercise } from '@/ingestion/types'
import { CorpusInputForm } from './components/CorpusInputForm'
import { useCorpusInput } from './hooks/use-corpus-input'

export interface CorpusInputProps {
  onLoad: (exercise: Exercise) => void
}

export function CorpusInput({ onLoad }: CorpusInputProps) {
  const corpus = useCorpusInput(onLoad)
  return (
    <CorpusInputForm
      value={corpus.value}
      pasteLanguage={corpus.pasteLanguage}
      fileError={corpus.fileError}
      emptyError={corpus.emptyError}
      caption={corpus.caption}
      busy={corpus.busy}
      onPasteChange={corpus.handlePasteChange}
      onLanguageChange={corpus.setPasteLanguage}
      onLoad={corpus.handleLoad}
      onFileChange={(e) => {
        void corpus.handleFileChange(e)
      }}
    />
  )
}
