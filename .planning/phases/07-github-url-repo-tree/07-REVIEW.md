---
phase: 07-github-url-repo-tree
reviewed: 2026-09-20T22:40:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/github/client.test.ts
  - src/github/client.ts
  - src/github/errors.ts
  - src/github/tree.test.ts
  - src/github/tree.ts
  - src/github/types.ts
  - src/github/url.test.ts
  - src/github/url.ts
  - src/index.css
  - src/ui/App.test.tsx
  - src/ui/App.tsx
  - src/ui/RepoBrowser.test.tsx
  - src/ui/RepoBrowser.tsx
  - index.html
findings:
  critical: 1
  warning: 5
  info: 2
  total: 8
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-09-20T22:40:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

Reviewed the GitHub URL parse, listing client, tree fold, Trainer corpus tabs, and RepoBrowser at standard depth. The host allowlist, CSP `connect-src`, credentials-omit fetch, typed error classes, and last-wins import token are sound. The client still constructs `api.github.com` paths that `..` can escape; API JSON and rate-limit headers are trusted without guards; and several failure modes surface the wrong copy or leave Import stuck.

## Critical Issues

### CR-01: NWO `owner/..` escapes the `/repos/{owner}/{repo}` path

**File:** `src/github/url.ts:10-16`
**Issue:** The NWO regex allows a repo name of `.` or `..` (`[A-Za-z0-9._-]+`). `encodeURIComponent('..')` is still `..`, so `fetch('https://api.github.com/repos/o/..')` path-normalizes to `https://api.github.com/repos/`. A follow-on tree URL `/repos/o/../git/trees/{branch}` normalizes to `/repos/git/trees/{branch}` — a different GitHub API route than the intended repository. URL-form `https://github.com/owner/..` is rejected only because `URL` normalizes the pathname first; the `owner/..` shorthand used in the golden accept table is not.
**Fix:** Reject `.` / `..` after every successful parse (NWO and URL path), before `fetchRepoTree`:

```ts
function assertRefSegment(value: string): void {
  if (value === '.' || value === '..' || value.length === 0) {
    throw new InvalidGithubUrlError()
  }
}

// after resolving owner + repo:
assertRefSegment(owner)
assertRefSegment(repo)
```

## Warnings

### WR-01: Repo and tree JSON are asserted, not validated

**File:** `src/github/client.ts:56-73`
**Issue:** `readGithub` returns `unknown` and immediately casts it to `{ default_branch: string }` / `{ sha, tree }`. `encodeURIComponent(undefined)` becomes `"undefined"`, so a 200 body missing `default_branch` hits `/git/trees/undefined` and is reported as `RepoNotFoundError`. A non-array `tree` is passed to `foldTree`, which then reads `entry.path` on a string character and throws `TypeError`. RESEARCH specified `asRepo` / `asTree` guards; they were not implemented.
**Fix:** Narrow the payloads before using them:

```ts
function asRepo(body: unknown): { default_branch: string } {
  if (typeof body !== 'object' || body === null) throw new GithubHttpError(502)
  const default_branch = (body as { default_branch?: unknown }).default_branch
  if (typeof default_branch !== 'string' || default_branch.length === 0) {
    throw new GithubHttpError(502)
  }
  return { default_branch }
}

function asTree(body: unknown): { sha: string; truncated?: boolean; tree: GitTreeEntry[] } {
  if (typeof body !== 'object' || body === null) throw new GithubHttpError(502)
  const rec = body as { sha?: unknown; truncated?: unknown; tree?: unknown }
  if (typeof rec.sha !== 'string' || !Array.isArray(rec.tree)) {
    throw new GithubHttpError(502)
  }
  return { sha: rec.sha, truncated: rec.truncated === true, tree: rec.tree as GitTreeEntry[] }
}
```

### WR-02: Non-finite `x-ratelimit-reset` renders “Invalid Date”

**File:** `src/github/client.ts:42-46`
**Issue:** `Number(reset)` is stored even when the header is missing-but-empty (`''` → `0`) or garbage (`NaN`). `typeof NaN === 'number'`, so `formatRateLimit` in `src/ui/RepoBrowser.tsx:44-50` builds `new Date(NaN * 1000)` and interpolates `Invalid Date` into the locked rate-limit string.
**Fix:** Only keep a finite unix-seconds value:

```ts
const resetNum = reset === null ? NaN : Number(reset)
throw new RateLimitedError({
  remaining: remaining === null ? 0 : Number(remaining),
  resetEpochS: Number.isFinite(resetNum) ? resetNum : undefined,
})
```

### WR-03: Any `TypeError` is shown as “Couldn't reach GitHub”

**File:** `src/ui/RepoBrowser.tsx:157-158`
**Issue:** The catch maps every `TypeError` to `COPY.unreachable` (CSP/COEP/offline). `JSON.parse` failures inside `res.json()` are `SyntaxError`, but `foldTree` throws `TypeError` when `entry.path` is missing (`String.prototype.lastIndexOf` on `undefined`). A successful HTTP response with a malformed tree is then described as a connectivity failure.
**Fix:** Wrap fetch-layer `TypeError` in the client (named error or `GithubHttpError`) and only map that class to unreachable copy. Let `foldTree` / JSON failures use `COPY.otherHttp`.

### WR-04: Unknown errors are rethrown from `onImport` as unhandled rejections

**File:** `src/ui/RepoBrowser.tsx:159-160`
**Issue:** The `else { throw err }` path runs inside `void onImport()`. `finally` clears `busy`, but the rejection is unhandled: no Error Boundary, status stays empty (it was cleared at the start of the attempt). The user sees a dead Import with no alert.
**Fix:** Map the fallback to the locked other-HTTP copy instead of rethrowing:

```ts
} else {
  setStatus({ kind: 'alert', text: COPY.otherHttp })
}
```

### WR-05: Tree wrapper `aria-label` is on a generic `div`

**File:** `src/ui/RepoBrowser.tsx:205`
**Issue:** 07-UI-SPEC requires `aria-label="Repository files"` on the tree wrapper. `aria-label` on an element with no implicit/explicit role is not mapped to the accessibility tree, so the listing is unlabeled.
**Fix:** Give the wrapper a role that accepts a name (do not use `role="tree"` — RESEARCH forbids it on `<details>`):

```tsx
<div className="repo-tree" role="region" aria-label="Repository files">
```

## Info

### IN-01: SHA / branch cache keys are written and never read

**File:** `src/github/client.ts:82-93`
**Issue:** `fetchRepoTree` only looks up `${owner}/${repo}`. The extra `${owner}/${repo}@${sha}` and `${owner}/${repo}:${defaultBranch} → sha` entries are dead writes. The `typeof cached !== 'string'` guard exists only because those writes mixed types in one `Map`. The `@` / `:` key format can collide with a later lookup if a ref ever contained those characters.
**Fix:** Store one `Map<string, RepoTreeResult>` keyed by `${owner}/${repo}` (or implement the documented sha pointer lookup and stop writing the unused keys).

### IN-02: Tabpanels are not named by their tabs

**File:** `src/ui/App.tsx:210-223`
**Issue:** Tabs correctly set `aria-controls`, but the tabpanels have no `aria-labelledby` pointing at `corpus-tab-paste` / `corpus-tab-github`. Not required by 07-UI-SPEC, but AT will announce an unnamed tabpanel.
**Fix:** Add `aria-labelledby="corpus-tab-paste"` / `aria-labelledby="corpus-tab-github"` on the matching panels.

---

_Reviewed: 2026-09-20T22:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
