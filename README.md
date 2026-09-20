# keebdrill

A typing trainer for developers that drills on **real technical corpus** —
code from Git repositories, technical documentation, pasted snippets, and
shell history — instead of generic English prose. It captures high-resolution
keystroke events (`event.timeStamp`, `keydown`/`keyup`, committed characters
via `beforeinput`/`input`) and, in later phases, reports code-specific metrics
(symbol-density-adjusted WPM, per-digraph latency, keyboard heatmap,
per-language profile, correction rate). v1 is a local-first browser SPA: paste
or upload a real code/text file, type it with keystroke capture, see WPM,
accuracy, and your five slowest keys.

## Requirements

- Node.js `^20.19.0 || >=22.12.0`
- pnpm `11.x`

## Run locally

```bash
pnpm install
pnpm dev              # dev server, http://localhost:5173
pnpm test             # Vitest (unit + happy-dom capture suite)
pnpm build && pnpm preview   # production build + local preview server
```

## Cross-origin isolation (required for accurate timing)

keebdrill's headline feature — per-digraph and per-key latency measurement —
depends on high-resolution `event.timeStamp` values. Browsers only unlock
their tightest timer resolution (Chromium: ~5µs, vs. ~100µs otherwise) when
the page is **cross-origin isolated**, which requires both of these response
headers on the HTML document:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

`pnpm dev` and `pnpm preview` already send both headers (set in
`vite.config.ts` on `server.headers` and `preview.headers` — these are
independent Vite options and neither is inherited from the other).

**Production static hosting needs a header-capable host.** Cloudflare Pages,
Netlify, and Vercel can all send custom response headers via a `_headers`
file at the root of the deployed output:

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

**GitHub Pages cannot send custom response headers** and is not a supported
production host for keebdrill without an additional client-side shim (e.g.
`coi-serviceworker`), which this project does not include in v1.

The app still runs without cross-origin isolation — it falls back to the
browser's default timer resolution and shows a visible "Heads up" banner
noting that keystroke measurements may be less precise. It never blocks use.

## Privacy

There is still no backend and no analytics. The only allowed network egress
is `https://api.github.com`, and only for **corpus listing** — fetching a
public repository's default-branch file tree. Keystroke logs and pasted or
uploaded corpus still never leave the machine. The only `fetch` call in
`src/` will live in `src/github/client.ts` (added in a later plan of this
phase).

This is enforced structurally, not just by policy: the HTML document ships a
`Content-Security-Policy` meta tag whose `connect-src` allowlist is `'self'`
and `https://api.github.com`.

As of v1.1, completed sessions — including the full raw keystroke log and any
pasted or uploaded corpus text — are stored in your browser's local IndexedDB
on your machine, and now persist across closing the tab. This storage never
leaves your machine: there is no sync, export, or upload path for it. Clearing
it is a browser-level action (clearing site data for this origin), not
something the app exposes a control for in this phase.
