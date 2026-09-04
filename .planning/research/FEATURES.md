# Feature Research

**Domain:** Developer-focused typing trainer (code / technical corpus), single-user self-hosted-style tool
**Researched:** 2026-09-03
**Confidence:** MEDIUM (competitor feature sets corroborated across multiple sources; specific latency numbers LOW; no primary user research beyond the author)

## Feature Landscape

### Table Stakes (Users Expect These)

Every credible typing trainer — code-focused or not — has these. Missing them makes keebdrill feel broken to its one user (a developer who has used Monkeytype / typing.io).

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Paste text OR upload a file as exercise source | Core loop; SpeedCoder "Custom Code" and typing.io paid upload both have it | LOW | v1 requirement. Read file client-side or single upload endpoint. No parsing needed for v1 (whole content). |
| Live typing view with per-character correctness feedback | Universal; Monkeytype/SpeedCoder/typing.io all highlight correct/incorrect inline as you go | MEDIUM | Caret position, colour past chars green/red, show current target char. State machine is the real work. |
| WPM for the completed exercise | The headline number of every typing product | LOW | Standard = (correct chars / 5) / minutes. Decide gross vs net (see Differentiators — symbol-adjusted). |
| Accuracy / error rate for the session | Second-most-expected number; every competitor shows it | LOW | `correct / (correct + incorrect + extra)`. Cheap once keystroke capture exists. |
| Slowest keys / most-missed keys after a run | SpeedCoder "keys with most mistakes", typing.io typo heatmap, Keybr weak keys | MEDIUM | v1 = top 5 slowest keystrokes. Needs per-key aggregation of high-res timings. Requirement already in PROJECT.md. |
| High-resolution keystroke capture (keydown/keyup, monotonic timestamps) | Invisible to user but everything above depends on it; `performance.now()` or equivalent | MEDIUM | The engine. Precision here is a hard constraint (per-digraph latency depends on it). Foundational — must be first. |
| Restart / retry the same exercise | Every trainer lets you redo a test instantly (Monkeytype quick-restart) | LOW | Just reset state; keep the loaded corpus. |
| Error-handling policy (free typing vs forced correction) | SpeedCoder ships both "Natural" and "Forced correction"; users expect one to exist and be sane | MEDIUM | PROJECT.md flags this as an undecided key decision. Pick ONE for v1 (recommend free/natural typing + track uncorrected errors); forced-correction changes the state engine substantially. |

### Differentiators (Competitive Advantage)

Where keebdrill competes. These align with the Core Value: *measure code-specific typing effort that Monkeytype/Keybr ignore.* Do not try to ship all of them at once — most are post-v1.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Symbol-density-adjusted WPM | Standard WPM (chars/5) rewards prose and hides the real cost of `{}[]()<>`, `=>`, `::`, `!==`, `\|>`. A code-weighted score is the product's reason to exist. | MEDIUM | Needs a defensible weighting model (e.g. cost per char class, or normalise against measured per-key latency). Document the formula. Risk: arbitrary weights erode trust — tie to measured latency, not guesses. |
| Per-digraph / bigram latency table | The actionable unit of typing improvement is key *transitions*, not keys. "Your `->` is 180ms vs your baseline 90ms" is advice no competitor gives. | MEDIUM | Aggregate inter-keystroke intervals per ordered char pair. Straightforward once capture exists. Surface top-N slowest digraphs of the user's stack. Directly serves the one-month success criterion. |
| Keyboard heatmap (speed + error, per key) | Visceral, glanceable weak-spot map. typing.io (typo heatmap), SpeedCoder (mistake heatmap), TypingMaster (speed heatmap) all have versions — but not symbol-aware or code-corpus-driven. | MEDIUM | Render an ANSI layout (v1: US ANSI only per PROJECT.md), colour by mean latency or error rate. Needs per-key aggregation + a layout coordinate map. |
| Per-language profiles | A dev's `rust` symbol mix differs from their `bash` or `python`. Separate baselines per language make progress legible and drills relevant. | MEDIUM | Requires tagging each exercise/session with a language and storing metrics partitioned by it. Depends on persistent storage. |
| Correction rate / efficiency score | `net WPM / gross WPM` — how much typing effort is wasted on backspacing through symbol-dense code. Exposes a cost prose tests never show. | LOW | Cheap to compute from existing keystroke stream (count backspaces / corrections vs total). High signal. |
| Adaptive drill generation from detected weaknesses | Keybr's core mechanic, but applied to code symbols/digraphs instead of English letters: synthesise drills that over-represent your slow transitions. | HIGH | Needs (a) enough history to rank weaknesses, (b) a generator that produces realistic-looking code fragments biased to target digraphs. Post-v1. Keybr uses a Markov chain; code equivalent is harder (must stay plausible). |
| Repo kata mode (ingest local/remote Git repo, type real functions) | typing.io types open-source code but you can't point it at *your* codebase. Training on the exact code style you work in daily is unique. | HIGH | Git clone + file walk + language detection + chunking. Privacy constraint: third-party repo content must never leave the local environment — state explicitly in docs. |
| Syntactic chunking (tree-sitter function/block boundaries) | Typing a whole file is fatiguing and unrealistic; typing one coherent function is a natural "rep". | MEDIUM-HIGH | tree-sitter has grammars for 36+ languages, AST chunking at function/class boundaries is a solved pattern. PROJECT.md defers this past v1 (v1 = whole pasted content). |
| Docs mode (Markdown, reStructuredText, man pages, RFCs) | Technical prose with its own symbol profile (backticks, brackets, code spans) — between code and English. | MEDIUM | Mostly a corpus/source-adapter problem once the engine is generic over "text with a language tag". |
| Shell mode (`~/.zsh_history` / `~/.bash_history`) | Command-line typing is a distinct, high-frequency dev skill: flags, pipes, `$()`, path separators. Nobody trains it. | MEDIUM | Parse history file format (strip timestamps), filter secrets/dedupe. Privacy-sensitive — local only, let user redact. |
| Fixed 10-minute Daily session with adaptive progression | A single deliberate habit-forming ritual; removes decision fatigue ("what do I practise today?"). | MEDIUM | Composes existing modes + adaptive selection + a session timer. Needs history to progress. Post-v1. |
| Historical progress dashboard (latency trend per digraph/stack) | The one-month success metric *is* "show a measurable latency reduction" — needs longitudinal storage + charts. | MEDIUM | Deferred in PROJECT.md to a later phase, but the v1 data model should record everything needed so history isn't lost. |
| Local-first / single-user, no account | Privacy (third-party repo IP), zero friction, runs offline. A deliberate stance vs SaaS competitors. | LOW | Already the v1 design. Worth stating as a feature, not just an omission. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| User accounts / auth / cloud sync | "So I can use it on multiple machines" | Single-user tool; auth is weeks of work + attack surface + privacy risk for ingested repo content. Kills the local-first stance. | Local DB file; if multi-device ever matters, sync the file via the user's own means (git, Syncing). |
| Gamification: streaks, XP, badges, leaderboards | Feels motivating; every consumer typing app has it | Optimises for engagement metrics, not skill. Author is the only user — vanity streaks add code and DB churn for no learning value. PROJECT.md explicitly defers. | The 10-min Daily ritual + visible latency-trend charts are the honest motivator. Revisit only if the core loop proves dull. |
| Multiplayer / races (TypeRacer-style) | Fun, social | Not core to training value; needs realtime infra, matchmaking, an opponent pool that doesn't exist for a personal tool. | Race against your *own* past runs (ghost/PB overlay) — same dopamine, zero infra. |
| Forced correction of every error in v1 | "More realistic / disciplined" | Fundamentally different state machine (must handle backtrack, re-sync, locked cursor). Doubles v1 engine scope. PROJECT.md flags as undecided. | v1: free typing, track uncorrected + corrected errors. Add forced-correction as a mode later once the engine is proven. |
| Full in-app code editor semantics (autocomplete, bracket auto-pair, multi-cursor) | "Match my real editor" | You'd be reimplementing VS Code. Auto-pairing brackets removes the very symbol training that is the point. | Optional VS Code-style auto-indent only (newline → matching indent), configurable. Leave every visible character for the user to type. |
| Support every keyboard layout at launch (es-LA, US-Intl, Dvorak, Colemak) | Author may not use US ANSI; "be inclusive" | Each layout is a different symbol/shift map → multiplies heatmap, digraph, and adjusted-WPM logic before the core idea is validated. PROJECT.md scopes v1 to US ANSI. | v1 hard-codes US ANSI. Abstract the layout behind one module so a second layout is additive later. |
| Real-time streaming of keystrokes to a backend | "Live dashboard", "analytics" | Latency-sensitive capture belongs client-side; network jitter corrupts the timing data that is the whole product. Also a privacy leak for repo content. | Capture and compute metrics locally; persist the finished session. Backend (if any) only stores aggregates. |
| Auto-ingesting the user's whole filesystem / all repos | "Zero setup, just train on everything" | Huge corpus of mixed licenses + secrets in configs/history; indexing cost; irrelevant generated code (node_modules, migrations). | Explicit per-source opt-in: user points at one repo / pastes one snippet / selects one history file. Respect `.gitignore`, skip vendored dirs. |
| Tab-to-indent training removed via full auto-indent | "IDEs do this for me" | Removes Tab/space/indentation from training entirely — a real part of code typing effort. PROJECT.md flags as undecided. | Make auto-indent a toggle (default on for realism, off for indentation drills). Symbols drill mode always manual. |

## Feature Dependencies

```
High-resolution keystroke capture engine
    ├──requires──> error-handling policy decision (free vs forced)
    ├──requires──> keyboard layout map (US ANSI v1)
    └──enables──> WPM
                  ├──enables──> symbol-density-adjusted WPM
                  └──enables──> correction rate / efficiency score
    └──enables──> accuracy
    └──enables──> per-key latency aggregation
                  ├──enables──> slowest-keys (top 5)   [v1]
                  ├──enables──> keyboard heatmap
                  └──enables──> per-digraph latency table

Persistent storage (session records + keystroke aggregates)
    ├──requires──> language tagging of exercises
    ├──enables──> per-language profiles
    ├──enables──> historical progress dashboard
    └──enables──> adaptive drill generation
                      └──requires──> per-digraph latency table (weakness ranking)
                      └──requires──> drill generator (code-plausible fragments)

Corpus source adapters (generic "text + language tag")
    ├── paste / upload            [v1]
    ├── repo kata ──requires──> Git ingest + tree-sitter chunking + local-only privacy guarantee
    ├── docs mode ──requires──> Markdown/rST/man parsers
    └── shell mode ──requires──> history-file parser + secret redaction

Syntactic chunking (tree-sitter)
    └──enhances──> repo kata, docs mode  (natural per-function "reps")

Daily 10-min session
    ├──requires──> at least 2 practice modes
    ├──requires──> adaptive selection (history-driven)
    └──requires──> persistent storage
```

### Dependency Notes

- **Everything depends on the capture engine.** It must be phase 1 and its timestamp precision is non-negotiable — every differentiator (adjusted WPM, digraph latency, heatmap) is only as trustworthy as the raw timings.
- **Error-handling policy must be decided before the engine is built**, not after — free vs forced correction is a different state machine, not a setting bolted on later.
- **v1 slowest-keys is a strict subset of the heatmap and digraph features** — same aggregation pipeline, less presentation. Build the aggregation once, generalise the view later.
- **Adaptive drills require both history and a generator.** History needs the storage layer running for weeks first; the generator (plausible code biased to target digraphs) is genuinely hard and should be its own phase.
- **Per-language profiles require language tagging from day one** even if profiles ship later — record the tag on every v1 session so history is retroactively partitionable.
- **Repo / docs / shell modes are parallel source adapters** over one generic exercise abstraction; if v1's "exercise" is modelled as `{text, language, source_type}`, adding modes is additive and non-breaking.
- **Local-only privacy guarantee conflicts with any cloud sync / streaming feature** — picking local-first now forecloses a hosted multi-user product later without a rethink. That is the right trade for this project.

## MVP Definition

### Launch With (v1) — matches PROJECT.md Active requirements

- [ ] Paste text or upload a file as the exercise source — the input to the whole loop
- [ ] Type the exercise with keydown/keyup capture at high-resolution timestamps — the engine; nothing else is possible without it
- [ ] Live per-character correctness feedback while typing — without it the typing view is unusable
- [ ] WPM for the completed exercise — the expected headline metric
- [ ] Accuracy / error rate for the completed exercise — the expected second metric
- [ ] Top 5 slowest keys/keystrokes from the session — the first taste of the code-specific angle
- [ ] One decided error-handling mode (recommend: free typing, track corrected + uncorrected errors) — required to build the engine at all
- [ ] Restart current exercise — trivial, expected

### Add After Validation (v1.x) — trigger: the daily loop is useful for a week

- [ ] Persist sessions to a local DB with `{text, language, source_type, timestamp}` + keystroke aggregates — trigger: you want to see yesterday vs today
- [ ] Per-digraph latency table (top slow transitions) — trigger: "slowest keys" isn't actionable enough
- [ ] Keyboard heatmap (speed + error) — trigger: you want a glanceable weak-spot map
- [ ] Symbol-density-adjusted WPM + correction/efficiency score — trigger: raw WPM feels misleading on code
- [ ] Historical progress charts (latency trend per digraph / language) — trigger: approaching the one-month success-criterion check
- [ ] Symbols drill mode (targeted `{}[]()<>`, `=>`, `::`, `!==`, `|>`, shifted number row) — trigger: you know your weak symbols and want to grind them

### Future Consideration (v2+) — defer until core loop has months of data

- [ ] Per-language profiles with separate baselines — defer: needs sustained multi-language history to be meaningful
- [ ] Repo kata mode (local/remote Git ingest) — defer: Git plumbing + tree-sitter chunking + privacy guarantees are a milestone of their own
- [ ] tree-sitter syntactic chunking (function/block reps) — defer: v1 whole-content typing is good enough to validate
- [ ] Docs mode / Shell-history mode — defer: parallel source adapters, only worth it once the abstraction is proven
- [ ] Adaptive drill generation from detected weaknesses — defer: hardest feature; needs history + a code-plausible generator
- [ ] Fixed 10-minute Daily session with adaptive progression — defer: composes multiple modes + adaptive selection
- [ ] Ghost / personal-best replay overlay — defer: nice motivator, not core
- [ ] Non-US-ANSI keyboard layouts — defer: multiplies symbol-map logic; v1 is US ANSI only

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Keystroke capture engine (hi-res, keydown/keyup) | HIGH | MEDIUM | P1 |
| Paste / upload exercise source | HIGH | LOW | P1 |
| Live per-character feedback | HIGH | MEDIUM | P1 |
| WPM + accuracy | HIGH | LOW | P1 |
| Top 5 slowest keys | HIGH | MEDIUM | P1 |
| Error-handling policy decision (free vs forced) | HIGH | LOW (decision) / MEDIUM (build) | P1 |
| Restart exercise | MEDIUM | LOW | P1 |
| Local session persistence + language tag | HIGH | MEDIUM | P2 |
| Per-digraph latency table | HIGH | MEDIUM | P2 |
| Keyboard heatmap | MEDIUM | MEDIUM | P2 |
| Symbol-adjusted WPM + efficiency score | HIGH | MEDIUM | P2 |
| Historical progress charts | HIGH | MEDIUM | P2 |
| Symbols drill mode | MEDIUM | MEDIUM | P2 |
| Per-language profiles | MEDIUM | MEDIUM | P3 |
| Repo kata mode | HIGH | HIGH | P3 |
| tree-sitter chunking | MEDIUM | MEDIUM-HIGH | P3 |
| Docs mode / Shell mode | MEDIUM | MEDIUM | P3 |
| Adaptive drill generation | HIGH | HIGH | P3 |
| Daily 10-min session | MEDIUM | MEDIUM | P3 |
| Accounts / gamification / multiplayer | LOW | HIGH | Anti-feature |

## Competitor Feature Analysis

| Feature | typing.io | SpeedCoder | Monkeytype / Keybr | keebdrill approach |
|---------|-----------|------------|--------------------|--------------------|
| Corpus | Curated open-source code, 16 langs; upload own (paid) | Curated code, 12 langs; paste own (free) | Generated words / English quotes | Your own code, docs, shell history — real personal corpus, local |
| WPM model | "Realistic engine" counts symbols + backspace | Standard WPM | Standard chars/5; barely penalises symbols | Symbol-density-adjusted WPM + efficiency score |
| Weak-spot feedback | Typo heatmap, typo-cost analysis, unproductive-keystroke graph | Most-missed keys on color keyboard | Keybr: per-key speed → adaptive focus key | Per-digraph latency table + speed/error heatmap + per-language |
| Adaptivity | None (fixed lessons) | None | Keybr: progressive letter unlock, focus key, Markov pseudo-words | Adaptive drills biased to your slow *digraphs/symbols* (post-v1) |
| Error handling | Realistic key processing | Natural + Forced-correction modes | Freedom / confidence / strict modes | v1: one mode (free typing); forced-correction later |
| Indentation | Handles code whitespace | Types code as-is | N/A | Optional VS Code-style auto-indent toggle |
| Progress history | Yes (paid): WPM trend, unproductive keys | Per-lesson only | Yes: account charts, PBs | Local longitudinal store; latency-trend-per-digraph charts |
| Account required | Yes for progress/upload | No | Yes for history | No — local-first, single-user |
| Price / model | Freemium, $9.99/mo | Free, web | Free / open source | Personal tool, local, no billing |

## Sources

- [typing.io — Typing Practice for Programmers](https://typing.io/) and [Plans & Pricing](https://typing.io/pricing) — MEDIUM
- [Typing.io Reviews 2026 (G2)](https://www.g2.com/products/typing-io/reviews), [SourceForge](https://sourceforge.net/software/product/Typing.io/) — MEDIUM
- [SpeedCoder — Typing Practice for Programmers](https://www.speedcoder.net/) — MEDIUM
- [monkeytypegame/monkeytype (GitHub README + docs)](https://github.com/monkeytypegame/monkeytype), [Monkeytype customization guide](https://monkeytypegame-monkeytype.mintlify.app/guides/customization) — MEDIUM
- [Keybr review / algorithm explanations](https://www.typequicker.com/compare/keybr), [keybr-tui write-up](https://y0sif.github.io/keybr-tui/) — MEDIUM
- [Observations on Typing from 136 Million Keystrokes (CHI 2018, Aalto)](https://userinterfaces.aalto.fi/136Mkeystrokes/resources/chi-18-analysis.pdf) — LOW (used only for digraph-latency ranges)
- [TypingTest bigram blitz](https://www.typingtest.com/bigram-blitz/), [TypingMaster typing meter (per-key heatmap)](https://www.typingmaster.com/typing-meter/) — LOW/MEDIUM
- [How to Calculate Typing Speed (WPM) and Accuracy — SpeedTypingOnline](https://www.speedtypingonline.com/typing-equations), [typetest.io WPM normalization](https://typetest.io/blog/posts/2026-03-29-typing-test-wpm-normalization.html) — MEDIUM
- [Code Typing Speed Actually Matters — TiltStack](https://www.tiltstack.com/blog/code-typing-trainer-for-developers/) — LOW (single-vendor blog; used for the prose-vs-code character-distribution and efficiency-score framing)
- [treesitter-chunker](https://github.com/Consiliency/treesitter-chunker), [AST-Aware Code Chunking — Supermemory](https://supermemory.ai/blog/building-code-chunk-ast-aware-code-chunking/) — MEDIUM (tree-sitter chunking feasibility)
- [Tabs vs spaces / auto-indent in code typing practice discussions](https://lobste.rs/s/fbtgeg/nobody_talks_about_real_reason_use_tabs) — LOW
- `.planning/PROJECT.md` — project scope, constraints, undecided key decisions

---
*Feature research for: developer code-typing trainer (keebdrill)*
*Researched: 2026-09-03*
