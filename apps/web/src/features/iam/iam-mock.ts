import type {
  AuditLogReadModel,
  LogEvent,
  Paginated,
  SystemSettingReadModel,
} from '@hris/shared-types';

import type {
  CreateRoleInput,
  CreateUserInput,
  IamRepository,
  LogFilter,
  ManageableUserStatus,
  PageInput,
  PermissionGrantInput,
  RoleDetail,
  RoleSummary,
  SettingUpdateInput,
  UpdateRoleInput,
  UpdateUserInput,
  UserSummary,
} from './iam-types';

/**
 * Offline Administration data for previews and tests.
 *
 * Serves a fixed, honest sample of the same read models the API returns so the
 * screens can be developed and exercised without the API running. `result` is
 * deliberately static: nothing here should be mistaken for real data.
 */
const SETTINGS: readonly SystemSettingReadModel[] = [
  {
    group: 'general',
    key: 'company.displayName',
    value: 'PT Contoh Nusantara',
    valueType: 'STRING',
    isSensitive: false,
    isEditable: true,
    description: 'The display name shown on the sign-in screen.',
  },
  {
    group: 'general',
    key: 'company.language',
    value: 'id-ID',
    valueType: 'STRING',
    isSensitive: false,
    isEditable: true,
    description: 'Default language for new employees.',
  },
  {
    group: 'email',
    key: 'email.senderAddress',
    value: 'hris@contoh.local',
    valueType: 'STRING',
    isSensitive: false,
    isEditable: true,
    description: 'Sender address for system notifications.',
  },
  {
    group: 'email',
    key: 'email.smtpPassword',
    value: '••••••••',
    valueType: 'STRING',
    isSensitive: true,
    isEditable: true,
    description: 'SMTP password (masked; leave blank to keep the stored value).',
  },
];

const USERS: readonly UserSummary[] = [
  {
    id: 'user-1',
    email: 'admin@contoh.local',
    displayName: 'Administrator',
    status: 'ACTIVE',
    hasVerifiedEmail: true,
    lastLoginAt: new Date().toISOString(),
    roles: [{ key: 'SYSTEM_ADMIN', name: 'System Administrator' }],
    createdAt: '2026-01-05T00:00:00.000Z',
  },
];

const ROLES: readonly RoleSummary[] = [
  {
    id: 'role-1',
    key: 'SYSTEM_ADMIN',
    name: 'System Administrator',
    description: 'Full administrative access to every module.',
    isSystem: true,
    memberCount: 1,
    permissionCount: 0,
  },
];

function emptyPage<T>(items: readonly T[]): Paginated<T> {
  return { items, pageInfo: { hasNextPage: false, endCursor: null } };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const mockIamRepository: IamRepository = {
  async listUsers(input, page) {
    void page;
    const search = input.search?.toLowerCase();
    const filtered = search
      ? USERS.filter((user) => user.displayName.toLowerCase().includes(search))
      : USERS;
    void input.status;
    return emptyPage(clone(filtered));
  },

  async createUser(input: CreateUserInput) {
    const user: UserSummary = {
      id: `user-${USERS.length + 1}`,
      email: input.email,
      displayName: input.displayName,
      status: 'INVITED',
      hasVerifiedEmail: false,
      lastLoginAt: null,
      roles: [],
      createdAt: new Date().toISOString(),
    };
    return { user, inviteToken: `mock-invite-${user.id}` };
  },

  async updateUser(_userId, _input: UpdateUserInput) {
    return clone(USERS[0] as UserSummary);
  },

  async changeUserStatus(_userId, _status: ManageableUserStatus) {
    // nothing to mutate offline
  },

  async listRoles() {
    return clone(ROLES);
  },

  async getRole(roleId) {
    const role = ROLES.find((candidate) => candidate.id === roleId);
    if (!role) throw new Error('Role not found');
    return { ...clone(role), grants: [] };
  },

  async createRole(_input: CreateRoleInput): Promise<RoleSummary> {
    return {
      id: 'role-new',
      key: 'CUSTOM',
      name: 'New Role',
      description: '',
      isSystem: false,
      memberCount: 0,
      permissionCount: 0,
    };
  },

  async updateRole(_roleId, _input: UpdateRoleInput): Promise<RoleSummary> {
    return clone(ROLES[0] as RoleSummary);
  },

  async replaceRolePermissions(
    _roleId,
    grants: readonly PermissionGrantInput[],
  ): Promise<RoleDetail> {
    return {
      ...clone(ROLES[0] as RoleSummary),
      grants: grants.map((grant) => ({
        permissionId: `permission-${grant.resource}-${grant.action}`,
        resource: grant.resource,
        action: grant.action,
        scope: grant.scope,
        scopeId: null,
      })),
    };
  },

  async deleteRole(_roleId) {
    // nothing to delete offline
  },

  async listPermissions() {
    return [
      { id: 'permission-1', key: 'user:view', resource: 'user', action: 'view' },
      { id: 'permission-2', key: 'user:create', resource: 'user', action: 'create' },
      { id: 'permission-3', key: 'role:view', resource: 'role', action: 'view' },
      { id: 'permission-4', key: 'setting:manage', resource: 'setting', action: 'manage' },
      { id: 'permission-5', key: 'audit-log:view', resource: 'audit-log', action: 'view' },
    ];
  },

  async listSettings(group?: string) {
    const settings = group ? SETTINGS.filter((setting) => setting.group === group) : SETTINGS;
    return clone(settings);
  },

  async updateSettings(items: readonly SettingUpdateInput[]) {
    const stored = SETTINGS[0];
    return clone(stored ? items.map(() => stored) : []);
  },

  async listEvents(filter: LogFilter, page: PageInput): Promise<Paginated<LogEvent>> {
    void page;
    const events: LogEvent[] = [
      {
        id: 'event-1',
        category: 'SECURITY',
        eventType: 'user.login',
        actorUserId: 'user-1',
        actorDisplayName: 'Administrator',
        resource: null,
        resourceId: null,
        status: 'SUCCESS',
        metadata: null,
        ipAddress: null,
        userAgent: null,
        requestId: null,
        createdAt: new Date().toISOString(),
      },
    ];
    const filtered = filter.category
      ? events.filter((event) => event.category === filter.category)
      : events;
    return emptyPage(filtered);
  },

  async listAudit(
    _filter: { resource?: string; action?: string },
    page: PageInput,
  ): Promise<Paginated<AuditLogReadModel>> {
    void page;
    return emptyPage([]);
  },
};
