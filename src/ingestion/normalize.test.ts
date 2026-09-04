import { describe, it, expect } from 'vitest'
import { normalize } from './normalize'

const BOM = '﻿'
const NBSP = ' '
const VT = ''
const FF = ''

interface Case {
  n: number
  name: string
  input: string
  tabWidth: number
  expected: string
}

// The 18 golden cases from 01-RESEARCH.md "Golden-test cases" (INPUT-03).
// Transform order and values are load-bearing — do not reorder or "simplify".
const cases: Case[] = [
  { n: 1, name: 'CRLF -> LF', input: 'a\r\nb\r\n', tabWidth: 4, expected: 'a\nb\n' },
  { n: 2, name: 'lone CR (old Mac) -> LF', input: 'a\rb', tabWidth: 4, expected: 'a\nb\n' },
  { n: 3, name: 'mixed endings', input: 'a\r\nb\nc', tabWidth: 4, expected: 'a\nb\nc\n' },
  { n: 4, name: 'leading BOM stripped', input: BOM + 'hello', tabWidth: 4, expected: 'hello\n' },
  { n: 5, name: 'BOM + CRLF', input: BOM + 'a\r\nb', tabWidth: 4, expected: 'a\nb\n' },
  { n: 6, name: 'leading tab indent (width 4)', input: '\tx', tabWidth: 4, expected: '    x\n' },
  { n: 7, name: 'mid-line tab, fixed-width (width 4)', input: 'a\tb', tabWidth: 4, expected: 'a    b\n' },
  { n: 8, name: 'configurable width (width 2)', input: '\tx', tabWidth: 2, expected: '  x\n' },
  { n: 9, name: 'trailing spaces + trailing tab stripped', input: 'x   \ny\t\n', tabWidth: 4, expected: 'x\ny\n' },
  { n: 10, name: 'adds final newline', input: 'no newline', tabWidth: 4, expected: 'no newline\n' },
  { n: 11, name: 'collapse trailing blank lines', input: 'x\n\n\n\n', tabWidth: 4, expected: 'x\n' },
  { n: 12, name: 'empty stays empty', input: '', tabWidth: 4, expected: '' },
  { n: 13, name: 'whitespace-only -> single newline', input: '   \n\t\n', tabWidth: 4, expected: '\n' },
  { n: 14, name: 'interior blank lines preserved', input: 'a\n\n\nb\n', tabWidth: 4, expected: 'a\n\n\nb\n' },
  {
    n: 15,
    name: 'non-ASCII / emoji preserved, trailing space stripped',
    input: 'café ☕ \n',
    tabWidth: 4,
    expected: 'café ☕\n',
  },
  { n: 16, name: 'blank CRLF line -> empty LF line', input: 'a\r\n   \r\nb', tabWidth: 4, expected: 'a\n\nb\n' },
  {
    n: 17,
    name: 'NBSP is not trailing ASCII ws — preserved',
    input: 'line ' + NBSP + '\n',
    tabWidth: 4,
    expected: 'line ' + NBSP + '\n',
  },
  { n: 18, name: 'multiple tabs (width 4)', input: 'a\tb\tc\n', tabWidth: 4, expected: 'a    b    c\n' },
]

describe('normalize() — 18 golden cases (INPUT-03)', () => {
  it.each(cases)('case $n: $name', ({ input, tabWidth, expected }) => {
    expect(normalize(input, { tabWidth })).toBe(expected)
  })
})

describe('normalize() — contract edges', () => {
  it('empty input returns empty string (explicit, no trailing newline added)', () => {
    expect(normalize('')).toBe('')
  })

  it('defaults tabWidth to 4 when opts omitted', () => {
    expect(normalize('\tx')).toBe('    x\n')
  })

  it('does not Unicode-normalize (NFC/NFD left alone)', () => {
    // e + combining acute (U+0065 U+0301) must NOT be folded to U+00E9.
    const decomposed = 'é'
    expect(normalize(decomposed)).toBe(decomposed + '\n')
    expect(normalize(decomposed)).not.toBe('é\n')
  })

  it('strips only a single leading BOM, only at index 0', () => {
    expect(normalize(BOM + BOM + 'x')).toBe(BOM + 'x\n')
    expect(normalize('x' + BOM + 'y')).toBe('x' + BOM + 'y\n')
  })

  it('does not strip NBSP / vertical tab / form feed as trailing whitespace (A4)', () => {
    expect(normalize('x' + NBSP)).toBe('x' + NBSP + '\n')
    expect(normalize('x' + VT)).toBe('x' + VT + '\n')
    expect(normalize('x' + FF)).toBe('x' + FF + '\n')
  })
})
