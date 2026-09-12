// PURE — zero DOM access, zero side effects, safe to call repeatedly (no
// shared mutable module state). Depends ONLY on the target exercise text —
// this module must NEVER import the attempt-stream record types from
// ../capture/types or read charLog. Weighting the formula per-character
// over the attempt stream (rather than once over the target) is the exact
// double-counting trap this module exists to avoid (D-04, RESEARCH.md
// Pitfall 5).
// Do NOT round any number inside this module — round only at the display
// layer (ResultsView.tsx / HistoryView.tsx).

/** Tunable weight: at 100% symbol density, wpm is multiplied by this value
 *  (D-05). A one-line tune, not a buried magic number — mirrors metrics.ts's
 *  MIN_GAP_MS/MAX_GAP_MS/MIN_SAMPLES placement. */
export const SYMBOL_WEIGHT = 2

/** D-01's three-way classifier: alnum (not counted), whitespace (not
 *  counted, but still part of the denominator), symbol (counted) — every
 *  codepoint that is neither alnum nor whitespace counts as a symbol,
 *  including underscore and emoji. Returns the fraction of `target`'s
 *  codepoints classified as symbols. */
export function classifySymbolDensity(target: string): number {
  // Code-point array, not raw string indexing (D-02) — a supplementary-
  // plane codepoint (e.g. emoji) would otherwise desync a raw .length/index
  // walk, exactly like metrics.ts's own Array.from(target) rationale.
  const codepoints = Array.from(target)

  // Zero-length-target guard — never divide by zero.
  if (codepoints.length === 0) return 0

  let symbolCount = 0
  for (const ch of codepoints) {
    if (/[A-Za-z0-9]/.test(ch)) continue
    if (/\s/.test(ch)) continue
    symbolCount += 1
  }

  return symbolCount / codepoints.length
}

/** D-05's exact linear weighting formula: a 0 density leaves wpm unchanged,
 *  a 1.0 (100%) density multiplies wpm by SYMBOL_WEIGHT, and every density
 *  in between interpolates linearly. */
export function computeSymbolAdjustedWpm(wpm: number, symbolDensity: number): number {
  const difficultyMultiplier = 1 + symbolDensity * (SYMBOL_WEIGHT - 1)
  return wpm * difficultyMultiplier
}
