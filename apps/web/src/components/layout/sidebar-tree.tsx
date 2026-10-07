'use client';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { isActiveRoute, type ModuleMenu, type MenuGroup } from '@/lib/navigation';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The menus of one module, as a tree.
 *
 * Three levels, matching the platform's own structure: the module, represented by the
 * rail; the menu group; and the item. A group is a `Collapsible` section whose header is
 * a `SidebarMenuButton`, so it behaves as a tree node rather than as a heading, and its
 * items live in a `SidebarMenuSub` underneath it.
 *
 * **A group containing the current page starts open.** Collapsing the section that hides
 * the page you are on leaves no indication of where you are, and the state would not
 * survive a reload anyway.
 *
 * **Only `built` items link.** Planned items render as disabled text with a marker.
 * They were once disabled buttons carrying a tooltip, which fails twice over: a disabled
 * button cannot be focused, and a tooltip never appears on a disabled element, so
 * "not built yet" was unreachable for exactly the entries that most needed saying.
 */
export function SidebarTree({ menu }: { menu: ModuleMenu }) {
  const pathname = usePathname();

  return (
    <nav aria-label={`${menu.label} menus`} data-testid="sidebar-tree">
      {menu.groups.map((group) => (
        <Group key={group.id} group={group} pathname={pathname} />
      ))}

      <SidebarGroup>
        <p className="px-2 text-xs leading-relaxed text-muted-foreground">
          {menu.description}
          {!menu.hasSurface && ' No screens in this build; the menus above are planned scope.'}
        </p>
      </SidebarGroup>
    </nav>
  );
}

function Group({ group, pathname }: { group: MenuGroup; pathname: string }) {
  const holdsCurrentPage = group.items.some(
    (item) => item.href !== undefined && isActiveRoute(pathname, item.href),
  );

  const plannedCount = group.items.filter((item) => item.status === 'planned').length;

  return (
    <Collapsible defaultOpen={holdsCurrentPage} className="group/collapsible">
      <SidebarGroup>
        <SidebarMenu>
          {/*
            The `<li>` is what makes the nesting valid: `SidebarMenuSub` is a `<ul>`, and
            a `<ul>` inside a `<ul>` is invalid markup that React rejects. The group node
            is therefore a list item whose child list hangs beneath it.

            The trigger is that node — the group's name, how much of it is still planned,
            and the chevron. `aria-expanded` comes from the primitive, so the collapsed
            state is conveyed without relying on the chevron's rotation.
          */}
          <SidebarMenuItem>
            <CollapsibleTrigger
              render={
                <SidebarMenuButton
                  tooltip={`${group.label} — ${group.items.length} ${group.items.length === 1 ? 'menu' : 'menus'}`}
                  className="font-medium"
                />
              }
            >
              <span className="truncate">{group.label}</span>

              {plannedCount > 0 && (
                <SidebarMenuBadge className="ml-auto text-muted-foreground">
                  {plannedCount} planned
                </SidebarMenuBadge>
              )}

              <ChevronRight
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[panel-open]/collapsible:rotate-90"
              />
            </CollapsibleTrigger>

            <CollapsibleContent>
              <SidebarMenuSub>
                {group.items.map((item) => (
                  <SidebarMenuSubItem key={`${group.id}-${item.label}`}>
                    {item.href === undefined ? (
                      /*
                        Rendered as a `<span>`, not an `<a>`.

                        An anchor with no `href` is not a link — it has no link role, and a
                        nameless generic element takes its accessible name from `title`
                        alone, which would quietly drop the "planned" text below from
                        assistive technology while still passing a visible-text assertion.
                        A span carries the same styling and its text stays in the tree.

                        The description rides in `title` because there is no control to
                        focus here, and a tooltip never appears on something that cannot be
                        hovered as a control.
                      */
                      <SidebarMenuSubButton
                        render={<span />}
                        aria-disabled
                        title={item.description}
                      >
                        <span className="truncate">{item.label}</span>
                        <span className="sr-only"> — planned, not built yet</span>
                      </SidebarMenuSubButton>
                    ) : (
                      <SidebarMenuSubButton
                        isActive={isActiveRoute(pathname, item.href)}
                        aria-current={isActiveRoute(pathname, item.href) ? 'page' : undefined}
                        title={item.description}
                        render={<Link href={item.href} />}
                      >
                        <span className="truncate">{item.label}</span>
                      </SidebarMenuSubButton>
                    )}
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </Collapsible>
  );
}
