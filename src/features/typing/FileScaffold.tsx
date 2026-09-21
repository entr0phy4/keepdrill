import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import type { PlanUnit } from '@/parse/types'
import { coverFile } from '@/scaffold/cover'
import { sliceUnit } from '@/scaffold/slice'
import { glyphFor } from '@/trainer/state'
import { prefersReducedMotion } from '@/shared/hooks'
import { Card } from '@/components/ui/card'
import { CaptureSurface } from './CaptureSurface'

export const COPY = {
  landmark: '{n} / {m}',
  landmarkKindName: '{kind} {name}',
} as const

export const KIND_LABEL = {
  import: 'import',
  function: 'function',
  class: 'class',
  type: 'type',
  other: '',
  file: 'file',
} as const

function subtitleFor(unit: PlanUnit | undefined): string {
  if (!unit) return ''
  const kind = KIND_LABEL[unit.kind]
  const name = unit.name ?? ''
  if (kind && name) return COPY.landmarkKindName.replace('{kind}', kind).replace('{name}', name)
  if (kind) return kind
  if (name) return name
  return ''
}

function renderGlyphs(slice: string): ReactNode[] {
  const chars = Array.from(slice)
  const nodes: ReactNode[] = []
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i] ?? ''
    if (ch === ' ' || ch === '\n') {
      nodes.push(
        <span key={i} className="ws-glyph">
          {glyphFor(ch)}
        </span>,
      )
    } else {
      nodes.push(ch)
    }
  }
  return nodes
}

const staticPreStyle: CSSProperties = {
  margin: 0,
  padding: 'var(--space-md)',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  tabSize: 4,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-body-size)',
  lineHeight: 'var(--text-body-line)',
  userSelect: 'text',
  color: 'var(--color-text)',
}

export function FileScaffold({
  text,
  units,
  unitIndex,
  loadToken,
  complete,
  onRestartRequested,
  onComplete,
}: {
  text: string
  units: readonly PlanUnit[]
  unitIndex: number
  loadToken: number
  complete: boolean
  onRestartRequested?: () => void
  onComplete?: (completedAt: number) => void
}) {
  const currentCardRef = useRef<HTMLDivElement | null>(null)
  const coverIndex = complete ? units.length : unitIndex
  const segments = coverFile(text, units, coverIndex)
  const landmarkUnit = units[Math.min(unitIndex, Math.max(units.length - 1, 0))]
  const n = unitIndex + 1
  const m = units.length
  const progress = COPY.landmark.replace('{n}', String(n)).replace('{m}', String(m))
  const subtitle = subtitleFor(landmarkUnit)
  const landmarkAria = subtitle ? `${progress}, ${subtitle}` : progress

  useLayoutEffect(() => {
    currentCardRef.current?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: prefersReducedMotion() ? 'instant' : 'smooth',
    })
  }, [unitIndex])

  return (
    <div style={{ display: 'grid', gap: 'var(--space-xs)' }}>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label={landmarkAria}
        style={{ display: 'grid', gap: 'var(--space-xs)', margin: 0 }}
      >
        <p className="text-label" style={{ margin: 0, minHeight: '1.4em' }}>
          {progress}
        </p>
        {subtitle ? (
          <p className="text-muted" style={{ margin: 0, overflowWrap: 'anywhere' }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      <div
        aria-label="File"
        style={{ maxHeight: '70vh', overflow: 'auto', display: 'grid', gap: 0 }}
      >
        {segments.map((seg) => {
          if (seg.kind === 'gap') {
            return (
              <pre key={`gap-${seg.start}-${seg.end}`} data-scaffold-role="gap" style={staticPreStyle}>
                {renderGlyphs(sliceUnit(text, seg.start, seg.end))}
              </pre>
            )
          }
          if (complete || seg.role !== 'current') {
            const role = complete ? 'done' : seg.role
            return (
              <pre
                key={seg.unit.id}
                data-scaffold-role={role}
                className={role === 'future' ? 'text-muted' : undefined}
                style={{
                  ...staticPreStyle,
                  color: role === 'future' ? undefined : 'var(--color-text)',
                }}
              >
                {renderGlyphs(sliceUnit(text, seg.unit.start, seg.unit.end))}
              </pre>
            )
          }
          return (
            <Card
              key={seg.unit.id}
              ref={currentCardRef}
              data-scaffold-current=""
              className="border border-border bg-card p-4"
            >
              <CaptureSurface
                key={loadToken}
                text={sliceUnit(text, seg.unit.start, seg.unit.end)}
                onRestartRequested={onRestartRequested}
                onComplete={onComplete}
              />
            </Card>
          )
        })}
      </div>
    </div>
  )
}
