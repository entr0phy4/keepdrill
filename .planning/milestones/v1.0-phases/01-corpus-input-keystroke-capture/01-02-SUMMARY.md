---
phase: 01-corpus-input-keystroke-capture
plan: 02
subsystem: ui
tags: [file-api, react, typescript, vitest, ingestion, normalizer, utf-8, upload]

requires:
  - phase: 01-01
    provides: "pure normalize(), Exercise/SourceType types, fromPaste(), CorpusInput paste path + onLoad seam, index.css token foundation"
provides:
  - "src/ingestion/errors.ts: CorpusTooLargeError (sizeBytes) / NonUtf8Error (fileName) typed error classes"
  - "src/ingestion/language-map.ts: extToLang(fileName) -> language label, case-insensitive, 'plaintext' fallback for unknown / extension-less / dotfile names"
  - "src/ingestion/upload.ts: fromFile(file, tabWidth?) -> Promise<Exercise> — 100 KB cap before read, UTF-16 BOM sniff, File.text() UTF-8 read, U+FFFD scan, normalize() only (D-08)"
  - "src/ui/CorpusInput.tsx: paste + upload; inline typed-error copy beneath the file control; 'Nothing to load yet' beneath an always-enabled Load button; 'Loaded from {filename}' caption; loadTokenRef last-wins guard; measured Loading… button state; layout-reserved error/caption rows"
affects: [01-03-full-capture-semantics, phase-02-trainer, phase-03-metrics]

actuals:
  tokens: 3400
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Error-as-typed-class + inline render: ingestion throws named errors, UI catches and maps each to a fixed copy string beneath the offending control (no toast, no stack trace)"
    - "Monotonic loadTokenRef: every async load attempt claims the next token; a result lands only if its token is still current (last-wins concurrency without a state machine)"
    - "Layout-reserved status rows: error/caption <p> elements always render with minHeight so surfacing a message causes no reflow of the preview below"

key-files:
  created:
    - "src/ingestion/errors.ts"
    - "src/ingestion/language-map.ts"
    - "src/ingestion/upload.ts"
    - "src/ingestion/upload.test.ts"
  modified:
    - "src/ui/CorpusInput.tsx"

key-decisions:
  - "extToLang uses lastIndexOf('.') <= 0 to treat both extension-less names (Makefile) and no-suffix dotfiles (.gitignore) as 'plaintext'"
  - "UTF-16 BOM sniff reads only file.slice(0, 2).arrayBuffer() before File.text(), keeping the oversize/binary guard cheap and off the full-read path"
  - "Kept the native <input type=file> control rather than a custom 'Choose file' button — index.css is outside this plan's file scope and an unstyled/hidden-input fake button would regress keyboard focus + a11y; Chrome's native label already reads 'Choose File'"
  - "Used the UI-SPEC Copywriting Contract ellipsis 'Loading…' rather than the plan action's ASCII 'Loading...' (plan action says copy is verbatim from the contract)"

patterns-established:
  - "Typed-error ingestion + inline UI copy mapping (reused by any future ingestion source)"
  - "loadTokenRef last-wins guard for async load handlers"

requirements-completed: [INPUT-02, INPUT-01, INPUT-03]

coverage:
  - id: D1
    description: "fromFile() turns a local file into a normalized upload Exercise (sourceType 'upload', sourceRef = file.name, language from extension) or rejects: >100 KB -> CorpusTooLargeError before any read; UTF-16 BOM or U+FFFD -> NonUtf8Error; content normalized identically to fromPaste; empty file -> empty text"
    requirement: "INPUT-02"
    verification:
      - kind: unit
        ref: "src/ingestion/upload.test.ts (12 fromFile cases: clean file, oversize+no-read, 100 KB boundary, UTF-16 LE/BE BOM, U+FFFD, CRLF+tab normalize equivalence, custom tab width, 0-byte, as-is preservation, name-only sourceRef)"
        status: pass
    human_judgment: false
  - id: D2
    description: "extToLang maps common dev extensions (.ts/.tsx, .js/.jsx, .py, .rs, .go, .sh/.bash, .sql, .json, .yaml/.yml, .md/.markdown, .html, .css, .toml) case-insensitively and returns 'plaintext' for unknown / extension-less / dotfile names"
    requirement: "INPUT-02"
    verification:
      - kind: unit
        ref: "src/ingestion/upload.test.ts (extToLang: 18 it.each mappings + case-insensitivity + 3 plaintext-fallback cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "CorpusInput handles upload + all deferred states: oversize/non-UTF-8 uploads show the exact inline copy beneath the file control; empty Load shows 'Nothing to load yet' with the button still enabled; 'Loaded from {filename}' caption after success; a superseded file selection never lands (last-wins); measured Loading… state; no layout shift"
    requirement: "INPUT-01"
    verification:
      - kind: automated
        ref: "pnpm exec tsc --noEmit -p tsconfig.json (clean) && pnpm build (exit 0) && oxlint (clean)"
        status: pass
      - kind: manual_procedural
        ref: "pnpm dev -> upload .ts file loads as 'typescript'; 200 KB file -> inline 'over 100 KB'; UTF-16 file -> inline 'isn't UTF-8 text'; empty Load -> 'Nothing to load yet'; no reflow of preview"
        status: unknown
    human_judgment: true
    rationale: "Inline error placement, no-layout-shift, always-enabled button affordance and last-wins visual behavior need a human eye in a real browser; deferred to end-of-phase human-verify per config human_verify_mode."

duration: 12min
completed: 2026-09-04
status: complete
---

# Phase 01 Plan 02: Corpus Input — File Upload & CorpusInput States Summary

**Browser File-API upload path (`File.text()` UTF-8) through the same pure `normalize()` into an in-memory `Exercise`, guarded by a pre-read 100 KB cap and a UTF-16-BOM / U+FFFD non-UTF-8 check that surface as fixed inline copy — plus the empty, loading, and last-wins `CorpusInput` states the walking skeleton deferred.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-04T11:58Z
- **Completed:** 2026-09-04T12:05Z
- **Tasks:** 2
- **Files modified:** 5 (4 created + CorpusInput.tsx)

## Accomplishments
- `fromFile(file, tabWidth = 4)`: size cap checked **before** `File.text()` (oversize file never read — T-01-02), UTF-16 BOM sniff on the first 2 bytes, promise-based UTF-8 read, U+FFFD scan, then `normalize()` only — content typed as-is (D-08). Returns `{ text, language, sourceType: 'upload', sourceRef: file.name }`.
- `extToLang()`: case-insensitive `Record<string,string>` lookup over ~20 dev extensions, `'plaintext'` fallback for unknown / extension-less / dotfile names.
- `CorpusTooLargeError` / `NonUtf8Error` typed classes with a readonly payload field each, thrown from `src/ingestion` and caught at the UI edge.
- `CorpusInput` now handles upload: `<input type="file">` labelled "Or upload a file"; `CorpusTooLargeError` -> "This file is over 100 KB…" and `NonUtf8Error` -> "This file isn't UTF-8 text…" rendered inline beneath the file control; "Loaded from {filename}" caption on success.
- Empty edge: "Nothing to load yet…" inline beneath the **always-enabled** Load button (no `disabled` gated on empty value).
- Last-wins: `loadTokenRef` monotonic guard — a later file selection supersedes an in-flight `fromFile`, so no interleaved exercise state.
- Loading state: `fromPaste` transform is timed; only a >16 ms transform flips the button to a disabled "Loading…" for one rAF then reverts. No spinner library.
- Error/caption rows reserve vertical space (`minHeight`) so messages cause no reflow of the preview below.
- 67 tests green (34 from 01-01 + 33 new); `tsc --noEmit` clean on both tsconfigs; `pnpm build` exit 0; oxlint clean. No `fetch` / network / raw-HTML sink introduced — `fromFile` uses only `File.text()` / `file.slice()`.

## Task Commits

1. **Task 1 (RED): failing tests for file upload ingestion** — `4e26f53` (test)
2. **Task 1 (GREEN): implement fromFile + extToLang + errors** — `828cabf` (feat)
3. **Task 2: wire upload and all CorpusInput states** — `91e02ae` (feat)

**Plan metadata:** _(docs commit — see final commit)_

_No REFACTOR commit — GREEN implementation needed no cleanup._

## Files Created/Modified
- `src/ingestion/errors.ts` - `CorpusTooLargeError` / `NonUtf8Error` typed error classes
- `src/ingestion/language-map.ts` - `extToLang(fileName)` extension -> language label
- `src/ingestion/upload.ts` - `fromFile(file, tabWidth?)` File-API -> normalized `Exercise` with size + encoding guards
- `src/ingestion/upload.test.ts` - 33 Vitest cases (node env): fromFile guards + normalize equivalence + extToLang mapping
- `src/ui/CorpusInput.tsx` - added file control, inline typed-error region, empty state, measured Loading state, `loadTokenRef` last-wins

## Decisions Made
See `key-decisions` frontmatter. Highlights:
- `extToLang` treats `.gitignore` (dotfile, no suffix) and `Makefile` (no extension) identically via `lastIndexOf('.') <= 0`.
- BOM sniff reads only 2 bytes via `file.slice(0, 2)` before the full `File.text()` read.
- Kept the native `<input type="file">` — see Deviations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test `File` construction failed `tsc` under `noUncheckedIndexedAccess` / lib types**
- **Found during:** Task 1 (GREEN, typecheck gate)
- **Issue:** `new File([new Uint8Array([...])], name)` — `Uint8Array<ArrayBufferLike>` is not assignable to `BlobPart` because `ArrayBufferLike` widens to include `SharedArrayBuffer`.
- **Fix:** `bytesFile` helper now takes `number[]` and constructs `new File([new Uint8Array(bytes).buffer as ArrayBuffer], …)`.
- **Files modified:** `src/ingestion/upload.test.ts`
- **Verification:** `./node_modules/.bin/tsc --noEmit -p tsconfig.json` exit 0; 33/33 upload tests pass.
- **Committed in:** `828cabf`

### Intentional plan adjustments (not auto-fixes)

**2. Native file input kept instead of a custom "Choose file" button**
- Plan action specified button text "Choose file". `index.css` is outside this plan's `files_modified`, and a hidden-input + styled-label fake button without CSS would regress keyboard focus and the accent focus ring. Chrome's native control already renders "Choose File". The visible label "Or upload a file" is present per the Copywriting Contract. Custom button styling can land in a UI-polish pass with CSS access.

**3. "Loading…" (ellipsis) used, not "Loading..." (ASCII)**
- Plan action text wrote `"Loading..."` but also mandates "All copy strings verbatim from 01-UI-SPEC.md Copywriting Contract", which lists `Loading…`. Used the contract form.

---

**Total deviations:** 1 auto-fixed (blocking) + 2 intentional copy/scope adjustments
**Impact on plan:** No scope creep. All files within `files_modified`. Every verification gate passes.

## Issues Encountered
- `pnpm exec tsc` output is swallowed by a supply-chain lockfile-verification wrapper in this environment (noted in 01-01); ran `./node_modules/.bin/tsc` directly for clean exit codes.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None. `fromFile` is fully implemented; `CorpusInput` handles every state from the UI contract. The only deferred item is the custom "Choose file" button *styling* (Deviation 2), which is cosmetic and does not block INPUT-02.

## Threat Flags
None. No security surface beyond the plan's `<threat_model>` was introduced. `fromFile` has no network egress (`File.text()` / `file.slice()` only); `file.name` is used solely for the caption string and `Exercise.sourceRef` (T-01-06); error strings and the caption are fixed literals / React text children with `file.name` rendered only as a text child (T-01-01); the 100 KB cap is enforced before any read (T-01-02).

## Next Phase Readiness
- INPUT-02 complete: paste **and** upload both feed the `onLoad(exercise)` seam unchanged.
- Plan 01-03 (full capture semantics + banner behavior + README) is unblocked — `CorpusInput` and `src/ingestion` are settled; 01-03 owns `src/capture/*`, `src/platform/isolation.ts`, `src/session.ts`, `src/ui/{Banners,CaptureSurface,App}.tsx`, `README.md`.
- No blockers.

## Self-Check: PASSED

- All 4 created files verified present on disk; `CorpusInput.tsx` modified.
- All 3 task commits verified in git history: `4e26f53`, `828cabf`, `91e02ae`.
- Full verification re-run at summary time: `pnpm vitest run` -> 67 passed; `tsc --noEmit` clean on both tsconfigs; `pnpm build` exit 0; oxlint clean.

---
*Phase: 01-corpus-input-keystroke-capture*
*Completed: 2026-09-04*
