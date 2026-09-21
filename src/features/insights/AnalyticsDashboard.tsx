import { useLiveQuery } from 'dexie-react-hooks'
import { listNewestFirst } from '@/persistence/repository'
import { computeDigraphLatency, computeLanguageProfile } from '@/analytics/analytics'
import { computeKeyboardHeatmap } from '@/analytics/heatmap'
import { DigraphLatencyView } from './components/DigraphLatencyView'
import { KeyboardHeatmap } from './components/KeyboardHeatmap'
import { LanguageProfileView } from './components/LanguageProfileView'

// Same three-way live-query branch as HistoryView (undefined ≠ []). Sections
// mount only when sessions.length > 0 (D-04). Stack order is locked: digraph
// → heatmap → language (D-02). Querier only — never persistence/db or dexie.

export function AnalyticsDashboard() {
  const sessions = useLiveQuery(listNewestFirst)

  return (
    <section role="status" className="grid gap-6">
      <h2>Analytics</h2>
      {sessions === undefined ? (
        <p className="text-muted">Loading analytics…</p>
      ) : sessions.length === 0 ? (
        <p className="text-muted">
          No sessions yet — finish a typing exercise and it&rsquo;ll show up here.
        </p>
      ) : (
        <div className="grid gap-8">
          <DigraphLatencyView rows={computeDigraphLatency(sessions)} />
          <KeyboardHeatmap cells={computeKeyboardHeatmap(sessions)} />
          <LanguageProfileView rows={computeLanguageProfile(sessions)} />
        </div>
      )}
    </section>
  )
}
