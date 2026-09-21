import type { MetricsResult } from '@/metrics/metrics'
import { glyphFor } from '@/trainer/state'
import { KeyChip } from '@/shared/components'

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
        <div className="results-stat">
          {Math.round(metrics.symbolAdjustedWpm)}{' '}
          <span className="results-stat-label">adj. wpm</span>
        </div>
      </div>
      <div className="results-slowest">
        <span className="text-label text-muted">Slowest keys</span>
        {metrics.slowest5.length === 0 ? (
          <p className="text-muted">
            Not enough repeated characters in this exercise to measure yet. Try a longer or more
            varied exercise.
          </p>
        ) : (
          <ol className="results-slowest-list">
            {metrics.slowest5.map((entry) => (
              <li key={entry.char} className="results-slowest-row">
                <KeyChip>
                  {entry.char === ' ' || entry.char === '\n' ? glyphFor(entry.char) : entry.char}
                </KeyChip>
                <span>{Math.round(entry.medianMs)} ms</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
