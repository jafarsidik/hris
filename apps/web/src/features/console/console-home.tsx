'use client';

import { ArrowRight, CircleCheck, CircleDashed } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import type { ResourceSummary } from '@hris/shared-types';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/features/auth/session-context';
import { platformApi } from '@/features/platform/platform-api';
import { consoleFor, holdsPermission, type ConsoleItem } from '@/lib/console';
import { registryConsoleItems } from '@/lib/registry-console';

/**
 * The administration console home: a single index of the ten configuration sections.
 *
 * It reads the caller's effective permissions from the session and filters items through
 * {@link consoleFor}, so a reader without `role.view` does not see a link to a screen the
 * API would refuse. It also pulls the live platform registry and derives an entry for
 * every registered CRUD resource the caller may view, so a resource registered at runtime
 * appears without a code change. The API authorises every request independently; this is a
 * navigation convenience, not a control.
 */
export function ConsoleHome() {
  const { state } = useSession();
  const permissions = useMemo(
    () => (state.status === 'authenticated' ? state.session.permissions : []),
    [state],
  );
  const canReadRegistry = holdsPermission(permissions, 'registry.view');
  const [resources, setResources] = useState<readonly ResourceSummary[]>([]);

  useEffect(() => {
    if (!canReadRegistry) {
      setResources([]);
      return;
    }
    let active = true;
    platformApi
      .listRegistryResources()
      .then((rows) => {
        if (active) {
          setResources(rows);
        }
      })
      .catch(() => {
        // The registry is an enhancement to navigation, not a dependency of it: a failed
        // read leaves the curated sections intact rather than blocking the console.
        if (active) {
          setResources([]);
        }
      });
    return () => {
      active = false;
    };
  }, [canReadRegistry]);

  const sections = useMemo(
    () => consoleFor(permissions, registryConsoleItems(resources, permissions)),
    [permissions, resources],
  );

  if (state.status === 'loading') {
    return (
      <div className="space-y-6">
        <PageHeader title="Console" description="Configure and operate the platform." />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="rounded-xl border p-6 shadow-sm">
              <div className="space-y-2">
                <div className="h-4 w-1/3 rounded bg-muted" />
                <div className="h-4 w-1/2 rounded bg-muted" />
                <div className="h-4 w-2/3 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Console"
        description="Ten sections covering every administrative surface of the platform."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <section key={section.id} aria-labelledby={section.id} className="min-w-0">
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle id={section.id} className="text-base">
                    {section.label}
                  </CardTitle>
                  <SectionStatus items={section.items} />
                </div>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {section.isEmpty ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing here is available to your account.
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {section.items.map((item) => (
                      <li key={item.label}>
                        <ConsoleEntry item={item} />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * The built/planned roll-up for one section.
 *
 * A section with nothing built yet is a roadmap entry, not a fault, so it reads `warning`
 * rather than `destructive`; a fully built section is `success`, and a partly built one is
 * neutral. The count is always shown so the label reads as a fact, not a mood.
 */
function SectionStatus({ items }: { items: readonly ConsoleItem[] }) {
  const built = items.filter((item) => item.status === 'built').length;
  const total = items.length;
  const variant = built === 0 ? 'warning' : built === total ? 'success' : 'secondary';
  return (
    <Badge variant={variant} className="shrink-0">
      {built}/{total} built
    </Badge>
  );
}

/**
 * A single console entry, built or planned.
 *
 * Both states share one layout — icon, label, description — so the section reads as a
 * consistent list. A built entry is a link with a leading check and a trailing arrow; a
 * planned entry is inert, with a dashed circle and a `Planned` tag. The check/dashed pair
 * matches the sidebar, so the same surface looks the same wherever it appears.
 */
function ConsoleEntry({ item }: { item: ConsoleItem }) {
  const built = item.href !== undefined;

  const body = (
    <>
      {built ? (
        <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
      ) : (
        <CircleDashed aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{item.label}</span>
        <span className="block truncate text-xs font-normal text-muted-foreground">
          {item.description}
        </span>
      </span>
    </>
  );

  if (item.href === undefined) {
    return (
      <span className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground">
        {body}
        <span className="shrink-0 text-xs">Planned</span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      className="group flex items-start gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none"
    >
      {body}
      <ArrowRight
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </Link>
  );
}
