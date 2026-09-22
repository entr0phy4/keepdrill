import { createContext, useContext, type ReactNode } from 'react'
import type { FilePlan } from '@/parse/types'
import { useRepoBrowser, type UseRepoBrowserResult } from './hooks/use-repo-browser'

const RepoBrowserContext = createContext<UseRepoBrowserResult | null>(null)

export function RepoBrowserProvider({
  children,
  onPlanned,
}: {
  children: ReactNode
  onPlanned?: (plan: FilePlan) => void
}) {
  const value = useRepoBrowser(onPlanned)
  return <RepoBrowserContext.Provider value={value}>{children}</RepoBrowserContext.Provider>
}

export function useRepoBrowserContext(): UseRepoBrowserResult {
  const ctx = useContext(RepoBrowserContext)
  if (!ctx) {
    throw new Error('useRepoBrowserContext must be used within RepoBrowserProvider')
  }
  return ctx
}

export function useOptionalRepoBrowserContext(): UseRepoBrowserResult | null {
  return useContext(RepoBrowserContext)
}
