import type { Exercise } from './types'
import { normalize } from './normalize'
import { extToLang } from './language-map'
import { CorpusTooLargeError, NonUtf8Error } from './errors'
import { MAX_BYTES } from './upload'

// GitHub blob bytes -> Exercise. Same load-bearing order as fromFile
// (src/ingestion/upload.ts): size cap, UTF-16 BOM sniff, UTF-8 decode,
// U+FFFD scan, normalize only. Bytes are already in memory so this is sync.
// sourceRef is owner/repo:path — never the blob sha (FILE-02).

export function fromGithubBlob(
  bytes: Uint8Array,
  meta: { owner: string; repo: string; path: string },
  tabWidth = 4,
): Exercise {
  if (bytes.byteLength > MAX_BYTES) {
    throw new CorpusTooLargeError(bytes.byteLength)
  }

  if (
    bytes.length >= 2 &&
    ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))
  ) {
    throw new NonUtf8Error(meta.path)
  }

  const raw = new TextDecoder('utf-8').decode(bytes)
  if (raw.includes('�')) {
    throw new NonUtf8Error(meta.path)
  }

  return {
    text: normalize(raw, { tabWidth }),
    language: extToLang(meta.path),
    sourceType: 'github',
    sourceRef: `${meta.owner}/${meta.repo}:${meta.path}`,
  }
}
