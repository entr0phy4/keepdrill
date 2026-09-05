import type { Exercise } from './types'
import { normalize } from './normalize'
import { extToLang } from './language-map'
import { CorpusTooLargeError, NonUtf8Error } from './errors'

// File upload -> Exercise. Lifted from 01-RESEARCH.md "File upload -> Exercise"
// and hardened with a UTF-16 BOM sniff (PITFALLS #6, #7 / A5, A6).
//
// Order is load-bearing:
//   1. size cap BEFORE any read — an oversize file is never pulled into memory
//   2. UTF-16 BOM sniff on the first 2 bytes -> NonUtf8Error
//   3. File.text() — the modern promise-based UTF-8 read (no FileReader, no
//      hand-rolled charset sniffing)
//   4. U+FFFD scan on the decoded text -> NonUtf8Error
//   5. normalize() only — content is typed as-is, nothing parsed or stripped (D-08)
//
// file.name is used ONLY for the caption / Exercise.sourceRef — never as a path,
// URL, fetch argument, or dynamic import (T-01-06).

// Exported (WR-04) so the paste path (CorpusInput.tsx) can enforce the same
// cap instead of accepting arbitrarily large pasted input unchecked.
export const MAX_BYTES = 100_000

export async function fromFile(file: File, tabWidth = 4): Promise<Exercise> {
  if (file.size > MAX_BYTES) {
    throw new CorpusTooLargeError(file.size)
  }

  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer())
  if (
    head.length >= 2 &&
    ((head[0] === 0xff && head[1] === 0xfe) || (head[0] === 0xfe && head[1] === 0xff))
  ) {
    throw new NonUtf8Error(file.name)
  }

  const raw = await file.text()
  if (raw.includes('�')) {
    throw new NonUtf8Error(file.name)
  }

  return {
    text: normalize(raw, { tabWidth }),
    language: extToLang(file.name),
    sourceType: 'upload',
    sourceRef: file.name,
  }
}
