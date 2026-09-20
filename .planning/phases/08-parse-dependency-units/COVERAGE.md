# API Coverage — GitHub REST (Phase 8)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> Phase 7 listed git blobs as OPT-OUT (browse-only). This phase INTEGRATES that capability.

| capability | decision | reason |
|---|---|---|
| GET `/repos/{owner}/{repo}/git/blobs/{file_sha}` | INTEGRATE | FILE-01: click-only blob load; content-addressed `sha` already on `FileNode` |
| Blob JSON `content` (Base64, possibly newline-wrapped) + `size` + `encoding` | INTEGRATE | Official git-blobs payload; strip newlines then `atob`; gate `size` then `byteLength` |
| Cache blob by sha + inflight coalescing | INTEGRATE | Unauthenticated 60 req/h; StrictMode / double-click must not double GET |
| Unauthenticated CORS GET (`Accept: application/vnd.github+json` only) | INTEGRATE | Same locked client as Phase 7; still no Octokit, version header, or PAT |
| HTTP 404 on blob | INTEGRATE | Distinct status copy; tree entry can vanish between listing and click |
| HTTP 429 and 403 with `x-ratelimit-remaining=0` | INTEGRATE | Reuse `RateLimitedError` mapper already in `githubGet`/`readGithub` |
| Other non-OK blob HTTP | INTEGRATE | Reuse `GithubHttpError` |
| GET `/repos/{owner}/{repo}` (default_branch) | OPT-OUT | Already integrated in Phase 7 listing; blob click does not re-resolve the repo |
| GET `/git/trees/{ref}?recursive=1` | OPT-OUT | Already integrated in Phase 7; this phase does not re-list |
| Contents API (`/repos/.../contents/{path}`) | OPT-OUT | Path+ref extra call; tree already has content-addressed sha; burns 60 req/h |
| Raw file URLs (`raw.githubusercontent.com`) | OPT-OUT | Would widen `connect-src`; blobs JSON is already allowlisted |
| `Accept: application/vnd.github.raw+json` | OPT-OUT | Extra header, possible CORS preflight; locked Accept-only |
| Tarball / zipball / `codeload.github.com` | OPT-OUT | Redirects drop CORS; not a single-file click path |
| Prefetch every blob on Import | OPT-OUT | 60 req/h death; FILE-01 is click-only |
| Git refs / branches / tags / SHA picker | OPT-OUT | REPO-05 deferred |
| Commits / compare / check runs / search / issues / PRs | OPT-OUT | Not corpus |
| GitHub Apps / auth / PAT / OAuth | OPT-OUT | REPO-06 deferred; no `Authorization` |
| GraphQL API | OPT-OUT | Locked REST + raw `fetch` |
| `GET /rate_limit` | OPT-OUT | Extra request; headers on the blob GET are enough |
| Gists / stars / forks / webhooks / releases / Actions | OPT-OUT | Not a filesystem blob |
| GitLab / generic git / local folder | OPT-OUT | Project boundary: public GitHub REST only |
