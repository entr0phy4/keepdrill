// PURE — zero DOM access, zero Dexie, no platform APIs. Static US-ANSI
// geometry table for the heatmap fold (D-10). Analog of language-map.ts:
// named constant + tiny lookup helper, computed once.
// Do NOT import src/platform/layout.ts — that file is the runtime
// layout-mismatch warning seam, not a code → {row, col} table.

export interface KeyGeometry {
  code: string
  /** 0 = number row … 4 = space row */
  row: number
  col: number
  span: number
  /** Unshifted US-ANSI glyph (≤5 characters so a 32×48 key box can hold label + ms). */
  label: string
  sampleable: boolean
}

/** Alphanumeric block only — no function row, arrows, numpad, or Intl codes.
 *  sampleable: letters, digits, punctuation, Space, Enter, Backspace, Tab.
 *  Drawn, sampleable:false: Shift*, Control*, Alt*, Meta*, CapsLock. */
export const US_ANSI_KEYS: readonly KeyGeometry[] = [
  // row 0 — number row
  { code: 'Backquote', row: 0, col: 0, span: 1, label: '`', sampleable: true },
  { code: 'Digit1', row: 0, col: 1, span: 1, label: '1', sampleable: true },
  { code: 'Digit2', row: 0, col: 2, span: 1, label: '2', sampleable: true },
  { code: 'Digit3', row: 0, col: 3, span: 1, label: '3', sampleable: true },
  { code: 'Digit4', row: 0, col: 4, span: 1, label: '4', sampleable: true },
  { code: 'Digit5', row: 0, col: 5, span: 1, label: '5', sampleable: true },
  { code: 'Digit6', row: 0, col: 6, span: 1, label: '6', sampleable: true },
  { code: 'Digit7', row: 0, col: 7, span: 1, label: '7', sampleable: true },
  { code: 'Digit8', row: 0, col: 8, span: 1, label: '8', sampleable: true },
  { code: 'Digit9', row: 0, col: 9, span: 1, label: '9', sampleable: true },
  { code: 'Digit0', row: 0, col: 10, span: 1, label: '0', sampleable: true },
  { code: 'Minus', row: 0, col: 11, span: 1, label: '-', sampleable: true },
  { code: 'Equal', row: 0, col: 12, span: 1, label: '=', sampleable: true },
  { code: 'Backspace', row: 0, col: 13, span: 2, label: 'Bksp', sampleable: true },
  // row 1 — QWERTY
  { code: 'Tab', row: 1, col: 0, span: 2, label: 'Tab', sampleable: true },
  { code: 'KeyQ', row: 1, col: 2, span: 1, label: 'Q', sampleable: true },
  { code: 'KeyW', row: 1, col: 3, span: 1, label: 'W', sampleable: true },
  { code: 'KeyE', row: 1, col: 4, span: 1, label: 'E', sampleable: true },
  { code: 'KeyR', row: 1, col: 5, span: 1, label: 'R', sampleable: true },
  { code: 'KeyT', row: 1, col: 6, span: 1, label: 'T', sampleable: true },
  { code: 'KeyY', row: 1, col: 7, span: 1, label: 'Y', sampleable: true },
  { code: 'KeyU', row: 1, col: 8, span: 1, label: 'U', sampleable: true },
  { code: 'KeyI', row: 1, col: 9, span: 1, label: 'I', sampleable: true },
  { code: 'KeyO', row: 1, col: 10, span: 1, label: 'O', sampleable: true },
  { code: 'KeyP', row: 1, col: 11, span: 1, label: 'P', sampleable: true },
  { code: 'BracketLeft', row: 1, col: 12, span: 1, label: '[', sampleable: true },
  { code: 'BracketRight', row: 1, col: 13, span: 1, label: ']', sampleable: true },
  { code: 'Backslash', row: 1, col: 14, span: 1, label: '\\', sampleable: true },
  // row 2 — home row
  { code: 'CapsLock', row: 2, col: 0, span: 2, label: 'Caps', sampleable: false },
  { code: 'KeyA', row: 2, col: 2, span: 1, label: 'A', sampleable: true },
  { code: 'KeyS', row: 2, col: 3, span: 1, label: 'S', sampleable: true },
  { code: 'KeyD', row: 2, col: 4, span: 1, label: 'D', sampleable: true },
  { code: 'KeyF', row: 2, col: 5, span: 1, label: 'F', sampleable: true },
  { code: 'KeyG', row: 2, col: 6, span: 1, label: 'G', sampleable: true },
  { code: 'KeyH', row: 2, col: 7, span: 1, label: 'H', sampleable: true },
  { code: 'KeyJ', row: 2, col: 8, span: 1, label: 'J', sampleable: true },
  { code: 'KeyK', row: 2, col: 9, span: 1, label: 'K', sampleable: true },
  { code: 'KeyL', row: 2, col: 10, span: 1, label: 'L', sampleable: true },
  { code: 'Semicolon', row: 2, col: 11, span: 1, label: ';', sampleable: true },
  { code: 'Quote', row: 2, col: 12, span: 1, label: "'", sampleable: true },
  { code: 'Enter', row: 2, col: 13, span: 2, label: 'Enter', sampleable: true },
  // row 3 — bottom letter row
  { code: 'ShiftLeft', row: 3, col: 0, span: 3, label: 'Shift', sampleable: false },
  { code: 'KeyZ', row: 3, col: 3, span: 1, label: 'Z', sampleable: true },
  { code: 'KeyX', row: 3, col: 4, span: 1, label: 'X', sampleable: true },
  { code: 'KeyC', row: 3, col: 5, span: 1, label: 'C', sampleable: true },
  { code: 'KeyV', row: 3, col: 6, span: 1, label: 'V', sampleable: true },
  { code: 'KeyB', row: 3, col: 7, span: 1, label: 'B', sampleable: true },
  { code: 'KeyN', row: 3, col: 8, span: 1, label: 'N', sampleable: true },
  { code: 'KeyM', row: 3, col: 9, span: 1, label: 'M', sampleable: true },
  { code: 'Comma', row: 3, col: 10, span: 1, label: ',', sampleable: true },
  { code: 'Period', row: 3, col: 11, span: 1, label: '.', sampleable: true },
  { code: 'Slash', row: 3, col: 12, span: 1, label: '/', sampleable: true },
  { code: 'ShiftRight', row: 3, col: 13, span: 3, label: 'Shift', sampleable: false },
  // row 4 — space row
  { code: 'ControlLeft', row: 4, col: 0, span: 1, label: 'Ctrl', sampleable: false },
  { code: 'MetaLeft', row: 4, col: 1, span: 1, label: 'Meta', sampleable: false },
  { code: 'AltLeft', row: 4, col: 2, span: 1, label: 'Alt', sampleable: false },
  { code: 'Space', row: 4, col: 3, span: 7, label: 'Space', sampleable: true },
  { code: 'AltRight', row: 4, col: 10, span: 1, label: 'Alt', sampleable: false },
  { code: 'MetaRight', row: 4, col: 11, span: 1, label: 'Meta', sampleable: false },
  { code: 'ControlRight', row: 4, col: 12, span: 1, label: 'Ctrl', sampleable: false },
]

export function isSampleable(code: string): boolean {
  return US_ANSI_KEYS.some((k) => k.code === code && k.sampleable)
}
