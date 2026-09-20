import { useLiveQuery } from 'dexie-react-hooks'
import { listNewestFirst } from '../persistence/repository'
import { computeDigraphLatency, computeLanguageProfile } from '../analytics/analytics'
import { computeKeyboardHeatmap } from '../analytics/heatmap'
import { DigraphLatencyView } from './DigraphLatencyView'
import { KeyboardHeatmap } from './KeyboardHeatmap'
import { LanguageProfileView } from './LanguageProfileView'

// Same three-way live-query branch as HistoryView (undefined ≠ []). Sections
// mount only when sessions.length > 0 (D-04). Stack order is locked: digraph
// → heatmap → language (D-02). Querier only — never persistence/db or dexie.

export function AnalyticsDashboard() {
  const sessions = useLiveQuery(listNewestFirst)

  return (
    <section role="status" style={{ display: 'grid', gap: 'var(--space-lg)' }}>
      <h2>Analytics</h2>
      {sessions === undefined ? (
        <p className="text-muted">Loading analytics…</p>
      ) : sessions.length === 0 ? (
        <p className="text-muted">
          No sessions yet — finish a typing exercise and it&rsquo;ll show up here.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-xl)' }}>
          <DigraphLatencyView rows={computeDigraphLatency(sessions)} />
          <KeyboardHeatmap cells={computeKeyboardHeatmap(sessions)} />
          <LanguageProfileView rows={computeLanguageProfile(sessions)} />
        </div>
      )}
    </section>
  )
}
