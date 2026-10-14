'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import type { ResourceSummary } from '@hris/shared-types';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/features/auth/session-context';
import { platformApi } from '@/features/platform/platform-api';
import { consoleFor, holdsPermission } from '@/lib/console';
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
                <CardTitle id={section.id} className="text-base">
                  {section.label}
                </CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {section.isEmpty ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing here is available to your account.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {section.items.map((item) => (
                      <li key={item.label}>
                        {item.href === undefined ? (
                          <span className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground">
                            <span className="truncate">{item.label}</span>
                            <span className="shrink-0 text-xs">Planned</span>
                          </span>
                        ) : (
                          <Link
                            href={item.href}
                            className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none"
                          >
                            <span className="min-w-0">
                              <span className="block truncate">{item.label}</span>
                              <span className="block truncate text-xs font-normal text-muted-foreground">
                                {item.description}
                              </span>
                            </span>
                            <ArrowRight
                              aria-hidden="true"
                              className="size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                            />
                          </Link>
                        )}
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
