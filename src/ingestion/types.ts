// D-11: the loaded exercise, held in memory only (no persistence in Phase 1).

export type SourceType = 'paste' | 'upload'

export interface Exercise {
  /** Normalized, typing-ready text. Never the raw input. */
  text: string
  /** Best-effort. `'plaintext'` for paste (D-11, A11). */
  language: string
  sourceType: SourceType
  /** File name for uploads (D-11). Absent for paste. */
  sourceRef?: string
}
