// PURE — zero imports. INPUT-03 / D-09. The transform ORDER is load-bearing
// (01-RESEARCH.md "Normalizer reference shape" + Pitfall 4); the 18 golden cases
// in normalize.test.ts lock it. Do NOT Unicode-normalize (NFC/NFD), do NOT strip
// NBSP / vertical tab / form feed — only ASCII space and tab count as trailing
// whitespace (assumption A4). v1 uses fixed-width tab expansion, not elastic tab
// stops (assumption A3).

export interface NormalizeOptions {
  tabWidth: number
}

export function normalize(raw: string, opts: NormalizeOptions = { tabWidth: 4 }): string {
  // Empty input returns empty string (must_haves / golden case 12). A non-empty
  // but whitespace-only input still collapses to exactly one newline (case 13).
  if (raw === '') return ''

  // 1. Strip a single leading BOM (U+FEFF), only at position 0.
  let s = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw

  // 2. CRLF and lone CR -> LF.
  s = s.replace(/\r\n?/g, '\n')

  // 3. Expand tabs — fixed width (A3), not elastic tab stops.
  const tab = ' '.repeat(Math.max(1, opts.tabWidth))
  s = s.replace(/\t/g, tab)

  // 4. Strip trailing ASCII space/tab per line.
  s = s.replace(/[ \t]+$/gm, '')

  // 5. Collapse to exactly one trailing newline (raw was non-empty, so we always
  //    end with exactly one "\n" — case 13).
  s = s.replace(/\n+$/g, '')
  return s + '\n'
}
