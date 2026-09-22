import type { ReactNode } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
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
    <SidebarProvider peek="none" className="font-sans">
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
      <SidebarInset className="peer-data-[variant=inset]:bg-[var(--color-bg)]">
        <header className="flex h-12 shrink-0 items-center gap-2 px-3">
          <SidebarTrigger />
        </header>
        <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
          <div className="mx-auto grid w-full max-w-[var(--column-max)] content-start gap-6 px-6 pb-8 font-mono">
            {banners}
            {children}
          </div>
        </ScrollArea>
      </SidebarInset>
    </SidebarProvider>
  )
}
