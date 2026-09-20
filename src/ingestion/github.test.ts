import { describe, expect, it, vi } from 'vitest'
import { fromGithubBlob } from './github'
import { fromPaste } from './paste'
import { extToLang } from './language-map'
import { normalize } from './normalize'
import { CorpusTooLargeError, NonUtf8Error } from './errors'

const META = { owner: 'o', repo: 'r', path: 'src/main.ts' } as const

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

describe('fromGithubBlob', () => {
  it('tags a clean UTF-8 blob as a github Exercise with owner/repo:path', () => {
    const exercise = fromGithubBlob(utf8('const x = 1\n'), META)
    expect(exercise).toEqual({
      text: 'const x = 1\n',
      language: 'typescript',
      sourceType: 'github',
      sourceRef: 'o/r:src/main.ts',
    })
  })

  it('rejects 100001 bytes with CorpusTooLargeError before TextDecoder', () => {
    const decode = vi.spyOn(TextDecoder.prototype, 'decode')
    const bytes = new Uint8Array(100_001)
    expect(() => fromGithubBlob(bytes, META)).toThrow(CorpusTooLargeError)
    try {
      fromGithubBlob(bytes, META)
    } catch (err) {
      expect(err).toMatchObject({ sizeBytes: 100_001 })
    }
    expect(decode).not.toHaveBeenCalled()
    decode.mockRestore()
  })

  it('accepts 100000 bytes of 0x61 (normalize may append a newline)', () => {
    const bytes = new Uint8Array(100_000).fill(0x61)
    const exercise = fromGithubBlob(bytes, { ...META, path: 'edge.txt' })
    expect(exercise.text).toBe(`${'a'.repeat(100_000)}\n`)
    expect(exercise.sourceType).toBe('github')
  })

  it('rejects a UTF-16 LE BOM with NonUtf8Error using meta.path', () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x41, 0x00])
    expect(() => fromGithubBlob(bytes, META)).toThrow(NonUtf8Error)
    try {
      fromGithubBlob(bytes, META)
    } catch (err) {
      expect(err).toMatchObject({ fileName: META.path })
    }
  })

  it('rejects a UTF-16 BE BOM with NonUtf8Error', () => {
    const bytes = new Uint8Array([0xfe, 0xff, 0x00, 0x41])
    expect(() => fromGithubBlob(bytes, META)).toThrow(NonUtf8Error)
  })

  it('rejects decoded text containing U+FFFD with NonUtf8Error', () => {
    const bytes = utf8('valid then � garbage')
    expect(() => fromGithubBlob(bytes, META)).toThrow(NonUtf8Error)
    try {
      fromGithubBlob(bytes, META)
    } catch (err) {
      expect(err).toMatchObject({ fileName: META.path })
    }
  })

  it('normalizes identically to fromPaste / normalize of the same raw', () => {
    const raw = 'function f() {\r\n\tif (a)\treturn 1  \r\n}\r\n'
    const github = fromGithubBlob(utf8(raw), { ...META, path: 'f.js' })
    const pasted = fromPaste(raw, extToLang('f.js'))
    expect(github.text).toBe(pasted.text)
    expect(github.text).toBe(normalize(raw, { tabWidth: 4 }))
  })

  it('produces a github Exercise from empty bytes that pass UTF-8 rules', () => {
    const exercise = fromGithubBlob(new Uint8Array(0), META)
    expect(exercise.text).toBe('')
    expect(exercise.sourceType).toBe('github')
    expect(exercise.sourceRef).toBe('o/r:src/main.ts')
    expect(exercise.language).toBe('typescript')
  })

  it('does not put the blob sha in sourceRef', () => {
    const exercise = fromGithubBlob(utf8('x\n'), META)
    expect(exercise.sourceRef).toBe('o/r:src/main.ts')
    expect(exercise.sourceRef).not.toMatch(/deadbeef|[0-9a-f]{7,}/)
  })
})
