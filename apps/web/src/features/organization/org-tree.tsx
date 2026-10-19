import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { unitChildren, type UnitRow } from './org-data';

/**
 * The organizational hierarchy as an expandable tree. `<details>/<summary>`
 * keeps it interactive with no client-side state: the browser expands or
 * collapses each branch natively, and the markup stays valid in a server
 * component.
 */
export function OrgTree() {
  return <div className="text-sm">{renderLevel(unitChildren(), '', 0)}</div>;
}

function renderLevel(
  children: Map<string, readonly UnitRow[]>,
  parentKey: string,
  level: number,
): React.JSX.Element | null {
  const rows = children.get(parentKey) ?? [];
  if (rows.length === 0) {
    return null;
  }
  return (
    <ul className={level === 0 ? '' : 'ml-4 border-l pl-4'}>
      {rows.map((unit) => {
        const kids = children.get(unit.name) ?? [];
        return (
          <li key={unit.id} className="py-1">
            {kids.length === 0 ? (
              <span className="text-foreground/90">▸ {unit.name}</span>
            ) : (
              <details open={level === 0}>
                <summary className="cursor-pointer select-none text-foreground">
                  ▾ {unit.name}{' '}
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({unit.type.toLowerCase().replace(/_/g, ' ')})
                  </span>
                </summary>
                <p className="ml-1 text-xs tabular-nums text-muted-foreground">
                  {unit.code} · {unit.headcount} people
                </p>
                {renderLevel(children, unit.name, level + 1)}
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The chart shell every org tree screen wraps its tree in. */
export function OrgTreeCard({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>Expand or collapse a branch to walk the hierarchy.</CardDescription>
      </CardHeader>
      <CardContent>
        <OrgTree />
      </CardContent>
    </Card>
  );
}
