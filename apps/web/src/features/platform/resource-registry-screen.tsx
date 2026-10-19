'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import type { ModuleSummary, ResourceSummary } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
import { ResourceFieldsTable } from '@/components/metadata/resource-fields-table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight } from 'lucide-react';

import { useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { platformApi } from '@/features/platform/platform-api';
import { RegistryAdmin, ResourceMetadataForms } from '@/features/platform/registry-admin';

/**
 * Resource registry (System -> Application & Metadata).
 *
 * Shows the applications, modules and resources the platform knows about and lets an
 * operator register new metadata (application, module, resource, field, action) without
 * editing platform source. Access is gated on `registry:view` / `registry:create` /
 * `registry:update`, which the API enforces.
 */
export function ResourceRegistryScreen() {
  const router = useRouter();
  const { state } = useSession();

  const applications = useIamLoad(() => platformApi.listRegistryApplications(), []);
  const modules = useIamLoad(() => platformApi.listRegistryModules(), []);
  const resources = useIamLoad(() => platformApi.listRegistryResources(), []);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const error = applications.error ?? modules.error ?? resources.error;
  const loading = applications.loading || modules.loading || resources.loading;
  const groups = groupByModule(resources.data ?? [], modules.data ?? []);

  const reloadAll = useCallback(() => {
    applications.reload();
    modules.reload();
    resources.reload();
  }, [applications, modules, resources]);

  return (
    <PageBody>
      <PageHeader
        title="Resource registry"
        description="Applications, modules and the resources they expose."
      />

      {error !== undefined ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <RegistryAdmin
        applications={applications.data ?? []}
        modules={modules.data ?? []}
        onChanged={reloadAll}
      />

      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
          <CardDescription>Deployed applications registered on the platform.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-10 w-full" />
          ) : (applications.data ?? []).length === 0 ? (
            <EmptyState title="No applications are registered" />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {(applications.data ?? []).map((application) => (
                <li key={application.id} className="flex flex-col gap-0.5 py-3">
                  <span className="text-sm font-medium">{application.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{application.key}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        groups.map((group) => (
          <Card key={group.key ?? 'unassigned'}>
            <CardHeader>
              <CardTitle>{group.name}</CardTitle>
              <CardDescription>
                {group.resources.length} resource{group.resources.length === 1 ? '' : 's'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col divide-y divide-border">
                {group.resources.map((resource) => (
                  <li key={resource.id} className="py-3">
                    <Collapsible>
                      <CollapsibleTrigger className="flex w-full flex-wrap items-center justify-between gap-3 text-left">
                        <div className="flex items-center gap-2">
                          <ChevronRight
                            aria-hidden="true"
                            className="size-4 shrink-0 text-muted-foreground"
                          />
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">{resource.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {resource.key}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{resource.resourceType}</Badge>
                          {resource.supportsCrud ? <Badge variant="secondary">CRUD</Badge> : null}
                          <Badge variant="secondary">
                            {resource.fields.length} field{resource.fields.length === 1 ? '' : 's'}
                          </Badge>
                          <Badge variant="secondary">
                            {resource.actions.length} action
                            {resource.actions.length === 1 ? '' : 's'}
                          </Badge>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3 pl-6">
                        <ResourceFieldsTable resource={resource} />
                        <ResourceMetadataForms resource={resource} onChanged={reloadAll} />
                      </CollapsibleContent>
                    </Collapsible>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </PageBody>
  );
}

interface ResourceGroup {
  readonly key: string | null;
  readonly name: string;
  readonly resources: readonly ResourceSummary[];
}

/**
 * Groups resources by owning module, ordered by the module's declared sort order.
 * Resources with no module fall into a trailing "Unassigned" group.
 */
function groupByModule(
  resources: readonly ResourceSummary[],
  modules: readonly ModuleSummary[],
): readonly ResourceGroup[] {
  const names = new Map(modules.map((module) => [module.key, module.name]));
  const order = new Map(modules.map((module, index) => [module.key, index]));

  const groups = new Map<string | null, ResourceSummary[]>();
  for (const resource of resources) {
    const key = resource.moduleKey;
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(resource);
    } else {
      groups.set(key, [resource]);
    }
  }

  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === null) {
        return 1;
      }
      if (b === null) {
        return -1;
      }
      return (order.get(a) ?? 0) - (order.get(b) ?? 0);
    })
    .map(([key, groupResources]) => ({
      key,
      name: key === null ? 'Unassigned' : (names.get(key) ?? key),
      resources: groupResources,
    }));
}
