import type { Exercise } from './types'
import { normalize } from './normalize'

// D-15: pasted content is `sourceType: 'paste'` with a caller-supplied language
// (the paste-form <select> in CorpusInput.tsx). Language is required — no
// default — so a missed call site is a compile error, not a silent 'plaintext'
// (D-15 / RESEARCH Anti-Patterns). Content is loaded as-is — normalize() only
// touches newlines, tabs, per-line trailing ASCII whitespace and a leading BOM;
// it never parses or strips content (D-08).
export function fromPaste(raw: string, language: string, tabWidth = 4): Exercise {
  return {
    text: normalize(raw, { tabWidth }),
    language,
    sourceType: 'paste',
  }
}
