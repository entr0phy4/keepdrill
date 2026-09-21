import type { ReactNode } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { ViewNav } from './ViewNav'

export interface AppShellProps {
  banners: ReactNode
  children: ReactNode
}

export function AppShell({ banners, children }: AppShellProps) {
  return (
    <SidebarProvider peek="hover" className="font-sans">
      <Sidebar variant="inset" collapsible="offcanvas">
        <SidebarHeader>
          <div className="flex items-center px-2 py-1.5">
            <span className="text-sm font-semibold tracking-tight">keebdrill</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Practice</SidebarGroupLabel>
            <SidebarGroupContent>
              <ViewNav />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 px-3">
          <SidebarTrigger />
        </header>
        <div className="mx-auto grid w-full max-w-[var(--column-max)] flex-1 content-start gap-6 px-6 pb-8 font-mono">
          {banners}
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
