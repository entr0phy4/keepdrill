# Phase 7: GitHub URL & Repo Tree - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-20
**Phase:** 7-GitHub URL & Repo Tree
**Areas discussed:** URL + tree placement, TS/JS click this phase, Deep GitHub URLs, Tree chrome

---

## URL + tree placement

| Option | Description | Selected |
|--------|-------------|----------|
| Paste \| GitHub switch | One corpus panel at a time; tree never shares space with paste | ✓ (Claude, via You decide) |
| Trainer-only stack | Paste and GitHub both visible on Trainer | |
| Always-on like CorpusInput | URL+tree stay mounted on History and Analytics | |
| You decide | Defer to Claude | ✓ |

**User's choice:** You decide (all four placement questions)
**Notes:** Locked recommended set: switch; Trainer-only panel (CorpusInput no longer always-on); Paste default tab, no last-tab persistence; preserve both sides on switch.

---

## TS/JS click this phase

| Option | Description | Selected |
|--------|-------------|----------|
| Clickable + distinct notice | Honest feedback, different copy from blocked files, no exercise | ✓ (Claude, via You decide) |
| Not a control | TS/JS names are not buttons until Phase 8 | |
| Select/highlight only | Silent selection, no copy | |
| You decide | Defer to Claude | ✓ |

**User's choice:** You decide (all four TS/JS questions)
**Notes:** No selection API; user-facing “not yet”; replace notice on every click; no dismiss. `.mjs`/`.cjs` stay on the blocked path (REPO-03 allowlist).

---

## Deep GitHub URLs

| Option | Description | Selected |
|--------|-------------|----------|
| Ignore extra path | Default-branch tree; blob/tree suffix dropped; no auto-expand | ✓ (Claude, via You decide) |
| Expand to path | Load tree and open folders to that path | |
| Reject deep URLs | Only owner/repo | |
| You decide | Defer to Claude | ✓ |

**User's choice:** You decide (all four deep-URL questions)
**Notes:** Silent ignore of branch/path; inline reject for gist/GitLab/other hosts; Import button + Enter; no fetch-on-paste.

---

## Tree chrome

| Option | Description | Selected |
|--------|-------------|----------|
| Mute non-TS/JS | `text-muted` on blocked files; TS/JS and folders full color; no icons | ✓ (Claude, via You decide) |
| Same look for every file | Distinction only after click | |
| You decide | Defer to Claude | ✓ |

**User's choice:** You decide (all four tree-chrome questions)
**Notes:** One status region under the tree (alert vs status); truncated notice without lazy fetches; first level open, nested collapsed.

---

## Claude's Discretion

Every concrete product question in this session was answered “You decide.”
CONTEXT.md records the recommended options as D-01..D-16 and leaves only
copy, internal names, cache shape, and fixture contents as remaining
discretion (subject to UI-SPEC).

## Deferred Ideas

- Remember last URL / last tab
- Auto-expand to a deep path
- Lazy subtree fetch on truncated trees
- Pending-file highlight for Phase 8
- `.mjs`/`.cjs` as loadable
- Branch picker, private repos, fourth header item
