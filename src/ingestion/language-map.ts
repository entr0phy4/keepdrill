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

export function extToLang(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  // dot === -1: no extension. dot === 0: a dotfile with no suffix (".gitignore").
  if (dot <= 0) return 'plaintext'
  const ext = fileName.slice(dot).toLowerCase()
  return EXT_TO_LANG[ext] ?? 'plaintext'
}
