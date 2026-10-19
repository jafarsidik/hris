import type { AuditLogReadModel } from '@hris/shared-types';

import { apiRequestV1 } from '@/lib/api/client-config';

export interface AuditLogPage {
  readonly items: readonly AuditLogReadModel[];
  readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
}

export const tenantActivityApi = {
  list: (params?: {
    readonly action?: string;
    readonly resource?: string;
    readonly actorUserId?: string;
    readonly limit?: number;
    readonly cursor?: string;
  }): Promise<AuditLogPage> => {
    const qs = new URLSearchParams();
    if (params?.action) qs.set('action', params.action);
    if (params?.resource) qs.set('resource', params.resource);
    if (params?.actorUserId) qs.set('actorUserId', params.actorUserId);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.cursor) qs.set('cursor', params.cursor);
    const url = qs.toString() === '' ? '/logs/audit' : `/logs/audit?${qs.toString()}`;
    return apiRequestV1<AuditLogPage>(url);
  },
};
