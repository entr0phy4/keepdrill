import { glyphFor } from '@/trainer/state'
import type { DigraphEntry } from '@/analytics/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { KeyChip } from '@/shared/components'

function digraphGlyph(pair: string): string {
  return Array.from(pair)
    .map((ch) => (ch === ' ' || ch === '\n' ? glyphFor(ch) : ch))
    .join('')
}

export function DigraphLatencyView({ rows }: { rows: DigraphEntry[] }) {
  return (
    <section className="grid gap-4">
      <h3 className="text-label text-muted">Slowest digraphs</h3>
      {rows.length === 0 ? (
        <p className="text-muted">
          Not enough digraph samples yet. Pairs need at least 5 in-window observations across your
          history.
        </p>
      ) : (
        <Table className="analytics-table">
          <TableHeader>
            <TableRow>
              <TableHead>Digraph</TableHead>
              <TableHead>Median</TableHead>
              <TableHead>Samples</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((entry, index) => (
              <TableRow key={entry.pair} index={index}>
                <TableCell>
                  <KeyChip>{digraphGlyph(entry.pair)}</KeyChip>
                </TableCell>
                <TableCell>{Math.round(entry.medianMs)} ms</TableCell>
                <TableCell>{entry.sampleCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
