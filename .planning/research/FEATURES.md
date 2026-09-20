# Feature Research

**Domain:** GitHub-backed repo kata + scaffolded fill-in-function typing on a code trainer
**Researched:** 2026-09-20
**Confidence:** MEDIUM-HIGH (locked by user conversation; competitor patterns from Keybr adaptive lessons, Monkeytype custom text, and VS Code's GitHub-tree-in-browser FS; no shipping product does dependency-ordered code typing)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist once the app claims “type a file from a GitHub repo.” Missing these makes v2.0 feel like a broken file picker.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Paste a public GitHub URL or `owner/repo` | That's the import affordance the user named | LOW | Parser accepts `github.com/owner/repo`, optional `.git` / trailing path ignored for v2.0 (always default branch). Other hosts → inline error, no fetch. |
| Filesystem tree of the whole repo | “Visualizar la estructura como un sistema de archivos” | MEDIUM | Nested folders, expand/collapse, file click. Recursive Trees API returns a flat `path` list — fold into a trie in memory. |
| Click a `.ts`/`.tsx`/`.js`/`.jsx` file → it becomes the exercise | User: select file, start typing | MEDIUM | Fetch blob on click only. Run `normalize()` then parse. |
| Non-TS/JS files visible but blocked | User: tree shows everything; click other language → notice, no load | LOW | Reuse `extToLang`. Message is a status, not a dead click with no feedback. |
| Full file visible while typing | Scaffold, not a mystery box | HIGH | Future units stay readable (user chose full_visible). Current unit is the only typeable range. |
| Units ordered by dependencies, leaves first | User: complete the file starting from the indispensable | HIGH | If `f1` calls `f2` and `f2` has no callees in-file, type `f2` then `f1`. Imports/types that functions reference come before those functions. |
| Advance through units until the file is done | “Completar todo el fichero” | MEDIUM | Completing the current unit (existing `completedAt` on that slice) reveals the next. Last unit completing is file-complete → existing ResultsView + persist. |
| Paste and upload still work | Fallback for other languages and ad-hoc snippets | LOW | CorpusInput stays. GitHub is an additional source, not a replacement. |
| Default branch only | User did not ask for ref picker | LOW | `GET /repos/{owner}/{repo}` → `default_branch`, then tree at that ref. |
| Size cap + UTF-8 | Parity with upload | LOW | Same 100 KB and non-UTF-8 rejection on decoded blob. |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Dependency-ordered syntactic units | Keybr adapts on *letters*. Nobody orders a real file's functions by in-file deps for typing. Matches keebdrill.md “trocea respetando límites sintácticos” | HIGH | This is the milestone, not a garnish. |
| In-place caret in the file | Feels like typing in the source, not in a disconnected drill pane | HIGH | CaptureSurface stays the input host; chrome around it is new. |
| Repo-attributed sessions | History/analytics already group by language; `sourceType: 'github'` + `sourceRef` let later filters work without a new milestone | LOW | Persist path/repo on `Exercise`. |
| Blocked-not-hidden tree | User still sees YAML, README, Python — the product tells the truth about parser coverage | LOW | Honest scope. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Type the whole file as one exercise | Fastest to ship | User explicitly rejected this after the first sketch; 400-line files are the original pain | Scaffolded units |
| Hide future functions (cloze / holes) | “Don't show the answer” | User chose full file visible. Holes also wreck overlay alignment | Dim/lock future text, still readable |
| Clone / download the whole repo | Feels like “real git” | 60 req/h; COEP; not needed to type one file | Recursive tree JSON + blob-on-click |
| Private repos / PAT | “My real work repos” | Auth, token storage, GitHub OAuth — out of scope | Public only; paste/upload for private snippets |
| Branch/tag/SHA picker | Power-user | Extra UI and extra API calls against the 60/h budget | Default branch |
| Tree-sitter for Python/Go/YAML in v2.0 | Repo is mixed | Each grammar is a wasm + planner ruleset | Blocked notice |
| Monaco/CM6 “editor mode” | Looks professional | Destroys capture invariants (IME, `timeStamp`, no blanket preventDefault) | CaptureSurface overlay |
| Prefetch every blob | Instant file open | Rate limit death | Click-to-fetch + in-memory cache |
| Timed 15–60s auto-chunk without AST | Original vision's kata length | User asked for function/dependency order, not wall-clock slices | AST units; a long function is one unit |
| Live parse-as-you-type | Feels smart | WASM on the hot path; capture handler must stay trivial | Parse once on load |

## Feature Dependencies

```
GitHub URL parse
    └──requires──> GitHub client (repo metadata + tree)
                       └──enables──> Repo tree UI
                                       └──requires──> blob fetch on TS/JS click
                                                          └──requires──> normalize() (existing)
                                                          └──requires──> parser seam (tree-sitter WASM)
                                                                             └──requires──> unit planner (ranges + topo order)
                                                                                                └──requires──> scaffolded trainer
                                                                                                                   └──enables──> unit advance until file complete

Paste/upload ──independent──> trainer (existing path; scaffold is GitHub-only)

Non-TS/JS blocked notice ──requires──> tree UI (not parser)
```

### Dependency Notes

- **Tree UI does not need tree-sitter.** Phase-order: fetch+tree can ship before parse. Clicking TS/JS can temporarily no-op or show “parser coming” only if we split phases that way — better to not enable click-to-load until the planner exists, or load-as-whole-file would violate the user's locked UX.
- **Scaffolded trainer requires a unit list.** Do not teach CaptureSurface about GitHub.
- **Paste/upload must not go through the planner.** User still wants ad-hoc full-text drills.

## MVP Definition

### Launch With (v2.0)

- [ ] Public GitHub URL → default-branch recursive tree
- [ ] Filesystem tree, all files visible
- [ ] TS/JS click → blob → normalize → parse → dependency-ordered units
- [ ] Non-TS/JS click → blocked notice
- [ ] Full file visible; only current unit typeable
- [ ] Advance units until file complete; persist session like today
- [ ] Paste/upload unchanged
- [ ] Rate-limit / 404 / truncated-tree / too-large / parse-fail surfaced as inline copy (not a thrown overlay)

### Add After Validation (v2.x)

- [ ] Branch/SHA picker — after default-branch loop is daily-useful
- [ ] Per-unit results in history (if v2.0 stores one session per file, split later)
- [ ] Remember last repo URL in localStorage (not IndexedDB schema)
- [ ] Python/Go grammars — after TS/JS planner is trusted

### Future Consideration (later milestones)

- [ ] Local folder / Tauri / GitLab
- [ ] Adaptive drills from heatmap
- [ ] Syntactic chunking of YAML/docs
- [ ] ANLY-06..09 leftover analytics

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| GitHub URL + tree | HIGH | MEDIUM | P1 |
| Blob load + size/UTF-8 guards | HIGH | LOW | P1 |
| TS/JS parse + unit ranges | HIGH | HIGH | P1 |
| Dependency order | HIGH | HIGH | P1 |
| Scaffolded in-place typing | HIGH | HIGH | P1 |
| Non-TS/JS blocked notice | MEDIUM | LOW | P1 |
| Keep paste/upload | HIGH | LOW | P1 |
| Branch picker | LOW | LOW | P3 |
| Private repos | MEDIUM | HIGH | P3 |
| Extra languages | MEDIUM | MEDIUM | P2 |

**Priority key:**
- P1: Must have for v2.0
- P2: Should have once TS/JS katas are in daily use
- P3: Explicitly out of this milestone

## Competitor Feature Analysis

| Feature | Monkeytype | Keybr | VS Code / github.dev | Our Approach |
|---------|------------|-------|----------------------|--------------|
| Corpus source | Prose quotes, custom paste | Generated letter lessons | Open files from GitHub tree | Public GitHub tree → real file |
| Split strategy | Timed / word count | Adaptive per-key | None (you edit) | AST function units, dep order |
| Seeing the rest of the file | N/A | N/A | Full editor | Full file visible, future locked |
| Capture precision | Word-level | Per-key | Not a trainer | Existing keystroke log + metrics |

## Sources

- User lock-in, `/gsd-new-milestone` conversation 2026-09-20
- [keebdrill.md](../../keebdrill.md) original repo-kata + syntactic chunking vision
- Keybr adaptive lessons (per-key, not per-function) — MEDIUM, contrast only
- VS Code `GitHubFileSystemProvider` (recursive tree + blob-on-read) — MEDIUM, architecture analogue not UX analogue

---
*Feature research for: GitHub public repo katas + TS/JS scaffolding*
*Researched: 2026-09-20*
