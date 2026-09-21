import type { LanguageProfileRow } from '@/analytics/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { KeyChip } from '@/shared/components'

export function LanguageProfileView({ rows }: { rows: LanguageProfileRow[] }) {
  return (
    <section className="grid gap-4">
      <h3 className="text-label text-muted">Language profile</h3>
      <Table className="analytics-table">
        <TableHeader>
          <TableRow>
            <TableHead>Language</TableHead>
            <TableHead>WPM</TableHead>
            <TableHead>Adj. WPM</TableHead>
            <TableHead>Accuracy</TableHead>
            <TableHead>Sessions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.language} index={index}>
              <TableCell>
                <KeyChip>{row.language}</KeyChip>
              </TableCell>
              <TableCell>{Math.round(row.wpm)}</TableCell>
              <TableCell>{Math.round(row.symbolAdjustedWpm)}</TableCell>
              <TableCell>{Math.round(row.accuracy * 100)}%</TableCell>
              <TableCell>{row.sessionCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
