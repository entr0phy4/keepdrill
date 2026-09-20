---
phase: 07
slug: github-url-repo-tree
status: verified
threats_open: 0
asvs_level: 1
created: 2026-09-20
---

# Phase 7 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| User URL string → parseGithubRef | Untrusted host/path; reject before fetch | Raw URL / `owner/repo` |
| client.ts → api.github.com | Unauthenticated CORS GET | Repo JSON, tree JSON, rate-limit headers |
| RepoRef → URL path | Encoded owner/repo only | Path segments |
| CSP meta → browser network | connect-src before CORS | Listing origin |
| GitHub path names → DOM | Untrusted blob/tree names | `TreeNode.name` / `path` |
| RepoBrowser → App exercise state | Must not cross into handleLoad | No exercise-load prop |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-07-01 | Spoofing | fetch redirects | low | accept | fetch only on constructed `api.github.com` URLs | closed |
| T-07-02 | Information disclosure | parseGithubRef / githubGet | high | mitigate | Host allowlist; `githubGet` concatenates `https://api.github.com` + `encodeURIComponent` path; never fetches the typed string | closed |
| T-07-03 | Tampering | foldTree paths | medium | mitigate | Path is `node.name` / `node.path` data only; not a filesystem escape | closed |
| T-07-04 | Information disclosure | request headers / errors | high | mitigate | Accept header only; no Authorization; REPO-06 deferred | closed |
| T-07-05 | Information disclosure | index.html CSP | high | mitigate | `connect-src 'self' https://api.github.com` only | closed |
| T-07-06 | Tampering | RepoBrowser tree labels | high | mitigate | React text children (`{node.name}`); no HTML-string injection | closed |
| T-07-07 | Denial of service | cache / in-flight | medium | mitigate | Coalesce in-flight by owner/repo; cache by sha; Import is click/Enter only | closed |
| T-07-08 | Information disclosure | 404 vs private | medium | mitigate | Single `RepoNotFoundError`; no GitHub message in UI | closed |
| T-07-09 | Information disclosure | RateLimitedError | low | accept | remaining / resetEpochS are not secrets; no client IP in Error.message | closed |
| T-07-10 | Tampering | file click → trainer | high | mitigate | `RepoBrowser` has no exercise-load prop; clicks write the status region only | closed |
| T-07-11 | Information disclosure | localStorage | medium | mitigate | App does not persist last URL or last tab | closed |
| T-07-12 | Denial of service | Import | medium | mitigate | No fetch-on-paste; last-wins token; submit disabled while busy | closed |
| T-07-13 | Elevation of privilege | CSP / COEP | high | mitigate | vite.config.ts still sends COOP `same-origin` and COEP `require-corp` | closed |
| T-07-14 | Information disclosure | status copy | medium | mitigate | Locked COPY strings only; no GitHub JSON interpolation | closed |
| T-07-SC | Tampering | npm installs | low | accept | This phase added no packages | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-07-01 | T-07-SC | No new npm packages; Package Legitimacy Audit N/A | plan accept | 2026-09-20 |
| AR-07-02 | T-07-09 | Rate-limit remaining/reset are not secrets | plan accept | 2026-09-20 |
| AR-07-03 | T-07-01 | Redirects only apply to constructed api.github.com URLs | plan accept | 2026-09-20 |

---

## Residual notes (non-blocking)

Code review CR-01: NWO `owner/..` is accepted and `encodeURIComponent('..')` does not encode the segment, so a constructed path can normalize on `api.github.com`. Host SSRF is still closed (never fetches the typed URL; origin is fixed). Tracked in `07-REVIEW.md`; not an open STRIDE item against T-07-02's planned control.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-20 | 15 | 15 | 0 | gsd-secure-phase (ASVS L1, register from PLAN.md) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-20
