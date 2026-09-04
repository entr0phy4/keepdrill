import { describe, expect, it, vi } from 'vitest'
import { fromFile } from './upload'
import { extToLang } from './language-map'
import { CorpusTooLargeError, NonUtf8Error } from './errors'
import { fromPaste } from './paste'
import { normalize } from './normalize'

// environment: 'node' (vitest "unit" project). Node 20+ provides global File /
// Blob with .text(), .slice() and .arrayBuffer().

function textFile(contents: string, name = 'snippet.txt'): File {
  return new File([contents], name, { type: 'text/plain' })
}

function bytesFile(bytes: number[], name = 'snippet.txt'): File {
  return new File([new Uint8Array(bytes).buffer as ArrayBuffer], name, {
    type: 'application/octet-stream',
  })
}

describe('fromFile', () => {
  it('turns a clean UTF-8 file into a normalized upload Exercise', async () => {
    const file = textFile('const x = 1\n', 'main.ts')
    const exercise = await fromFile(file)

    expect(exercise).toEqual({
      text: 'const x = 1\n',
      language: 'typescript',
      sourceType: 'upload',
      sourceRef: 'main.ts',
    })
  })

  it('rejects a file over 100 KB with CorpusTooLargeError and never reads it', async () => {
    const file = textFile('x', 'huge.txt')
    Object.defineProperty(file, 'size', { value: 100_001 })
    const textSpy = vi.spyOn(file, 'text')

    await expect(fromFile(file)).rejects.toBeInstanceOf(CorpusTooLargeError)
    await expect(fromFile(file)).rejects.toMatchObject({ sizeBytes: 100_001 })
    expect(textSpy).not.toHaveBeenCalled()
  })

  it('accepts a file exactly at the 100 KB boundary', async () => {
    const file = textFile('a'.repeat(100_000), 'edge.txt')
    expect(file.size).toBe(100_000)
    const exercise = await fromFile(file)
    expect(exercise.text).toBe('a'.repeat(100_000) + '\n')
  })

  it('rejects a UTF-16 LE BOM file with NonUtf8Error', async () => {
    const file = bytesFile([0xff, 0xfe, 0x41, 0x00], 'utf16le.txt')
    await expect(fromFile(file)).rejects.toBeInstanceOf(NonUtf8Error)
    await expect(fromFile(file)).rejects.toMatchObject({ fileName: 'utf16le.txt' })
  })

  it('rejects a UTF-16 BE BOM file with NonUtf8Error', async () => {
    const file = bytesFile([0xfe, 0xff, 0x00, 0x41], 'utf16be.txt')
    await expect(fromFile(file)).rejects.toBeInstanceOf(NonUtf8Error)
  })

  it('rejects a file whose decoded text contains U+FFFD with NonUtf8Error', async () => {
    const file = textFile('valid then � garbage', 'mojibake.txt')
    await expect(fromFile(file)).rejects.toBeInstanceOf(NonUtf8Error)
    await expect(fromFile(file)).rejects.toMatchObject({ fileName: 'mojibake.txt' })
  })

  it('normalizes CRLF + tabs identically to fromPaste of the same string', async () => {
    const raw = 'function f() {\r\n\tif (a)\treturn 1  \r\n}\r\n'
    const uploaded = await fromFile(textFile(raw, 'f.js'))
    const pasted = fromPaste(raw)
    expect(uploaded.text).toBe(pasted.text)
    expect(uploaded.text).toBe(normalize(raw, { tabWidth: 4 }))
  })

  it('respects a custom tab width', async () => {
    const uploaded = await fromFile(textFile('\tx\n', 'a.txt'), 2)
    expect(uploaded.text).toBe('  x\n')
  })

  it('resolves an empty Exercise for a 0-byte file', async () => {
    const file = textFile('', 'empty.txt')
    expect(file.size).toBe(0)
    const exercise = await fromFile(file)
    expect(exercise.text).toBe('')
    expect(exercise.sourceType).toBe('upload')
    expect(exercise.sourceRef).toBe('empty.txt')
  })

  it('types content as-is: comments and string literals are preserved', async () => {
    const raw = '// TODO: keep me\nconst s = "  spaced  literal  "\n'
    const exercise = await fromFile(textFile(raw, 'keep.ts'))
    expect(exercise.text).toBe('// TODO: keep me\nconst s = "  spaced  literal  "\n')
  })

  it('derives sourceRef and language only from file.name, not a path', async () => {
    const exercise = await fromFile(textFile('SELECT 1\n', 'weird name (1).SQL'))
    expect(exercise.sourceRef).toBe('weird name (1).SQL')
    expect(exercise.language).toBe('sql')
  })
})

describe('extToLang', () => {
  it.each([
    ['main.ts', 'typescript'],
    ['App.tsx', 'typescript'],
    ['script.js', 'javascript'],
    ['component.jsx', 'javascript'],
    ['app.py', 'python'],
    ['lib.rs', 'rust'],
    ['main.go', 'go'],
    ['deploy.sh', 'bash'],
    ['run.bash', 'bash'],
    ['query.sql', 'sql'],
    ['data.json', 'json'],
    ['config.yaml', 'yaml'],
    ['config.yml', 'yaml'],
    ['README.md', 'markdown'],
    ['NOTES.markdown', 'markdown'],
    ['page.html', 'html'],
    ['style.css', 'css'],
    ['Cargo.toml', 'toml'],
  ])('maps %s -> %s', (name, lang) => {
    expect(extToLang(name)).toBe(lang)
  })

  it('is case-insensitive on the extension', () => {
    expect(extToLang('MAIN.TS')).toBe('typescript')
    expect(extToLang('Query.SqL')).toBe('sql')
  })

  it('returns plaintext for an unknown extension', () => {
    expect(extToLang('archive.xyz')).toBe('plaintext')
  })

  it('returns plaintext for a file with no extension', () => {
    expect(extToLang('Makefile')).toBe('plaintext')
  })

  it('returns plaintext for a dotfile with no suffix', () => {
    expect(extToLang('.gitignore')).toBe('plaintext')
  })
})
