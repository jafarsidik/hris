import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { MODULE_MENUS } from '@/lib/navigation';

/**
 * Build progress across the module surface.
 *
 * The overall bar describes how many modules contain at least one routed screen; the
 * rows underneath add detail per module, counting routed menu items against every item
 * the module declares. Deduced from `MODULE_MENUS` alone, so a module added to the
 * shared navigation contract shows up here without a hand-written row.
 */
export function ModuleProgress() {
  const surfaced = MODULE_MENUS.filter((entry) => entry.hasSurface).length;
  const overallPct = Math.round((surfaced / MODULE_MENUS.length) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Module status</h2>
        </CardTitle>
        <CardDescription>Surface built against the navigation roadmap</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">
              {surfaced} of {MODULE_MENUS.length} modules
            </span>
            <span className="tabular-nums text-muted-foreground">{overallPct}%</span>
          </div>
          <Progress value={overallPct} aria-label="Modules with a built surface" />
        </div>

        <ul className="divide-y divide-border">
          {MODULE_MENUS.map((entry) => {
            const items = entry.groups.flatMap((group) => group.items);
            const built = items.filter((item) => item.status === 'built').length;
            const Icon = entry.icon;

            return (
              <li key={entry.module} className="flex items-center gap-3 py-2">
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{entry.label}</span>
                    <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                      {built}/{items.length}
                    </span>
                  </div>
                  <Progress
                    value={built === 0 ? null : (built / items.length) * 100}
                    className={built === 0 ? 'opacity-40' : undefined}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
