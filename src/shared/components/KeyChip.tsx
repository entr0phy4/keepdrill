import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface KeyChipProps {
  children: ReactNode
  className?: string
}

/** Compat wrapper: tests and history rows query `.key-chip`. Fluid has no kbd. */
export function KeyChip({ children, className }: KeyChipProps) {
  return <span className={cn('key-chip', className)}>{children}</span>
}
