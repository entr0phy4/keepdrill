import { describe, expect, it } from 'vitest'
import { PASTE_LANGUAGE_OPTIONS } from './language-map'

describe('PASTE_LANGUAGE_OPTIONS', () => {
  it('is a deduplicated alphabetized vocabulary derived from EXT_TO_LANG, without plaintext', () => {
    expect(PASTE_LANGUAGE_OPTIONS).toEqual([
      'bash',
      'css',
      'go',
      'html',
      'javascript',
      'json',
      'markdown',
      'python',
      'rust',
      'sql',
      'toml',
      'typescript',
      'yaml',
    ])
    expect(PASTE_LANGUAGE_OPTIONS).not.toContain('plaintext')
    expect(new Set(PASTE_LANGUAGE_OPTIONS).size).toBe(PASTE_LANGUAGE_OPTIONS.length)
  })
})
