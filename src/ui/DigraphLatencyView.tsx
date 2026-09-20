import { glyphFor } from '../trainer/state'
import type { DigraphEntry } from '../analytics/types'

// Semantic table (06-UI-SPEC), not ResultsView's ordered list. Rounding and
// glyph mapping happen only here. Rows are inert diagnostic cells (T-06-07/09).

function digraphGlyph(pair: string): string {
  return Array.from(pair)
    .map((ch) => (ch === ' ' || ch === '\n' ? glyphFor(ch) : ch))
    .join('')
}

export function DigraphLatencyView({ rows }: { rows: DigraphEntry[] }) {
  return (
    <section style={{ display: 'grid', gap: 'var(--space-md)' }}>
      <h3 className="text-label text-muted">Slowest digraphs</h3>
      {rows.length === 0 ? (
        <p className="text-muted">
          Not enough digraph samples yet. Pairs need at least 5 in-window observations across your history.
        </p>
      ) : (
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Digraph</th>
              <th>Median</th>
              <th>Samples</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <tr key={entry.pair}>
                <td>
                  <span className="key-chip">{digraphGlyph(entry.pair)}</span>
                </td>
                <td>{Math.round(entry.medianMs)} ms</td>
                <td>{entry.sampleCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
