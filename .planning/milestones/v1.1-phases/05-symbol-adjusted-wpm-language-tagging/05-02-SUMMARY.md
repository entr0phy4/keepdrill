---
phase: 05-symbol-adjusted-wpm-language-tagging
plan: 02
subsystem: ingestion
tags: [language-tag, paste, select, react, vitest]

requires:
  - phase: 01-corpus-input-keystroke-capture
    provides: "fromPaste()/extToLang()/CorpusInput paste+upload form; Exercise.language field"
  - phase: 04-session-persistence-history
    provides: "HistoryRow language chip renders Exercise.language unmodified"
provides:
  - "PASTE_LANGUAGE_OPTIONS canonical vocabulary derived from EXT_TO_LANG values (D-12), EXT_TO_LANG stays private"
  - "fromPaste(raw, language, tabWidth?) requires an explicit language argument with no default (D-15)"
  - "CorpusInput paste-path <select id=\"corpus-paste-language\"> defaulting to plaintext, never blocking Load exercise (D-11/D-13/D-14)"
affects: [06-cross-session-analytics, per-language-profile]

tech-stack:
  added: []
  patterns:
    - "Closed native <select> enum sourced from PASTE_LANGUAGE_OPTIONS — never a free-text field, never a second hardcoded list"
    - "Required positional parameter (no default) so a missed fromPaste call site is a tsc error, not a silent plaintext tag"
    - "Select styled only via existing className=\"control\" — zero new CSS"

key-files:
  created:
    - src/ingestion/language-map.test.ts
    - src/ingestion/paste.test.ts
    - src/ui/CorpusInput.test.tsx
  modified:
    - src/ingestion/language-map.ts
    - src/ingestion/paste.ts
    - src/ingestion/upload.test.ts
    - src/ui/CorpusInput.tsx

key-decisions:
  - "fromPaste language is a required positional parameter with no default (D-15 / RESEARCH A1) so a missed call site fails at compile time"
  - "PASTE_LANGUAGE_OPTIONS excludes plaintext; CorpusInput presents plaintext as the explicit always-selected first option (D-12/D-13)"
  - "Rule 3: Task 1 passed an explicit 'plaintext' into CorpusInput's fromPaste call so typecheck stayed green before Task 2 wired pasteLanguage"

patterns-established:
  - "Paste and upload share one vocabulary: PASTE_LANGUAGE_OPTIONS is [...new Set(Object.values(EXT_TO_LANG))].sort() inside language-map.ts"
  - "Paste language is local useState('plaintext') only — no localStorage/sessionStorage (D-13)"

requirements-completed: [ANLY-02]

coverage:
  - id: D1
    description: "PASTE_LANGUAGE_OPTIONS is the single canonical, alphabetized, deduplicated EXT_TO_LANG value set and does not include plaintext; EXT_TO_LANG itself stays private"
    requirement: "ANLY-02"
    verification:
      - kind: unit
        ref: "src/ingestion/language-map.test.ts#is a deduplicated alphabetized vocabulary derived from EXT_TO_LANG, without plaintext"
        status: pass
    human_judgment: false
  - id: D2
    description: "fromPaste(raw, language, tabWidth?) requires language with no default and copies it onto Exercise.language; upload.test.ts CRLF/tab parity still passes"
    requirement: "ANLY-02"
    verification:
      - kind: unit
        ref: "src/ingestion/paste.test.ts#returns an Exercise tagged with the caller-supplied language"
        status: pass
      - kind: unit
        ref: "src/ingestion/upload.test.ts#normalizes CRLF + tabs identically to fromPaste of the same string"
        status: pass
      - kind: other
        ref: "pnpm typecheck — fromPaste's required language parameter compiles at every call site"
        status: pass
    human_judgment: false
  - id: D3
    description: "Paste path shows a Language <select> defaulting to plaintext, listing PASTE_LANGUAGE_OPTIONS, never blocking Load exercise, and threading the chosen value into fromPaste"
    requirement: "ANLY-02"
    verification:
      - kind: unit
        ref: "src/ui/CorpusInput.test.tsx — default plaintext; option list completeness; load without touching select; load after changing select; select never disabled"
        status: pass
    human_judgment: false
  - id: D4
    description: "Upload path is unaffected — fromFile/extToLang still tags by extension even if the paste select is set to another language"
    requirement: "ANLY-02"
    verification:
      - kind: unit
        ref: "src/ui/CorpusInput.test.tsx#does not let the select override the upload path language tag"
        status: pass
    human_judgment: false
  - id: D5
    description: "At ≤360px the Language select does not cause horizontal page overflow next to its label (UI-SPEC E3 backstop)"
    requirement: "ANLY-02"
    verification: []
    human_judgment: true
    rationale: "Narrow-viewport overflow is a visual backstop with no automated screenshot assertion; deferred to end-of-phase human verify-work"

duration: 4min
completed: 2026-09-13
status: complete
---

# Phase 5 Plan 02: Paste Language Tagging Summary

**Closed Language `<select>` on the paste path, fed by `PASTE_LANGUAGE_OPTIONS` derived from `EXT_TO_LANG`, with `fromPaste`'s language now a required caller-supplied argument**

## Performance

- **Duration:** 4 min
- **Started:** 2026-09-13T18:47:45Z
- **Completed:** 2026-09-13T18:52:40Z
- **Tasks:** 2 (4 TDD commits: RED/GREEN × 2)
- **Files modified:** 7

## Accomplishments

- `PASTE_LANGUAGE_OPTIONS` is the single canonical paste/upload language vocabulary, computed once from `EXT_TO_LANG`'s values; `'plaintext'` stays an explicit call-site default
- `fromPaste(raw, language, tabWidth = 4)` requires language — a missed call site is a compile error, not a silent `'plaintext'` tag
- `CorpusInput` renders `<select id="corpus-paste-language">` below the paste textarea, defaulting to plaintext, never blocking "Load exercise", and never remembered across sessions
- Upload `fromFile`/`extToLang` path is unchanged; the select cannot override an uploaded file's extension-derived language

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED:** `019fc53` (test) — failing tests for `PASTE_LANGUAGE_OPTIONS` and `fromPaste(raw, 'python')`
2. **Task 1 GREEN:** `8c9fef4` (feat) — export + required `language` parameter; `upload.test.ts` and a temporary `CorpusInput` compile-fix call site
3. **Task 2 RED:** `88b560b` (test) — failing `CorpusInput.test.tsx` for select default, options, load wiring, D-14, upload isolation
4. **Task 2 GREEN:** `8807259` (feat) — `<select>` + `pasteLanguage` state wired into `fromPaste(value, pasteLanguage)`

**Plan metadata:** (this commit)

_Note: TDD tasks produced two commits each (test → feat)._

## Files Created/Modified

- `src/ingestion/language-map.ts` — `PASTE_LANGUAGE_OPTIONS` export derived from private `EXT_TO_LANG`
- `src/ingestion/language-map.test.ts` — asserts the 13-language alphabetized vocabulary without plaintext
- `src/ingestion/paste.ts` — `fromPaste` takes required `language`; returned `Exercise.language` is the parameter
- `src/ingestion/paste.test.ts` — `fromPaste(raw, 'python')` tags `language: 'python'` and still normalizes text
- `src/ingestion/upload.test.ts` — line 71 call site now `fromPaste(raw, 'plaintext')`
- `src/ui/CorpusInput.tsx` — `pasteLanguage` state + Language `<select className="control">` + `fromPaste(value, pasteLanguage)`
- `src/ui/CorpusInput.test.tsx` — default selection, option completeness, default/changed load, never-blocking, upload isolation

## Decisions Made

- Kept `language` required with no default (D-15 / RESEARCH A1) rather than optional-with-`'plaintext'`-default, so future call sites cannot silently tag paste as plaintext.
- `PASTE_LANGUAGE_OPTIONS` deliberately omits `'plaintext'`; `CorpusInput` renders that option first so "is this the default" stays visible at the form, not buried in `language-map.ts`.
- Task 1 temporarily called `fromPaste(value, 'plaintext')` from `CorpusInput` so `pnpm typecheck` could pass before Task 2 introduced `pasteLanguage` — then Task 2 replaced it with `fromPaste(value, pasteLanguage)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Explicit `fromPaste` language in CorpusInput during Task 1**
- **Found during:** Task 1 GREEN (`pnpm typecheck`)
- **Issue:** Making `language` required broke `CorpusInput.tsx`'s existing `fromPaste(value)` call. Task 1's files list did not include `CorpusInput.tsx` (wired in Task 2), but Task 1's acceptance criteria require typecheck to pass.
- **Fix:** Passed `'plaintext'` explicitly at that call site in the Task 1 GREEN commit; Task 2 replaced it with `pasteLanguage`.
- **Files modified:** `src/ui/CorpusInput.tsx`
- **Verification:** `pnpm typecheck` exited 0 after Task 1 and again after Task 2
- **Committed in:** `8c9fef4` (Task 1 GREEN); superseded by `8807259` (Task 2 GREEN)

**2. [TDD] Extra `fromPaste` call site in `paste.test.ts`**
- **Found during:** Task 1 RED
- **Issue:** Plan acceptance criteria expected exactly two `fromPaste(` call sites (`CorpusInput.tsx`, `upload.test.ts`). `tdd="true"` required a failing behavior test for `fromPaste(raw, 'python')`.
- **Fix:** Added `src/ingestion/paste.test.ts` (and `language-map.test.ts`) as the RED tests. Production call sites remain the two planned ones; the new test file is the third invocation.
- **Files modified:** `src/ingestion/paste.test.ts`, `src/ingestion/language-map.test.ts`
- **Verification:** both test files pass; production grep still shows CorpusInput + upload.test as the only non-test/non-definition call sites
- **Committed in:** `019fc53` (Task 1 RED)

---

**Total deviations:** 2 auto-fixed (1 blocking compile-fix, 1 TDD extra test file)
**Impact on plan:** Both necessary for the required-parameter signature plus TDD gates. No scope creep. Upload path untouched.

## TDD Gate Compliance

RED then GREEN commits exist for both tasks:

| Task | RED | GREEN |
|------|-----|-------|
| 1 | `019fc53` test(05-02) | `8c9fef4` feat(05-02) |
| 2 | `88b560b` test(05-02) | `8807259` feat(05-02) |

No REFACTOR commits (implementation matched the plan; no cleanup needed).

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ANLY-02 is implemented: pasted sessions can carry a real language tag instead of always `'plaintext'`.
- Phase 6's per-language profile can group on `Exercise.language` from both paste (picker) and upload (extension).
- Remaining Phase 5 plan: none — this is plan 2 of 2. Ready for `/gsd-verify-work 5` (includes the ≤360px select overflow human check).
- Visual/functional UAT still needed: paste a snippet, change the select, complete an exercise, confirm History's language chip shows the chosen language.

## Self-Check: PASSED

- Created/modified files exist on disk
- Task commits `019fc53`, `8c9fef4`, `88b560b`, `8807259` exist in git log
- `pnpm test` 181/181, `pnpm typecheck`, `pnpm lint`, `pnpm build` all green

---
*Phase: 05-symbol-adjusted-wpm-language-tagging*
*Completed: 2026-09-13*
