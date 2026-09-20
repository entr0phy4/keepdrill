// D-11: the loaded exercise, held in memory only (no persistence in Phase 1).
// sourceRef: upload = file name; github = owner/repo:path (no blob sha).

export type SourceType = 'paste' | 'upload' | 'github'

export interface Exercise {
  /** Normalized, typing-ready text. Never the raw input. */
  text: string
  /** Best-effort. `'plaintext'` for paste (D-11, A11). */
  language: string
  sourceType: SourceType
  /** File name for uploads (D-11). `owner/repo:path` for github. Absent for paste. */
  sourceRef?: string
}
