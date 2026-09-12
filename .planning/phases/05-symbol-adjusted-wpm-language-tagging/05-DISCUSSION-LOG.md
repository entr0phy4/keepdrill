# Phase 5: Symbol-Adjusted WPM & Language Tagging - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-12
**Phase:** 5-symbol-adjusted-wpm-language-tagging
**Areas discussed:** Symbol Classifier, Weighting Formula, Display Placement, Language Picker (UI), Language Picker (Defaults/Persistence)

---

## Gray-area selection

All five candidate gray areas were presented via multi-select:

1. Clasificador de símbolo
2. Fórmula de ponderación
3. Presentación visual
4. UI del selector de lenguaje
5. Valores por defecto y persistencia

**User's response:** *"determina la mejor decision para todas las preguntas del discuss"* — the user explicitly delegated all five decisions to Claude's judgment rather than answering interactively.

---

## Symbol Classifier

| Option | Description | Selected |
|--------|-------------|----------|
| `[A-Za-z0-9]` + whitespace vs. everything else (symbol) | Research's stated likely definition (`FEATURES.md`) | ✓ |
| Same, but underscore `_` treated as alnum (identifier-friendly) | Would make `snake_case` identifiers score as lower symbol-density | |

**Claude's choice:** Everything not `[A-Za-z0-9]` and not whitespace (`/\s/`) is a symbol, including `_`. → CONTEXT.md D-01/D-02/D-03.
**Notes:** Flagged in CONTEXT.md as a judgment call to revisit if it feels wrong in practice — no external standard to defer to.

---

## Weighting Formula

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Session-level multiplier on target-text symbol density, applied to whole-session WPM | `PITFALLS.md` Pitfall 5's explicit recommendation — avoids double-counting corrected symbol chars | ✓ |
| (b) Per-character weighting applied to the attempt stream | Riskier — inflates score for users who fumble+retry symbols the most (opposite of intended signal) | |

**Claude's choice:** Option (a). Formula: `symbolDensity = symbolCount / totalCodepoints` (target text); `difficultyMultiplier = 1 + symbolDensity * (SYMBOL_WEIGHT - 1)`, `SYMBOL_WEIGHT = 2`; `symbolAdjustedWpm = wpm * difficultyMultiplier`. → CONTEXT.md D-04/D-05/D-06/D-07.
**Notes:** `SYMBOL_WEIGHT = 2` explicitly flagged as the one number in this phase with zero external grounding — a named, one-line-tunable constant. A golden test guarding against the double-counting regression is mandatory (D-07).

---

## Display Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Companion metric, always shown next to net WPM (Monkeytype precedent) | `FEATURES.md` Anti-Features: "Show both, side-by-side" | ✓ |
| Replace net WPM with the adjusted number | Explicitly rejected in research — loses comparability with external WPM benchmarks | |

**Claude's choice:** Companion metric in both `ResultsView` (new stat block, label `"adj. wpm"`, same markup pattern) and `HistoryRow` (additional value, exact layout deferred to discretion). → CONTEXT.md D-08/D-09/D-10.

---

## Language Picker (UI)

| Option | Description | Selected |
|--------|-------------|----------|
| `<select>` dropdown on the paste form, defaulting to `plaintext` | `FEATURES.md` Anti-Features' explicit recommendation over auto-detection | ✓ |
| Free-text input | Rejected — invites typos/inconsistent tags that fragment Phase 6's per-language grouping | |
| Auto-detection (heuristic/tree-sitter) | Explicitly out of scope — `ANLY-09` Future Requirements | |

**Claude's choice:** `<select>` in `CorpusInput`, paste path only (upload untouched), options = `language-map.ts::EXT_TO_LANG` value set + `plaintext`, never blocking. → CONTEXT.md D-11/D-12/D-14/D-15.

---

## Language Picker (Defaults/Persistence)

| Option | Description | Selected |
|--------|-------------|----------|
| Default `plaintext` every time, no cross-session memory | Simplest correct v1.1 behavior | ✓ |
| Remember last-picked language across sessions | Nicer UX for repeat users, but speculative build-ahead for v1.1 | |

**Claude's choice:** Default `plaintext`, no persistence. → CONTEXT.md D-13.
**Notes:** Noted as a cheap, reversible follow-up in Deferred Ideas if it proves annoying in daily use.

---

## Claude's Discretion

- Exact `HistoryRow` layout for the second WPM number.
- Exact `<select>` styling/visual treatment (subject to a UI-SPEC pass per ROADMAP.md `UI hint: yes`).
- `fromPaste`'s new parameter naming/signature; `computeSymbolAdjustedWpm`'s function signature.
- Whether the picker's option list is hardcoded or re-exported from `language-map.ts`.
- Test strategy depth beyond the mandatory D-07 golden test.

## Deferred Ideas

- Auto language detection for paste (`ANLY-09`).
- Remembering the user's last-picked language across sessions.
- Upload-path language override (out of ANLY-02's scope).
- Tuning `SYMBOL_WEIGHT` based on real self-use data.
