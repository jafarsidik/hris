import { randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { withTenantContext } from '@hris/database';
import { parsePermissionKey, type DataScope } from '@hris/shared-types';

import { canGrant } from '../../common/auth/data-scope';
import { PasswordService } from '../../common/auth/password.service';
import { ValidationError, NotFoundError } from '../../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { LogService } from '../logs/log.service';

export interface ApiClientSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly clientId: string;
  readonly scopes: readonly string[];
  readonly isActive: boolean;
  readonly lastUsedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ApiClientActor {
  readonly companyId: string;
  readonly userId: string;
  readonly permissions: readonly { resource: string; action: string; scope: DataScope }[];
}

/** The scope every developer-API grant is issued at; narrower scopes are not modelled yet. */
const API_CLIENT_GRANT_SCOPE: DataScope = 'COMPANY';

/**
 * Developer API client management.
 *
 * The secret is generated here, returned exactly once, and only its SHA-256 hash is
 * persisted — the same treatment as an opaque session token, which is appropriate
 * because the secret is 256 bits of randomness rather than a chosen password. Scopes
 * are validated two ways: each must be a real `resource.action` from the vocabulary,
 * and the actor must already hold a grant at least as wide as the one requested, so a
 * client cannot be minted with authority its creator does not possess.
 */
@Injectable()
export class ApiClientsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  async list(companyId: string): Promise<readonly ApiClientSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const rows = await tx.apiClient.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      return rows.map(toSummary);
    });
  }

  async get(companyId: string, id: string): Promise<ApiClientSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const row = await tx.apiClient.findFirst({ where: { id } });
      if (row === null) {
        throw new NotFoundError('The API client does not exist.');
      }
      return toSummary(row);
    });
  }

  async create(
    actor: ApiClientActor,
    input: { name: string; description?: string; scopes: readonly string[] },
  ): Promise<ApiClientSummary & { secret: string }> {
    const scopes = uniqueScopes(input.scopes);
    assertScopesGrantable(actor, scopes);

    const clientId = `hris_ak_${randomBytes(12).toString('hex')}`;
    const secret = randomBytes(32).toString('base64url');
    const secretHash = this.passwords.sha256Hex(secret);
    const client = this.prisma.getClient();

    const created = await withTenantContext(client, actor.companyId, async (tx) => {
      const row = await tx.apiClient.create({
        data: {
          companyId: actor.companyId,
          name: input.name,
          description: input.description,
          clientId,
          secretHash,
          scopes,
          ownerUserId: actor.userId,
          createdBy: actor.userId,
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'api-client.create',
        resource: 'api-client',
        resourceId: row.id,
        payload: { scopes },
      });
      return row;
    });

    return { ...toSummary(created), secret: `${clientId}.${secret}` };
  }

  async update(
    actor: ApiClientActor,
    id: string,
    input: { name?: string; description?: string; scopes?: readonly string[]; isActive?: boolean },
  ): Promise<ApiClientSummary> {
    const scopes = input.scopes === undefined ? undefined : uniqueScopes(input.scopes);
    if (scopes !== undefined) {
      assertScopesGrantable(actor, scopes);
    }

    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const existing = await tx.apiClient.findFirst({ where: { id }, select: { id: true } });
      if (existing === null) {
        throw new NotFoundError('The API client does not exist.');
      }

      const row = await tx.apiClient.update({
        where: { id },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(scopes === undefined ? {} : { scopes }),
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
          createdBy: actor.userId,
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'api-client.update',
        resource: 'api-client',
        resourceId: id,
        ...(scopes === undefined ? {} : { payload: { scopes } }),
      });
      return toSummary(row);
    });
  }

  async rotate(actor: ApiClientActor, id: string): Promise<ApiClientSummary & { secret: string }> {
    const secret = randomBytes(32).toString('base64url');
    const secretHash = this.passwords.sha256Hex(secret);
    const client = this.prisma.getClient();

    const updated = await withTenantContext(client, actor.companyId, async (tx) => {
      const existing = await tx.apiClient.findFirst({
        where: { id },
        select: { id: true, clientId: true },
      });
      if (existing === null) {
        throw new NotFoundError('The API client does not exist.');
      }
      const row = await tx.apiClient.update({
        where: { id },
        data: { secretHash, createdBy: actor.userId },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'api-client.rotate',
        resource: 'api-client',
        resourceId: id,
      });
      return row;
    });

    return { ...toSummary(updated), secret: `${updated.clientId}.${secret}` };
  }

  async remove(actor: ApiClientActor, id: string): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, actor.companyId, async (tx) => {
      const existing = await tx.apiClient.findFirst({ where: { id }, select: { id: true } });
      if (existing === null) {
        throw new NotFoundError('The API client does not exist.');
      }
      await tx.apiClient.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false, createdBy: actor.userId },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'api-client.delete',
        resource: 'api-client',
        resourceId: id,
      });
    });
  }
}

/** Deduplicates scopes so a caller cannot store the same grant twice. */
function uniqueScopes(scopes: readonly string[]): string[] {
  return [...new Set(scopes)];
}

/**
 * Rejects a scope that is not a real permission key, or that the actor cannot grant.
 * `canGrant` already ignores actor/action/scope combinations the actor does not hold.
 */
function assertScopesGrantable(actor: ApiClientActor, scopes: readonly string[]): void {
  for (const scope of scopes) {
    const parsed = parsePermissionKey(scope);
    if (parsed === null) {
      throw new ValidationError(`"${scope}" is not a valid resource.action scope.`);
    }
    const grantable = canGrant(
      actor.permissions.map((permission) => ({ ...permission, scopeId: null })),
      { resource: parsed.resource, action: parsed.action, scope: API_CLIENT_GRANT_SCOPE },
    );
    if (!grantable) {
      throw new ValidationError(`You cannot grant the scope "${scope}".`);
    }
  }
}

function toSummary(row: {
  id: string;
  name: string;
  description: string | null;
  clientId: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ApiClientSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    clientId: row.clientId,
    scopes: row.scopes,
    isActive: row.isActive,
    lastUsedAt: row.lastUsedAt === null ? null : row.lastUsedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
