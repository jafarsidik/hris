import { apiRequestV1 } from '@/lib/api/client-config';

export const userGroupsApi = {
  list: (): Promise<unknown[]> => apiRequestV1('/user-groups'),
  get: (id: string) => apiRequestV1(`/user-groups/${encodeURIComponent(id)}`),
  create: (input: { name: string; description?: string | null }) =>
    apiRequestV1('/user-groups', { method: 'POST', body: input }),
  update: (id: string, patch: { name?: string; description?: string | null }) =>
    apiRequestV1(`/user-groups/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }),
  remove: (id: string) =>
    apiRequestV1<never>(`/user-groups/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  members: (id: string) => apiRequestV1('/user-groups/' + encodeURIComponent(id) + '/members'),
  addMember: (groupId: string, userId: string) =>
    apiRequestV1(`/user-groups/${encodeURIComponent(groupId)}/members`, {
      method: 'POST',
      body: { userId },
    }),
  removeMember: (groupId: string, userId: string) =>
    apiRequestV1<never>(
      `/user-groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    ),
};

export const dataPoliciesApi = {
  list: (): Promise<unknown[]> => apiRequestV1('/data-policies'),
  create: (input: {
    name: string;
    description?: string | null;
    classification?: string;
    targetResource: string;
    maskingAction?: string;
    isEnabled?: boolean;
  }) => apiRequestV1('/data-policies', { method: 'POST', body: input }),
  update: (id: string, patch: Record<string, unknown>) =>
    apiRequestV1(`/data-policies/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }),
  remove: (id: string) =>
    apiRequestV1<never>(`/data-policies/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
