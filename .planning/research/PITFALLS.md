# Pitfalls Research

**Domain:** Developer typing trainer with high-resolution keystroke telemetry (keebdrill)
**Researched:** 2026-09-03
**Confidence:** MEDIUM-HIGH (timing/browser behavior HIGH from MDN/Chrome/W3C; statistical-validity and corpus-licensing MEDIUM; UX pitfalls MEDIUM from competitor analysis)

---

## Critical Pitfalls

### Pitfall 1: Trusting `KeyboardEvent.timeStamp` / `performance.now()` sub-millisecond precision that the browser does not actually give you

**What goes wrong:**
The whole differentiator ("per-digraph/trigraph latency") depends on timestamp precision, but browsers deliberately clamp high-resolution timers to defend against Spectre and keystroke-timing side channels. In a normal (non cross-origin isolated) page: Chrome/Chromium clamps `performance.now()` and event timestamps to **100 microseconds**; Firefox rounds to **1 millisecond**. Only a cross-origin-isolated context (COOP + COEP headers) unlocks 5µs (Chrome) / 20µs (Firefox). If you build assuming microsecond fidelity, your Firefox data is quantized to 1ms buckets and cross-browser comparisons are invalid.

**Why it happens:**
`performance.now()` docs historically showed microsecond examples; developers assume `DOMHighResTimeStamp` means "high enough." The clamping is invisible — values still look like floats, they are just rounded.

**How to avoid:**
- Decide the platform first (Constraint already flags this). A **TUI/native capture engine** (Rust/Python reading raw terminal or evdev/OS events) sidesteps browser clamping entirely and is the stronger choice for a timing-first product. If web is chosen, serve the app **cross-origin isolated** (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`) from day one and verify `crossOriginIsolated === true` and `performance.timeOrigin` behavior.
- Record which clock/resolution produced each session; store a `timing_resolution_us` field per session so later analysis can filter or down-weight coarse data.
- For digraph latencies (typically 60–300 ms) even 1ms rounding is tolerable *in aggregate*, but not for the "5 slowest keys" on a short exercise where 3–4 samples per key is common — see Pitfall 5.

**Warning signs:**
Latency histograms show suspiciously discrete spikes at 1ms multiples; Firefox and Chrome produce systematically different WPM/latency for the same user; `performance.now()` returns integers.

**Phase to address:** Phase 0/1 (platform + capture-engine decision); verified again in the metrics phase.

---

### Pitfall 2: Using the wrong timestamp source — reading `performance.now()` inside the handler instead of `event.timeStamp`

**What goes wrong:**
`event.timeStamp` records when the input event was *created by the browser*. Calling `performance.now()` at the top of your listener records when your JS *got scheduled to run*, which includes main-thread contention, layout, GC, and React re-render time. Under load these differ by tens of milliseconds — exactly the magnitude of a digraph latency — so your "slowest keys" become "keys I happened to type while React was busy."

**Why it happens:**
Tutorials show `Date.now()` / `performance.now()` in handlers; `event.timeStamp` is less discussed and historically had cross-browser epoch inconsistencies (relative to `timeOrigin` vs Unix epoch) that scared people off. Modern browsers standardized it to `DOMHighResTimeStamp` comparable to `performance.now()`.

**How to avoid:**
- Use `event.timeStamp` as the authoritative time for every keydown/keyup. Capture `performance.now()` too, only as a diagnostic of handler lag (`handlerLag = performance.now() - event.timeStamp`).
- Keep the keystroke listener dead simple: push `{code, key, type, timeStamp}` into a plain array (or ring buffer) and return. Do all rendering/metrics off the hot path (rAF or after test end).
- Never do React state updates per keystroke that re-render the full text area.

**Warning signs:**
`handlerLag` p95 > 5ms; latency correlates with text length (longer exercise = slower "typing" because the DOM got heavier); janky caret.

**Phase to address:** Capture-engine phase (Phase 1/2).

---

### Pitfall 3: Counting OS key-repeat events as real keystrokes

**What goes wrong:**
Holding a key (common on `-`, `=`, space, arrow keys, or just a sticky finger) makes the OS emit a stream of `keydown` events with no matching `keyup` until release. Naively these inflate keystroke count, destroy accuracy stats, and create fake 30–50ms "digraphs" (the OS repeat rate) that dominate the slowest/fastest tails and poison per-digraph medians.

**Why it happens:**
`keydown` fires repeatedly on auto-repeat; the `event.repeat` flag exists but is easy to forget, and terminal apps see raw repeat at the configured `xset r rate` / macOS `KeyRepeat` cadence with no flag at all.

**How to avoid:**
- Web: ignore any `keydown` where `event.repeat === true` for character insertion AND for timing. Track a per-`code` "is currently down" set; a `keydown` for a code already in the set is a repeat even if the flag is missing (WebView/older-browser bug).
- TUI: debounce identical keycodes arriving faster than a human floor (~25–30 ms) unless the design explicitly wants to train key-repeat; more robustly, read keyup/keydown separately (evdev) rather than cooked terminal input.
- Decide product-level: repeated characters in the *corpus* (e.g. `====`, `---`, `//`) must be typed as distinct presses — so you cannot just "allow holding the key." Make held-key a detected error or a no-op.

**Warning signs:**
Digraph latency distribution has a sharp secondary mode at ~30–60ms; accuracy occasionally >100% or keystroke count exceeds corpus length on a clean run; the same character repeats faster than any human bigram.

**Phase to address:** Capture-engine phase (Phase 1/2).

---

### Pitfall 4: Ambiguous / non-standard WPM and accuracy definitions

**What goes wrong:**
There is no single WPM. If you invent your own, your numbers are not comparable to Monkeytype/Keybr/typing.io and — worse — not comparable to *your own past self* after you tweak the formula. Common mistakes: counting actual space-delimited words instead of the standard 5-character "word"; mixing gross and net WPM; letting backspaces/corrections count as negative or as extra characters; timing from page load instead of first keystroke; including the trailing think-pause before the last char.

**Why it happens:**
"Words per minute" sounds self-evident. Code has few spaces, so real-word counting produces wild numbers and symbol-dense lines look artificially slow/fast.

**How to avoid:**
- Adopt the industry standard explicitly and write it in the spec:
  - **Gross/Raw WPM** = (all characters typed / 5) / minutes elapsed.
  - **Net WPM** = (correct characters / 5) / minutes, OR gross minus (uncorrected errors / 5) / minutes — pick one, document it.
  - **Accuracy** = correct keystrokes / total keystrokes (include corrections in the denominator; this is "real accuracy," the harsher and more honest number).
  - Clock starts on **first keystroke**, stops on **last required keystroke**.
- Because the corpus is code, also report **adjusted WPM** as a *separate, clearly-labeled* metric (the actual differentiator) — never silently redefine the headline WPM.
- Freeze the formulas before storing any historical data; version the metric schema so a later formula change is a new column, not a silent rewrite.

**Warning signs:**
WPM changes when you refactor the metrics code; your WPM is 3x or 1/3 of Monkeytype for the same text; short exercises give absurd WPM (dividing by a near-zero minute count).

**Phase to address:** Metrics phase (v1). This is a spec decision, cheap now, expensive after data accrues.

---

### Pitfall 5: Reporting "5 slowest keys" / per-digraph latency from statistically meaningless sample sizes

**What goes wrong:**
A pasted 40-line snippet might contain the digraph `->` twice and `{}` once. Reporting "your slowest digraph is `{}` at 480ms" from n=1 is noise — one hesitation while reading ahead dominates. Users will chase phantom weaknesses, and the future "adaptive drill generator" will amplify noise into a training program. Keystroke-dynamics research generally wants **hundreds to thousands** of digraph samples before per-digraph timing stabilizes; a v1 session gives single digits per key.

**Why it happens:**
The feature reads as trivial ("sort keys by mean latency, take top 5"). The small-sample problem is invisible on the happy path — it always returns 5 keys.

**How to avoid:**
- Require a minimum sample count (e.g. n >= 5, ideally >= 10) before a key/digraph is eligible for the "slowest" list; show "not enough data" otherwise rather than a fabricated ranking.
- Use **median or trimmed mean**, not mean — one 2-second read-ahead pause otherwise defines the key.
- Filter outliers first: drop inter-key gaps above a ceiling (e.g. > 1000ms = the user paused/read, not a motor delay) and below a floor (< 25ms = repeat/rollover artifact).
- Show a confidence signal (sample count, IQR) next to each slow key.
- Aggregate **across sessions** for the real profile; a single session is a sample, not a verdict. This pushes the meaningful version of the feature to the "historical profile" phase and keeps v1 honest.
- Separate **dwell** (key hold) from **flight/latency** (gap between keys); conflating them mislabels the problem.

**Warning signs:**
Slowest-key list reshuffles completely between two runs of the same file; slowest keys are always rare characters; latencies over ~800ms in the dataset (those are cognitive pauses, not typing).

**Phase to address:** Metrics phase (v1) for the guardrails; adaptive-drill / profile phase for real aggregation.

---

### Pitfall 6: Mishandling newlines, indentation, and Tab in code corpus

**What goes wrong:**
Code is mostly whitespace structure. Get it wrong and the trainer is either unusable or trains the wrong skill:
- Expecting the user to type leading indentation manually when their muscle memory (and every editor) auto-indents → constant "errors" and rage-quit.
- Auto-inserting indentation for them → removes all Tab/space training, which the PROJECT explicitly calls a core value ("the shifted number row, underscores… Tab/space training").
- Tab vs spaces mismatch: corpus uses tabs, you render/expect 4 spaces (or vice versa) → invisible, maddening mismatch.
- Trailing whitespace on lines, final newline / no final newline, CRLF vs LF from pasted Windows content → phantom errors at line ends.
- Counting the newline keystroke inconsistently in WPM (is `Enter` a character? typing.io-style tools skip it).

**Why it happens:**
Prose typing tests never face this. Whitespace is invisible in the UI, so bugs are hard to see. Different OSes/editors paste different line endings.

**How to avoid:**
- Make an explicit, documented decision (PROJECT flags it as pending under Key Decisions): recommend **v1 = normalize and require explicit whitespace typing** — strip trailing whitespace per line, normalize CRLF→LF, normalize tabs→spaces (configurable width, default from PROJECT's stack), collapse/guarantee a single trailing newline. Then the user types every space and every newline.
- Render whitespace visibly during typing (dot for space, arrow for tab, ⏎ for newline) so mismatches are seen, not felt.
- Treat `Enter` at end-of-line as the expected next character; auto-skip *only* the next line's leading indentation IF you choose the editor-like model — but then say so and exclude it from accuracy.
- Decide once whether whitespace keystrokes count toward WPM (recommend: yes, they are real work in code) and document it.
- Unit-test the corpus normalizer with tabs, CRLF, trailing spaces, no-final-newline, mixed indentation, BOM.

**Warning signs:**
Users report "it says I made an error but the line looks identical"; accuracy tanks specifically at line starts/ends; pasted code from Windows behaves differently.

**Phase to address:** Corpus ingest / normalization phase (v1 — even paste needs a normalizer).

---

### Pitfall 7: Dead keys, IME, and `AltGr` breaking capture on non-US layouts (and even for US users who switch layouts)

**What goes wrong:**
Even though v1 is scoped to US ANSI, the author's context mentions es-LA / US-International layouts, and a US-International layout makes `'`, `"`, `` ` ``, `~`, `^` **dead keys**: pressing `'` emits nothing until the next key, then emits `'` or `á`. A trainer that `preventDefault()`s keydown to control input will *break composition entirely* and make the app unusable for those layouts. IME (CJK) fires `keydown` with `keyCode 229` and routes text through `compositionstart/update/end`, not through `key`. `AltGr` (right Alt) on Latin-American/EU layouts is where `{ } [ ] \ @ ~` live — the exact symbols this product trains — and it surfaces as `ctrlKey+altKey` which is easy to misclassify as a shortcut.

**Why it happens:**
US-ANSI development and testing. `preventDefault` on keydown is the standard way to build a controlled typing surface. Composition events are unfamiliar.

**How to avoid:**
- v1: detect and explicitly declare "US ANSI only." On load, sniff `navigator.keyboard.getLayoutMap()` (Chromium) and/or watch for dead-key/`compositionstart` events; show a clear "your layout isn't supported yet" banner instead of silently producing garbage data.
- Do NOT `preventDefault()` blindly on keydown. Prefer reading committed text from `input`/`beforeinput` on a real editable element for the *character* stream, and use keydown/keyup purely for *timing*, reconciling the two. This survives dead keys and IME.
- Handle `compositionstart` → pause per-keystroke scoring until `compositionend`, then attribute the composed string.
- Key the symbol map / heatmap on `event.code` (physical key) plus produced character, not on `event.key` alone.
- Log layout, `AltGr` usage, and composition events per session so the later multi-layout phase has real data.

**Warning signs:**
Apostrophes/quotes/backticks/carets "don't register" or double-register; CJK/accented users see 0 WPM or massive error counts; `{}[]` never appear in captured input for some users.

**Phase to address:** Capture-engine phase (v1 detection + non-preventDefault design); dedicated non-US-layout phase later (PROJECT: deferred).

---

### Pitfall 8: Corpus licensing — redistributing / shipping third-party code without rights

**What goes wrong:**
The long-term vision ingests Git repos, docs, RFCs, man pages, shell history. The moment ingested third-party code is stored on a server, bundled into the app, synced to a "web dashboard," included in telemetry/error reports, or committed to the project repo as a fixture, you are redistributing someone else's copyrighted work — GPL, proprietary, "all rights reserved" (the GitHub default for repos with no license), or NDA'd work code. The Copilot litigation shows this area is legally live even for permissively-licensed public code (attribution/license-notice stripping under MIT/BSD/Apache §4).

**Why it happens:**
"It's public on GitHub" is mistaken for "it's freely reusable." Most devs don't realize no-license = maximally restricted. Test fixtures and cached corpora quietly accumulate in the repo.

**How to avoid:**
- Architect for **local-only ingested content from day one** (PROJECT already states this as a constraint). Ingested repos/docs/shell-history never leave the machine: no server upload, no analytics payloads containing corpus text, no crash reports with snippet text, `.gitignore` the corpus cache directory.
- Store only **derived, non-reconstructive** data centrally if a dashboard is ever built: per-digraph latencies, counts, WPM — never the source text or reconstructable n-grams.
- For any bundled/shipped sample corpus, use only content you have explicit rights to (public-domain, CC0, or your own code) and **preserve license/attribution files**.
- Shell history is especially sensitive: it contains secrets (tokens, passwords in URLs, hostnames). Scrub or never persist.
- Document the licensing/privacy posture in the README (PROJECT: "must be stated explicitly in documentation").

**Warning signs:**
Corpus text appears in git history, in Sentry/analytics, in server logs, or in a database that syncs; test fixtures contain files copied from other repos; shell-history mode stores raw lines.

**Phase to address:** Repo-ingest phase and any phase that adds a server/dashboard/telemetry. Guardrail (no corpus in git, no corpus in telemetry) should be set in v1 even though ingest is later.

---

### Pitfall 9: Scope creep away from the one-week v1 loop

**What goes wrong:**
The vision is rich (tree-sitter chunking, adaptive drills, repo kata, heatmaps, per-language profiles, 10-minute daily sessions, TUI+web hybrid). Each is individually reasonable and individually fatal to shipping v1 in a useful timeframe. The classic failure: building the "capture engine" as a general telemetry platform, or the metrics module as a full stats pipeline, before a single real session has been typed. PROJECT's own success criterion is "one week of daily self-use."

**Why it happens:**
The interesting engineering is in the deferred features. The v1 loop (paste → type → 3 numbers) feels too small to be worth architecting for, so people architect for v3 instead.

**How to avoid:**
- Hard gate: v1 ships exactly the 5 Active requirements — paste/upload, capture, WPM, accuracy, 5 slowest keys. Nothing else merges until a week of real self-use is logged.
- Build the capture data model to be *append-only and complete* (every keydown/keyup + timestamp + code + key) so later features are pure post-processing — but do NOT build the post-processing.
- Explicitly defer in the roadmap (already in PROJECT Out of Scope): tree-sitter, adaptive drills, repo/docs/shell ingest, non-US layouts, accounts, dashboards, Docker.
- Resist the hybrid architecture for v1 — pick ONE platform. Two clients + shared DB is a v2+ decision.
- Timebox v1. If it is not self-usable in ~2 weeks of build, the loop is too big.

**Warning signs:**
PRs touching "future" modules; "while I'm here" refactors of the capture layer; a database schema with tables for features not in v1; debating tree-sitter grammars before typing a real session; the hybrid TUI+web question blocking Phase 1.

**Phase to address:** Roadmap structure itself — v1 milestone scope lock.

---

### Pitfall 10: Losing keystroke data on the boundary — start, end, blur, paste, and mid-session reload

**What goes wrong:**
Timing-critical app, but: the first keystroke is dropped because the listener attached after focus; the clock started on render not on first key; the user alt-tabs (window blur) mid-exercise and the 8-second gap counts as typing time, wrecking WPM; the browser tab is backgrounded and `setTimeout`/rAF throttle to 1/sec, mangling any time-based sampling; the user pastes the answer; a refresh loses the whole session because nothing was persisted until "done."

**Why it happens:**
Happy-path testing types straight through. Blur/visibility/paste are edge cases that only show up in real daily use — which is exactly the validation scenario.

**How to avoid:**
- Start the timer on first `keydown`, not on mount.
- Listen for `blur` / `visibilitychange`; either pause the exercise (freeze the clock, show "paused") or mark the session `interrupted` and exclude its WPM from the profile. Record pause durations.
- Detect and block/flag `paste` events into the typing surface.
- Persist the raw event log incrementally (IndexedDB / local file), not just on completion, so a crash mid-session is recoverable and analyzable.
- Compute elapsed time as sum of active intervals, not `end - start`.

**Warning signs:**
Occasional impossibly-high WPM sessions; WPM lower on days you got interrupted; first character of every exercise has no/short latency; sessions vanish on reload.

**Phase to address:** Capture-engine + session-lifecycle phase (v1).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store only aggregated metrics per session, not the raw keydown/keyup log | Simpler schema, less storage | Every future feature (heatmap, digraph profile, adaptive drills, re-computed metrics) is impossible without a data re-collection; can't fix a metric bug retroactively | **Never** — the raw event log is the product's core asset. Store it from session 1. |
| `preventDefault()` on keydown to build a controlled typing box | Easy caret/input control | Breaks dead keys, IME, AltGr; blocks the whole non-US-layout roadmap | Only if a US-ANSI-only banner is shown and composition events are still detected |
| Mean latency for slowest-key ranking | One line of code | Noise-dominated, misleads user, poisons future adaptive drills | Never — use median/trimmed mean + min sample count from the start |
| Invent a custom WPM formula tuned to "feel right" | Nice-looking numbers | Not comparable to anything, including past-self after tweaks | Never for the headline metric; fine as an explicitly-labeled secondary "adjusted" metric |
| Hybrid TUI + web for v1 | "Do it once" | Doubles the capture-engine surface, blocks Phase 1 on an unresolved architecture debate | Never for v1 — pick one platform |
| Skip cross-origin isolation on the web build | No header/deploy config | Firefox timing quantized to 1ms, Chrome to 100µs; cross-browser data incomparable | Acceptable only if TUI is the real capture path and web is display-only |
| Ship a bundled sample corpus copied from public repos | Instant content | License/attribution violation, corpus in git history | Only with CC0/public-domain/own code + preserved license files |
| Normalize tabs→spaces silently | Fewer whitespace bugs | Removes a stated core training target (Tab/space) if done without a config toggle | Acceptable for v1 with documented decision + width config |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Browser high-res clock | Assuming µs precision; reading `performance.now()` in handler as the keystroke time | Use `event.timeStamp`; enable COOP/COEP; record actual resolution per session |
| OS keyboard (terminal/TUI) | Reading cooked line-buffered input; taking OS auto-repeat as keystrokes | Raw/unbuffered mode; evdev keydown+keyup where possible; debounce/repeat-filter |
| Git repo ingestion (later) | Cloning and storing repo content server-side or in telemetry | Local-only processing; store derived metrics only; `.gitignore` corpus cache |
| Shell history ingestion (later) | Persisting raw history lines | Scrub secrets; treat as maximally sensitive; local-only; opt-in per file |
| Clipboard | Allowing paste into the typing surface | Block/flag `paste`; mark session invalid |
| Analytics / crash reporting (if added) | Payloads include corpus text or reconstructable n-grams | Strip all corpus text; send counts/latencies only |
| tree-sitter (later) | Adding it in v1 "to do chunking properly" | Defer entirely; v1 uses whole pasted content |
| React state | `setState` per keystroke re-rendering the corpus view | Keystrokes → plain array off the render path; render caret via rAF or uncontrolled DOM |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-keystroke React re-render of the full exercise text | Rising `handlerLag`; latency grows with corpus length | Virtualize / render only the active line; keep hot path allocation-free | Noticeable by ~300–500 line pastes; severe on low-end laptops |
| Recomputing all metrics on every keystroke for a live WPM display | Main-thread jank, inflated latencies | Compute live metrics in rAF at ~10Hz, or in a worker; full metrics at end | Medium-length exercises on any machine under other load |
| Keeping the entire raw event log in React state | GC pauses appear as fake slow digraphs | Store events in a ref / ring buffer; flush to IndexedDB in batches | Long daily sessions (10-min drill) — thousands of events |
| Backgrounded-tab timer throttling | Time-based sampling breaks when user tabs away | Use `event.timeStamp` deltas, not wall-clock sampling; pause on `visibilitychange` | Any real daily use with alt-tabbing |
| Storing raw logs forever with no rollup | DB/file growth; slow profile queries | Nightly rollup to per-digraph aggregates; keep raw for N days | After weeks of daily use (still small, but plan the rollup) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Persisting/transmitting ingested third-party code | Copyright/license violation; leaking proprietary/NDA work code | Local-only architecture; derived metrics only; corpus dir gitignored and excluded from backups/telemetry |
| Storing raw shell history | Exfiltrating secrets (API tokens, passwords in URLs, internal hostnames) | Secret-scrub on ingest; local-only; explicit opt-in per file; never in logs |
| Keystroke log = plaintext of everything the user typed | If synced/backed-up, it reconstructs source code and possibly typed secrets | Treat raw keystroke logs as sensitive; local storage only in v1; encrypt-at-rest if a sync feature is ever added |
| Cross-origin isolation headers enable `SharedArrayBuffer` | Larger attack surface if third-party scripts are loaded | Keep the web build dependency-light; audit embedded resources; self-host fonts/assets |
| Error reports / stack traces containing corpus or keystroke text | Passive leak of protected content | Scrub telemetry; disable verbose logging in production |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Invisible whitespace in the exercise | User can't tell why a line is "wrong"; rage-quit | Render space/tab/newline glyphs; show expected vs typed diff |
| Forcing correction of every error (mandatory backspace) vs free-run — chosen implicitly | Completely different training feel; PROJECT flags this as an unresolved Key Decision | Decide explicitly; v1 recommend free-run with accuracy absorbing the hit (Monkeytype default), simpler state machine |
| Auto-indent like an editor without telling the user | User double-types indentation → errors, or never learns Tab/space | Pick a model, show it, exclude auto-inserted chars from accuracy |
| "5 slowest keys" from n=1–2 samples presented as fact | User trains phantom weaknesses | Min sample count; "not enough data yet"; show sample size |
| Headline WPM not matching Monkeytype for the same text | User distrusts the whole tool | Use standard 5-char-word net WPM for the headline; label the code-adjusted metric separately |
| Counting read-ahead pauses as typing latency | Slowest-key list = "keys after which I paused to read", not motor difficulty | Cap inter-key gaps (>~1s = pause); trimmed statistics |
| No feedback on layout mismatch | Non-US user gets silent garbage data | Detect dead keys / layout map; show "US ANSI only" banner |
| Exercise too long for a "quick session" | Abandonment; incomplete sessions pollute stats | Support partial completion; mark and handle incomplete sessions |

## "Looks Done But Isn't" Checklist

- [ ] **Keystroke capture:** Often missing `event.repeat` filtering and a "key already down" guard — verify held-key produces one press, not a stream.
- [ ] **Keystroke capture:** Often missing first-keystroke timing (listener/clock race) — verify the first char has a real, plausible latency and the clock starts on key 1.
- [ ] **WPM/accuracy:** Often missing a written formula spec and a version field — verify the definition is documented and stored data records which formula version produced it.
- [ ] **WPM:** Often missing active-time computation — verify alt-tabbing mid-exercise doesn't inflate elapsed time.
- [ ] **Slowest keys:** Often missing min-sample gating and outlier filtering — verify it says "not enough data" on a tiny snippet and that a deliberate 3s pause doesn't create a "slow key."
- [ ] **Corpus normalizer:** Often missing CRLF, no-final-newline, trailing-whitespace, tab/space, BOM handling — verify with a Windows-pasted, tab-indented file.
- [ ] **Whitespace UX:** Often missing visible glyphs — verify the user can see spaces/tabs/newlines they must type.
- [ ] **Layout handling:** Often missing dead-key/IME detection — verify a US-International layout typing `'` + `e` is either handled or clearly rejected, not silently wrong.
- [ ] **Timing precision:** Often missing COOP/COEP (web) — verify `crossOriginIsolated === true` and check resolution on Firefox and Chrome.
- [ ] **Data model:** Often missing raw event persistence — verify a full keydown/keyup log with timestamps is saved per session, not just aggregates.
- [ ] **Session lifecycle:** Often missing incremental persistence — verify a mid-session refresh doesn't lose data.
- [ ] **Privacy:** Often missing gitignore/telemetry exclusion for corpus — verify pasted text never lands in git, logs, or any network request.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Only aggregates stored, raw log never captured | HIGH | Add raw logging now; all historical sessions are lost for new features; communicate the reset to yourself as the user |
| Custom/changed WPM formula, no versioning | MEDIUM | Add a formula-version column; recompute where raw data exists; annotate the discontinuity in any progress chart |
| `preventDefault` design blocks non-US layouts | MEDIUM | Refactor to input/beforeinput for character stream + keydown for timing; keydown-only rewrite is the expensive part |
| Timing captured at 1ms (Firefox, no COOP/COEP) | LOW-MEDIUM | Add headers, redeploy; past coarse sessions stay coarse but aggregate trends survive; tag old sessions |
| Slowest-key noise already drove adaptive drills | MEDIUM | Add sample-count gating + cross-session aggregation; regenerate drill weights from pooled data |
| Corpus text committed to git / sent to telemetry | HIGH | Rewrite git history (BFG/filter-repo), rotate anything leaked, purge telemetry store, add guardrails; reputational if public |
| OS key-repeat polluted historical latency data | LOW-MEDIUM | Re-filter raw logs (repeat flag / sub-25ms same-key gaps); recompute aggregates |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Timer precision clamping | Phase 0/1 — platform & capture-engine decision | `crossOriginIsolated===true` (web) or native clock in use; resolution logged per session; Firefox vs Chrome WPM within noise |
| 2. Wrong timestamp source | Phase 1/2 — capture engine | Code uses `event.timeStamp`; `handlerLag` p95 < 5ms; latency independent of corpus length |
| 3. OS key-repeat counted | Phase 1/2 — capture engine | Held-key test yields one press; no secondary latency mode at ~30–60ms |
| 4. WPM/accuracy definitions | Phase (v1) — metrics | Written formula spec in repo; matches Monkeytype on a prose sample within ~2%; metric-version field stored |
| 5. Small-sample slowest keys | Phase (v1) — metrics; later — profile/adaptive | "Not enough data" on short snippet; median-based; stable ranking across repeats of a large file |
| 6. Newline/indent/Tab handling | Phase (v1) — corpus normalization | Normalizer unit tests pass for CRLF/tabs/trailing-ws/no-final-newline/BOM; whitespace glyphs visible |
| 7. Dead keys / IME / AltGr | Phase 1/2 — capture engine (detection); later — non-US layout phase | US-International `'`+letter handled or cleanly rejected; no blind `preventDefault` on keydown |
| 8. Corpus licensing | Repo-ingest phase; any server/telemetry phase (guardrail in v1) | No corpus text in git, logs, or network; only derived metrics persisted centrally; README states posture |
| 9. Scope creep | Roadmap structure — v1 milestone scope lock | v1 PRs touch only the 5 Active requirements; no tables/modules for deferred features; one platform chosen |
| 10. Data loss on lifecycle boundaries | Phase (v1) — session lifecycle | Clock starts on first key; blur pauses/flags session; paste blocked; mid-session reload recoverable |

## Sources

- [MDN — High precision timing (Performance API): timer clamping 100µs non-isolated / 5µs isolated, Firefox 1ms](https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/High_precision_timing) — HIGH
- [Chrome for Developers — High resolution timestamps for events (`Event.timeStamp` as DOMHighResTimeStamp, comparable to `performance.now()`, monotonic)](https://developer.chrome.com/blog/high-res-timestamps) — HIGH
- [Chrome for Developers — Aligning input events (discrete events like keydown/keyup dispatched immediately, NOT coalesced to rAF; continuous events are)](https://developer.chrome.com/blog/aligning-input-events) — HIGH
- [Chrome for Developers — Aligning timers with cross-origin isolation restrictions (100µs default since Chrome 91, 5µs when COOP+COEP)](https://developer.chrome.com/blog/cross-origin-isolated-hr-timers) — HIGH
- [MDN — KeyboardEvent (`repeat` property; keydown auto-repeat sequence; keyCode 229 for IME)](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent) — HIGH
- [MDN — Element: keydown event (fired during IME composition since Firefox 65; composition event interaction)](https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event) — HIGH
- [W3C UI Events — Keyboard Events / key values ("Dead" key value; composition events for dead-key sequences)](https://w3c.github.io/uievents/split/keyboard-events.html) — HIGH
- [Bugzilla 1511752 — German dead-key layout sends odd key events](https://bugzilla.mozilla.org/show_bug.cgi?id=1511752) — MEDIUM
- [Handling IME events in JavaScript (stum.de) — compositionstart/update/end, keyCode 229](https://www.stum.de/2016/06/24/handling-ime-events-in-javascript/) — MEDIUM
- [Monkeytype — About (WPM = correct chars / 5 normalized to 60s; Raw WPM includes incorrect; accuracy = % correct keypresses)](https://monkeytype.com/about) — HIGH
- [Typetera — Raw WPM vs Net WPM](https://typetera.com/wpm/raw-wpm-vs-net-wpm) — MEDIUM
- [Nolan Lawson — High-performance input handling on the web](https://nolanlawson.com/2019/08/11/high-performance-input-handling-on-the-web/) — MEDIUM
- [Nolan Lawson — Browsers, input events, and frame throttling](https://nolanlawson.com/2019/08/14/browsers-input-events-and-frame-throttling/) — MEDIUM
- [arXiv 2303.04605 — Keystroke Dynamics: Concepts, Techniques, and Applications (DD/UD/UU/dwell primitives; profile-size vs performance, diminishing returns, ~1000+ digraphs for usable profile)](https://arxiv.org/html/2303.04605v2) — MEDIUM
- [Frontiers in Human Neuroscience — keystroke timing reliability / sample-size effects](https://www.frontiersin.org/journals/human-neuroscience/articles/10.3389/fnhum.2013.00835/full) — MEDIUM
- [InfoWorld — Judge dismisses most of the GitHub Copilot lawsuit](https://www.infoworld.com/article/2515112/judge-dismisses-lawsuit-over-github-copilot-ai-coding-assistant.html) — MEDIUM
- [Joseph Saveri Law Firm — GitHub Copilot IP litigation overview](https://www.saverilawfirm.com/our-cases/github-copilot-intellectual-property-litigation) — MEDIUM
- [zephyrtronium — GitHub Copilot and License Restrictions (no-license = all rights reserved; MIT/BSD attribution obligations)](https://zephyrtronium.github.io/articles/copilot.html) — MEDIUM
- [typing.io — Typing practice for programmers (auto-indent model, open-source-based lessons)](https://typing.io/) — MEDIUM
- Personal-domain reasoning: symbol-density WPM, session-lifecycle data loss, scope-lock against PROJECT.md Out-of-Scope list — MEDIUM

---
*Pitfalls research for: developer typing trainer with keystroke telemetry (keebdrill)*
*Researched: 2026-09-03*
