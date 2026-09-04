// Ingestion errors are thrown as named classes and caught at the UI edge, where
// each maps to a fixed copy string rendered inline beneath the offending control
// (RESEARCH "Error-as-typed-class + inline render"). No stack trace, no toast.

export class CorpusTooLargeError extends Error {
  readonly sizeBytes: number

  constructor(sizeBytes: number) {
    super(`Corpus file is ${sizeBytes} bytes, over the 100 KB limit`)
    this.name = 'CorpusTooLargeError'
    this.sizeBytes = sizeBytes
  }
}

export class NonUtf8Error extends Error {
  readonly fileName: string

  constructor(fileName: string) {
    super(`Corpus file "${fileName}" is not UTF-8 text`)
    this.name = 'NonUtf8Error'
    this.fileName = fileName
  }
}
