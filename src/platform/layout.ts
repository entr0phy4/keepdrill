// Best-effort keyboard-layout notice (D-17). Chromium-only API; Firefox and
// Safari refuse navigator.keyboard for fingerprinting reasons. This NEVER throws,
// NEVER blocks first paint, and NEVER gates the UI — it only console.warns once
// on a clearly non-ANSI layout. There is no on-page ANSI banner.

let warned = false

// A handful of physical keys whose printed value differs on common non-ANSI
// layouts (e.g. AZERTY, QWERTZ). Not exhaustive — a coarse "clearly not ANSI" signal.
const ANSI_EXPECTATIONS: ReadonlyArray<readonly [code: string, expected: string]> = [
  ['KeyQ', 'q'],
  ['KeyW', 'w'],
  ['KeyA', 'a'],
  ['KeyZ', 'z'],
  ['Semicolon', ';'],
  ['BracketLeft', '['],
]

export async function warnIfNonAnsiLayout(): Promise<void> {
  if (warned) return
  try {
    const kb = (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } })
      .keyboard
    const getLayoutMap = kb?.getLayoutMap
    if (typeof getLayoutMap !== 'function') return // not Chromium — silent

    const map = await getLayoutMap.call(kb)
    const mismatches = ANSI_EXPECTATIONS.filter(([code, expected]) => {
      const actual = map.get(code)
      return typeof actual === 'string' && actual.toLowerCase() !== expected
    })

    if (mismatches.length >= 2 && !warned) {
      warned = true
      console.warn(
        '[keebdrill] Keyboard layout looks non-US-ANSI (%s). ' +
          'keebdrill is built and tested for US ANSI; symbol keys may mismatch.',
        mismatches.map(([code]) => code).join(', '),
      )
    }
  } catch {
    // getLayoutMap can reject (permissions policy, headless) — never fatal.
  }
}
