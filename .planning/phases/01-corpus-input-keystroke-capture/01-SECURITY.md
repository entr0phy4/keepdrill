---
phase: 1
slug: corpus-input-keystroke-capture
status: verified
threats_open: 0
asvs_level: 1
created: 2026-09-05
---

# Phase 1 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| clipboard / paste → browser memory | Untrusted arbitrary text enters via the corpus paste box (INPUT-01) | Pasted plaintext |
| local file → browser memory | Untrusted file bytes enter via `<input type="file">` / `File.text()` | File bytes, `file.name` |
| in-memory corpus → DOM | The corpus string is rendered into the page and must stay inert text | Rendered text |
| keyboard / clipboard → capture `<textarea>` | Keystrokes, paste, drop, IME composition, and `isTrusted === false` synthetic events enter the capture surface | KeystrokeEvent stream |
| capture logs → Session → (Phase 3/4) | The keystroke + char log is a verbatim transcript of everything typed | KeystrokeEvent[], CommittedChar[] |
| host response headers → browser | COOP/COEP on the HTML document is what unlocks `crossOriginIsolated` | HTTP response headers |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Tampering (XSS) | `src/ui/App.tsx`, `src/ui/CorpusInput.tsx` | high | mitigate | Corpus/error/caption text rendered only as React text children (`<pre>{exercise.text}</pre>`); verified zero `innerHTML`/`dangerouslySetInnerHTML` in `src/` | closed |
| T-01-02 | Denial of Service | `src/ingestion/upload.ts`, paste flow | medium | mitigate | `MAX_BYTES = 100_000` checked before `File.text()` → `CorpusTooLargeError`; preview bounded `max-height: 40vh` scroll container | closed |
| T-01-03 | Information disclosure | whole app (corpus + keystroke log) | high | mitigate | Verified zero `fetch`/`XMLHttpRequest`/`sendBeacon`/`WebSocket` in `src/`; memory-only buffers (D-02); no analytics/telemetry dependency | closed |
| T-01-04 | Tampering (data integrity) | `src/capture/capture.ts` | low | mitigate | `if (!e.isTrusted) return` guards on keydown/keyup/beforeinput/input handlers — verified present at 5 call sites | closed |
| T-01-05 | Elevation of privilege (Spectre surface via cross-origin isolation) | `vite.config.ts`, `index.html`, `package.json` | medium | mitigate | COOP `same-origin` + COEP `require-corp` set on both `server.headers` and `preview.headers`; zero third-party runtime scripts/assets; system-monospace font stack; README documents the isolation requirement for deployers | closed |
| T-01-06 | Information disclosure / path handling | `src/ingestion/upload.ts` | low | mitigate | `file.name` used only for the caption string and `Exercise.sourceRef` — verified never concatenated into a path, URL, `fetch`, or dynamic import | closed |
| T-01-07 | Denial of Service (mojibake) | `src/ingestion/upload.ts` | low | mitigate | UTF-16 BOM sniff + U+FFFD scan → `NonUtf8Error` with an actionable message | closed |
| T-01-08 | Tampering (answer leakage / timing corruption) | `src/capture/capture.ts`, `src/ui/CaptureSurface.tsx` | medium | mitigate | Paste/drop into the typing surface cancelled via selective `preventDefault` on `beforeinput` `insertFromPaste`/`insertFromDrop`, flagged inline; corpus paste box deliberately unaffected | closed |
| T-01-09 | Denial of Service (wedged key after alt-tab) | `src/capture/capture.ts` | low | mitigate | `downCodes.clear()` on `blur` and `visibilitychange→hidden`; lifecycle markers recorded | closed |
| T-01-SC | Tampering (supply chain) | `package.json` / pnpm installs | high | mitigate | 01-RESEARCH.md Package Legitimacy Audit completed — every dependency verdict OK or SUS→OK (release-recency false positives only); versions pinned; `vitest` pinned to `~4.1.11` (not the one-day-old 5.0.0) | closed |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (`high`) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-05 | 10 | 10 | 0 | Claude (gsd-secure-phase, orchestrator-verified — register authored at plan time, ASVS L1 short-circuit) |

**Note:** During this audit, `vite.config.ts` was found with the COOP/COEP headers commented out in the *uncommitted working tree* — a leftover from the UAT Test 4 manual step that intentionally asked the tester to disable isolation temporarily to observe the degraded-timing banner. The committed file was never affected; the working-tree edit was reverted (`git checkout -- vite.config.ts`) before this audit closed T-01-05, and both headers were re-confirmed present.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-05
