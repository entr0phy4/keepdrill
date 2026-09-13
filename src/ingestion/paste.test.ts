import { describe, expect, it } from 'vitest'
import { fromPaste } from './paste'
import { normalize } from './normalize'

describe('fromPaste', () => {
  it('returns an Exercise tagged with the caller-supplied language', () => {
    const raw = 'def f():\n\treturn 1\n'
    const exercise = fromPaste(raw, 'python')
    expect(exercise.language).toBe('python')
    expect(exercise.sourceType).toBe('paste')
    expect(exercise.text).toBe(normalize(raw, { tabWidth: 4 }))
  })
})
