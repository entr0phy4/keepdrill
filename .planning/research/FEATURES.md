# Feature Research

**Domain:** Code-typing trainer analytics (session history, digraph/trigraph latency, keyboard heatmap, per-language profile, symbol-adjusted WPM)
**Researched:** 2026-09-05
**Confidence:** MEDIUM-HIGH (patterns cross-checked against Monkeytype, Keybr, and the existing keebdrill codebase; "symbol-density-adjusted WPM" has no established external standard, so that piece is a keebdrill-original design, flagged LOW-confidence-as-convention, HIGH-confidence-as-feasible)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist once a tool claims "session persistence + analytics." Missing these makes v1.1 feel unfinished relative to Keybr/Monkeytype, which already do the equivalents for prose.

| Capability | Feature | Why Expected | Complexity | Notes |
|---|---|---|---|---|
| Session history | Every completed session is saved automatically, no explicit "save" action | Keybr/Monkeytype/every reviewed typing app persists silently after each run; a manual save step is friction users won't tolerate for daily use | LOW | `src/session.ts::buildSession` already assembles the full `Session` object (`exercise`, `events`, `charLog`, `markers`, timing metadata) at completion — persistence is "write this to Dexie," not "design a new shape." |
| Session history | List view: date, WPM, accuracy, sorted newest-first | This is the universal minimum across every competitor and third-party app reviewed (Speed Typing app, TypingTest.me, keybr profile) | LOW | A plain table/list, not a chart — explicitly matches PROJECT.md's "basic session list" scope and its explicit deferral of trend charts. |
| Digraph latency | A ranked table of slowest digraphs (pair-of-characters), analogous to the existing single-key slowest-5 | Keybr's whole value proposition is "per-key and per-pair statistics you can act on"; users who already see slowest-5 single keys will expect the natural pair-wise extension | MEDIUM | Same statistical discipline as `metrics.ts::slowestFive` — must gate on minimum sample count (keybr and similar tools implicitly do this by only surfacing pairs seen "enough" times) or the ranking is noise, especially with only 1 session's data. |
| Keyboard heatmap | A static QWERTY-shaped diagram (not a raw list) with per-key color intensity | Every heatmap tool surveyed (Patrick Wied's keyboard heatmap, Keybr's profile heatmap, generic "keyboard heatmap" tools) renders an actual key-shaped layout, never a table — users pattern-match "heatmap" to "keyboard picture," not "spreadsheet" | MEDIUM-HIGH | Needs a real (even if simple, div-grid) US-ANSI key layout component. This is new UI, not a reuse of anything currently in `src/ui`. |
| Per-language profile | Aggregate metrics (WPM, accuracy) grouped and filterable by tagged language | This is the direct extension of "per-language metrics" already promised in PROJECT.md's original vision and depends only on grouping already-collected sessions | MEDIUM (blocked — see Dependency Notes) | **Currently infeasible for most real usage**: `Exercise.language` is `'plaintext'` for every pasted exercise (`src/ingestion/types.ts` line 8, `language-map.ts` — extension mapping only fires on upload). Since paste is presumably the dominant ingestion path for daily self-use, "per-language profile" would show one bucket ("plaintext") without a companion fix. |
| Symbol-adjusted WPM | A second WPM-like number shown alongside net WPM, not a silent replacement | Monkeytype's own precedent (raw WPM shown next to net WPM) establishes the UX pattern users already expect: a companion number, not a single "corrected" figure that hides the old one | MEDIUM | Formula is a keebdrill invention (no external standard scales WPM by symbol density — closest analogue, Keystrokes-Per-Hour, only rescales units, it does not weight for symbol difficulty). Must be designed, not looked up. |

### Differentiators (Competitive Advantage)

Features that set keebdrill apart from Monkeytype/Keybr/10FastFingers specifically because those tools are prose-first and don't group by programming language or code-specific character classes.

| Capability | Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|---|
| Digraph/trigraph latency | Trigraph (3-character sequence) latency, not just digraphs | No competitor surveyed (Monkeytype, Keybr, 10FastFingers, TypeTracker) exposes trigraph stats — code has meaningful 3-char sequences (`===`, `->`, `!==`, `::`) that digraphs alone can't isolate; this is a genuine differentiator matching the PROJECT.md compound-operator pain point | HIGH | Trigraphs are sparser per session than digraphs (fewer occurrences of any specific 3-gram) — needs *more* accumulated sessions before the `MIN_SAMPLES` gate is satisfiable. Ship digraphs first; trigraphs become meaningful once persistence has been running a while. This is a reason to sequence trigraphs as a fast-follow, not day-one. |
| Keyboard heatmap | Color driven by median latency (or error rate) per physical key, not raw frequency | Every generic "keyboard heatmap" tool found in research (Patrick Wied's, alllintools, calculkorea) colors by usage *frequency* — that answers "what do I type most," not "what is slow." A speed/error-driven heatmap is the actual differentiator matching keebdrill's stated value prop (latency, not frequency) | MEDIUM-HIGH | Requires a **new** aggregation keyed by `KeyboardEvent.code` (physical key), because `metrics.ts::slowestFive` deliberately groups by committed *character* (`D-03`: "Do NOT group by `KeyboardEvent.code`") — that decision was correct for the single-key ranking (a Shift+`,`→`<` should score against `<`, not against the physical comma key) but is the *wrong* dimension for a physical-keyboard heatmap, which must be keyed by the physical key that took the time. These are two different, both-legitimate aggregation axes over the same `charLog`, not one reused function. |
| Per-language profile | Cross-session comparison view — "you're 15% slower in Python than TypeScript" — grouped digraph latency per language, not just aggregate WPM | No competitor groups by programming language at all (they don't ingest code); this directly operationalizes PROJECT.md's stated differentiator | MEDIUM (once tagging gap is closed) | Depends entirely on fixing the paste-language gap (see Table Stakes row and Dependency Notes). Without that fix, this differentiator has no data to work with. |
| Symbol-adjusted WPM | Weight the WPM formula by the proportion of non-alphanumeric ("symbol") characters in the exercise text, so two sessions with equal net WPM but different symbol density produce different adjusted scores | Directly addresses PROJECT.md's stated pain point ("existing platforms barely penalize symbols") — this is the single most-differentiating number in the whole milestone and the one competitors structurally cannot offer, since none tag symbol density at all | MEDIUM | Needs an explicit, documented symbol classifier (which characters/code-points count as "symbol" — likely: everything that is not `[A-Za-z0-9]` and not whitespace) applied over `Exercise.text`, mirrored against the code-point-safe iteration pattern (`Array.from`) already established in `metrics.ts` for Unicode correctness. Keep the classifier and the weighting formula as two separately testable pure functions, same golden-file testing discipline as `computeWpm`/`computeAccuracy`. |
| Session history | Per-session detail drill-down (re-open a past session's slowest-5 / full capture, not just the summary row) | Nice progression from "list of numbers" toward "actually diagnose what happened in that run" | LOW-MEDIUM | Cheap once the full `Session`/charLog is persisted (not just the derived metrics) — the detail view is just `computeSessionMetrics` re-run against stored data. Persist the raw log, not only the summary, to keep this option open. |

### Anti-Features (Commonly Requested, Often Problematic)

| Capability | Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|---|
| Session history | Trend / evolution line charts over time | Feels like the "obvious" next step after a history list, and every competitor eventually adds this | Already explicitly out of scope in PROJECT.md for this milestone; charting is real design + library surface (Recharts/uPlot per STACK.md) that competes with getting digraph/heatmap/per-language analytics shipped first | Ship the flat history table now; charts are a clearly separable v1.2+ feature once the table/list has real weeks of data to chart |
| Keyboard heatmap | Live/real-time heatmap that updates key-by-key while typing | Feels flashy, matches some tools' "watch it light up" demos | Any computation inside or triggered from the hot keydown/keyup path risks exactly the jitter the project's own capture discipline explicitly guards against (`event.timeStamp`, trivial handler, no React re-render per keystroke — documented in STACK.md and enforced by the existing capture code) | Compute the heatmap post-hoc from the persisted log, same as all other metrics (`computeSessionMetrics` pattern) — recolor once per completed session, not per keystroke |
| Digraph/trigraph latency | Surfacing every observed pair/triple, unfiltered | More data feels more thorough | With only 1–3 sessions of history, most pairs/triples have 1–2 occurrences — a "ranked" list built on n=1 samples is indistinguishable from noise and will mislead the user about what's actually slow | Reuse the existing `MIN_SAMPLES`/gap-window gating pattern from `metrics.ts::slowestFive` (currently `>=3` post-filter samples, 25–1000ms window) for digraphs/trigraphs too, and grey out or omit pairs below threshold rather than force-ranking them |
| Per-language profile | Auto-detecting language from pasted content via heuristics or parsing (regex sniffing, tree-sitter) | Seems like the "real" fix for the plaintext-paste gap, and feels smarter than asking the user | Tree-sitter/syntactic analysis is an explicitly deferred later phase (PROJECT.md "Out of Scope: Syntactic chunking with tree-sitter"); heuristic sniffing (regex-guessing a language from snippet content) is a rabbit hole of false positives for short/ambiguous snippets and is disproportionate effort for a solo-user tool | A simple manual language picker/override on the paste form (a dropdown defaulting to "plaintext," user can set it) — trivial UI, zero parsing risk, and the user always knows what they just pasted |
| Symbol-adjusted WPM | Replacing net WPM entirely with the symbol-adjusted number | Simplifies the results screen to one headline number | Loses comparability with every external typing-speed reference point (Monkeytype, "good WPM" benchmarks) the user already has intuition for; also makes the metric's own history non-comparable if the formula/weighting is later tuned | Show both, side-by-side, exactly like Monkeytype shows raw next to net — symbol-adjusted WPM is a *companion* lens, not a replacement |
| Keyboard heatmap / per-language profile | Gamified overlays on either (streaks, "beat your heatmap," badges per language mastered) | Common in consumer typing apps, feels motivating | Explicitly out of scope for the whole project (PROJECT.md: "Gamification... deferred until the core loop proves useful") and orthogonal to the actual differentiator (data-driven diagnosis, not engagement mechanics) | Keep both views purely diagnostic/analytical, no scoring/badges layer |

## Feature Dependencies

```
Session Persistence (Dexie/IndexedDB)
    └──requires──> existing Session shape (src/session.ts::buildSession) — already assembled at completion, just needs a storage layer
    └──enables──>  History View (list)
    └──enables──>  Digraph/Trigraph Latency (accumulated across sessions, per milestone goal)
    └──enables──>  Keyboard Heatmap (accumulated across sessions, or per-session)
    └──enables──>  Per-Language Profile (grouping stored sessions by exercise.language)

Per-Language Profile
    └──requires──> Language tagging present on ALL sessions, not just uploads
                       └──BLOCKED BY──> paste always tags 'plaintext' (src/ingestion/types.ts, language-map.ts:
                                         extToLang only reachable via the upload path; paste has no extension to map)
                       └──requires (new, small feature)──> manual language picker/override on the paste form

Keyboard Heatmap
    └──requires──> a NEW per-physical-key (KeyboardEvent.code) latency aggregation
                       └──distinct axis from──> metrics.ts::slowestFive, which aggregates by committed CHARACTER (D-03)
                                                 — cannot be reused as-is; both aggregations read the same charLog
                                                 but group by a different key

Digraph/Trigraph Latency
    └──requires──> Session Persistence (to accumulate "across sessions" per PROJECT.md milestone goal — a single
                    session rarely has enough repeats of any given pair, and never enough for triples)
    └──trigraph tier requires──> materially more accumulated data than digraphs (sparser per-session occurrence)
                       └──enhances (but not required)──> Per-Language Profile (digraph/trigraph latency CAN be
                                                          further sliced by language once both exist)

Symbol-Density-Adjusted WPM
    └──requires──> a symbol classifier over Exercise.text (pure function, new — not present in metrics.ts today)
    └──enhances──> WPM display (parallel/companion metric, does not replace net WPM)
    └──independent of──> Session Persistence (can compute per-session immediately; benefits from persistence only
                          for showing adjusted-WPM history)

Session History (detail drill-down) ──enhances──> Session Persistence
    (requires persisting the raw charLog/markers, not just the derived summary numbers, to remain re-computable)
```

### Dependency Notes

- **Per-Language Profile requires fixing the paste-language gap first.** This is the single most consequential dependency in the milestone. `src/ingestion/types.ts` documents the current behavior directly: `Exercise.language` is `'plaintext'` for paste by design (D-11, A11), and `language-map.ts`'s `extToLang` is only invoked where a filename/extension exists — i.e., the upload path. If daily self-use leans on paste (the lower-friction path), a per-language profile view built today would show a single "plaintext" bucket and deliver zero value. **Recommendation:** add a minimal manual language selector to the paste form (reuse the same language vocabulary as `EXT_TO_LANG`'s values) as a prerequisite task within this milestone, not a separate future phase — it's small, and per-language profile is otherwise dead on arrival.
- **Keyboard Heatmap needs a new aggregation dimension, not a reuse of `slowestFive`.** The existing single-key slowest-5 logic intentionally groups by the committed *character* (a Shift+comma's `<` is scored as `<`, never as the physical comma key — `D-03`). A physical keyboard heatmap must instead answer "how slow was *this key on the diagram*", which means grouping by `KeyboardEvent.code` (physical position) regardless of what character/shift-state produced it. Plan for two parallel aggregation functions over the same `charLog`/`events`, not one shared one.
- **Digraph/Trigraph Latency depends on Session Persistence explicitly because the milestone goal is *accumulated* stats** ("Latencia por dígrafo/trígrafo acumulada entre sesiones" — PROJECT.md). A single session's digraph counts are usually too sparse to rank meaningfully; the existing `MIN_SAMPLES = 3` / `(25ms, 1000ms)` gating pattern in `metrics.ts` should be reused conceptually (not necessarily the same constants) for pairs and triples, and will bind harder for trigraphs, which occur least often.
- **Symbol-Density-Adjusted WPM is the only capability with zero direct dependency on persistence** — it can be computed and shown on the very next completed session, same call site as today's `computeSessionMetrics`. Treat it as the easiest, most self-contained slice of the milestone to ship first, and it doubles as a good instance to validate the "companion metric, not replacement" display pattern before applying the same pattern to raw-vs-adjusted history rows.
- **Session History (detail drill-down) is a low-cost differentiator *if and only if* the raw charLog/markers are persisted**, not just the derived summary numbers. Storing only `{date, wpm, accuracy}` per session is cheaper on IndexedDB but forecloses re-computation (detail view, later heatmap-by-session, later digraph re-analysis with an improved formula). Persist the full `Session` shape `buildSession` already assembles; derive summaries on read, the same way `computeSessionMetrics` is pure and re-runnable today.

## MVP Definition

### Launch With (v1.1)

Minimum to satisfy the milestone goal stated in PROJECT.md ("persist locally + expose the four analytics + measure real improvement over time").

- [ ] Session persistence to Dexie/IndexedDB, storing the full `Session` shape (not just summary numbers) — everything downstream depends on this
- [ ] History view: flat list, date + WPM + accuracy, newest first — no charts (explicitly deferred)
- [ ] Digraph latency: ranked table, accumulated across sessions, same sample-count/gap-window gating discipline as the existing slowest-5
- [ ] Keyboard heatmap: static QWERTY US-ANSI diagram, colored by median per-physical-key latency (new `KeyboardEvent.code`-keyed aggregation)
- [ ] Manual language picker/override on the paste form — **prerequisite fix**, without which per-language profile has no real data
- [ ] Per-language profile: WPM/accuracy grouped by tagged language, once the paste-tagging gap above is closed
- [ ] Symbol-density-adjusted WPM: shown as a companion number next to net WPM on the results screen, and stored per session for history

### Add After Validation (v1.x)

- [ ] Trigraph latency — add once digraph latency is shipped and a few weeks of real sessions have accumulated enough per-triple samples to clear a meaningful gate
- [ ] Session detail drill-down (re-view a past session's own slowest-5/digraph breakdown) — trivial once raw logs are persisted, but not required for the milestone's core "measure improvement" goal
- [ ] Heatmap filtered by language (e.g., "show me my Python-only heatmap") — natural cross of two v1.1 features, but a distinct filter UI, defer until both exist independently

### Future Consideration (v2+)

- [ ] Trend/evolution charts over session history — explicitly out of scope per PROJECT.md; revisit once there's enough history to chart meaningfully
- [ ] Auto language detection (heuristic or tree-sitter-based) instead of the manual picker — explicitly deferred (tree-sitter is its own later phase); the manual picker is the correct-for-now answer
- [ ] Cross-device sync of history — no backend in scope; would require the Tauri/native evolution path discussed in STACK.md, not a browser-only feature

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| Session persistence (Dexie) | HIGH | LOW | P1 |
| History list view | HIGH | LOW | P1 |
| Paste language picker (prerequisite fix) | HIGH (unblocks per-language profile) | LOW | P1 |
| Symbol-density-adjusted WPM | HIGH | MEDIUM | P1 |
| Digraph latency table | HIGH | MEDIUM | P1 |
| Keyboard heatmap | MEDIUM-HIGH | MEDIUM-HIGH | P1 |
| Per-language profile | MEDIUM-HIGH | MEDIUM (post-fix) | P1 |
| Trigraph latency | MEDIUM | HIGH | P2 |
| Session detail drill-down | MEDIUM | LOW-MEDIUM | P2 |
| Heatmap-by-language filter | LOW-MEDIUM | LOW (once both exist) | P2 |
| Trend/evolution charts | MEDIUM | MEDIUM-HIGH | P3 |
| Auto language detection | LOW (manual picker already solves it) | HIGH | P3 |

**Priority key:**
- P1: Must have for this milestone (v1.1)
- P2: Should have, add once v1.1 core has real usage data
- P3: Future consideration, not this milestone

## Competitor Feature Analysis

| Feature | Monkeytype | Keybr | 10FastFingers | Our Approach |
|---|---|---|---|---|
| Session history | Personal-best tracking, minimal list; full history mostly behind account/login | Profile page with progress graphs, tied to account | Basic score history, leaderboard-focused | Local-first flat list (date/WPM/accuracy), no account, full session detail recoverable from persisted raw log |
| Per-key/pair latency | Not exposed to the user (internal only, if computed at all) | Per-key stats + a "weakest keys" adaptive lesson generator; digraph-level detail limited | Not exposed | Digraph AND trigraph latency tables, explicitly code-oriented (compound operators, bracket pairs), with sample-gating to avoid noise |
| Keyboard heatmap | Not offered | Yes — heatmap on profile, colored by usage/performance (frequency-leaning per community reports) | Not offered | Heatmap colored by median **latency** (speed), not frequency — directly matches the "where am I slow" diagnostic goal, the clearer differentiator |
| Per-language grouping | N/A (prose only) | N/A (prose/letters only) | N/A (prose only) | Genuinely unique: group stats by tagged programming language — but only as good as the language tag, hence the paste-picker prerequisite |
| Raw/adjusted WPM pairing | Raw WPM shown next to Net WPM (error-based adjustment) | Net WPM only, no raw variant surfaced prominently | WPM only | Net WPM next to a NEW symbol-density-adjusted WPM — same "companion metric" UX pattern as Monkeytype, applied to a dimension (symbol density) no competitor measures |

## Sources

- [Raw WPM vs Net WPM - what's the difference? · Free typing test](https://typetera.com/wpm/raw-wpm-vs-net-wpm) — MEDIUM confidence (single third-party explainer, but consistent with Wikipedia's WPM definition and matches keebdrill's own existing `computeWpm`/`computeAccuracy` formulas)
- [Words per minute — Wikipedia](https://en.wikipedia.org/wiki/Words_per_minute) — HIGH confidence (standard reference for the 5-char "word" convention underlying both net and raw WPM)
- [Keyboard Heatmap | Realtime heatmap visualization (Patrick Wied)](https://www.patrick-wied.at/projects/heatmap-keyboard/) — MEDIUM confidence (representative example of frequency-driven heatmap convention, used here to contrast against the latency-driven approach recommended for keebdrill)
- [Keybr.com GitHub (aradzie/keybr.com)](https://github.com/aradzie/keybr.com) — MEDIUM confidence (project exists and is the reference implementation for per-key stats + adaptive lessons + heatmap; specific internal heatmap color-metric not independently verified beyond community reports)
- [Divide-By-0/keybr-with-stats — per-character and per-pair statistics fork](https://github.com/Divide-By-0/keybr-with-stats) — MEDIUM confidence (corroborates the digraph/pair statistics pattern as a natural, previously-built extension of keybr's single-key stats)
- [linguini1/typeTracker — graphing/analyzing keybr export data](https://github.com/linguini1/typeTracker) — MEDIUM confidence (corroborates that history/trend analysis is commonly a separate, add-on layer over the base session data, supporting the "defer charts" decision already made in PROJECT.md)
- [TypingFastest — average coder typing speed / code vs prose WPM](https://typingfastest.com/blog/average-coder-typing-speed-how-fast-should-developers-type-2026) — MEDIUM confidence (aggregated blog analysis, directionally consistent with the general "code is 20–30% slower than prose" claim used only as color, not as a hard target)
- [TypeQuicker — Keystrokes Per Hour (KPH) as an alternative to WPM for symbol-heavy contexts](https://www.typequicker.com/typing-speed-test/keystrokes-per-hour) — MEDIUM confidence (establishes that KPH is the closest existing "symbol-aware-ish" alternative metric in the industry, but confirms it only rescales units — WPM × 300 — rather than weighting for symbol *difficulty/density*, which is why symbol-density-adjusted WPM must be designed fresh for keebdrill)
- Direct codebase inspection (`src/session.ts`, `src/ingestion/types.ts`, `src/ingestion/language-map.ts`, `src/metrics/metrics.ts`) — HIGH confidence (primary source, ground truth for existing shapes, the D-03 char-vs-code aggregation decision, and the paste-plaintext gap)

---
*Feature research for: keebdrill v1.1 (session persistence + analytics milestone)*
*Researched: 2026-09-05*
