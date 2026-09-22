// Character-level source color. React text nodes only — never markup.

export type TokenKind = 'plain' | 'keyword' | 'string' | 'comment' | 'number' | 'function' | 'punct'

const C_KEYWORDS = [
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch',
  'case', 'break', 'continue', 'default', 'class', 'extends', 'new', 'this', 'super', 'import',
  'export', 'from', 'as', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'typeof',
  'instanceof', 'in', 'of', 'void', 'null', 'undefined', 'true', 'false', 'type', 'interface',
  'enum', 'public', 'private', 'protected', 'readonly', 'implements', 'static', 'yield',
] as const

const KEYWORDS: Record<string, readonly string[]> = {
  typescript: C_KEYWORDS,
  javascript: C_KEYWORDS,
  rust: ['fn', 'let', 'mut', 'const', 'struct', 'enum', 'impl', 'trait', 'pub', 'use', 'mod', 'return', 'if', 'else', 'for', 'while', 'loop', 'match', 'async', 'await', 'self', 'Self', 'true', 'false', 'where', 'type'],
  go: ['func', 'var', 'const', 'type', 'struct', 'interface', 'package', 'import', 'return', 'if', 'else', 'for', 'range', 'switch', 'case', 'defer', 'go', 'map', 'chan', 'true', 'false', 'nil'],
  python: ['def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'import', 'from', 'as', 'with', 'try', 'except', 'finally', 'raise', 'pass', 'lambda', 'yield', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is', 'async', 'await'],
  bash: ['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case', 'esac', 'in', 'function', 'return', 'local'],
  sql: ['select', 'from', 'where', 'and', 'or', 'not', 'insert', 'into', 'values', 'update', 'set', 'delete', 'join', 'left', 'right', 'inner', 'on', 'group', 'by', 'order', 'as', 'create', 'table', 'null', 'true', 'false'],
  css: ['import', 'media', 'keyframes', 'from', 'to'],
}

type CommentStyle = { line?: string; block?: readonly [string, string] }

const COMMENTS: Record<string, CommentStyle> = {
  typescript: { line: '//', block: ['/*', '*/'] },
  javascript: { line: '//', block: ['/*', '*/'] },
  rust: { line: '//', block: ['/*', '*/'] },
  go: { line: '//', block: ['/*', '*/'] },
  css: { block: ['/*', '*/'] },
  sql: { line: '--', block: ['/*', '*/'] },
  python: { line: '#' },
  bash: { line: '#' },
  yaml: { line: '#' },
  toml: { line: '#' },
  html: { block: ['<!--', '-->'] },
}

const PUNCT = new Set('{}[]().,;:<>+-*/%&|^!~?=')

function startsWith(chars: readonly string[], index: number, token: string): boolean {
  for (let i = 0; i < token.length; i++) {
    if (chars[index + i] !== token[i]) return false
  }
  return true
}

function fill(kinds: TokenKind[], from: number, to: number, kind: TokenKind): void {
  for (let i = from; i < to && i < kinds.length; i++) kinds[i] = kind
}

function isIdentStart(ch: string): boolean {
  return /[A-Za-z_$]/.test(ch)
}

function isIdent(ch: string): boolean {
  return /[A-Za-z0-9_$]/.test(ch)
}

/** One kind per code point, same indexing as the trainer cursor. */
export function tokenKinds(text: string, language: string): TokenKind[] {
  const chars = Array.from(text)
  const kinds: TokenKind[] = new Array<TokenKind>(chars.length).fill('plain')
  if (language === 'plaintext' || language === '') return kinds
  const keywords = new Set(KEYWORDS[language] ?? [])
  const comments = COMMENTS[language]
  const strings = language !== 'plaintext'

  let i = 0
  while (i < chars.length) {
    const ch = chars[i] ?? ''

    if (comments?.block && startsWith(chars, i, comments.block[0])) {
      const start = i
      i += comments.block[0].length
      while (i < chars.length && !startsWith(chars, i, comments.block[1])) i += 1
      i = Math.min(chars.length, i + comments.block[1].length)
      fill(kinds, start, i, 'comment')
      continue
    }

    if (comments?.line && startsWith(chars, i, comments.line)) {
      const start = i
      while (i < chars.length && chars[i] !== '\n') i += 1
      fill(kinds, start, i, 'comment')
      continue
    }

    if (strings && (ch === '"' || ch === "'" || ch === '`')) {
      const quote = ch
      const start = i
      i += 1
      while (i < chars.length && chars[i] !== quote && chars[i] !== '\n') {
        if (chars[i] === '\\') i += 2
        else i += 1
      }
      if (chars[i] === quote) i += 1
      fill(kinds, start, i, 'string')
      continue
    }

    if (ch >= '0' && ch <= '9') {
      const start = i
      while (i < chars.length && /[0-9._xXa-fA-F]/.test(chars[i] ?? '')) i += 1
      fill(kinds, start, i, 'number')
      continue
    }

    if (isIdentStart(ch)) {
      const start = i
      i += 1
      while (i < chars.length && isIdent(chars[i] ?? '')) i += 1
      const word = chars.slice(start, i).join('')
      if (keywords.has(word) || (language === 'sql' && keywords.has(word.toLowerCase()))) {
        fill(kinds, start, i, 'keyword')
        continue
      }
      let look = i
      while (look < chars.length && (chars[look] === ' ' || chars[look] === '\n')) look += 1
      if (chars[look] === '(') fill(kinds, start, i, 'function')
      continue
    }

    if (PUNCT.has(ch)) {
      kinds[i] = 'punct'
      i += 1
      continue
    }

    i += 1
  }

  return kinds
}

/** 0-based line of the cursor. A newline belongs to the line it ends. */
export function lineIndexAt(chars: readonly string[], cursor: number): number {
  let line = 0
  const end = Math.min(Math.max(cursor, 0), chars.length)
  for (let i = 0; i < end; i++) {
    if (chars[i] === '\n') line += 1
  }
  return line
}
