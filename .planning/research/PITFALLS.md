# Pitfalls Research

**Domain:** Adding local IndexedDB persistence + cross-session analytics (digraph/trigraph latency, keyboard heatmap, per-language profile, symbol-adjusted WPM) to an existing, working, well-tested single-session code-typing trainer (keebdrill v1.0 → v1.1)
**Researched:** 2026-09-05
**Confidence:** MEDIUM-HIGH (codebase-grounded findings HIGH; general IndexedDB/Recharts/statistics claims MEDIUM, cross-checked against MDN/Dexie official docs and GitHub issues)

## Critical Pitfalls

### Pitfall 1: Silently mixing metrics computed by different formula versions across sessions

**What goes wrong:**
`metrics.ts` already exports `METRICS_SCHEMA_VERSION = 1` and stamps every `MetricsResult` with it — this exists precisely because the formulas are expected to change (the WPM/accuracy/slowest-5 gap-filter constants are tunable, and the code review history shows the codepoint-indexing bug was fixed mid-project). Once sessions are persisted, a later formula tweak (e.g. changing `MIN_GAP_MS`/`MAX_GAP_MS`/`MIN_SAMPLES`, or the WPM active-time basis) will silently produce a mix of old-formula and new-formula results in the same history table. If cross-session digraph/heatmap aggregation reads raw `charLog`/`markers` and re-derives metrics with the *current* code, that's fine — but if it reads persisted `MetricsResult.wpm`/`.slowest5` values computed at session time, a formula change corrupts every trend line and per-digraph aggregate retroactively without anyone noticing, because the numbers still "look like" WPM/ms.

**Why it happens:** The natural (cheap) implementation persists the already-computed `MetricsResult` alongside the session, then the history/analytics views just read that column. It works perfectly until the metrics formula changes — which the codebase's own version constant telegraphs as a "when," not an "if."

**How to avoid:**
- Persist the raw inputs to `computeSessionMetrics` (`charLog`, `markers`, `exercise.text`, `now`/`completedAt`) as the source of truth, not just the derived `MetricsResult`. Recompute on read for anything that participates in cross-session aggregation (digraph latency, heatmap, symbol-adjusted WPM).
- If you do cache the derived `MetricsResult` for fast list rendering (session history table), store `schemaVersion` alongside it and gate all aggregation/comparison logic on schema equality — either recompute lazily when a stale-version row is read, or run a one-time migration pass on schema bump.
- Never silently average/rank a mix of schema versions together. Filter or recompute before combining.

**Warning signs:** A digraph or "slowest 5" trend that shows a step-change on a specific date with no corresponding real practice change — that date is a code deploy. Heatmap or symbol-WPM regressions that can't be explained by typing behavior.

**Phase to address:** Persistence phase (schema design) — store raw `charLog`/`markers`/`exercise`, not just derived metrics, and thread `schemaVersion` through any cached derived value from day one. Do not defer this to the analytics phase; retrofitting it after sessions exist requires a backfill migration.

---

### Pitfall 2: Persisted `Session.startedAt` (`Date.now()`) leaking into cross-session latency math instead of the `event.timeStamp` clock domain

**What goes wrong:** `capture/types.ts` explicitly documents `Session.startedAt` as "`Date.now()` wall clock, display only," while every latency computation (`computeSessionMetrics`'s `now` parameter, `computeActiveElapsedMs`'s `t0`/`now`) lives in the `event.timeStamp`-based `tMs` domain — a *different*, monotonic, DOMHighResTimeStamp clock that is NOT epoch-aligned and NOT comparable across page loads/reloads. `metrics.ts`'s own header comment calls this out as "Pitfall 1" for the *current* single-session code (never pass `Session.startedAt` as `now`). Once sessions are persisted and analytics code loads *multiple* sessions to build a cross-session digraph table or trend line, this exact mistake becomes far easier to reintroduce: a new engineer (or future-you) writing the cross-session aggregator naturally reaches for "the session's timestamp" to sort/bucket sessions by date, and it is dangerously easy to also reuse that same field, or a value derived from it, inside a per-session latency recomputation — especially if the persisted record's field naming doesn't scream "wall-clock, not tMs-domain."

**Why it happens:** Two clock domains coexist by design (tMs for measurement precision, `Date.now()`/`startedAt` for human-readable dates), and cross-session code needs the *second* one (to sort/filter/display session history) while per-session metrics need the *first* one. It's an easy field mix-up once the two are sitting side by side in one persisted record read by unfamiliar analytics code.

**How to avoid:** Keep the persisted schema's field names and types unambiguous — e.g. `startedAtWallClock: number` / `completedAtWallClock: number` for history/date display vs. keep `charLog`/`markers` tMs fields untouched and never surface a bare `now`/`completedAt` field that could be confused with wall-clock time. Add a lint-able or test-enforced invariant: any function that recomputes metrics from a persisted session must derive its `now` from `charLog`/`markers` (e.g. last event's `tMs`), never from a wall-clock field on the record.
Add a golden/regression test asserting cross-session recomputation produces identical `wpm`/`slowest5` to the original in-session computation for a fixed fixture, to catch clock-domain regressions immediately.

**Warning signs:** WPM values for old sessions that are astronomically high or `Infinity`/`NaN` after being reloaded from storage (a `Date.now()`-vs-`tMs` domain mismatch typically produces a near-zero or negative `elapsedMs`, guarded to 0 by `computeWpm`'s existing guard — so watch instead for suspicious near-zero elapsed times / suspiciously infinite-looking WPM on historical reads).

**Phase to address:** Persistence phase — define the storage schema with unambiguous field names; write the recomputation-from-storage path as a NEW pure function (`computeSessionMetrics(session.exercise.text, session.charLog, session.markers, /* derived from charLog/markers */)`) with its own test fixture, not an ad hoc call site duplicated in the analytics phase.

---

### Pitfall 3: Aggregating digraph/trigraph latency across sessions without the existing per-session sample-size gate — small-N "slowest" rankings become noise

**What goes wrong:** `metrics.ts` already encodes hard-won statistical discipline for *within-session* slowest-5 (median not mean, `MIN_SAMPLES = 3` gate applied POST-filter, exclusive `(25ms, 1000ms)` outlier window, grouped by logical committed character not raw key code). A cross-session digraph/trigraph aggregation feature is tempting to build as a naive re-implementation (new code, new file) that groups digraph latencies globally and ranks by mean or by max — silently dropping the outlier filter, the post-filter minimum-sample gate, or both. With trigraphs specifically, the combinatorial explosion of possible 2-3 character sequences in code (operators like `->`, `=>`, `::`, `!==`) means most trigraphs will have very few (1-2) observations even after several sessions, so an un-gated ranking will surface single-occurrence "300ms trigraph" flukes as the headline "your slowest sequence," undermining the entire value proposition (the project's stated success criterion is measuring *real* improvement on *frequent* symbol digraphs).
Industry latency-metrics guidance independently confirms this: percentile/extremal statistics computed on small sample counts are dominated by single-outlier noise, and the standard mitigation is exactly what `metrics.ts` already does — median with an explicit minimum-sample gate, not raw max or naive percentile.

**Why it happens:** The existing gate logic lives inside `slowestFive`/`replayAttempts`, scoped to a single session's `Map<char, number[]>`. A cross-session feature naturally needs a *different* aggregation shape (accumulate across many sessions, key by digraph/trigraph not single char), and it's easy to write that as fresh code that "looks similar" but forgets to port the gate constants, the outlier window, or the requirement to filter before gating.

**How to avoid:**
- Factor the gate/filter/median logic (`MIN_GAP_MS`, `MAX_GAP_MS`, `MIN_SAMPLES`, filter-then-gate-then-median ordering) out of `slowestFive` into a shared, exported, unit-tested utility that both the existing single-session path and the new cross-session digraph/trigraph aggregator call — do not duplicate the constants or the ordering logic.
- For digraphs/trigraphs specifically, expect to need a *higher* minimum-sample threshold than the single-char `MIN_SAMPLES = 3`, since two- and three-character sequences are rarer than single characters per session; pick the threshold empirically against real accumulated data before shipping the feature, and gate the UI (e.g. "not enough data yet" state) rather than showing sparse/noisy rankings.
- Group by the same "logical committed character(s)" semantics already established (D-03: group by `CommittedChar.data` codepoint, not `KeyboardEvent.code`) — extend this to sequences of codepoints, keeping the multi-codepoint IME attribution rule (attribute to the last codepoint of a multi-codepoint insert) consistent.

**Warning signs:** The "slowest digraph" leaderboard is dominated by rare/unusual sequences the user typed once, changes wildly between sessions, or highlights sequences with only 1-2 total observations.

**Phase to address:** Analytics phase (digraph/trigraph latency) — before building the aggregation UI, refactor the sample-gate/filter/median logic into a shared module and write it test-first against synthetic small-N fixtures.

---

### Pitfall 4: Pasted-text sessions (always tagged `'plaintext'`) polluting per-language profiling as if `'plaintext'` were a real, meaningful language bucket

**What goes wrong:** `Exercise.language` is `'plaintext'` for every pasted session (paste never attempts language detection — `language-map.ts`'s `extToLang` is only invoked for uploads) AND `'plaintext'` is also the *legitimate* fallback for uploads with an unrecognized/absent extension. A per-language profile feature that naively groups sessions by `exercise.language` will conflate three semantically different things into one `'plaintext'` bucket: (1) genuinely untagged/unknown content, (2) real prose/markdown-adjacent text the user intentionally typed as plain text, and (3) — worst case — actual code pasted by the user that never got a language tag simply because paste has no detection. Because pasting is almost certainly the *lower-friction, more-used* ingestion path day to day (vs. deliberately uploading a file), `'plaintext'` will likely become the largest bucket by session count, making the "per-language profile" feature's headline number a meaningless aggregate dominated by unlabeled data — directly undermining the feature's purpose.

**Why it happens:** `Exercise.language` was designed in Phase 1 as "best-effort, not a parser" for a single-session UI need (tagging), long before cross-session aggregation was a requirement; nothing in the existing type system distinguishes "we don't know" from "this really is plaintext."

**How to avoid:**
- Before building per-language profiling, close the paste-tagging gap: either (a) let the user pick/confirm a language when pasting (cheap, honest, no false precision), or (b) run lightweight heuristic/content-sniffing language detection on paste (e.g. shebang lines, braces density, keyword signatures) — but if you do this, do NOT silently relabel historical sessions; only apply to new pastes, and treat detection confidence explicitly.
- In the per-language profile UI, treat `'plaintext'` as its own explicit, clearly-labeled bucket ("untagged / plain text") — do not let it masquerade as a language on equal footing with `'typescript'`/`'python'`/etc., and consider excluding it from "your fastest/slowest language" superlative claims entirely.
- Add a persisted `languageSource: 'extension' | 'user-selected' | 'untagged'` (or similar) field distinct from `language` itself, so the analytics layer can filter/weight by confidence without re-deriving it from `sourceType`.

**Warning signs:** The per-language profile's top bucket by session count is `'plaintext'` and its WPM/accuracy numbers don't match any single real language's expected shape (e.g. suspiciously high WPM because prose has fewer symbol digraphs than code).

**Phase to address:** Requirements/scoping should resolve paste-language-tagging *before* or *within* the per-language-profile phase — this is a data-quality prerequisite, not a nice-to-have. Flag explicitly in phase planning: "per-language profile phase blocked on deciding paste language-tagging strategy."

---

### Pitfall 5: Symbol-density-adjusted WPM computed with a fixed/global symbol weighting that double-counts or misclassifies the corrected-over attempt stream

**What goes wrong:** The existing `wpm`/`accuracy` formulas are carefully defined over `correctAttempts`/`incorrectAttempts` from `replayAttempts`, which replays *every* insert attempt including ones later overwritten by backspace-and-retype (explicitly NOT collapsed to final per-position status — this is D-02, locked in because collapsing loses correction history). A symbol-adjusted WPM feature needs a per-character "symbol weight" (e.g. `{` weighted higher than `a`) multiplied into the WPM numerator. If this weighting is naively applied to the *raw committed-char attempt stream* (including corrected-over attempts) rather than to the *target* text's canonical characters, you get double- or triple-counting: every backspace-retype of a symbol re-applies its (higher) weight, inflating symbol-adjusted WPM specifically for whichever characters the user fumbled most — the opposite of the intended signal (fumbled symbols should show *lower* effective throughput, not higher weighted-WPM).

**Why it happens:** `computeWpm(correctChars, elapsedMs)` currently takes a plain count; the natural extension is `computeWeightedWpm(weightedCorrectChars, elapsedMs)` where `weightedCorrectChars` sums a per-char weight over the same `correctAttempts` accounting used today. But "correct attempts" already legitimately counts every eventually-correct keystroke including ones after a fumble+retry (this is intentional and correct for *accuracy*, not necessarily for *symbol-density-adjusted WPM*, which is a throughput metric that should probably be normalized on the *target* text's symbol density, not the attempt stream's).

**How to avoid:**
- Decide explicitly (and document as a decision, not an implicit default) whether symbol-density adjustment is: (a) a multiplier on the *target exercise's* overall symbol density (one scalar per session, applied to the whole-session WPM) — simplest, avoids the double-counting trap entirely; or (b) a per-character weighting applied to the attempt stream — if chosen, it MUST be applied consistently with the existing correct/incorrect attempt semantics and explicitly tested against a fixture with backspace-corrected symbols to confirm it doesn't inflate the corrected-fumble case.
- Prefer (a) for v1.1 given the "nothing is persisted/committed yet" stage of this feature — it's the option least likely to interact badly with the existing replay/correction semantics, and it's the interpretation implied by "symbol-density-adjusted WPM" (adjusting the *exercise's* difficulty, not re-weighting individual keystrokes).
- Whichever is chosen, add a golden test analogous to the existing `metrics.test.ts` cases, specifically covering a session with backspace-corrected symbol characters, to lock the formula the same way D-01/D-02 are locked today.

**Warning signs:** Symbol-adjusted WPM is *higher* than plain WPM for a session with many corrections on symbol characters — that's the double-counting signature.

**Phase to address:** Analytics phase (symbol-adjusted WPM) — resolve the design decision during phase discussion/spec, before implementation; do not leave it as an implementation-time judgment call given how easily it interacts with D-02's replay semantics.

---

### Pitfall 6: IndexedDB/Dexie schema versioning mistakes on the very first migration

**What goes wrong:** Dexie requires an explicit version bump plus an `upgrade()` function for any schema change; skipping the version bump (e.g. just editing the `stores()` call in place during development and forgetting to increment `db.version(N)`) silently no-ops the migration for any user who already has a v1.1-era database on disk — Dexie only runs upgrade logic when it detects `oldVersion < newVersion`. Because this is a solo-developer, single-machine, local-first app, this class of bug is easy to miss in dev (you just wipe your IndexedDB and it "works") but will bite the moment the schema needs a second change — the exact point this project is at, going from "no persistence" (v1.0) to "first persisted schema" (v1.1) to (later) "digraph/trigraph aggregate tables, per-language indices" which will very likely require additional stores or indices in a subsequent milestone.

**Why it happens:** Dexie's `Version.upgrade()` API is easy to use correctly for the *first* version but the discipline (increment number, add upgrade fn, never mutate an already-shipped version's schema in place) is easy to forget under solo/rapid iteration, especially with no other developers to catch it in review.

**How to avoid:**
- Establish the schema-versioning discipline explicitly in this persistence phase, even though it's the first version: `db.version(1).stores({...})`, and document in-code (a comment analogous to the existing D-xx decision comments) that any future schema change requires a NEW `db.version(N+1).stores({...}).upgrade(tx => ...)` block, never editing version 1's `stores()` definition.
- Write a migration test harness now (even trivial for v1) so the pattern exists before it's needed under pressure: seed a fake "old" IndexedDB shape, run the upgrade, assert the new shape/data.
- To delete a store in a future version, Dexie requires an explicit `null` entry for that store's schema in the new version — omitting it silently keeps the old store around as dead weight, not deleted.

**Warning signs:** A schema change "works" in dev (fresh DB) but a returning user's browser silently keeps stale data/shape, or a runtime error appears only for users with pre-existing data.

**Phase to address:** Persistence phase — bake the versioning discipline and a migration test into the initial Dexie setup, not deferred to "when we actually need version 2."

---

### Pitfall 7: Storing the full raw keystroke log (`events`) unbounded, per session, forever

**What goes wrong:** `Session` includes `events: readonly KeystrokeEvent[]` — a keydown+keyup pair per physical keystroke, at minimum, for the entire session — in addition to `charLog` and `markers`. For a typing trainer used daily, this is many thousands of small objects accumulating indefinitely with no eviction policy. Individually this is small, but IndexedDB storage quota is finite and browser-dependent (desktop: hundreds of MB typically available; mobile: as little as 50MB), and eviction under quota pressure is LRU-by-origin — meaning the browser could evict the ENTIRE keebdrill database (not just old rows) if the origin isn't recently used and disk fills from other apps, silently destroying the user's practice history with no in-app warning. Persisting `events` as raw arrays via IndexedDB's structured-clone-based storage (rather than as `Uint8Array`/typed-array-backed compact encodings) also multiplies per-object overhead needlessly.

**Why it happens:** `events` already exists as an in-memory shape from Phase 1/2 (needed then for capture debugging/composition); it's tempting to persist the whole `Session` object verbatim since that's the path of least resistance and requires no new decision-making about what's "needed."

**How to avoid:**
- Decide explicitly what's actually needed for v1.1's stated analytics (digraph/trigraph latency, heatmap, per-language profile, symbol WPM) — all of these can very likely be derived from `charLog` + `markers` alone; raw `events` (keydown/keyup pairs) may not need long-term persistence at all, or only need short-term persistence for debugging (e.g. keep only the most recent N sessions' raw events, or don't persist `events` past the results screen).
- If `events` is persisted, cap/prune it: e.g. persist derived per-session aggregates (digraph latency samples) permanently but raw `events`/`charLog` on a rolling window (last N sessions), or make raw-log retention a user-configurable/opt-in setting.
- Wrap all Dexie writes in try/catch for `QuotaExceededError` per browser storage-eviction guidance, and provide user-visible feedback rather than silently swallowing/losing a session on write failure.
- Consider `navigator.storage.estimate()` to surface a "storage used" indicator, and `navigator.storage.persist()` to request persistent (non-evictable) storage — the closest available mitigation against LRU origin eviction, though not a guarantee.

**Warning signs:** IndexedDB usage growing unbounded across daily use with no way to inspect/prune it; a user story where a returning user's history is unexpectedly empty (evicted) with no error shown.

**Phase to address:** Persistence phase — decide and implement the retention policy (what's stored forever vs. pruned vs. never persisted) as part of the initial schema design, not as a later cleanup task.

---

### Pitfall 8: Race conditions / partial writes when persisting a session on completion, blur, or rapid navigation

**What goes wrong:** The existing `buildSession` function is explicitly documented as producing a "LIVE snapshot, not a one-time event" — calling it once and caching forever is called out as a known trap (CR-01). Adding persistence introduces a new failure mode on top of this: if the write to Dexie is triggered on the "session complete" event but the user navigates away, closes the tab, or the tab loses focus mid-write (async IndexedDB transactions are not synchronous), the write can be lost or partially committed. Because free-correction and restart are core mechanics (a session can be restarted mid-flight per D-04), a persistence trigger tied to the wrong lifecycle event (e.g. firing on every keystroke, or firing on unmount without awaiting the transaction) risks either duplicate/partial session rows or silently dropped completions.

**Why it happens:** Persistence is naturally wired to "whenever it seems convenient" (component unmount, a `useEffect` cleanup, a button's `onClick`) rather than to a single, well-defined completion event with awaited confirmation, especially when retrofitting persistence onto an existing state machine (`trainer/state.ts`) that wasn't designed with a persistence hook in mind.

**How to avoid:**
- Persist exactly once, on the trainer state machine's explicit "completed" transition (not on unmount, not on blur, not per-keystroke), and treat the write as awaited/confirmed before allowing navigation away from the results view (e.g. disable/guard navigation until the Dexie promise resolves, or show a save-pending indicator).
- Use a single Dexie transaction for the full session write (not several sequential `.add()` calls across stores) so a failure rolls back atomically rather than leaving partial per-store data.
- Guard against double-submission: if "Restart" can be triggered from the results view, ensure a fresh restart doesn't create a second incomplete row for the same logical session, and ensure the (session-complete) trigger can't double-fire (e.g. React StrictMode double-invoking effects in dev).

**Warning signs:** Duplicate session rows in history for a single practice run; a session that was clearly completed (results were shown) missing from history after reload.

**Phase to address:** Persistence phase — define and test the single persistence trigger point against `trainer/state.ts`'s state machine before building the history UI on top of it.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Persist only the computed `MetricsResult` per session, not raw `charLog`/`markers` | Simpler schema, faster history-list reads | Cannot recompute after a formula change; cannot build new cross-session analytics (digraph/heatmap) retroactively over old sessions | Never for v1.1 — the milestone's own scope requires cross-session digraph/heatmap derived from raw data |
| Group per-language stats by `exercise.language` string directly with no `'plaintext'` handling | Zero extra schema/UI work | Per-language profile's biggest bucket is meaningless untagged data | Only as an explicitly-labeled interim state, never as the shipped v1.1 UX |
| Symbol-density weighting applied per-attempt (including corrected-over attempts) | Reuses existing `replayAttempts` accounting unchanged | Silently rewards users who fumble symbols with inflated weighted-WPM | Never — resolve the target-vs-attempt-stream design question up front |
| Skip a migration test harness for the first Dexie schema version | Faster to ship v1.1 | No safety net when schema v2 is needed (very likely, given trigraph/heatmap tables may need their own stores later) | Only if the team is willing to hand-verify every future migration manually — not recommended given solo-dev context |
| Persist raw `events` (keydown/keyup) indefinitely alongside `charLog` | No decision-making needed, reuses existing shape verbatim | Unbounded IndexedDB growth, higher LRU-eviction exposure, wasted storage since analytics likely only need `charLog`/`markers` | Acceptable short-term with an explicit pruning/rolling-window TODO, not acceptable as permanent policy |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|--------------|------------------|-------------------|
| Dexie / IndexedDB | Editing an already-shipped version's `stores()` definition in place instead of adding a new `db.version(N+1)` block | Always add a new version block with an `upgrade()` function for any schema change post-ship; never mutate a shipped version definition |
| Dexie / IndexedDB | Omitting a store from a new version's schema, assuming that "deletes" it | Explicit `null` schema entry is required to actually delete a store; omission just leaves it untouched |
| IndexedDB writes | Fire-and-forget `db.sessions.add(...)` with no error handling | Wrap every write in try/catch for `QuotaExceededError`; surface a user-visible save-failed state rather than swallowing the error |
| IndexedDB storage | Assuming data persists indefinitely once written | LRU-based origin eviction under disk pressure is real, especially on mobile/Safari; consider `navigator.storage.persist()` and surface storage usage to the user |
| Recharts (heatmap) | Shipping the default color-only heatmap with no `accessibilityLayer` and no non-color cue | Enable `accessibilityLayer` explicitly (defaults to false pre-3.0), verify 3:1 contrast between adjacent color-scale steps in both light and dark themes, add numeric labels or shape/pattern redundancy so the heatmap isn't color-only |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|-----------|-------------|-----------------|
| Recomputing full cross-session digraph/trigraph aggregation on every history-view render by scanning every persisted session's raw `charLog` | Noticeably slower history/analytics page load as session count grows | Maintain incrementally-updated aggregate tables (e.g. a `digraphStats` store keyed by digraph, updated once per new session write) rather than full re-scans on read | Roughly dozens to low hundreds of sessions of daily code-typing history (each session's `charLog` can be hundreds to low-thousands of entries) |
| Persisting full raw `events` array per session with no cap | Slow IndexedDB writes/reads over time, quota pressure sooner | Prune/cap raw event retention (see Pitfall 7); persist only derived aggregates long-term | After weeks of daily use at multiple sessions/day |
| Recharts re-rendering the full heatmap/digraph chart on every keystroke of a live session (if analytics views are ever mounted during active typing) | Jank/jitter that could even leak back into keystroke timing measurement (the codebase's own architecture explicitly isolates the capture handler from render work — do not let analytics rendering share a render cycle with active capture) | Keep analytics views strictly post-session (results/history screens), never mounted during active capture, consistent with the existing "handler does only a buffer push, metrics computed post-hoc" design | Any co-mounting of live capture and chart rendering |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Persisting third-party repo/pasted content verbatim in IndexedDB with no consideration of what "stays local" actually guarantees | If a future phase adds any sync/export/telemetry feature without revisiting this, licensed third-party code could leave the machine, violating the project's own stated privacy constraint | Document explicitly (as the project's PROJECT.md already does) that IndexedDB persistence satisfies "stays local" only as long as no export/sync/telemetry code path exists; flag this constraint again whenever a later phase touches persistence or networking |
| No consideration of shared/multi-user machines | On a shared computer, another OS user profile typically has separate browser storage, but the same OS user's *other browser profiles* or *the same profile* can read the same IndexedDB origin — pasted proprietary code becomes visible to anyone with access to that browser profile | Out of scope for a single-user personal tool, but worth one line in docs/README if the tool is ever shared/open-sourced |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Showing a "per-language profile" or "slowest digraph" panel with sparse/noisy data as if it were a confident result | User draws false conclusions ("I'm slow at Rust") from 1-2 sessions of data | Gate analytics displays behind a minimum-session/minimum-sample threshold; show an explicit "not enough data yet" state below threshold, consistent with the existing `MIN_SAMPLES` philosophy already in `metrics.ts` |
| Heatmap that only differentiates via color hue/saturation | Colorblind/low-vision users (and anyone in bright sunlight / poor monitors) can't read it, and dark-mode heatmaps often fail contrast for mid-range values specifically | Pair color with numeric value display and/or shape/pattern; validate 3:1 contrast between adjacent scale steps against both light and dark backgrounds explicitly, not just against the darkest/lightest ends |
| Session history list that silently loses a session (quota eviction, failed write) with no acknowledgment | User believes their practice history is more complete/accurate than it is, undermining the "measure real improvement over time" success criterion | Surface write failures; consider a lightweight periodic export/backup affordance (e.g. "export history as JSON") given IndexedDB's non-durability guarantees |

## "Looks Done But Isn't" Checklist

- [ ] **Session persistence:** Often missing schema-version discipline — verify a second Dexie `version()` block with `upgrade()` exists as a documented pattern/test, not just version 1 hard-coded once.
- [ ] **Digraph/trigraph latency:** Often missing the minimum-sample gate ported from `slowestFive` — verify the shared filter/gate/median utility is actually reused, not reimplemented ad hoc, and that trigraphs use an appropriately higher threshold than single-char `MIN_SAMPLES`.
- [ ] **Per-language profile:** Often missing explicit `'plaintext'`/untagged handling — verify paste-language tagging is resolved (user-selected or heuristic) before the profile view ships, and that `'plaintext'` is visually distinguished from real languages.
- [ ] **Symbol-adjusted WPM:** Often missing a decision record for target-density vs. per-attempt weighting — verify a test fixture with backspace-corrected symbol characters confirms no double-counting inflation.
- [ ] **Keyboard heatmap:** Often missing dark-mode contrast validation and non-color redundancy — verify contrast ratios were actually checked in both themes, not just visually eyeballed in one.
- [ ] **Cross-session metrics:** Often missing schema-version filtering — verify aggregation code excludes or recomputes stale-schema-version sessions rather than blending them in raw.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|-----------------|
| Mixed formula versions already persisted and blended into analytics | MEDIUM | Backfill: recompute every persisted session's derived metrics from its raw `charLog`/`markers` using the current formula, bump a stored `schemaVersion`, re-render aggregates |
| Un-gated small-N digraph/trigraph rankings already shipped and shown to the user | LOW | Add the missing minimum-sample gate and outlier filter to the shared utility; existing raw data doesn't need to change, only the read-time aggregation logic |
| `'plaintext'` bucket already polluting per-language profile | LOW-MEDIUM | Add `languageSource` field going forward (doesn't require rewriting old rows); in the UI, retroactively bucket old `'plaintext'` rows as "untagged" and exclude from superlative claims; optionally prompt the user to retag old sessions if feasible |
| IndexedDB schema versioning mistake shipped (a version was edited in place) | HIGH if users already have divergent on-disk shapes | Requires a careful "detect old malformed shape, coerce or discard" migration; for a solo-dev single-machine app this is more tractable (inspect your own DB directly) than for a multi-user product — still budget real time for it |
| Session data lost to quota eviction | LOW (data is simply gone, no corruption) | No recovery of lost data; mitigate going forward with `navigator.storage.persist()` and/or a periodic export/backup feature |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Mixed formula versions across sessions | Persistence phase | Schema stores raw `charLog`/`markers` + `schemaVersion`; aggregation code demonstrably filters/recomputes by version in a test |
| `startedAt` wall-clock leaking into tMs-domain math | Persistence phase | New "recompute from storage" function has its own golden test proving identical output to in-session computation |
| Un-gated small-N digraph/trigraph rankings | Analytics phase (digraph/trigraph) | Shared gate/filter/median utility extracted and unit-tested; UI shows "not enough data" below threshold |
| `'plaintext'` polluting per-language profile | Requirements/scoping, then Analytics phase (per-language profile) | Paste language-tagging strategy decided and implemented before profile view ships; UI visibly separates untagged bucket |
| Symbol-WPM double-counting via corrected attempts | Analytics phase (symbol-adjusted WPM) | Design decision documented (target-density vs per-attempt); test fixture with corrected symbols passes |
| Dexie schema versioning mistakes | Persistence phase | A second version-bump/migration test exists in the test suite before the phase is marked done, even if trivial |
| Unbounded raw `events` storage | Persistence phase | Explicit retention policy documented and implemented (pruned/rolling-window/opt-in), not "store everything forever" by default |
| Race conditions on session-complete write | Persistence phase | Single, awaited persistence trigger tied to the state machine's completion transition, tested for double-fire and interrupted-navigation cases |
| Recharts heatmap accessibility/dark-mode contrast | Analytics phase (keyboard heatmap) | `accessibilityLayer` enabled; contrast ratios checked in both themes; non-color redundancy present |

## Sources

- https://dexie.org/docs/Version/Version.upgrade().html — Dexie versioning/upgrade semantics — MEDIUM (cross-checked, official docs)
- https://dexie.org/docs/Tutorial/Understanding-the-basics — Dexie schema basics — MEDIUM
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria — IndexedDB quota/eviction (LRU, QuotaExceededError) — MEDIUM (official MDN)
- https://rxdb.info/articles/indexeddb-max-storage-limit.html — IndexedDB storage limits by browser/device — MEDIUM
- https://github.com/recharts/recharts/wiki/Recharts-and-accessibility — Recharts accessibilityLayer defaults — MEDIUM
- https://www.deque.com/blog/how-to-make-interactive-charts-accessible/ — chart accessibility contrast guidance — MEDIUM
- https://www.a11y-collective.com/blog/accessible-charts/ — heatmap contrast pitfalls — MEDIUM
- https://www.ibm.com/support/pages/why-p99-latency-metrics-are-unreliable-low-traffic-workloads — small-sample percentile unreliability — MEDIUM
- https://clickhouse.com/resources/engineering/percentiles-vs-averages — percentile vs average / median guidance under low N — MEDIUM
- In-repo, HIGH confidence (direct source read): `src/metrics/metrics.ts`, `src/capture/types.ts`, `src/session.ts`, `src/trainer/active-time.ts`, `src/ingestion/language-map.ts`, `src/ingestion/types.ts`, `.planning/PROJECT.md`

---
*Pitfalls research for: keebdrill v1.1 (session persistence + cross-session analytics)*
*Researched: 2026-09-05*
