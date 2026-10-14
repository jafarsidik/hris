import type {
  AuditLogReadModel,
  DataScope,
  LogEvent,
  Paginated,
  SystemSettingReadModel,
} from '@hris/shared-types';

/** Read models returned by the Administration API (mirrors the API contracts). */
export interface UserSummary {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  readonly hasVerifiedEmail: boolean;
  readonly lastLoginAt: string | null;
  readonly roles: readonly { readonly key: string; readonly name: string }[];
  readonly createdAt: string;
}

export type ManageableUserStatus = 'ACTIVE' | 'SUSPENDED' | 'DISABLED';

export interface RoleSummary {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly isSystem: boolean;
  readonly memberCount: number;
  readonly permissionCount: number;
}

export interface RoleDetail extends RoleSummary {
  readonly grants: readonly {
    readonly permissionId: string;
    readonly resource: string;
    readonly action: string;
    readonly scope: DataScope;
    readonly scopeId: string | null;
  }[];
}

export interface PermissionRow {
  readonly id: string;
  readonly key: string;
  readonly resource: string;
  readonly action: string;
}

export interface PermissionGrantInput {
  readonly resource: string;
  readonly action: string;
  readonly scope: DataScope;
  readonly scopeId?: string;
}

export interface CreateUserInput {
  readonly email: string;
  readonly displayName: string;
  readonly roleIds: readonly string[];
}

export interface UpdateUserInput {
  readonly displayName?: string;
  readonly roleIds?: readonly string[];
}

export interface CreateRoleInput {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly permissions?: readonly PermissionGrantInput[];
}

export interface UpdateRoleInput {
  readonly name: string;
  readonly description: string;
}

export interface SettingUpdateInput {
  readonly key: string;
  readonly value: unknown;
}

export interface LogFilter {
  readonly category?: string;
  readonly resource?: string;
  readonly status?: string;
  readonly action?: string;
}

export interface IamRepository {
  listUsers(
    input: { search?: string; status?: UserSummary['status'] },
    page: PageInput,
  ): Promise<Paginated<UserSummary>>;
  createUser(input: CreateUserInput): Promise<{ user: UserSummary; inviteToken: string }>;
  updateUser(userId: string, input: UpdateUserInput): Promise<UserSummary>;
  changeUserStatus(userId: string, status: ManageableUserStatus): Promise<void>;
  listRoles(): Promise<readonly RoleSummary[]>;
  getRole(roleId: string): Promise<RoleDetail>;
  createRole(input: CreateRoleInput): Promise<RoleSummary>;
  updateRole(roleId: string, input: UpdateRoleInput): Promise<RoleSummary>;
  replaceRolePermissions(
    roleId: string,
    grants: readonly PermissionGrantInput[],
  ): Promise<RoleDetail>;
  deleteRole(roleId: string): Promise<void>;
  listPermissions(): Promise<readonly PermissionRow[]>;
  listSettings(group?: string): Promise<readonly SystemSettingReadModel[]>;
  updateSettings(items: readonly SettingUpdateInput[]): Promise<readonly SystemSettingReadModel[]>;
  listEvents(filter: LogFilter, page: PageInput): Promise<Paginated<LogEvent>>;
  listAudit(
    filter: { resource?: string; action?: string },
    page: PageInput,
  ): Promise<Paginated<AuditLogReadModel>>;
}

export interface PageInput {
  readonly limit?: number;
  readonly cursor?: string;
}
