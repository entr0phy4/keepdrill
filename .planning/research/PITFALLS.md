# Pitfalls Research

**Domain:** Adding GitHub fetch + AST-scaffolded range typing to a capture-precise, COEP-isolated SPA
**Researched:** 2026-09-20
**Confidence:** HIGH for COEP/CORS, Unicode, capture, rate limits; MEDIUM for tree-sitter unit-boundary edge cases

## Critical Pitfalls

### Pitfall 1: COEP `require-corp` vs GitHub / WASM

**What goes wrong:**
First `fetch('https://api.github.com/...')` or `Language.load` from a CDN fails, `crossOriginIsolated` flips false if someone “fixes” it by removing COEP, and timer resolution collapses — the project's differentiator.

**Why it happens:**
Phase 1 locked COEP `require-corp` with **zero** third-party runtime. v2.0 is the first cross-origin read. People either strip COEP or load wasm from unpkg.

**How to avoid:**
- Keep COEP. GitHub `fetch` is cors-mode to a CORS-enabled API (allowed).
- Serve `tree-sitter.wasm` and grammar wasm from `public/` (same origin).
- If a browser still blocks GitHub, switch to COEP `credentialless` — **not** to no COEP.
- README: GitHub.com is now an allowed egress for corpus only.

**Warning signs:**
Degraded-timing banner appears after the GitHub feature lands; Network tab shows `(blocked:NotSameOriginAfterDefaultedToSameOriginByCoep)` or CORS preflight fail on `X-GitHub-Api-Version`.

**Phase to address:**
GitHub client phase (first v2.0 phase). Verify with `curl -sI` still showing COOP+COEP **and** a live `fetch` to a public repo in the running app.

---

### Pitfall 2: Unauthenticated 60 req/h

**What goes wrong:**
Importing a repo “hangs” or returns 403 after a few file clicks. Developer prefetches every blob. Tests hit the live API and flake CI.

**Why it happens:**
Recursive tree is 1 call; each file is another. A demo that opens 10 files plus React StrictMode double-mount burns the budget. Octokit retries make it worse.

**How to avoid:**
- Cache tree by `{owner,repo,sha}`.
- Blob on click only; cache blob by sha.
- Fixture GitHub JSON in tests. Zero live calls in Vitest.
- Surface `x-ratelimit-remaining` when 403/429.

**Warning signs:**
`403 rate limit exceeded` on a second import the same hour; StrictMode double fetch without a cache key.

**Phase to address:**
GitHub client phase.

---

### Pitfall 3: UTF-16 tree-sitter indices vs code-point trainer cursor

**What goes wrong:**
Unit ranges slice the wrong characters. Supplementary-plane chars in comments/strings (or even a single emoji in a test fixture) desync CaptureSurface coloring. The Phase 3 uncompletable-exercise bug returns in a new costume.

**Why it happens:**
`SyntaxNode.startIndex` / `endIndex` are JS string indices (UTF-16 code units). `computeTrainerState` and glyphs use `Array.from` (code points).

**How to avoid:**
Convert every tree-sitter index to a code-point offset through a single helper before `plan.ts` emits units. Golden tests must include a supplementary-plane character **outside** and **inside** a function.

**Warning signs:**
Unit slice starts one character early after an emoji; last unit's `end` > `Array.from(text).length`.

**Phase to address:**
Parser/planner phase.

---

### Pitfall 4: Overlapping or nested units

**What goes wrong:**
A method inside a class, a nested function, or an arrow assigned to `const` gets two units that share ranges. Overlay and slice logic double-count or skip text. “Complete the file” never reaches leftover class-wrapper text.

**Why it happens:**
Naive “every `function_declaration` + every `method_definition` + every `arrow_function`” walks the tree without a containment policy.

**How to avoid:**
Pick a **non-overlapping cover** of the file:
- Top-level statements are candidates (imports, types, functions, classes).
- Nested functions live **inside** their parent unit (not separate).
- Class: either one unit (whole class) or methods as units **without** also emitting the class body as a unit that contains them — pick **methods as units + leftover class chrome as its own unit** (header/braces) typed around the methods in dep order, or **whole class as one unit** if method-splitting is too messy for v2.0.
- **Recommendation:** v2.0 = top-level functions/const-arrows + import/type blocks; **classes as a single unit**. Nested functions do not split. Document it.

**Warning signs:**
`assertNonOverlapping(units)` fails; file-complete leaves untyped braces.

**Phase to address:**
Planner phase (lock the containment policy in CONTEXT.md).

---

### Pitfall 5: Capture log vs unit remount

**What goes wrong:**
`resetCapture()` forgotten → previous unit's charLog paints garbage on the new slice. `resetCapture()` done but Session only contains the last unit. Restart (Escape) wipes the whole file accidentally.

**Why it happens:**
Today load/restart = one Exercise = one buffer. Curriculum is a new lifetime.

**How to avoid:**
- On unit advance: snapshot `getEvents`/`getCharLog`/`getMarkers`, then `resetCapture()`, remount via `loadToken`.
- On file complete: concatenate snapshots (unit separators in markers are nice-to-have).
- Escape: restart **current unit** (reset capture for that slice only), not `curriculum[0]`.
- Corpus load of a new file: discard snapshots (same as today's handleLoad).

**Warning signs:**
Results WPM is only the last function; or first keystroke of unit 2 is scored against unit 1's leftover log.

**Phase to address:**
Scaffolded trainer phase.

---

### Pitfall 6: Showing future units is not the same as putting them in the textarea

**What goes wrong:**
Engineer puts the full file in the textarea so the overlay “just lines up,” then tries to lock selection. IME, backspace-across-unit, and paste-block all break. Tab no-op interacts with indent in the file chrome.

**Why it happens:**
CaptureSurface was designed 1:1 with `text`.

**How to avoid:**
Textarea value = current unit only. File chrome is a `<pre>` (or existing glyph renderer) with three CSS states. Alignment can be “unit block stacked in the file flow,” not a pixel-perfect transparent overlay of a slice inside a full-file textarea.

**Warning signs:**
New `preventDefault` in capture.ts; `selectionStart` clamps; IME composition spans a unit boundary.

**Phase to address:**
Scaffolded trainer phase. **Do not modify capture.ts** unless a bug is proven.

---

### Pitfall 7: Malformed TS / parse returns empty units

**What goes wrong:**
Click a `.ts` file of broken WIP code, planner returns `[]`, UI hangs or loads nothing with no copy.

**Why it happens:**
tree-sitter produces an error node, not a throw. A planner that only looks for `function_declaration` misses `export default function` / `const f = () =>` / `async function`.

**How to avoid:**
- Cover: `function_declaration`, `function_expression`/`arrow_function` bound at top level, `export_statement` wrappers, `generator_function_declaration`.
- If `units.length === 0` or coverage < 100% of non-trivia: **one fallback unit = whole file**, plus a non-blocking notice “couldn't split this file; typing it whole.” This is the escape hatch that keeps the tree usable. (User locked scaffold as the happy path, not as a hard fail.)
- Never throw out of the click handler.

**Warning signs:**
Silent no-op on click; only some functions in a file are in the curriculum.

**Phase to address:**
Planner + trainer integration.

---

### Pitfall 8: Untrusted GitHub HTML/JS in the renderer

**What goes wrong:**
File contents include `</pre><script>` or markdown; someone uses `innerHTML` or `dangerouslySetInnerHTML` for highlighting.

**Why it happens:**
“Syntax highlight the future units” is a tempting add-on.

**How to avoid:**
Text nodes / `textContent` / existing `glyphFor` renderer only. No highlight.js. No `innerHTML`. License: README already says third-party corpus stays local — update it to mention GitHub fetch.

**Warning signs:**
New DOM sink in FileScaffold.

**Phase to address:**
Repo UI + scaffold UI (threat model).

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Whole-file fallback when parse fails | Tree never dead-ends | Users think scaffold is flaky | Always as a labeled fallback |
| Classes as one unit | Avoids nested-range hell | Methods not leaf-ordered | v2.0 yes; split later |
| One Session per file (concat logs) | History stays readable | Can't chart per-function WPM | v2.0 yes |
| No branch picker | Saves API calls | Can't type a PR ref | v2.0 yes |
| Pin grammar 0.23.x while runtime is 0.25 | Known ABI | Miss newer syntax | Until wasm load is proven |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub REST | Send `X-GitHub-Api-Version` / `Authorization` | `Accept` only; public |
| GitHub tarball | Follow redirect to `codeload.github.com` | Trees + blobs only |
| web-tree-sitter | Default locateFile points at JS chunk dir | `locateFile: () => '/tree-sitter.wasm'` |
| Vite | Forget to copy wasm to `public/` | postinstall + check in README |
| StrictMode | Double fetch on mount | Cache by sha in the client module |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Prefetch all blobs | 429, jank on import | Blob on click | >60 files opened/hour |
| Recursive tree 7 MB JSON | Main-thread freeze | `truncated` notice; lazy subtrees | 100k-entry repos |
| WASM init on every file | 200ms pause per click | Init once, cache Parser | Every file |
| Full-file React reconciliation per keystroke | Typing jank | File chrome is static; only current unit uses rAF CaptureSurface | 100 KB files |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `innerHTML` of blob text | XSS | textContent / glyph renderer |
| GitHub PAT in localStorage | Token theft | No auth this milestone |
| Rendering README markdown with a full MD engine | XSS via GH-flavored HTML | Don't; tree is names only until click |
| Logging blob contents in production | Privacy/license | Existing: corpus stays local; no beacon |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Tree with no blocked feedback | “Click does nothing” | Explicit notice |
| Rate limit as generic “Failed to fetch” | User retries, makes it worse | Named copy + remaining/reset |
| Unit advance with no landmark | Lost in a 400-line file | Highlight current unit; keep it in view (`scrollIntoView`) |
| Escape restarts whole file | Rage after one bad function | Restart current unit |
| Future units look typeable | Clicks do nothing | Dim + `user-select` ok, not a textarea |

## "Looks Done But Isn't" Checklist

- [ ] **COEP:** `curl -sI` still has COOP+COEP after GitHub ships
- [ ] **Live fetch:** real public repo tree in Chromium, not just fixtures
- [ ] **Wasm:** `Parser.init` works under `pnpm preview` (not only `dev`)
- [ ] **Unicode:** emoji in a comment does not shift unit slices
- [ ] **Coverage:** leftover module code is either a unit or in fallback
- [ ] **Session:** History row after a 3-unit file is one session with full `Exercise.text`
- [ ] **Paste/upload:** still load without planner
- [ ] **Rate limit:** 403 copy exists; tests never call GitHub
- [ ] **Truncated tree:** `truncated: true` is visible
- [ ] **Empty parse:** fallback unit + notice

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| COEP stripped by mistake | HIGH | Restore headers; use `credentialless` if needed |
| Rate limit | LOW | Wait until `x-ratelimit-reset`; cache harder |
| Bad wasm ABI | MEDIUM | Rebuild wasm with current CLI or pin `web-tree-sitter` |
| Overlapping units in the wild | MEDIUM | Fallback whole-file; tighten planner fixtures |
| Session only last unit | LOW | Concat snapshots in App before saveSession |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| COEP / CORS / wasm origin | Phase 7 GitHub tree | curl headers + live fetch + isolated true |
| 60 req/h + cache | Phase 7 | Fixture tests; cache hit on expand |
| XSS / untrusted blob | Phase 7–9 | no innerHTML grep |
| UTF-16 vs code points | Phase 8 planner | emoji golden case |
| Nested/overlapping units | Phase 8 | assertNonOverlapping + class policy |
| Empty parse fallback | Phase 8 | malformed fixture |
| Capture reset / session concat | Phase 9 scaffold | 2-unit file → one History row, both functions in log |
| Textarea = full file | Phase 9 | capture.ts unchanged; unit-sized `text` prop |

## Sources

- keebdrill Phase 1 COEP decision and README privacy grep
- Phase 3 Unicode indexing bug (PROJECT.md Key Decisions)
- MDN COEP; GitHub CORS + rate limit docs
- web-tree-sitter locateFile / ABI notes
- CaptureSurface 1:1 textarea contract (`src/ui/CaptureSurface.tsx`)

---
*Pitfalls research for: GitHub katas + AST-scaffolded typing*
*Researched: 2026-09-20*
