import type { MetricsResult } from '../metrics/metrics'
import { glyphFor } from '../trainer/state'

// Auto-revealed the instant the exercise completes (D-05/D-07) — no button,
// no separate "view results" action. Mirrors Banners.tsx's prop-driven,
// role="status" display convention. Never applies performance-threshold
// color-coding or gamified framing (locked UI-SPEC rule, REQUIREMENTS.md Out
// of Scope). Math.round() happens ONLY here, at the display layer (Pitfall
// 5) — metrics.ts itself never rounds.
//
// Slowest-keys section (METR-03): renders metrics.slowest5 as a ranked list,
// or the "not enough data" fallback when it's empty — a partial metrics
// result (WPM/accuracy populated, slowest-keys not) is a valid, expected
// shape, never a whole-panel error (UI-SPEC). A space/newline entry reuses
// glyphFor (src/trainer/state.ts) for its key-chip rather than reimplementing
// the whitespace-glyph mapping.

export interface ResultsViewProps {
  metrics: MetricsResult
}

export function ResultsView({ metrics }: ResultsViewProps) {
  return (
    <section className="results-panel" role="status" aria-live="polite">
      <h2>Results</h2>
      <div className="results-stats">
        <div className="results-stat">
          {Math.round(metrics.wpm)} <span className="results-stat-label">wpm</span>
        </div>
        <div className="results-stat">
          {Math.round(metrics.accuracy * 100)}% <span className="results-stat-label">accuracy</span>
        </div>
      </div>
      <div className="results-slowest">
        <span className="text-label text-muted">Slowest keys</span>
        {metrics.slowest5.length === 0 ? (
          <p className="text-muted">
            Not enough repeated characters in this exercise to measure yet. Try a longer or more varied exercise.
          </p>
        ) : (
          <ol className="results-slowest-list">
            {metrics.slowest5.map((entry) => (
              <li key={entry.char} className="results-slowest-row">
                <span className="key-chip">
                  {entry.char === ' ' || entry.char === '\n' ? glyphFor(entry.char) : entry.char}
                </span>
                <span>{Math.round(entry.medianMs)} ms</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
