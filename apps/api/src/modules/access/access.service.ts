import { Inject, Injectable } from '@nestjs/common';

import { Prisma, findOrgUnitEntity, findOrgUnitSubtree, withTenantContext } from '@hris/database';
import {
  type DataScope,
  type SessionInfo,
  LOG_EVENT_TYPES,
  buildPage,
  cursorFingerprint,
  isAction,
  isDataScope,
  isResource,
  resolveCursor,
  type PageParams,
  type Paginated,
  type PermissionGrant,
  type EffectivePermission,
} from '@hris/shared-types';

import { PrismaService } from '../database/prisma.service';
import { LogService } from '../logs/log.service';
import { NotificationService } from '../notifications/notification.service';
import { resolveScope, canGrant, type ScopeDecision } from '../../common/auth/data-scope';
import { PasswordService } from '../../common/auth/password.service';
import { SESSION_STORE, type SessionStore } from '../../common/auth/session.store';
import { type SessionPrincipal } from '../../common/auth/permission.service';
import {
  ConflictError,
  NotFoundError,
  ForbiddenError,
  OutOfScopeError,
  ValidationError,
} from '../../common/errors/app-error';

export type ManageableUserStatus = 'ACTIVE' | 'SUSPENDED' | 'DISABLED';

export interface UserSummary {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  readonly hasVerifiedEmail: boolean;
  readonly lastLoginAt: string | null;
  readonly organizationalUnitId: string | null;
  readonly organizationalUnit: {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly type: string;
  } | null;
  readonly roles: readonly { readonly key: string; readonly name: string }[];
  readonly createdAt: string;
}

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

const USER_SORT = { createdAt: 'desc', id: 'desc' } as const;

/** The user projection every read path shares, including the placed unit. */
const USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  status: true,
  hasVerifiedEmail: true,
  lastLoginAt: true,
  organizationalUnitId: true,
  createdAt: true,
  unit: { select: { id: true, code: true, name: true, type: true } },
  roles: { select: { role: { select: { key: true, name: true } } } },
} as const;

/**
 * Administration of users, roles and permissions (brief, Administration).
 *
 * User records are tenancy-isolated by RLS, so every read and mutation runs inside
 * `withTenantContext`. Roles and permissions are platform-wide reference data without
 * RLS (they have no company column); the *grants* are what a tenant owns, and they are
 * only mutated here with the tenant context set.
 */
@Injectable()
export class AccessService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(SESSION_STORE) private readonly sessionStore: SessionStore,
    @Inject(NotificationService) private readonly notifications: NotificationService,
  ) {}

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------

  async listUsers(
    companyId: string,
    principal: SessionPrincipal,
    filter: {
      search?: string;
      status?: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
      roleKey?: string;
      organizationalUnitId?: string;
    },
    params: PageParams,
  ): Promise<Paginated<UserSummary>> {
    const client = this.prisma.getClient();
    const decision = resolveScope(principal.permissions, 'user', 'view', {
      userId: principal.user.id,
      unitId: principal.user.organizationalUnitId,
    });
    if (decision.kind === 'denied') {
      throw new OutOfScopeError(
        `Your "${decision.scope ?? 'unresolved'}" scope for user.view cannot be resolved.`,
      );
    }

    const fingerprint = cursorFingerprint({ filters: { ...filter, companyId }, sort: USER_SORT });
    const resolved = resolveCursor(params.cursor, fingerprint);
    if (!resolved.ok) {
      throw new ValidationError('The pagination cursor does not match the current filters');
    }

    const rows = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await userScopeWhere(tx, decision);
      return tx.user.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...scopeWhere,
          ...(filter.search ? { OR: searchWhere(filter.search) } : {}),
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.roleKey ? { roles: { some: { role: { key: filter.roleKey } } } } : {}),
          ...(filter.organizationalUnitId
            ? { organizationalUnitId: filter.organizationalUnitId }
            : {}),
          ...(resolved.cursor.position.values.length > 0
            ? afterUserCursor(resolved.cursor.position.values)
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: USER_SELECT,
      });
    });

    const items = rows.map(toUserSummary);
    return buildPage(items, params, fingerprint, (item) => ({
      values: [item.createdAt, item.id],
    }));
  }

  async getUser(
    companyId: string,
    principal: SessionPrincipal,
    userId: string,
  ): Promise<UserSummary> {
    const decision = resolveScope(principal.permissions, 'user', 'view', {
      userId: principal.user.id,
      unitId: principal.user.organizationalUnitId,
    });
    if (decision.kind === 'denied') {
      throw new OutOfScopeError(
        `Your "${decision.scope ?? 'unresolved'}" scope for user.view cannot be resolved.`,
      );
    }
    if (decision.kind === 'self' && decision.userId !== userId) {
      throw new OutOfScopeError('You can only view your own user record.');
    }

    const client = this.prisma.getClient();
    const user = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await userScopeWhere(tx, decision);
      return tx.user.findFirst({
        where: {
          id: userId,
          companyId,
          deletedAt: null,
          ...scopeWhere,
        },
        select: USER_SELECT,
      });
    });
    if (!user) {
      throw new NotFoundError('The user does not exist.');
    }
    return toUserSummary(user);
  }

  /**
   * Creates an active user with the chosen roles and an administrator-set password.
   *
   * There is no invitation step: the account is usable the moment it is created, so the
   * administrator must share the initial password out of band and the new member changes
   * it themselves afterwards.
   */
  async createUser(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      email: string;
      displayName: string;
      roleIds: readonly string[];
      password: string;
      organizationalUnitId?: string | null;
    },
  ): Promise<UserSummary> {
    const client = this.prisma.getClient();
    const actorUserId = principal.user.id;
    const email = input.email.trim().toLowerCase();

    const existing = await this.findUserByEmail(email);
    if (existing) {
      throw new ConflictError('A user with this email already exists.');
    }

    const passwordHash = await this.passwords.hashPassword(input.password);

    const user = await withTenantContext(client, companyId, async (tx) => {
      const unitId = await this.resolveAssignableUnit(tx, companyId, principal, input);
      const created = await tx.user.create({
        data: {
          companyId,
          email,
          displayName: input.displayName,
          status: 'ACTIVE',
          hasVerifiedEmail: true,
          passwordHash,
          passwordChangedAt: new Date(),
          createdBy: actorUserId,
          ...(unitId === undefined ? {} : { organizationalUnitId: unitId }),
        },
        select: USER_SELECT,
      });

      await this.syncUserRoles(tx, created.id, companyId, principal, input.roleIds);
      return created;
    });

    await this.logs.recordEvent(companyId, {
      category: 'ACCESS',
      eventType: LOG_EVENT_TYPES['user.created'],
      actorUserId,
      resource: 'user',
      resourceId: user.id,
      status: 'SUCCESS',
    });
    await this.logs.writeAudit(companyId, {
      actorUserId,
      action: 'user.create',
      resource: 'user',
      resourceId: user.id,
      payload: { email, displayName: input.displayName, roles: input.roleIds },
    });

    await this.notifications.emit(companyId, user.id, {
      eventKey: 'user.welcome',
      userId: user.id,
      href: '/dashboard',
    });

    return toUserSummary(user);
  }

  async updateUser(
    companyId: string,
    principal: SessionPrincipal,
    userId: string,
    input: {
      displayName?: string;
      roleIds?: readonly string[];
      organizationalUnitId?: string | null;
    },
  ): Promise<UserSummary> {
    const client = this.prisma.getClient();
    const actorUserId = principal.user.id;
    const user = await withTenantContext(client, companyId, async (tx) => {
      const current = await tx.user.findFirst({
        where: { id: userId, companyId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!current) {
        throw new NotFoundError('The user does not exist.');
      }

      const unitId = await this.resolveAssignableUnit(tx, companyId, principal, input, 'update');
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
          ...(unitId === undefined ? {} : { organizationalUnitId: unitId }),
          createdBy: actorUserId,
        },
        select: USER_SELECT,
      });

      if (input.roleIds !== undefined) {
        await this.syncUserRoles(tx, userId, companyId, principal, input.roleIds);
      }
      return updated;
    });

    await this.logs.recordEvent(companyId, {
      category: 'ACCESS',
      eventType: LOG_EVENT_TYPES['user.updated'],
      actorUserId,
      resource: 'user',
      resourceId: userId,
      status: 'SUCCESS',
      metadata: {
        displayNameChanged: input.displayName !== undefined,
        rolesReplaced: input.roleIds !== undefined,
        unitChanged: input.organizationalUnitId !== undefined,
      },
    });
    await this.logs.writeAudit(companyId, {
      actorUserId,
      action: 'user.update',
      resource: 'user',
      resourceId: userId,
      payload: {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.organizationalUnitId !== undefined
          ? { organizationalUnitId: input.organizationalUnitId }
          : {}),
      },
    });

    if (input.roleIds !== undefined) {
      await this.notifications.emit(companyId, actorUserId, {
        eventKey: 'role.changed',
        userId,
        href: '/settings/profile',
      });
    }

    return toUserSummary(user);
  }

  /**
   * Resolves the unit to place a user in, returning `undefined` when the caller did not
   * specify one (so the column is left untouched), `null` when they explicitly cleared it,
   * and the validated id otherwise.
   *
   * A non-null unit must exist in the tenant *and* fall inside the caller's `user` data
   * scope: a delegated administrator who can only see their own subtree must not be able
   * to place a member outside it. `self` scope confines the placement to the caller's own
   * unit; `subtree`/`entity` resolve through the organizational tree.
   */
  private async resolveAssignableUnit(
    tx: Prisma.TransactionClient,
    companyId: string,
    principal: SessionPrincipal,
    input: { readonly organizationalUnitId?: string | null },
    action: 'create' | 'update' = 'create',
  ): Promise<string | null | undefined> {
    if (input.organizationalUnitId === undefined) {
      return undefined;
    }
    if (input.organizationalUnitId === null) {
      return null;
    }

    const unit = await tx.organizationalUnit.findFirst({
      where: { id: input.organizationalUnitId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!unit) {
      throw new ValidationError('The selected organizational unit does not exist.');
    }

    const decision = resolveScope(principal.permissions, 'user', action, {
      userId: principal.user.id,
      unitId: principal.user.organizationalUnitId,
    });
    switch (decision.kind) {
      case 'all':
        return unit.id;
      case 'self':
        if (unit.id !== principal.user.organizationalUnitId) {
          throw new OutOfScopeError('You can only place users in your own organizational unit.');
        }
        return unit.id;
      case 'subtree': {
        const subtree = await findOrgUnitSubtree(tx, decision.rootUnitId);
        if (!subtree.includes(unit.id)) {
          throw new OutOfScopeError('That organizational unit is outside your permitted scope.');
        }
        return unit.id;
      }
      case 'entity': {
        const [rootEntity, unitEntity] = await Promise.all([
          findOrgUnitEntity(tx, decision.rootUnitId),
          findOrgUnitEntity(tx, unit.id),
        ]);
        if (rootEntity === null || rootEntity !== unitEntity) {
          throw new OutOfScopeError('That organizational unit is outside your permitted scope.');
        }
        return unit.id;
      }
      default:
        throw new OutOfScopeError(
          `Your "${decision.scope ?? 'unresolved'}" scope cannot place users.`,
        );
    }
  }

  async changeUserStatus(
    companyId: string,
    actorUserId: string,
    userId: string,
    status: ManageableUserStatus,
  ): Promise<void> {
    if (actorUserId === userId && status !== 'ACTIVE') {
      throw new ForbiddenError('You cannot disable your own account.');
    }

    const client = this.prisma.getClient();
    const target = await withTenantContext(client, companyId, async (tx) => {
      const current = await tx.user.findFirst({
        where: { id: userId, companyId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!current) {
        throw new NotFoundError('The user does not exist.');
      }

      const sendable = ['ACTIVE', 'SUSPENDED', 'DISABLED'] as const;
      if (!sendable.includes(status)) {
        throw new ValidationError('Only ACTIVE, SUSPENDED or DISABLED are valid statuses.');
      }

      await tx.user.update({ where: { id: userId }, data: { status } });

      // Suspending or disabling ends every live session immediately.
      if (status !== 'ACTIVE') {
        const sessions = await tx.session.findMany({
          where: { userId, revokedAt: null, deletedAt: null },
          select: { tokenHash: true },
        });
        for (const session of sessions) {
          await this.sessionStore.delete(session.tokenHash);
        }
        await tx.session.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return current;
    });

    await this.logs.recordEvent(companyId, {
      category: 'SECURITY',
      eventType: LOG_EVENT_TYPES['user.status_changed'],
      actorUserId,
      resource: 'user',
      resourceId: userId,
      status: 'SUCCESS',
      metadata: { previous: target.status, next: status },
    });
    await this.logs.writeAudit(companyId, {
      actorUserId,
      action: 'user.status_change',
      resource: 'user',
      resourceId: userId,
      payload: { previous: target.status, next: status },
    });
  }

  async listUserSessions(companyId: string, userId: string): Promise<SessionInfo[]> {
    const client = this.prisma.getClient();
    const rows = await withTenantContext(client, companyId, (tx) =>
      tx.session.findMany({
        where: { userId, companyId, revokedAt: null, deletedAt: null },
        orderBy: [{ lastSeenAt: 'desc' }],
        select: {
          id: true,
          userId: true,
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          lastSeenAt: true,
          expiresAt: true,
          revokedAt: true,
        },
      }),
    );

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      userAgent: row.userAgent,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
      isCurrent: false,
    }));
  }

  async revokeUserSession(
    companyId: string,
    actorUserId: string,
    userId: string,
    sessionId: string,
  ): Promise<void> {
    const client = this.prisma.getClient();
    const session = await withTenantContext(client, companyId, (tx) =>
      tx.session.findFirst({
        where: { id: sessionId, userId, companyId, revokedAt: null, deletedAt: null },
        select: { tokenHash: true },
      }),
    );
    if (!session) {
      throw new NotFoundError('The session does not exist or has already been revoked.');
    }

    await this.sessionStore.delete(session.tokenHash);
    await withTenantContext(client, companyId, (tx) =>
      tx.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } }),
    );

    await this.logs.recordEvent(companyId, {
      category: 'ACCESS',
      eventType: LOG_EVENT_TYPES['user.session_revoked'],
      actorUserId,
      resource: 'user',
      resourceId: userId,
      status: 'SUCCESS',
      metadata: { sessionId },
    });
  }

  // ---------------------------------------------------------------------------
  // Roles
  // ---------------------------------------------------------------------------

  async listRoles(companyId: string): Promise<RoleSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, (tx) =>
      tx.role.findMany({
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
        select: {
          id: true,
          key: true,
          name: true,
          description: true,
          isSystem: true,
          grants: { select: { id: true } },
          users: {
            where: { OR: [{ companyId: null }, { companyId }] },
            select: { id: true },
          },
        },
      }),
    ).then((rows) =>
      rows.map((row) => ({
        id: row.id,
        key: row.key,
        name: row.name,
        description: row.description,
        isSystem: row.isSystem,
        permissionCount: row.grants.length,
        memberCount: row.users.length,
      })),
    );
  }

  async getRole(companyId: string, roleId: string): Promise<RoleDetail> {
    const client = this.prisma.getClient();
    const role = await withTenantContext(client, companyId, (tx) =>
      tx.role.findFirst({
        where: { id: roleId },
        select: {
          id: true,
          key: true,
          name: true,
          description: true,
          isSystem: true,
          grants: {
            select: {
              permissionId: true,
              dataScope: true,
              scopeId: true,
              permission: { select: { resource: true, action: true } },
            },
          },
          users: {
            where: { OR: [{ companyId: null }, { companyId }] },
            select: { id: true },
          },
        },
      }),
    );
    if (!role) {
      throw new NotFoundError('The role does not exist.');
    }

    return {
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissionCount: role.grants.length,
      memberCount: role.users.length,
      grants: role.grants.map((grant) => ({
        permissionId: grant.permissionId,
        resource: grant.permission.resource,
        action: grant.permission.action,
        scope: grant.dataScope,
        scopeId: grant.scopeId,
      })),
    };
  }

  async createRole(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      key: string;
      name: string;
      description: string;
      permissions?: readonly PermissionGrant[];
    },
  ): Promise<RoleSummary> {
    const client = this.prisma.getClient();
    const actorUserId = principal.user.id;
    const key = input.key.trim().toUpperCase();

    const role = await withTenantContext(client, companyId, async (tx) => {
      const slug = key.replace(/[^A-Z0-9_]+/g, '_');
      if (slug.length === 0) {
        throw new ValidationError('The role key must contain letters or numbers.');
      }

      this.assertCanGrant(principal.permissions, input.permissions ?? []);

      const existing = await tx.role.findUnique({ where: { key: slug } });
      if (existing) {
        throw new ConflictError(`A role with the key "${slug}" already exists.`);
      }

      const created = await tx.role.create({
        data: {
          key: slug,
          name: input.name,
          description: input.description,
          createdBy: actorUserId,
        },
        select: { id: true, key: true, name: true },
      });

      if (input.permissions && input.permissions.length > 0) {
        await this.replaceGrants(tx, created.id, actorUserId, input.permissions);
      }

      return created;
    });

    await this.logs.recordEvent(companyId, {
      category: 'ACCESS',
      eventType: LOG_EVENT_TYPES['role.created'],
      actorUserId,
      resource: 'role',
      resourceId: role.id,
      status: 'SUCCESS',
      metadata: { key: role.key, grantCount: input.permissions?.length ?? 0 },
    });
    await this.logs.writeAudit(companyId, {
      actorUserId,
      action: 'role.create',
      resource: 'role',
      resourceId: role.id,
      payload: { key: role.key, name: input.name },
    });

    const summary = await this.getRoleSummary(companyId, role.id);
    return summary;
  }

  async updateRole(
    companyId: string,
    actorUserId: string,
    roleId: string,
    input: { name: string; description: string },
  ): Promise<RoleSummary> {
    const client = this.prisma.getClient();
    const role = await withTenantContext(client, companyId, async (tx) => {
      const current = await tx.role.findFirst({ where: { id: roleId } });
      if (!current) {
        throw new NotFoundError('The role does not exist.');
      }
      if (current.isSystem) {
        throw new ForbiddenError('System roles cannot be edited.');
      }
      return tx.role.update({
        where: { id: roleId },
        data: { name: input.name, description: input.description, createdBy: actorUserId },
        select: { id: true },
      });
    });

    await this.logs.recordEvent(companyId, {
      category: 'ACCESS',
      eventType: LOG_EVENT_TYPES['role.updated'],
      actorUserId,
      resource: 'role',
      resourceId: roleId,
      status: 'SUCCESS',
    });
    await this.logs.writeAudit(companyId, {
      actorUserId,
      action: 'role.update',
      resource: 'role',
      resourceId: roleId,
      payload: { name: input.name },
    });

    void role;
    return this.getRoleSummary(companyId, roleId);
  }

  async replaceRolePermissions(
    companyId: string,
    principal: SessionPrincipal,
    roleId: string,
    permissions: readonly PermissionGrant[],
  ): Promise<RoleDetail> {
    const client = this.prisma.getClient();
    const actorUserId = principal.user.id;
    await withTenantContext(client, companyId, async (tx) => {
      const role = await tx.role.findFirst({ where: { id: roleId } });
      if (!role) {
        throw new NotFoundError('The role does not exist.');
      }
      if (role.isSystem) {
        throw new ForbiddenError('System role grants cannot be edited.');
      }
      this.assertCanGrant(principal.permissions, permissions);
      await this.replaceGrants(tx, roleId, actorUserId, permissions);
    });

    await this.logs.recordEvent(companyId, {
      category: 'ACCESS',
      eventType: LOG_EVENT_TYPES['role_permissions_updated'],
      actorUserId,
      resource: 'role',
      resourceId: roleId,
      status: 'SUCCESS',
      metadata: { grantCount: permissions.length },
    });
    await this.logs.writeAudit(companyId, {
      actorUserId,
      action: 'role.permissions_replaced',
      resource: 'role',
      resourceId: roleId,
      payload: { grants: permissions },
    });

    return this.getRole(companyId, roleId);
  }

  async deleteRole(companyId: string, actorUserId: string, roleId: string): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, companyId, async (tx) => {
      const role = await tx.role.findFirst({ where: { id: roleId } });
      if (!role) {
        throw new NotFoundError('The role does not exist.');
      }
      if (role.isSystem) {
        throw new ForbiddenError('System roles cannot be deleted.');
      }
      const members = await tx.userRole.count({ where: { roleId } });
      if (members > 0) {
        throw new ConflictError(
          'The role is still assigned to users. Remove those assignments first.',
        );
      }
      await tx.role.delete({ where: { id: roleId } });
    });

    await this.logs.recordEvent(companyId, {
      category: 'ACCESS',
      eventType: LOG_EVENT_TYPES['role.deleted'],
      actorUserId,
      resource: 'role',
      resourceId: roleId,
      status: 'SUCCESS',
    });
    await this.logs.writeAudit(companyId, {
      actorUserId,
      action: 'role.delete',
      resource: 'role',
      resourceId: roleId,
    });
  }

  // ---------------------------------------------------------------------------
  // Permissions
  // ---------------------------------------------------------------------------

  async listPermissions(): Promise<PermissionRow[]> {
    const client = this.prisma.getClient();
    const rows = await client.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
      select: { id: true, key: true, resource: true, action: true },
    });
    return rows;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async getRoleSummary(companyId: string, roleId: string): Promise<RoleSummary> {
    const role = await this.getRole(companyId, roleId);
    return {
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      memberCount: role.memberCount,
      permissionCount: role.permissionCount,
    };
  }

  private async findUserByEmail(email: string): Promise<boolean> {
    const client = this.prisma.getClient();
    const rows = await client.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM app_auth_find_user_by_email(${email}::citext) LIMIT 1`,
    );
    return rows.length > 0;
  }

  private async syncUserRoles(
    tx: Prisma.TransactionClient,
    userId: string,
    companyId: string,
    principal: SessionPrincipal,
    roleIds: readonly string[],
  ): Promise<void> {
    await tx.userRole.deleteMany({ where: { userId, companyId } });

    for (const roleId of roleIds) {
      const role = await tx.role.findFirst({
        where: { id: roleId },
        select: {
          id: true,
          grants: {
            select: {
              dataScope: true,
              permission: { select: { resource: true, action: true } },
            },
          },
        },
      });
      if (!role) {
        throw new ValidationError(`A role you selected no longer exists.`);
      }
      this.assertCanGrant(
        principal.permissions,
        role.grants.map((grant) => ({
          resource: grant.permission.resource,
          action: grant.permission.action,
          scope: grant.dataScope,
        })),
      );
      await tx.userRole.create({
        data: { userId, roleId: role.id, companyId, createdBy: principal.user.id },
      });
    }
  }

  private assertCanGrant(
    permissions: readonly EffectivePermission[],
    grants: readonly {
      readonly resource: string;
      readonly action: string;
      readonly scope: DataScope;
    }[],
  ): void {
    for (const grant of grants) {
      if (!canGrant(permissions, grant)) {
        throw new ForbiddenError(
          `You cannot grant "${grant.resource}.${grant.action}" at "${grant.scope}" scope because you do not hold it yourself.`,
        );
      }
    }
  }

  private async replaceGrants(
    tx: Prisma.TransactionClient,
    roleId: string,
    actorUserId: string,
    permissions: readonly PermissionGrant[],
  ): Promise<void> {
    await tx.rolePermission.deleteMany({ where: { roleId } });

    for (const grant of permissions) {
      if (!isResource(grant.resource) || !isAction(grant.action) || !isDataScope(grant.scope)) {
        throw new ValidationError(`"${grant.resource}.${grant.action}" is not a valid permission.`);
      }
      const permission = await tx.permission.findFirst({
        where: { resource: grant.resource, action: grant.action },
        select: { id: true },
      });
      if (!permission) {
        throw new ValidationError(
          `The permission "${grant.resource}.${grant.action}" does not exist.`,
        );
      }
      await tx.rolePermission.create({
        data: {
          roleId,
          permissionId: permission.id,
          dataScope: grant.scope,
          scopeId: grant.scopeId ?? null,
          createdBy: actorUserId,
        },
      });
    }
  }
}

async function userScopeWhere(
  tx: Prisma.TransactionClient,
  decision: ScopeDecision,
): Promise<Prisma.UserWhereInput> {
  switch (decision.kind) {
    case 'all':
      return {};
    case 'self':
      return { id: decision.userId };
    case 'subtree': {
      const unitIds = await findOrgUnitSubtree(tx, decision.rootUnitId);
      return unitIds.length > 0 ? { organizationalUnitId: { in: unitIds } } : { id: { in: [] } };
    }
    case 'entity': {
      const entityId = await findOrgUnitEntity(tx, decision.rootUnitId);
      return entityId ? { unit: { is: { entityId } } } : { id: { in: [] } };
    }
    default:
      return { id: { in: [] } };
  }
}

function searchWhere(search: string): Prisma.UserWhereInput[] {
  const q = search.trim();
  if (q.length === 0) {
    return [];
  }
  return [
    { email: { contains: q, mode: 'insensitive' } },
    { displayName: { contains: q, mode: 'insensitive' } },
  ];
}

function afterUserCursor(values: readonly string[]): Prisma.UserWhereInput {
  const createdAt = new Date(values[0] ?? '');
  const id = values[1] ?? '';
  return {
    OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }],
  };
}

function toUserSummary(row: {
  id: string;
  email: string;
  displayName: string;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  hasVerifiedEmail: boolean;
  lastLoginAt: Date | null;
  organizationalUnitId: string | null;
  createdAt: Date;
  unit: {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly type: string;
  } | null;
  roles: readonly { readonly role: { readonly key: string; readonly name: string } }[];
}): UserSummary {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    status: row.status,
    hasVerifiedEmail: row.hasVerifiedEmail,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    organizationalUnitId: row.organizationalUnitId,
    organizationalUnit: row.unit,
    createdAt: row.createdAt.toISOString(),
    roles: row.roles.map((membership) => membership.role),
  };
}
