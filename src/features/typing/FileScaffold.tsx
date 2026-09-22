import { useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import type { PlanUnit } from '@/parse/types'
import { coverFile } from '@/scaffold/cover'
import { sliceUnit } from '@/scaffold/slice'
import { glyphFor } from '@/trainer/state'
import { prefersReducedMotion } from '@/shared/hooks'
import { Card } from '@/components/ui/card'
import { CaptureSurface } from './CaptureSurface'
import { tokenKinds, type TokenKind } from './highlight'

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

function renderPlainChars(
  chars: readonly string[],
  kinds: readonly TokenKind[],
  start: number,
  end: number,
): ReactNode[] {
  const lines: ReactNode[] = []
  let buf: ReactNode[] = []
  let lineStart = start
  const flush = (at: number) => {
    lines.push(
      <span key={`line-${lineStart}-${at}`} className="file-line">
        {buf}
      </span>,
    )
    buf = []
    lineStart = at
  }
  for (let i = start; i < end; i++) {
    const ch = chars[i] ?? ''
    const token = kinds[i]
    buf.push(
      <span
        key={i}
        data-token={token && token !== 'plain' ? token : undefined}
        data-nl={ch === '\n' ? '' : undefined}
      >
        {ch}
      </span>,
    )
    if (ch === '\n') flush(i + 1)
  }
  if (buf.length > 0) flush(end)
  return lines
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
  interactive = true,
  plain = false,
  language = 'plaintext',
  pathLabel,
  onRestartRequested,
  onComplete,
}: {
  text: string
  units: readonly PlanUnit[]
  unitIndex: number
  loadToken: number
  complete: boolean
  interactive?: boolean
  plain?: boolean
  language?: string
  pathLabel?: string
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
  const chars = useMemo(() => Array.from(text), [text])
  const kinds = useMemo(
    () => (plain ? tokenKinds(text, language) : []),
    [plain, text, language],
  )

  useLayoutEffect(() => {
    if (plain) return
    currentCardRef.current?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: prefersReducedMotion() ? 'instant' : 'smooth',
    })
  }, [unitIndex, plain])

  const landmark = (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={landmarkAria}
      className={plain ? 'file-scaffold-landmark' : undefined}
      style={plain ? undefined : { display: 'grid', gap: 'var(--space-xs)', margin: 0 }}
    >
      <p
        className="text-label"
        style={plain ? undefined : { margin: 0, minHeight: '1.4em' }}
      >
        {progress}
      </p>
      {subtitle ? (
        <p
          className="text-muted"
          style={plain ? undefined : { margin: 0, overflowWrap: 'anywhere' }}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  )

  const regionNodes = segments.map((seg) => {
    if (seg.kind === 'gap') {
      if (plain) {
        return (
          <div
            key={`gap-${seg.start}-${seg.end}`}
            data-scaffold-role="gap"
            className="file-static"
          >
            {renderPlainChars(chars, kinds, seg.start, seg.end)}
          </div>
        )
      }
      return (
        <pre key={`gap-${seg.start}-${seg.end}`} data-scaffold-role="gap" style={staticPreStyle}>
          {renderGlyphs(sliceUnit(text, seg.start, seg.end))}
        </pre>
      )
    }
    if (complete || seg.role !== 'current' || !interactive) {
      const role = complete ? 'done' : seg.role
      if (plain) {
        return (
          <div
            key={seg.unit.id}
            data-scaffold-role={role}
            className="file-static"
          >
            {renderPlainChars(chars, kinds, seg.unit.start, seg.unit.end)}
          </div>
        )
      }
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
    if (plain) {
      return (
        <div key={seg.unit.id} ref={currentCardRef} data-scaffold-current="" className="file-unit-current">
          <CaptureSurface
            key={loadToken}
            plain
            language={language}
            text={sliceUnit(text, seg.unit.start, seg.unit.end)}
            onRestartRequested={onRestartRequested}
            onComplete={onComplete}
          />
        </div>
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
  })

  if (plain) {
    return (
      <section className="file-source" aria-label={pathLabel ?? 'File contents'}>
        {pathLabel ? <p className="file-source-path text-label">{pathLabel}</p> : null}
        <div className="file-scaffold">
          {landmark}
          <div className="file-source-body" aria-label="File">
            <div className="file-source-flow">{regionNodes}</div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-xs)' }}>
      {landmark}
      <div
        aria-label="File"
        style={{ maxHeight: '70vh', overflow: 'auto', display: 'grid', gap: 0 }}
      >
        {regionNodes}
      </div>
    </div>
  )
}
