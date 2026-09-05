import type { MetricsResult } from '../metrics/metrics'

// Auto-revealed the instant the exercise completes (D-05/D-07) — no button,
// no separate "view results" action. Mirrors Banners.tsx's prop-driven,
// role="status" display convention. Never applies performance-threshold
// color-coding or gamified framing (locked UI-SPEC rule, REQUIREMENTS.md Out
// of Scope). Math.round() happens ONLY here, at the display layer (Pitfall
// 5) — metrics.ts itself never rounds.

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
    </section>
  )
}
