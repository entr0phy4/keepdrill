# Phase 6: Cross-Session Analytics - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-13
**Phase:** 6-cross-session-analytics
**Areas discussed:** Analytics placement, Digraph ranking + sample gate, Heatmap visual language, Per-language profile shape

Discussion questions were presented in Spanish at the user's request.

---

## Analytics placement

| Option | Description | Selected |
|--------|-------------|----------|
| Third header item | "Analytics" sibling view; one stacked page; History stays its own list | ✓ |
| Tabs inside History | History becomes Sessions \| Digraphs \| Heatmap \| Languages | |
| Four sibling header items | History + Digraphs + Heatmap + Languages as separate views | |
| You decide | Claude discretion | |

**User's choice:** Third header item — stacked Analytics page.
**Notes:** Header stays three buttons. Trainer hide-not-unmount still applies.

| Option | Description | Selected |
|--------|-------------|----------|
| Digraphs → heatmap → languages | Ranking first (project success criterion), then visual, then grouping | ✓ |
| Heatmap → digraphs → languages | Keyboard drawing first | |
| Languages → digraphs → heatmap | Summary-by-tag first | |
| You decide | Claude discretion | |

**User's choice:** Digraphs → heatmap → languages.

| Option | Description | Selected |
|--------|-------------|----------|
| Scroll only | Three stacked blocks, no in-page anchors | ✓ |
| In-page jump links | TOC jumping to each section | |
| You decide | Claude discretion | |

**User's choice:** Scroll only.

| Option | Description | Selected |
|--------|-------------|----------|
| One page-level empty state | Three sections not rendered when history is empty | ✓ |
| Per-section empties always | Three sections always visible with their own empty copy | |
| You decide | Claude discretion | |

**User's choice:** Single page-level empty state when there are zero sessions.

---

## Digraph ranking + sample gate

| Option | Description | Selected |
|--------|-------------|----------|
| Top 10 | More diagnostic than per-session slowest-5, still capped | ✓ |
| Top 5 | Same cap as slowest-5 | |
| All that pass the gate | No cap | |
| You decide | Claude discretion | |

**User's choice:** Top 10 slowest.

| Option | Description | Selected |
|--------|-------------|----------|
| 5 samples | Stricter than single-char MIN_SAMPLES=3, reachable in a few days | ✓ |
| 3 samples | Same as slowest-5 | |
| 8 samples | More stable, table may stay empty for weeks | |
| You decide | Claude discretion | |

**User's choice:** 5 post-filter samples.

| Option | Description | Selected |
|--------|-------------|----------|
| Omit below-gate pairs | ANLY-03 "excluded"; section empty if none pass | ✓ |
| Grey them out | Shown but not ranked, below the gated rows | |
| You decide | Claude discretion | |

**User's choice:** Omit.

| Option | Description | Selected |
|--------|-------------|----------|
| Digraph + median ms + n | n makes the gate visible | ✓ |
| Digraph + median ms | n stays internal | |
| You decide | Claude discretion | |

**User's choice:** Digraph + median ms + sample count.

---

## Heatmap visual language

| Option | Description | Selected |
|--------|-------------|----------|
| Color + number on the key | Non-color redundancy (PITFALLS) | ✓ |
| Color + tooltip | Number only on hover | |
| Color only | Cleaner, worse a11y | |
| You decide | Claude discretion | |

**User's choice:** Color + numeric median ms on the key.

| Option | Description | Selected |
|--------|-------------|----------|
| Neutral fill, no number | Full US-ANSI shape; unused keys not painted "fast" | ✓ |
| Hide those keys | Diagram only shows sampled keys | |
| Neutral fill + em dash | Placeholder glyph where the number would be | |
| You decide | Claude discretion | |

**User's choice:** Neutral fill, no number.

| Option | Description | Selected |
|--------|-------------|----------|
| Relative min/max | Scale from sampled keys in this history | ✓ |
| Absolute ms bands | e.g. green <80, amber 80–200, red >200 | |
| You decide | Claude discretion | |

**User's choice:** Relative scale.

| Option | Description | Selected |
|--------|-------------|----------|
| Same 5-sample gate as digraphs | One constant; below → neutral, no number | ✓ |
| 3 samples | Single-char threshold | |
| You decide | Claude discretion | |

**User's choice:** Same 5-sample gate.

---

## Per-language profile shape

| Option | Description | Selected |
|--------|-------------|----------|
| Table | One row per language; same scan metaphor as digraphs | ✓ |
| Cards | One card per language | |
| You decide | Claude discretion | |

**User's choice:** Table.

| Option | Description | Selected |
|--------|-------------|----------|
| WPM + adj. WPM + accuracy + n | Companion metric + session count | ✓ |
| WPM + accuracy + n | No adj. WPM on this table | |
| WPM + accuracy only | Strict ANLY-05 minimum | |
| You decide | Claude discretion | |

**User's choice:** Language + net WPM + adj. WPM + accuracy + session count.

| Option | Description | Selected |
|--------|-------------|----------|
| Most sessions first | Most evidence at the top | ✓ |
| Alphabetical | Including plaintext where it sorts | |
| Net WPM descending | Fastest language first | |
| You decide | Claude discretion | |

**User's choice:** Sort by session count descending.

| Option | Description | Selected |
|--------|-------------|----------|
| Show all tags with ≥1 session | n is already visible | ✓ |
| Require ≥3 sessions per tag | Hide thin language rows | |
| You decide | Claude discretion | |

**User's choice:** Show every tag with at least one session.

---

## Claude's Discretion

User did not pick "You decide" on any question. Discretion left to planner/UI-SPEC: empty-state copy, heatmap palette/contrast, which US-ANSI keys are drawn, digraph whitespace glyphs, how language-row WPM/accuracy are aggregated across sessions, module file split, CorpusInput visibility on the Analytics view, test depth.

## Deferred Ideas

None raised during discussion beyond what REQUIREMENTS.md / PROJECT.md already defer (trigraphs, session drill-down, language filters, charts, live heatmap).
