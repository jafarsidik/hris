import { Inject, Injectable } from '@nestjs/common';

import { withTenantContext } from '@hris/database';
import { DATA_SCOPE_RANK, type DataScope, type EffectivePermission } from '@hris/shared-types';

import { UnauthenticatedError } from '../errors/app-error';
import { PrismaService } from '../../modules/database/prisma.service';

/**
 * The authenticated caller broken out into what authorization needs: the user
 * record, their roles, and their effective permissions.
 */
export interface SessionPrincipal {
  readonly user: {
    readonly id: string;
    readonly companyId: string;
    readonly email: string;
    readonly displayName: string;
    readonly status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
    readonly hasVerifiedEmail: boolean;
    readonly lastLoginAt: Date | null;
    readonly passwordChangedAt: Date | null;
    readonly organizationalUnitId: string | null;
  };
  readonly roles: readonly { key: string; name: string }[];
  readonly permissions: readonly EffectivePermission[];
}

interface ResolvedGrant {
  readonly resource: string;
  readonly action: string;
  readonly scope: DataScope;
  readonly scopeId: string | null;
}

/**
 * Resolves the authenticated principal from the database.
 *
 * Nothing about the principal is cached — not in the token (ADR 0010) and not in
 * memory — so a role change or revocation is reflected by the very next request.
 * This is the database read the authorisation model already mandates, so it adds
 * required traffic rather than redundant traffic.
 */
@Injectable()
export class PermissionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async loadPrincipal(userId: string, companyId: string): Promise<SessionPrincipal> {
    const client = this.prisma.getClient();

    return withTenantContext(client, companyId, async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: {
          id: true,
          companyId: true,
          email: true,
          displayName: true,
          status: true,
          hasVerifiedEmail: true,
          lastLoginAt: true,
          passwordChangedAt: true,
          organizationalUnitId: true,
        },
      });

      if (!user) {
        throw new UnauthenticatedError(
          'Your account no longer exists. Please contact your administrator.',
        );
      }

      const memberships = await tx.userRole.findMany({
        where: { userId },
        select: { role: { select: { id: true, key: true, name: true } } },
      });

      const roleIds = [...new Set(memberships.map((membership) => membership.role.id))];
      const roleEntries = memberships.map((membership) => membership.role);

      const grants: ResolvedGrant[] = [];
      if (roleIds.length > 0) {
        const rows = await tx.rolePermission.findMany({
          where: { roleId: { in: roleIds } },
          select: {
            dataScope: true,
            scopeId: true,
            permission: { select: { resource: true, action: true } },
          },
        });
        for (const row of rows) {
          grants.push({
            resource: row.permission.resource,
            action: row.permission.action,
            scope: row.dataScope,
            scopeId: row.scopeId,
          });
        }
      }

      return {
        user: {
          id: user.id,
          companyId: user.companyId,
          email: user.email,
          displayName: user.displayName,
          status: user.status,
          hasVerifiedEmail: user.hasVerifiedEmail,
          lastLoginAt: user.lastLoginAt,
          passwordChangedAt: user.passwordChangedAt,
          organizationalUnitId: user.organizationalUnitId,
        },
        roles: dedupeRoles(roleEntries),
        permissions: aggregatePermissions(grants),
      };
    });
  }
}

function dedupeRoles(
  roles: readonly { key: string; name: string }[],
): readonly { key: string; name: string }[] {
  const seen = new Set<string>();
  const result: { key: string; name: string }[] = [];
  for (const role of roles) {
    if (!seen.has(role.key)) {
      seen.add(role.key);
      result.push({ key: role.key, name: role.name });
    }
  }
  return result;
}

/**
 * Collapses the grant rows into one entry per resource/action, keeping the widest
 * scope. A user with DEPARTMENT on one role and COMPANY on another is COMPANY.
 */
export function aggregatePermissions(grants: readonly ResolvedGrant[]): EffectivePermission[] {
  const byKey = new Map<string, EffectivePermission>();

  for (const grant of grants) {
    const key = `${grant.resource}.${grant.action}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, toEffectivePermission(grant));
      continue;
    }
    const existingScopeId = existing.scopeId ?? null;
    if (DATA_SCOPE_RANK[grant.scope] > DATA_SCOPE_RANK[existing.scope]) {
      byKey.set(key, toEffectivePermission(grant));
    } else if (
      DATA_SCOPE_RANK[grant.scope] === DATA_SCOPE_RANK[existing.scope] &&
      existingScopeId !== null &&
      grant.scopeId === null
    ) {
      // On a tie the unscoped grant is broader, so it wins.
      byKey.set(key, toEffectivePermission(grant));
    }
  }

  return [...byKey.values()];
}

/**
 * Omits `scopeId` when null so the serialized permission shape stays identical to the
 * one clients have always seen and an absent key means "not narrowed".
 */
function toEffectivePermission(grant: ResolvedGrant): EffectivePermission {
  return {
    resource: grant.resource,
    action: grant.action,
    scope: grant.scope,
    ...(grant.scopeId ? { scopeId: grant.scopeId } : {}),
  };
}
