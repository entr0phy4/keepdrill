// Platform seam — the ONLY module that imports the WASM runtime
// (web-tree-sitter). Kept out of the hot path. Callers receive a
// TsNode-compatible root or a thrown Error; Language.load / parse
// failures are not swallowed.

import { Language, Parser } from 'web-tree-sitter'
import type { TsNode } from './types'

export type Dialect = 'typescript' | 'tsx'

let initOnce: Promise<void> | null = null
const langs = new Map<Dialect, Language>()

export function ensureParser(): Promise<void> {
  initOnce ??= Parser.init({
    locateFile: (scriptName: string) => `/${scriptName}`,
  })
  return initOnce
}

export async function loadDialect(kind: Dialect): Promise<Language> {
  const hit = langs.get(kind)
  if (hit) return hit
  const path =
    kind === 'tsx' ? '/wasm/tree-sitter-tsx.wasm' : '/wasm/tree-sitter-typescript.wasm'
  const lang = await Language.load(path)
  langs.set(kind, lang)
  return lang
}

export function dialectForPath(path: string): Dialect {
  const slash = path.lastIndexOf('/')
  const basename = (slash === -1 ? path : path.slice(slash + 1)).toLowerCase()
  if (basename.endsWith('.tsx') || basename.endsWith('.jsx')) return 'tsx'
  return 'typescript'
}

export async function parseSource(text: string, dialect: Dialect): Promise<TsNode> {
  await ensureParser()
  const language = await loadDialect(dialect)
  const parser = new Parser()
  parser.setLanguage(language)
  const tree = parser.parse(text)
  if (!tree) {
    throw new Error('parse returned null')
  }
  return tree.rootNode
}
