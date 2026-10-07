'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MODULE_MENUS, activeModule, type ModuleId } from '@/lib/navigation';
import { usePathname } from 'next/navigation';

/**
 * The module strip: the base of the navigation.
 *
 * Lists every module in `MODULE_IDS`. Selecting one scopes the sidebar to that module's
 * menus, so the sidebar never shows a list belonging to another part of the platform.
 *
 * Three states, each distinguishable without relying on colour:
 *
 * - **Current** — the module that owns the route being viewed: `aria-current="page"` and
 *   a filled background.
 * - **Selected** — the module whose menus are on screen: `aria-pressed`.
 * - **Not built** — no screen exists yet: a dashed outline, and the tooltip says so.
 *
 * The selection is client state rather than a route, because most modules have no route to
 * navigate to. Deriving the sidebar from the URL would mean the sidebar can only ever show
 * a module that already has a page, which is two of these eleven.
 *
 * Rendered once, beside the sidebar, on desktop only. Narrow screens get a dropdown in the
 * sidebar sheet instead — a different widget, because a second copy of this strip would
 * put two `Modules` landmarks and twenty-two buttons on one page.
 */
export function ModuleRail({
  selected,
  onSelect,
}: {
  selected: ModuleId;
  onSelect: (module: ModuleId) => void;
}) {
  const pathname = usePathname();
  const current = activeModule(pathname);

  return (
    <nav
      aria-label="Modules"
      data-testid="module-rail"
      /*
       * Width is explicit rather than content-sized.
       *
       * The desktop sidebar is `position: fixed; left: 0`, so it paints over this rail
       * unless the offset is known in advance. `--module-rail-width` in `globals.css` has
       * to agree with this value exactly; if the rail's padding or button size changes
       * without this changing too, the sidebar and the rail will overlap again and the
       * rail will vanish behind it — silently, because the DOM and the geometry both look
       * correct while the hit test does not.
       */
      className="relative z-10 flex w-[53px] shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar px-2 py-3"
    >
      {MODULE_MENUS.map((entry) => {
        const Icon = entry.icon;
        const isCurrent = entry.module === current;
        const isSelected = entry.module === selected;

        return (
          <Tooltip key={entry.module}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => {
                    onSelect(entry.module);
                  }}
                  // `aria-current` marks where the reader is; `aria-pressed` marks which
                  // module's menus are on screen. Collapsing them into one would make
                  // browsing a module look like navigating to it.
                  aria-current={isCurrent ? 'page' : undefined}
                  aria-pressed={isSelected}
                  aria-label={`${entry.label}. ${entry.description}`}
                  className={[
                    'grid size-9 shrink-0 place-items-center rounded-md transition-colors',
                    'focus-visible:ring-sidebar-ring focus-visible:ring-2 focus-visible:outline-none',
                    isCurrent
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                    // Dashed rather than merely faint: "not built" is a different fact
                    // from "available", and reduced opacity does not say which this is.
                    !entry.hasSurface ? 'border border-dashed border-sidebar-border' : '',
                  ].join(' ')}
                />
              }
            >
              <Icon aria-hidden="true" className="size-[18px]" />
            </TooltipTrigger>

            <TooltipContent side="right" className="max-w-64">
              <p className="font-medium">{entry.label}</p>
              <p className="text-xs text-muted-foreground">{entry.description}</p>
              {!entry.hasSurface && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Not built yet — the menus beside it are planned scope.
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}
