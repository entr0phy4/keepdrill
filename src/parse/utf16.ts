// PURE — zero imports. Tree-sitter startIndex/endIndex are UTF-16 offsets;
// the trainer iterates code points via Array.from (Phase 3 uncompletable-exercise bug).

export function utf16ToCodePoint(text: string, utf16Index: number): number {
  return Array.from(text.slice(0, utf16Index)).length
}
