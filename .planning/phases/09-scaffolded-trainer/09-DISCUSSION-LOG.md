# Phase 9: Scaffolded Trainer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-20
**Phase:** 9-Scaffolded Trainer
**Areas discussed:** File chrome layout, Click-to-type handoff, Unit-complete feel, Restart button vs redo del archivo

User reply after gray-area presentation: "decide tu todo y prosigue con el plan."
All four areas locked to research-recommended options. No follow-up questions.

---

## File chrome layout

| Option | Description | Selected |
|--------|-------------|----------|
| Stacked document-order blocks (done / CaptureSurface / future dimmed) | File chrome is a separate renderer; textarea = current unit only. Research PITFALLS Pitfall 6. | ✓ |
| Pixel-perfect overlay inside a full-file textarea | Looks like typing in the source; breaks IME/`beforeinput`/Tab. FEATURES anti-pattern. | |
| Disconnected drill pane (hide the rest of the file) | Cloze / mystery box. User already rejected hidden future units. | |

**User's choice:** You decide — stacked document-order chrome.
**Notes:** Done/future show canonical `Exercise.text` slices, not the typed buffer.

---

## Click-to-type handoff

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate start on `onPlanned` | Click TS/JS → unit 0 typeable. FEATURES table stakes. | ✓ |
| Explicit Start after plan preview | Extra step; FilePlan already idle in App from Phase 8. | |
| Call existing `handleLoad(plan.exercise)` | Would type the whole file — the happy path the user rejected. | |

**User's choice:** You decide — immediate `startScaffold(plan)`, never paste `handleLoad` for GitHub.
**Notes:** Fallback one-unit still FileScaffold. Last-wins vs new click or paste/upload load. Tab switch is not a reset (Phase 7 D-04).

---

## Unit-complete feel

| Option | Description | Selected |
|--------|-------------|----------|
| Instant advance + N/M landmark + scrollIntoView | SCAF-02 auto-advance; PITFALLS UX landmark. | ✓ |
| Brief "unit complete" interstitial | Extra chrome; delays flow. | |
| Highlight only, no counter | Easy to get lost in a 400-line file. | |

**User's choice:** You decide — instant advance, N/M + kind/name, scrollIntoView with reduced-motion honor.
**Notes:** Last unit → existing ResultsView. One concatenated Session. No per-unit WPM UI.

---

## Restart button vs redo del archivo

| Option | Description | Selected |
|--------|-------------|----------|
| Escape and Restart button both restart current unit | SCAF-04; do not wipe completed unit snapshots; keep file `startedAt`. | ✓ |
| Restart button = whole file, Escape = current unit | Two meanings for "restart"; rage-quit after one bad function if they hit the button. | |
| Add a separate whole-file restart control | New capability; abandon via new load is enough. | |

**User's choice:** You decide — both controls = current unit; no whole-file restart this phase.
**Notes:** Today's `handleRestart` resets the entire session — scaffold must narrow it.

---

## Claude's Discretion

Entire discussion was user-delegated. Discretion remaining (not product forks):
COPY strings, `<pre>` vs `glyphFor` for static regions, optional unit-separator
markers in the Session log, internal names, UI-SPEC copy/layout, Restart button
label wording.

## Deferred Ideas

- Per-unit History rows / per-function WPM
- Whole-file restart control
- Pixel-perfect full-file overlay
- Syntax highlighting
- Cloze / hidden future units (already rejected in REQUIREMENTS)
