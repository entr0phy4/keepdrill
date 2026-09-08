import { useLiveQuery } from 'dexie-react-hooks'
import { listNewestFirst } from '../persistence/repository'

// Minimal history list (D-09/D-14) — expanded to full row fidelity (D-11) in
// plan 04-02. Imports the querier, never `dexie` or `../persistence/db`
// (D-03). `useLiveQuery` returns `undefined` on first render (loading) and
// `[]` once resolved with no rows (empty) — the two are never conflated
// (RESEARCH Pitfall 5).
export function HistoryView() {
  const sessions = useLiveQuery(listNewestFirst)

  return (
    <section role="status" style={{ display: 'grid', gap: 'var(--space-lg)' }}>
      <h2>History</h2>
      {sessions === undefined ? (
        <p className="text-muted">Loading history…</p>
      ) : sessions.length === 0 ? (
        <p className="text-muted">
          No sessions yet — finish a typing exercise and it&rsquo;ll show up here.
        </p>
      ) : (
        <ol className="history-list">
          {sessions.map((s) => (
            <li key={s.id} className="history-row">
              <span title={new Date(s.startedAt).toLocaleString()}>
                {new Date(s.startedAt).toLocaleString()}
              </span>
              <span>{Math.round(s.metricsSnapshot.wpm)} wpm</span>
              <span>{Math.round(s.metricsSnapshot.accuracy * 100)}%</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
