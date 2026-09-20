---
phase: 08-parse-dependency-units
plan: 01
subsystem: parse
tags: [tree-sitter, wasm, csp, abi-pin, web-tree-sitter]

requires:
  - phase: 07-github-url-repo-tree
    provides: CSP connect-src api.github.com, COEP require-corp, src/github/client.ts fetch seam
provides:
  - web-tree-sitter@0.27.0 ABI pin that Language.load-s typescript and tsx wasm in Node
  - Same-origin runtime wasm at public/web-tree-sitter.wasm
  - Grammar wasm at public/wasm/tree-sitter-typescript.wasm and public/wasm/tree-sitter-tsx.wasm
  - CSP script-src 'self' 'wasm-unsafe-eval' without general eval
  - README Privacy listing + blob contents; wasm is not egress
affects: [08-04 wasm.ts Parser.init locateFile]

tech-stack:
  added:
    - web-tree-sitter@0.27.0
    - tree-sitter-typescript@0.23.2
  patterns:
    - Committed same-origin wasm under public/ so COEP require-corp holds
    - script-src wasm-compile token only (no 'unsafe-eval')
    - Grammar install with --ignore-scripts (native node-gyp unused)

key-files:
  created:
    - .planning/phases/08-parse-dependency-units/08-ABI-PIN.md
    - public/web-tree-sitter.wasm
    - public/wasm/tree-sitter-typescript.wasm
    - public/wasm/tree-sitter-tsx.wasm
  modified:
    - package.json
    - pnpm-lock.yaml
    - index.html
    - README.md

key-decisions:
  - "Pin web-tree-sitter@0.27.0 — Language.load of tree-sitter-typescript@0.23.2 typescript and tsx wasm succeeded in Node (abiVersion 14); 0.25.10 and tree-sitter-cli were not needed"
  - "locateFile scriptName is web-tree-sitter.wasm; copy that basename to public/"
  - "cli_rebuild false; do not install tree-sitter-javascript or tree-sitter-cli"

patterns-established:
  - "Wave 0 ABI spike outside the repo before pnpm add"
  - "Commit copied .wasm so preview/CI do not depend on postinstall"

requirements-completed: []

coverage:
  - id: D1
    description: "08-ABI-PIN.md names web-tree-sitter@0.27.0, runtime_wasm web-tree-sitter.wasm, grammars tree-sitter-typescript@0.23.2, public grammar paths, cli_rebuild false"
    requirement: FILE-01
    verification:
      - kind: other
        ref: "test -f .planning/phases/08-parse-dependency-units/08-ABI-PIN.md && grep web-tree-sitter,tree-sitter-typescript,cli_rebuild 08-ABI-PIN.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "package.json pins web-tree-sitter 0.27.0 and tree-sitter-typescript 0.23.2; does not name tree-sitter-javascript or tree-sitter-cli"
    requirement: FILE-01
    verification:
      - kind: other
        ref: "grep web-tree-sitter and tree-sitter-typescript in package.json; absent tree-sitter-javascript and tree-sitter-cli"
        status: pass
    human_judgment: false
  - id: D3
    description: "Committed same-origin wasm at public/web-tree-sitter.wasm, public/wasm/tree-sitter-typescript.wasm, public/wasm/tree-sitter-tsx.wasm"
    requirement: FILE-01
    verification:
      - kind: other
        ref: "ls public/web-tree-sitter.wasm public/wasm/tree-sitter-typescript.wasm public/wasm/tree-sitter-tsx.wasm"
        status: pass
    human_judgment: false
  - id: D4
    description: "index.html script-src is 'self' plus wasm-unsafe-eval; connect-src still 'self' and https://api.github.com; vite.config.ts COEP require-corp unchanged"
    requirement: FILE-01
    verification:
      - kind: other
        ref: "grep script-src 'self' 'wasm-unsafe-eval' index.html; grep require-corp vite.config.ts; no quoted 'unsafe-eval'"
        status: pass
    human_judgment: false
  - id: D5
    description: "README Privacy names api.github.com listing and blob contents, existing client.ts fetch, and same-origin wasm as not egress"
    requirement: FILE-01
    verification:
      - kind: other
        ref: "grep blob README.md Privacy; no 'later plan' fetch sentence"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-09-20
status: complete
---

# Phase 8 Plan 01: Pin tree-sitter WASM ABI Summary

**web-tree-sitter 0.27.0 loads tree-sitter-typescript 0.23.2 wasm in Node; same-origin copies plus CSP wasm-unsafe-eval under unchanged COEP require-corp**

## Performance

- **Duration:** 4 min
- **Started:** 2026-09-20T23:21:05Z
- **Completed:** 2026-09-20T23:25:00Z
- **Tasks:** 3 (1 blocking-human checkpoint + 2 auto)
- **Files modified:** 8

## Accomplishments

- Node spike in `/tmp/keebdrill-wasm-abi`: `Parser.init` + `Language.load` of both typescript and tsx wasm succeeded on `web-tree-sitter@0.27.0` (`abiVersion=14`); locateFile requested `web-tree-sitter.wasm`
- `08-ABI-PIN.md` records the winner; `cli_rebuild: false`; 0.25.10 and `tree-sitter-cli` were not used
- Installed `web-tree-sitter@0.27.0` (dependency) and `tree-sitter-typescript@0.23.2` (devDependency, `--ignore-scripts`); copied wasm into `public/`
- CSP `script-src 'self' 'wasm-unsafe-eval'` in `index.html`; README Privacy covers listing **and** blob contents; `vite.config.ts` COEP `require-corp` untouched
- `src/parse/wasm.ts` still does not exist (08-04)

## Task Commits

Each task was committed atomically:

1. **Task 1: Human-verify tree-sitter npm packages** - none (checkpoint; user typed `approved`)
2. **Task 2: Node ABI spike — 0.27.0 then 0.25.10** - `6310ab2` (docs)
3. **Task 3: Install pin, commit wasm, CSP, README** - `51dfd9d` (feat)

**Plan metadata:** `docs(08-01): complete WASM ABI pin plan`

## Files Created/Modified

- `.planning/phases/08-parse-dependency-units/08-ABI-PIN.md` - Winning runtime 0.27.0, `web-tree-sitter.wasm`, grammar 0.23.2, `cli_rebuild: false`
- `package.json` / `pnpm-lock.yaml` - Pins; no javascript grammar or CLI as direct deps
- `public/web-tree-sitter.wasm` - Runtime wasm (`locateFile` basename)
- `public/wasm/tree-sitter-typescript.wasm` - TypeScript dialect grammar
- `public/wasm/tree-sitter-tsx.wasm` - TSX dialect grammar
- `index.html` - `script-src 'self' 'wasm-unsafe-eval'`; connect-src unchanged
- `README.md` - Privacy: listing + blob; `client.ts` already exists; same-origin wasm is not egress

## Decisions Made

- Pin `web-tree-sitter@0.27.0` because both grammar wasm files loaded and smoke-parsed in Node. Do not fall back to 0.25.10.
- `cli_rebuild: false`. Do not add `tree-sitter-cli` (unverified `install.js` binary download).
- Do not add `tree-sitter-javascript` as a project package. `.js` uses the typescript grammar (RESEARCH A1). The grammar package still pulls `tree-sitter-javascript@0.23.1` transitively in the lockfile for unused native bindings; `--ignore-scripts` skipped `node-gyp-build`.
- `src/parse/wasm.ts` is deferred to 08-04 against this verified pin.

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** None.

## Issues Encountered

None. Task 1 human-verify was approved before this continuation. 0.27.0 did not throw the empty dylink `Error`.

## Auth Gates

Task 1 blocking-human package verify (web-tree-sitter, tree-sitter-typescript on npmjs.com) — approved. Not an auth gate.

## Known Stubs

None. Intentional absence: `src/parse/wasm.ts` is owned by 08-04.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 08-02 (blob fetch / github ingest) and 08-03 (pure planner) in Wave 1. 08-04 must `Parser.init({ locateFile: (scriptName) => \`/\${scriptName}\` })` and load `/wasm/tree-sitter-typescript.wasm` plus `/wasm/tree-sitter-tsx.wasm`. FILE-01 remains pending until blob + click-to-plan land.

## Self-Check: PASSED

- FOUND: .planning/phases/08-parse-dependency-units/08-ABI-PIN.md
- FOUND: public/web-tree-sitter.wasm
- FOUND: public/wasm/tree-sitter-typescript.wasm
- FOUND: public/wasm/tree-sitter-tsx.wasm
- FOUND: 6310ab2, 51dfd9d
- ABSENT: src/parse/wasm.ts
- VERIFY: package.json pins 0.27.0 / 0.23.2; no javascript/cli; CSP wasm-unsafe-eval; no general eval; COEP require-corp; README blob

---
*Phase: 08-parse-dependency-units*
*Completed: 2026-09-20*
