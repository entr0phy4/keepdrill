import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface StatusMessageProps {
  children?: ReactNode
  tone?: 'status' | 'alert'
  className?: string
  id?: string
  reserved?: boolean
}

export function StatusMessage({
  children,
  tone = 'status',
  className,
  id,
  reserved = true,
}: StatusMessageProps) {
  const isError = tone === 'alert'
  return (
    <p
      id={id}
      role={isError ? 'alert' : 'status'}
      className={cn(isError ? undefined : 'text-muted', className)}
      style={{
        margin: 0,
        minHeight: reserved ? '1.4em' : undefined,
        color: isError ? 'var(--destructive)' : undefined,
      }}
    >
      {children}
    </p>
  )
}
