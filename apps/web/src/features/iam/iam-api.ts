import type {
  AuditLogReadModel,
  LogEvent,
  Paginated,
  SystemSettingReadModel,
} from '@hris/shared-types';

import { apiRequestV1 } from '@/lib/api/client-config';

import type {
  CreateRoleInput,
  IamRepository,
  LogFilter,
  ManageableUserStatus,
  PageInput,
  PermissionGrantInput,
  PermissionRow,
  RoleDetail,
  RoleSummary,
  SettingUpdateInput,
  UpdateRoleInput,
  UserSummary,
} from './iam-types';

function paginate(page: PageInput): { limit: number; cursor?: string } {
  return page.cursor
    ? { limit: page.limit ?? 20, cursor: page.cursor }
    : { limit: page.limit ?? 20 };
}

/**
 * Administration data against the live API.
 *
 * Browser calls carry the `hris_session` cookie, so no bearer token is attached here.
 */
export const apiIamRepository: IamRepository = {
  async listUsers(input, page) {
    const params = new URLSearchParams();
    if (input.search) params.set('search', input.search);
    if (input.status) params.set('status', input.status);
    params.set('limit', String(page.limit ?? 20));
    if (page.cursor) params.set('cursor', page.cursor);
    return apiRequestV1<Paginated<UserSummary>>(`/users?${params.toString()}`);
  },

  async createUser(input) {
    return apiRequestV1<{ user: UserSummary; inviteToken: string }>('/users', {
      method: 'POST',
      body: { ...input, roleIds: [...input.roleIds] },
    });
  },

  async updateUser(userId, input) {
    return apiRequestV1<UserSummary>(`/users/${userId}`, {
      method: 'PATCH',
      body: { ...input, roleIds: input.roleIds ? [...input.roleIds] : undefined },
    });
  },

  async changeUserStatus(userId, status: ManageableUserStatus) {
    await apiRequestV1<never>(`/users/${userId}/status`, { method: 'POST', body: { status } });
  },

  async listRoles() {
    return apiRequestV1<readonly RoleSummary[]>('/roles');
  },

  async getRole(roleId) {
    return apiRequestV1<RoleDetail>(`/roles/${roleId}`);
  },

  async createRole(input: CreateRoleInput) {
    return apiRequestV1<RoleSummary>('/roles', {
      method: 'POST',
      body: { ...input, permissions: input.permissions ? [...input.permissions] : undefined },
    });
  },

  async updateRole(roleId, input: UpdateRoleInput) {
    return apiRequestV1<RoleSummary>(`/roles/${roleId}`, { method: 'PATCH', body: input });
  },

  async replaceRolePermissions(roleId, grants: readonly PermissionGrantInput[]) {
    return apiRequestV1<RoleDetail>(`/roles/${roleId}/permissions`, {
      method: 'PUT',
      body: { permissions: [...grants] },
    });
  },

  async deleteRole(roleId) {
    await apiRequestV1<never>(`/roles/${roleId}`, { method: 'DELETE' });
  },

  async listPermissions() {
    return apiRequestV1<readonly PermissionRow[]>('/permissions');
  },

  async listSettings(group) {
    return apiRequestV1<readonly SystemSettingReadModel[]>(
      group ? `/settings/${group}` : '/settings',
    );
  },

  async updateSettings(items: readonly SettingUpdateInput[]) {
    return apiRequestV1<readonly SystemSettingReadModel[]>('/settings', {
      method: 'PUT',
      body: { items: [...items] },
    });
  },

  async listEvents(filter: LogFilter, page: PageInput) {
    const params = new URLSearchParams();
    if (filter.category) params.set('category', filter.category);
    if (filter.resource) params.set('resource', filter.resource);
    if (filter.status) params.set('status', filter.status);
    const p = paginate(page);
    params.set('limit', String(p.limit));
    if (p.cursor) params.set('cursor', p.cursor);
    return apiRequestV1<Paginated<LogEvent>>(`/logs?${params.toString()}`);
  },

  async listAudit(filter: { resource?: string; action?: string }, page: PageInput) {
    const params = new URLSearchParams();
    if (filter.resource) params.set('resource', filter.resource);
    if (filter.action) params.set('action', filter.action);
    const p = paginate(page);
    params.set('limit', String(p.limit));
    if (p.cursor) params.set('cursor', p.cursor);
    return apiRequestV1<Paginated<AuditLogReadModel>>(`/logs/audit?${params.toString()}`);
  },
};
