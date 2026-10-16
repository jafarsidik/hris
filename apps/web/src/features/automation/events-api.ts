import type { EventRegistrySnapshot } from '@hris/shared-types';

import { apiRequestV1 } from '@/lib/api/client-config';

export interface EventFilter {
  readonly type?: string;
  readonly resource?: string;
  readonly resourceId?: string;
  readonly pendingOnly?: boolean;
  readonly limit?: number;
}

const query = (params: Readonly<Record<string, string | number | boolean | undefined>>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }
    search.set(key, String(value));
  }
  const rendered = search.toString();
  return rendered.length === 0 ? '' : `?${rendered}`;
};

export const eventsApi = {
  list: (filter: EventFilter = {}): Promise<EventRegistrySnapshot> =>
    apiRequestV1<EventRegistrySnapshot>(
      `/events${query({
        type: filter.type,
        resource: filter.resource,
        resourceId: filter.resourceId,
        pendingOnly: filter.pendingOnly,
        limit: filter.limit,
      })}`,
    ),

  retry: (id: string): Promise<void> =>
    apiRequestV1<never>(`/events/${encodeURIComponent(id)}/retry`, { method: 'POST' }),
};
