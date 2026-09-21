import { useLiveQuery } from 'dexie-react-hooks'
import { listNewestFirst } from '@/persistence/repository'
import { resolveMetrics } from './history-metrics'
import { relativeTime } from './relative-time'
import { glyphFor } from '@/trainer/state'
import { KeyChip } from '@/shared/components'
import type { StoredSession } from '@/persistence/types'

// Full PERS-02 row fidelity (D-11/D-12) — expanded from 04-01's minimal
// date/wpm/accuracy row. Imports the querier, never `dexie` or
// `../persistence/db` (D-03). `useLiveQuery` returns `undefined` on first
// render (loading) and `[]` once resolved with no rows (empty) — the two
// are never conflated (RESEARCH Pitfall 5).
export function HistoryView() {
  const sessions = useLiveQuery(listNewestFirst)

  return (
    <section role="status" className="grid gap-6">
      <h2>History</h2>
      {sessions === undefined ? (
        <p className="text-muted history-loading">Loading history…</p>
      ) : sessions.length === 0 ? (
        <p className="text-muted history-empty">
          No sessions yet — finish a typing exercise and it&rsquo;ll show up here.
        </p>
      ) : (
        <ol className="history-list">
          {sessions.map((s) => (
            <HistoryRow key={s.id} session={s} />
          ))}
        </ol>
      )}
    </section>
  )
}

// D-13: inert row — no onClick / href / tabIndex / interactive role. The
// only hover affordance is the native `title` tooltip on the relative-date
// span. Rounds only here, at render (matches ResultsView's convention).
function HistoryRow({ session }: { session: StoredSession }) {
  const m = resolveMetrics(session)
  const sourceType = session.exercise.sourceType
  const sourceLabel =
    sourceType === 'upload'
      ? (session.exercise.sourceRef ?? 'Uploaded file')
      : sourceType === 'github'
        ? (session.exercise.sourceRef ?? 'GitHub file')
        : 'Pasted snippet'
  const lengthChars = Array.from(session.exercise.text).length
  const slowest = m.slowest5[0]

  return (
    <li className="history-row">
      <div className="history-row-primary">
        <span title={new Date(session.startedAt).toLocaleString()}>
          {relativeTime(session.startedAt)}
        </span>
        <span>
          {Math.round(m.wpm)} / {Math.round(m.symbolAdjustedWpm)}{' '}
          <span className="results-stat-label text-muted">adj.</span>
        </span>
        <span>{Math.round(m.accuracy * 100)}%</span>
      </div>
      <div className="history-row-meta">
        <span className="text-muted">{sourceLabel}</span>
        <KeyChip>{session.exercise.language}</KeyChip>
        <span className="text-muted">{lengthChars} chars</span>
        {slowest !== undefined && (
          <KeyChip>
            {slowest.char === ' ' || slowest.char === '\n' ? glyphFor(slowest.char) : slowest.char}
          </KeyChip>
        )}
      </div>
    </li>
  )
}
