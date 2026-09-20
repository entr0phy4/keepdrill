# API Coverage — GitHub REST

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

| capability | decision | reason |
|---|---|---|
| Resolve owner/repo from URL or `owner/repo` | INTEGRATE | REPO-01 / D-09: `parseGithubRef` is the only entry to Import |
| GET `/repos/{owner}/{repo}` (default_branch, 301 rename follow) | INTEGRATE | REPO-01: default branch name before the tree call |
| GET `/git/trees/{ref}?recursive=1` | INTEGRATE | REPO-01/REPO-02: one recursive listing of the default branch |
| Recursive tree `truncated` flag | INTEGRATE | REPO-04 / D-15: named notice, still render returned entries |
| HTTP 404 on repo or tree | INTEGRATE | REPO-04: one public-not-found string (GitHub 404s private too) |
| HTTP 409 empty repository | INTEGRATE | Empty-repo copy; success, not a generic failure |
| HTTP 429 and 403 with `x-ratelimit-remaining=0` | INTEGRATE | REPO-04: `RateLimitedError` + reset clock |
| Rate-limit response headers (`x-ratelimit-remaining`, `x-ratelimit-reset`) | INTEGRATE | Surface reset as local time; no extra `GET /rate_limit` |
| Unauthenticated CORS GET (`Accept: application/vnd.github+json` only) | INTEGRATE | Locked public client; no Octokit, no version header, no PAT |
| Contents API (`/repos/.../contents`) | OPT-OUT | Trees API is the locked listing path; contents is per-path and burns the 60 req/h budget |
| Git blobs (`GET /git/blobs/{sha}`) | OPT-OUT | FILE-01 — Phase 8; this phase is browse-only |
| Raw file URLs (`raw.githubusercontent.com`) | OPT-OUT | D-10 reject as pasted input; not a listing API |
| Tarball / zipball / `codeload.github.com` | OPT-OUT | Redirects drop CORS; out of locked public-REST listing path |
| Git refs list (`/git/refs`, `/git/ref/{ref}`) | OPT-OUT | Default branch comes from the repo payload; REPO-05 is deferred |
| Branches / tags / SHA picker | OPT-OUT | REPO-05 — Future Requirements |
| Commits list / compare / commit status / check runs | OPT-OUT | Not needed to render a filesystem tree |
| Search (code, repos, users) | OPT-OUT | Import is an explicit owner/repo, not discovery |
| Issues | OPT-OUT | Extra URL path is ignored (D-09); not a corpus source |
| Pull requests | OPT-OUT | Extra URL path is ignored (D-09); not a corpus source |
| GitHub Apps / auth / PAT / OAuth | OPT-OUT | REPO-06 deferred; no `Authorization` header this milestone |
| Gists | OPT-OUT | D-10: typed invalid URL, no fetch |
| Stars / forks / watchers / traffic | OPT-OUT | Social graph is not corpus |
| Webhooks | OPT-OUT | No backend tier; SPA cannot receive hooks |
| Releases / packages / actions / codespaces / pages | OPT-OUT | Not a filesystem listing |
| Collaborators / permissions / org APIs | OPT-OUT | Single-user local SPA; public reads only |
| GraphQL API | OPT-OUT | Locked REST + raw `fetch`; GraphQL would add a second surface |
| `GET /rate_limit` | OPT-OUT | Extra request against the 60/h budget; headers on the real calls are enough |
| Non-recursive trees + lazy subdirectory fetch | OPT-OUT | D-15: no lazy subdirectory fetches this phase |
| GitLab / generic git / local folder | OPT-OUT | Project boundary: public GitHub REST only |
