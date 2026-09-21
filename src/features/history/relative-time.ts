// PURE — no dependency (04-RESEARCH.md discretion: Intl.RelativeTimeFormat is
// a browser built-in, not a new package). Formats a wall-clock `startedAt`
// (Session.startedAt, Date.now() domain — D-12) against `now` as a relative
// string ('2h ago', '3d ago', 'just now'). A single module-level formatter
// instance is reused across calls (matches metrics.ts's "no per-call
// allocation of anything expensive" discipline).

const RTF = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

// Descending unit ladder (D-12). The largest unit whose magnitude the diff
// reaches is used; below 1000ms falls through to the 'second' branch, which
// Intl.RelativeTimeFormat renders as "now" / "just now" via numeric: 'auto'
// for a rounded value of 0.
const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000_000],
  ['month', 2_592_000_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
  ['second', 1000],
]

export function relativeTime(startedAt: number, now: number = Date.now()): string {
  const diff = startedAt - now
  for (const [unit, unitMs] of UNITS) {
    if (Math.abs(diff) >= unitMs || unit === 'second') {
      return RTF.format(Math.round(diff / unitMs), unit)
    }
  }
  // Unreachable — the 'second' branch above always matches — kept as a
  // type-safe fallback.
  return RTF.format(0, 'second')
}
