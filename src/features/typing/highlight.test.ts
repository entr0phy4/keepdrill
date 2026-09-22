import { describe, expect, it } from 'vitest'
import { lineIndexAt, tokenKinds } from './highlight'

describe('tokenKinds', () => {
  it('colors a typescript keyword, string, number, and comment without treating source as markup', () => {
    const text = 'const name = "hi"\n// note\nadd(1)\n'
    const kinds = tokenKinds(text, 'typescript')
    const chars = Array.from(text)

    expect(kinds).toHaveLength(chars.length)
    expect(kinds.slice(0, 5).every((kind) => kind === 'keyword')).toBe(true)
    expect(kinds[chars.indexOf('"')]).toBe('string')
    expect(kinds[chars.indexOf('1')]).toBe('number')
    const comment = chars.indexOf('/')
    expect(kinds[comment]).toBe('comment')
    expect(kinds[text.indexOf('add')]).toBe('function')
    expect(text.includes('<')).toBe(false)
  })

  it('does not color a keyword that sits inside a string', () => {
    const text = '"const"\n'
    const kinds = tokenKinds(text, 'javascript')
    expect(kinds.every((kind) => kind === 'string' || kind === 'plain')).toBe(true)
  })

  it('leaves plaintext uncolored', () => {
    expect(tokenKinds('const x = 1\n', 'plaintext').every((kind) => kind === 'plain')).toBe(true)
  })
})

describe('lineIndexAt', () => {
  const chars = Array.from('ab\ncd\n')

  it('stays on the first line before the break', () => {
    expect(lineIndexAt(chars, 2)).toBe(0)
  })

  it('moves down once the cursor passes the newline', () => {
    expect(lineIndexAt(chars, 3)).toBe(1)
  })

  it('moves back up when the cursor returns before that newline', () => {
    expect(lineIndexAt(chars, 2)).toBe(0)
  })
})
