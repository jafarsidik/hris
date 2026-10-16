'use client';

import { useMemo, useState } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { getIam } from '@/features/iam';
import { useIamLoad } from '@/features/iam/use-iam-data';

/**
 * Grants a set of `resource.action` scopes to an API client.
 *
 * The vocabulary is the registry-backed permission list the API already exposes, so the
 * screen cannot offer a scope the platform does not define. The API re-validates every
 * scope and refuses one the creator cannot grant, so this is an affordance, not the
 * boundary.
 */
export function ScopePicker({
  value,
  onChange,
  label,
}: {
  readonly value: readonly string[];
  readonly onChange: (scopes: readonly string[]) => void;
  readonly label: string;
}) {
  const permissions = useIamLoad(() => getIam().listPermissions(), []);
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    const byResource = new Map<string, { key: string; action: string }[]>();
    for (const permission of permissions.data ?? []) {
      const key = `${permission.resource}.${permission.action}`;
      const list = byResource.get(permission.resource) ?? [];
      list.push({ key, action: permission.action });
      byResource.set(permission.resource, list);
    }
    const term = search.trim().toLowerCase();
    const filtered = new Map<string, { key: string; action: string }[]>();
    for (const [resource, actions] of byResource) {
      const matched = term === '' ? actions : actions.filter((a) => a.key.includes(term));
      if (matched.length > 0) {
        filtered.set(resource, matched);
      }
    }
    return [...filtered.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions.data, search]);

  const selected = new Set(value);

  function toggle(key: string, checked: boolean) {
    const next = new Set(value);
    if (checked) {
      next.add(key);
    } else {
      next.delete(key);
    }
    onChange([...next]);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{value.length} selected</span>
      </div>
      {permissions.loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : permissions.error !== undefined ? (
        <p role="alert" className="text-sm text-destructive">
          {permissions.error}
        </p>
      ) : (
        <>
          <Input
            aria-label="Search scopes"
            placeholder="Search scopes"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border p-3">
            {grouped.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scopes match.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {grouped.map(([resource, actions]) => (
                  <div key={resource} className="flex flex-col gap-1.5">
                    <span className="font-mono text-xs text-muted-foreground">{resource}</span>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {actions.map((action) => (
                        <label
                          key={action.key}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={selected.has(action.key)}
                            onCheckedChange={(checked) => toggle(action.key, checked)}
                            aria-label={`Grant ${action.key}`}
                          />
                          <span className="font-mono text-xs">{action.action}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
