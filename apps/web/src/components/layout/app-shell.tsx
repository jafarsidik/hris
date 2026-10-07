'use client';

import { BreadcrumbTrail } from '@/components/layout/breadcrumb-trail';
import { ModuleRail } from '@/components/layout/module-rail';
import { SessionMenu } from '@/components/layout/session-menu';
import { SidebarTree } from '@/components/layout/sidebar-tree';
import { NotificationBell } from '@/components/layout/notification-bell';
import { CommandPalette } from '@/components/command/command-palette';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { MODULE_MENUS, activeModule, type ModuleId } from '@/lib/navigation';
import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * The application frame: module rail, sidebar, header, content region and footer.
 *
 * A client component because it owns which module the sidebar is showing. `children`
 * arrives as already-rendered server output, so the pages inside it stay server
 * components; only the frame's own state is client-side.
 *
 * **The selection follows the route.** Navigating anywhere selects that page's module,
 * so the sidebar is never showing another module's menus while the reader is on this
 * page. A reader may still select another module from the rail to inspect its scope; the
 * selection snaps back on the next navigation.
 *
 * **There is no edge rail.** The shadcn `SidebarRail` is a 4px collapse handle, and the
 * strip beside the sidebar now occupies that visual position with something that
 * actually does something. Collapse is handled by the two `SidebarTrigger`s, one in the
 * header for narrow viewports and one in the footer, which is reachable once the sidebar
 * is collapsed to icons.
 *
 * `SidebarInset` renders the `<main>` element, so this file must not add another one. It
 * carries the `main-content` id the skip link in `layout.tsx` targets, which keeps
 * exactly one main landmark on the page.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const current = activeModule(pathname);

  const [selected, setSelected] = useState<ModuleId>(current ?? 'PLATFORM');

  useEffect(() => {
    if (current !== null) {
      setSelected(current);
    }
  }, [current]);

  const menu = MODULE_MENUS.find((entry) => entry.module === selected) ?? MODULE_MENUS[0];
  const surfaced = MODULE_MENUS.filter((entry) => entry.hasSurface).length;

  return (
    <SidebarProvider
      data-has-module-rail
      style={{ '--module-rail-width': '53px' } as CSSProperties}
    >
      {/*
        A sibling of the sidebar rather than a child, so it stays put while the sidebar
        scrolls and survives the sidebar collapsing to icons. Desktop only: the sheet has
        no room beside anything, and a second copy of the strip would put two `Modules`
        landmarks and twenty-two buttons on one page.
      */}
      <div className="hidden md:flex">
        <ModuleRail selected={selected} onSelect={setSelected} />
      </div>

      <Sidebar collapsible="icon" className="md:peer-data-[variant=sidebar]:md:flex-none">
        <SidebarHeader>
          <div className="flex h-8 items-center gap-2 px-2">
            <Link
              href="/"
              className="flex items-center gap-2 font-bold text-sidebar-foreground no-underline"
            >
              <span
                aria-hidden="true"
                className="grid size-6 shrink-0 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground"
              >
                <Building2 className="size-3.5" />
              </span>
              <span className="truncate font-bold tracking-tight group-data-[collapsible=icon]:hidden">
                HRIS
              </span>
            </Link>
          </div>
        </SidebarHeader>

        {/*
          Narrow screens reach the same eleven modules through a dropdown rather than a
          strip: inside a 375px-wide sheet a vertical rail would cost more width than the
          menus it selects.
        */}
        <div className="border-b border-sidebar-border px-2 py-2 md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:ring-sidebar-ring focus-visible:ring-2 focus-visible:outline-none"
                />
              }
            >
              <span className="truncate">{menu?.label ?? 'Modules'}</span>
              <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 opacity-60" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Modules</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {MODULE_MENUS.map((entry) => (
                <DropdownMenuItem
                  key={entry.module}
                  onClick={() => {
                    setSelected(entry.module);
                  }}
                  className="justify-between gap-2"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{entry.label}</span>
                    {!entry.hasSurface && (
                      <span className="truncate text-xs text-muted-foreground">Not built yet</span>
                    )}
                  </span>
                  {entry.module === selected && (
                    <Check aria-hidden="true" className="size-4 shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <SidebarContent>{menu !== undefined && <SidebarTree menu={menu} />}</SidebarContent>

        <SidebarFooter>
          <Separator className="bg-sidebar-border" />
          <div className="flex items-center justify-between gap-2 px-2 py-2 text-xs text-sidebar-foreground">
            <span className="truncate group-data-[collapsible=icon]:hidden">
              {surfaced} of {MODULE_MENUS.length} modules built
            </span>
            <SidebarTrigger className="size-7" aria-label="Collapse or expand navigation" />
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset id="main-content">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-sm">
          <SidebarTrigger className="size-8 md:hidden" aria-label="Open navigation" />

          {/*
            No wrapping `<nav>`: `Breadcrumb` already renders its own landmark, and two
            nested navigation landmarks are announced ambiguously.
          */}
          <BreadcrumbTrail />

          <div className="ml-auto flex items-center gap-1.5">
            <CommandPalette />
            <NotificationBell />
            <SessionMenu />
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-6">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </div>

        <footer className="px-4 py-4 text-sm text-muted-foreground sm:px-6">
          Enterprise HRIS &middot; foundation phase
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
