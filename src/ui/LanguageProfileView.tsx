import type { LanguageProfileRow } from '../analytics/types'

// Semantic table (D-16..D-20). plaintext is a visible ordinary bucket — never
// rewritten. Rounding only at this display layer. Rows are inert (T-06-07/09).

export function LanguageProfileView({ rows }: { rows: LanguageProfileRow[] }) {
  return (
    <section style={{ display: 'grid', gap: 'var(--space-md)' }}>
      <h3 className="text-label text-muted">Language profile</h3>
      <table className="analytics-table">
        <thead>
          <tr>
            <th>Language</th>
            <th>WPM</th>
            <th>Adj. WPM</th>
            <th>Accuracy</th>
            <th>Sessions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.language}>
              <td>
                <span className="key-chip">{row.language}</span>
              </td>
              <td>{Math.round(row.wpm)}</td>
              <td>{Math.round(row.symbolAdjustedWpm)}</td>
              <td>{Math.round(row.accuracy * 100)}%</td>
              <td>{row.sessionCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
