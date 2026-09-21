import type { ReactNode } from 'react'
import { IconProvider } from '@/lib/icon-context'
import { ShapeProvider } from '@/lib/shape-context'
import { SizeProvider } from '@/lib/size-context'
import { SurfaceProvider } from '@/lib/surface-context'

export function FluidProviders({ children }: { children: ReactNode }) {
  return (
    <ShapeProvider defaultShape="rounded">
      <SizeProvider defaultSize="default">
        <IconProvider>
          <SurfaceProvider value={1}>{children}</SurfaceProvider>
        </IconProvider>
      </SizeProvider>
    </ShapeProvider>
  )
}

/** Fluid dark tokens are class-based; keep the existing prefers-color-scheme policy. */
export function syncColorScheme(): void {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = (): void => {
    document.documentElement.classList.toggle('dark', media.matches)
  }
  apply()
  media.addEventListener('change', apply)
}
