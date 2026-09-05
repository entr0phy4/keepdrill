// PURE — zero DOM access, zero runtime imports (only `import type`). D-03/D-04/
// D-05/D-11. Order of operations across `charLog` is load-bearing; the golden
// cases in state.test.ts lock it. Do NOT read `textarea.selectionStart` here —
// the cursor is derived exclusively from this fold (D-10). Do NOT attempt to
// infer a multi-character delete length from `data` — every delete* CommittedChar
// carries `data: null` (Pitfall 5 / D-11's documented one-position-back v1
// limitation), so every delete-type record moves the cursor back exactly one
// target-character position, never more.

import type { CommittedChar } from '../capture/types'

export type PerCharStatus = 'correct' | 'incorrect' | 'pending'

export interface TrainerState {
  perCharStatus: PerCharStatus[]
  cursor: number
  correctedCount: number
  uncorrectedCount: number
  completedAt: number | null
}

export function computeTrainerState(target: string, charLog: readonly CommittedChar[]): TrainerState {
  const perCharStatus: PerCharStatus[] = new Array(target.length).fill('pending')
  // Tracks whether a position was ever marked incorrect at any point, even
  // after a later backspace resets it to 'pending' (D-04's "corrected" needs
  // this history; the delete branch below intentionally does NOT clear it).
  const wasEverWrong: boolean[] = new Array(target.length).fill(false)
  let cursor = 0
  let completedAt: number | null = null

  for (const rec of charLog) {
    // 1. Delete branch — every delete* inputType moves the cursor back exactly
    //    one position (D-05/D-11), guarded at 0 (idempotent no-op at start).
    if (rec.inputType.startsWith('delete')) {
      if (cursor > 0) {
        cursor -= 1
        perCharStatus[cursor] = 'pending'
      }
      continue
    }

    // 2. Insert branch — iterate rec.data per JS code point (for...of, not
    //    UTF-16 units), so an IME multi-codepoint commit scores every
    //    position in a single record. Stops once the target is exhausted.
    for (const ch of rec.data ?? '') {
      if (cursor >= target.length) break
      if (ch === target[cursor]) {
        perCharStatus[cursor] = 'correct'
      } else {
        perCharStatus[cursor] = 'incorrect'
        wasEverWrong[cursor] = true
      }
      cursor += 1
    }

    // 3. Completion check — set once to the record's own tMs, never
    //    overwritten by any later record (D-04: complete != all-correct).
    if (completedAt === null && cursor >= target.length) {
      completedAt = rec.tMs
    }
  }

  let correctedCount = 0
  let uncorrectedCount = 0
  for (let i = 0; i < target.length; i++) {
    if (perCharStatus[i] === 'correct' && wasEverWrong[i]) correctedCount += 1
    if (perCharStatus[i] === 'incorrect') uncorrectedCount += 1
  }

  return { perCharStatus, cursor, correctedCount, uncorrectedCount, completedAt }
}

/** Whitespace-glyph mapping (D-06 amended, TYPE-04): space -> middle dot,
 *  newline -> downwards-arrow-with-corner-leftwards, all else unchanged.
 *  Intentionally reachable-but-inert for the tab character: `Exercise.text`
 *  can never contain one because Phase 1's normalize.ts unconditionally
 *  expands every tab to spaces before an Exercise exists — do NOT add a
 *  tab-to-glyph mapping here, and do NOT add any capture.ts export for
 *  synthetic tab-character insertion (02-RESEARCH.md's pre-amendment
 *  synthetic-char-recording design and 02-PATTERNS.md's pre-amendment
 *  pattern both predate CONTEXT.md's amendment of D-06/D-07). */
export function glyphFor(char: string): string {
  if (char === ' ') return '·'
  if (char === '\n') return '↵'
  return char
}
