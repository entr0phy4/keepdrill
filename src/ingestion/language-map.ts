// Best-effort language label from a file extension (D-11, A11). Not a parser —
// the value only tags the Exercise for later per-language metrics. Unknown or
// extension-less names fall back to 'plaintext', matching paste (D-11).
// Map contents are Claude's discretion per 01-CONTEXT.md.

const EXT_TO_LANG: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.sh': 'bash',
  '.bash': 'bash',
  '.sql': 'sql',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.toml': 'toml',
}

// D-12: canonical paste/upload language vocabulary, derived from EXT_TO_LANG's
// own value set so the two paths can never drift onto different lists. Computed
// once at module load. Deliberately excludes 'plaintext' — the caller presents
// that as the explicit, always-selected default (D-13) so "is this the default"
// stays visible at the call site rather than buried here. Do not export
// EXT_TO_LANG itself (Pitfall 5): that would leak the extension-keying concern
// into the UI layer.
export const PASTE_LANGUAGE_OPTIONS: readonly string[] = [
  ...new Set(Object.values(EXT_TO_LANG)),
].sort()

export function extToLang(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  // dot === -1: no extension. dot === 0: a dotfile with no suffix (".gitignore").
  if (dot <= 0) return 'plaintext'
  const ext = fileName.slice(dot).toLowerCase()
  return EXT_TO_LANG[ext] ?? 'plaintext'
}
