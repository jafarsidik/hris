import { Inject, Injectable } from '@nestjs/common';

import { withTenantContext } from '@hris/database';
import { parsePermissionKey, type EffectivePermission } from '@hris/shared-types';

import { PrismaService } from '../../modules/database/prisma.service';
import { parseApiKey } from './api-key';
import { PasswordService } from './password.service';
import type { SessionPrincipal } from './permission.service';

interface ApiClientRow {
  readonly id: string;
  readonly companyId: string;
  readonly name: string;
  readonly secretHash: string;
  readonly scopes: string[];
  readonly isActive: boolean;
}

/**
 * Authenticates a developer API client from its key.
 *
 * The key is presented with no session, so the client row is read through a
 * `SECURITY DEFINER` lookup (`app_api_find_client`) that resolves the tenant from the
 * key itself; only then is the tenant context established. The secret is compared as a
 * SHA-256 hash in constant time, so a leaked hash is not usable as a credential and a
 * comparison cannot be timed to recover it.
 *
 * The resulting principal is deliberately synthetic: it identifies the client, not a
 * person, and its permissions are exactly the granted scopes at `COMPANY` breadth.
 * Every scope is re-parsed from the vocabulary, so an unknown scope in the database
 * cannot widen access.
 */
@Injectable()
export class ApiClientAuthenticator {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
  ) {}

  async authenticate(
    presented: string,
  ): Promise<{ principal: SessionPrincipal; tokenHash: string } | null> {
    const parsed = parseApiKey(presented);
    if (!parsed) {
      return null;
    }

    const client = this.prisma.getClient();
    const rows = await client.$queryRaw<ApiClientRow[]>`
      SELECT "id",
             "company_id" AS "companyId",
             "name",
             "secret_hash" AS "secretHash",
             "scopes",
             "is_active" AS "isActive"
      FROM "app_api_find_client"(${parsed.clientId})
    `;

    const row = rows[0];
    if (row === undefined || !row.isActive) {
      return null;
    }

    const presentedHash = this.passwords.sha256Hex(parsed.secret);
    if (!this.passwords.constantTimeEqual(presentedHash, row.secretHash)) {
      return null;
    }

    const permissions = buildScopedPermissions(row.scopes);

    await withTenantContext(client, row.companyId, (tx) =>
      tx.apiClient.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }),
    );

    return {
      principal: {
        user: {
          id: row.id,
          companyId: row.companyId,
          email: `${row.id}@api-client.internal`,
          displayName: row.name,
          status: 'ACTIVE',
          hasVerifiedEmail: true,
          lastLoginAt: null,
          passwordChangedAt: null,
          organizationalUnitId: null,
        },
        roles: [{ key: 'API_CLIENT', name: 'API Client' }],
        permissions,
      },
      tokenHash: presentedHash,
    };
  }
}

/**
 * Turns granted scope strings into effective permissions. An unparseable scope is
 * dropped rather than granted, so a corrupted row fails closed.
 */
function buildScopedPermissions(scopes: readonly string[]): EffectivePermission[] {
  const permissions: EffectivePermission[] = [];
  for (const scope of scopes) {
    const parsed = parsePermissionKey(scope);
    if (parsed) {
      permissions.push({ resource: parsed.resource, action: parsed.action, scope: 'COMPANY' });
    }
  }
  return permissions;
}
