import type { Exercise } from './types'
import { normalize } from './normalize'

// D-11 / A11: pasted content is always `language: 'plaintext'`, `sourceType: 'paste'`.
// Content is loaded as-is — normalize() only touches newlines, tabs, per-line
// trailing ASCII whitespace and a leading BOM; it never parses or strips content (D-08).
export function fromPaste(raw: string, tabWidth = 4): Exercise {
  return {
    text: normalize(raw, { tabWidth }),
    language: 'plaintext',
    sourceType: 'paste',
  }
}
