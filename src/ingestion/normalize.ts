// PURE — zero imports. INPUT-03 / D-09.
//
// RED stub: returns the raw input unchanged so the golden suite fails first.
// The real fixed-order transform lands in the GREEN step.

export interface NormalizeOptions {
  tabWidth: number
}

export function normalize(raw: string, _opts: NormalizeOptions = { tabWidth: 4 }): string {
  return raw
}
