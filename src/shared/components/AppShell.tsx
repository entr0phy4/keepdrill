import type { ReactNode } from 'react'

export interface AppShellProps {
  title: string
  nav: ReactNode
  banners: ReactNode
  children: ReactNode
}

export function AppShell({ title, nav, banners, children }: AppShellProps) {
  return (
    <main className="grid gap-6">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <h1>{title}</h1>
        {nav}
      </header>
      {banners}
      {children}
    </main>
  )
}
