import type { HeatmapCell } from '../analytics/types'

// Static US-ANSI diagram (D-10). Color lerp and Math.round live only here —
// never by mutating cells, never with accent/destructive tokens (D-14/D-15).
// Keys are inert divs, not buttons (T-06-09). Labels and ms are text nodes
// only (T-06-07).

const FIGURE_CAPTION =
  'Median latency in ms. Darker amber is slower, relative to keys with at least 5 samples.'
const UNGATED_CAPTION = 'No keys have 5 samples yet.'

export function KeyboardHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const sampled = cells.filter((c): c is HeatmapCell & { medianMs: number } => c.medianMs !== null)
  const lo = sampled.length === 0 ? 0 : Math.min(...sampled.map((c) => c.medianMs))
  const hi = sampled.length === 0 ? 0 : Math.max(...sampled.map((c) => c.medianMs))

  return (
    <section style={{ display: 'grid', gap: 'var(--space-md)' }}>
      <h3 className="text-label text-muted">Keyboard heatmap</h3>
      <figure role="group" aria-label="US ANSI keyboard, median latency in milliseconds">
        <div className="keyboard-heatmap">
          {cells.map((cell) => {
            const medianMs = cell.medianMs
            const t = medianMs === null ? null : hi === lo ? 0.5 : (medianMs - lo) / (hi - lo)
            const rounded = medianMs === null ? null : Math.round(medianMs)
            return (
              <div
                key={cell.code}
                className="kb-key"
                aria-label={
                  rounded !== null
                    ? `${cell.label}, ${rounded} milliseconds`
                    : `${cell.label}, not enough samples`
                }
                style={{
                  gridColumn: `${cell.col + 1} / span ${cell.span}`,
                  gridRow: cell.row + 1,
                  // Custom property carries color-mix; happy-dom drops it on `background`.
                  ['--kb-fill' as string]:
                    t === null
                      ? 'var(--color-surface)'
                      : `color-mix(in srgb, var(--heatmap-hi) ${t * 100}%, var(--heatmap-lo))`,
                  background: 'var(--kb-fill)',
                  color: t === null ? 'var(--color-text)' : 'var(--heatmap-key-fg)',
                }}
              >
                <span>{cell.label}</span>
                {rounded !== null ? <span>{rounded}</span> : null}
              </div>
            )
          })}
        </div>
        <figcaption className="text-muted">{FIGURE_CAPTION}</figcaption>
        {sampled.length === 0 ? <p className="text-muted">{UNGATED_CAPTION}</p> : null}
      </figure>
    </section>
  )
}
