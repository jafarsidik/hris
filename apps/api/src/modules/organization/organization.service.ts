import { Inject, Injectable } from '@nestjs/common';

import {
  type Prisma,
  findOrgUnitEntity,
  findOrgUnitSubtree,
  withTenantContext,
} from '@hris/database';
import {
  buildPage,
  cursorFingerprint,
  resolveCursor,
  type OrganizationalUnitSummary,
  type OrganizationalUnitType,
  type OrganizationEntitySummary,
  type PageParams,
  type Paginated,
} from '@hris/shared-types';

import { PrismaService } from '../database/prisma.service';
import { LogService } from '../logs/log.service';
import { resolveScope, type ScopeDecision } from '../../common/auth/data-scope';
import { type SessionPrincipal } from '../../common/auth/permission.service';
import {
  ConflictError,
  NotFoundError,
  OutOfScopeError,
  ValidationError,
} from '../../common/errors/app-error';

export interface OrganizationActor {
  readonly companyId: string;
  readonly userId: string;
}

export interface EntityInput {
  code: string;
  name: string;
  countryCode: string;
  currencyCode: string;
}

export interface UnitInput {
  code: string;
  name: string;
  type: OrganizationalUnitType;
  entityId?: string | null;
  parentId?: string | null;
}

export interface UnitFilter {
  readonly entityId?: string;
  readonly parentId?: string;
  readonly type?: OrganizationalUnitType;
  readonly search?: string;
}

const ENTITY_SORT = { createdAt: 'desc', id: 'desc' } as const;
const UNIT_SORT = { createdAt: 'asc', id: 'asc' } as const;

const ENTITY_SELECT = {
  id: true,
  code: true,
  name: true,
  countryCode: true,
  currencyCode: true,
  createdAt: true,
  updatedAt: true,
} as const;

const UNIT_SELECT = {
  id: true,
  entityId: true,
  parentId: true,
  type: true,
  code: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} as const;

type EntityRow = Prisma.EntityGetPayload<{ select: typeof ENTITY_SELECT }>;
type UnitRow = Prisma.OrganizationalUnitGetPayload<{ select: typeof UNIT_SELECT }>;

/**
 * Organizational structure: legal entities and the unit tree beneath them.
 *
 * Every read and mutation runs inside `withTenantContext`, so row-level security keeps
 * the tenant boundary even if a predicate is forgotten. Reads additionally narrow to the
 * caller's `organization:view` data scope: `all` sees the whole company, `subtree` sees
 * the units under their placement, `entity` sees the units of their legal entity, and
 * `self` sees only their own unit. Writes require the target to fall inside that same
 * scope, and an unknown or out-of-scope id is a plain 404 so the structure of another
 * subtree is never disclosed.
 */
@Injectable()
export class OrganizationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  // ---------------------------------------------------------------------------
  // Legal entities
  // ---------------------------------------------------------------------------

  async listEntities(
    companyId: string,
    principal: SessionPrincipal,
    filter: { search?: string },
    params: PageParams,
  ): Promise<Paginated<OrganizationEntitySummary>> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const fingerprint = cursorFingerprint({
      filters: { ...filter, companyId },
      sort: ENTITY_SORT,
    });
    const resolved = resolveCursor(params.cursor, fingerprint);
    if (!resolved.ok) {
      throw new ValidationError('The pagination cursor does not match the current filters');
    }

    const rows = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await entityScopeWhere(tx, decision);
      return tx.entity.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...scopeWhere,
          ...(filter.search ? { OR: entitySearchWhere(filter.search) } : {}),
          ...(resolved.cursor.position.values.length > 0
            ? afterEntityCursor(resolved.cursor.position.values)
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: ENTITY_SELECT,
        take: params.limit + 1,
      });
    });

    const items = rows.map(toEntitySummary);
    return buildPage(items, params, fingerprint, (item) => ({
      values: [item.createdAt, item.id],
    }));
  }

  async getEntity(
    companyId: string,
    principal: SessionPrincipal,
    entityId: string,
  ): Promise<OrganizationEntitySummary> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const row = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await entityScopeWhere(tx, decision);
      return tx.entity.findFirst({
        where: { id: entityId, companyId, deletedAt: null, ...scopeWhere },
        select: ENTITY_SELECT,
      });
    });
    if (row === null) {
      throw new NotFoundError('The legal entity does not exist.');
    }
    return toEntitySummary(row);
  }

  async createEntity(
    companyId: string,
    principal: SessionPrincipal,
    input: EntityInput,
  ): Promise<OrganizationEntitySummary> {
    const decision = this.readScope(principal);
    if (decision.kind !== 'all') {
      throw new OutOfScopeError('Your scope does not allow creating legal entities.');
    }

    const client = this.prisma.getClient();
    const code = input.code.trim();
    const row = await withTenantContext(client, companyId, async (tx) => {
      await this.assertEntityCodeFree(tx, companyId, code, null);
      return tx.entity.create({
        data: {
          companyId,
          code,
          name: input.name.trim(),
          countryCode: input.countryCode.trim().toUpperCase(),
          currencyCode: input.currencyCode.trim().toUpperCase(),
          createdBy: principal.user.id,
        },
        select: ENTITY_SELECT,
      });
    });

    await this.audit(companyId, principal.user.id, 'organization.entity_created', row.id, {
      code,
      name: row.name,
    });
    return toEntitySummary(row);
  }

  async updateEntity(
    companyId: string,
    principal: SessionPrincipal,
    entityId: string,
    input: Partial<EntityInput>,
  ): Promise<OrganizationEntitySummary> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const code = input.code === undefined ? undefined : input.code.trim();

    const row = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await entityScopeWhere(tx, decision);
      const current = await tx.entity.findFirst({
        where: { id: entityId, companyId, deletedAt: null, ...scopeWhere },
        select: { id: true },
      });
      if (current === null) {
        throw new NotFoundError('The legal entity does not exist.');
      }
      if (code !== undefined) {
        await this.assertEntityCodeFree(tx, companyId, code, entityId);
      }
      return tx.entity.update({
        where: { id: entityId },
        data: {
          ...(code === undefined ? {} : { code }),
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.countryCode === undefined
            ? {}
            : { countryCode: input.countryCode.trim().toUpperCase() }),
          ...(input.currencyCode === undefined
            ? {}
            : { currencyCode: input.currencyCode.trim().toUpperCase() }),
        },
        select: ENTITY_SELECT,
      });
    });

    await this.audit(companyId, principal.user.id, 'organization.entity_updated', entityId);
    return toEntitySummary(row);
  }

  async deleteEntity(
    companyId: string,
    principal: SessionPrincipal,
    entityId: string,
  ): Promise<void> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();

    await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await entityScopeWhere(tx, decision);
      const current = await tx.entity.findFirst({
        where: { id: entityId, companyId, deletedAt: null, ...scopeWhere },
        select: { id: true },
      });
      if (current === null) {
        throw new NotFoundError('The legal entity does not exist.');
      }
      const units = await tx.organizationalUnit.count({
        where: { entityId, companyId, deletedAt: null },
      });
      if (units > 0) {
        throw new ConflictError('Remove or reassign the entity\u2019s units before deleting it.');
      }
      await tx.entity.update({ where: { id: entityId }, data: { deletedAt: new Date() } });
    });

    await this.audit(companyId, principal.user.id, 'organization.entity_deleted', entityId);
  }

  // ---------------------------------------------------------------------------
  // Organizational units
  // ---------------------------------------------------------------------------

  async listUnits(
    companyId: string,
    principal: SessionPrincipal,
    filter: UnitFilter,
    params: PageParams,
  ): Promise<Paginated<OrganizationalUnitSummary>> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const fingerprint = cursorFingerprint({
      filters: { ...filter, companyId },
      sort: UNIT_SORT,
    });
    const resolved = resolveCursor(params.cursor, fingerprint);
    if (!resolved.ok) {
      throw new ValidationError('The pagination cursor does not match the current filters');
    }

    const rows = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await unitScopeWhere(tx, decision, principal.user.organizationalUnitId);
      return tx.organizationalUnit.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...scopeWhere,
          ...(filter.entityId ? { entityId: filter.entityId } : {}),
          ...(filter.parentId ? { parentId: filter.parentId } : {}),
          ...(filter.type ? { type: filter.type } : {}),
          ...(filter.search ? { OR: unitSearchWhere(filter.search) } : {}),
          ...(resolved.cursor.position.values.length > 0
            ? afterUnitCursor(resolved.cursor.position.values)
            : {}),
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: UNIT_SELECT,
        take: params.limit + 1,
      });
    });

    const items = rows.map(toUnitSummary);
    return buildPage(items, params, fingerprint, (item) => ({
      values: [item.createdAt, item.id],
    }));
  }

  async getUnit(
    companyId: string,
    principal: SessionPrincipal,
    unitId: string,
  ): Promise<OrganizationalUnitSummary> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const row = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await unitScopeWhere(tx, decision, principal.user.organizationalUnitId);
      return tx.organizationalUnit.findFirst({
        where: { id: unitId, companyId, deletedAt: null, ...scopeWhere },
        select: UNIT_SELECT,
      });
    });
    if (row === null) {
      throw new NotFoundError('The organizational unit does not exist.');
    }
    return toUnitSummary(row);
  }

  async createUnit(
    companyId: string,
    principal: SessionPrincipal,
    input: UnitInput,
  ): Promise<OrganizationalUnitSummary> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const code = input.code.trim();
    const entityId = input.entityId ?? null;
    const parentId = input.parentId ?? null;

    const row = await withTenantContext(client, companyId, async (tx) => {
      await this.assertUnitCodeFree(tx, companyId, code, null);
      await this.assertPlacementInScope(tx, decision, principal, entityId, parentId);
      return tx.organizationalUnit.create({
        data: {
          companyId,
          code,
          name: input.name.trim(),
          type: input.type,
          entityId,
          parentId,
          createdBy: principal.user.id,
        },
        select: UNIT_SELECT,
      });
    });

    await this.audit(companyId, principal.user.id, 'organization.unit_created', row.id, {
      code,
      type: row.type,
    });
    return toUnitSummary(row);
  }

  async updateUnit(
    companyId: string,
    principal: SessionPrincipal,
    unitId: string,
    input: Partial<UnitInput>,
  ): Promise<OrganizationalUnitSummary> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const code = input.code === undefined ? undefined : input.code.trim();

    const row = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await unitScopeWhere(tx, decision, principal.user.organizationalUnitId);
      const current = await tx.organizationalUnit.findFirst({
        where: { id: unitId, companyId, deletedAt: null, ...scopeWhere },
        select: { id: true, entityId: true, parentId: true },
      });
      if (current === null) {
        throw new NotFoundError('The organizational unit does not exist.');
      }
      if (code !== undefined) {
        await this.assertUnitCodeFree(tx, companyId, code, unitId);
      }

      const nextEntityId = input.entityId === undefined ? current.entityId : input.entityId;
      const nextParentId = input.parentId === undefined ? current.parentId : input.parentId;
      if (input.entityId !== undefined || input.parentId !== undefined) {
        await this.assertPlacementInScope(tx, decision, principal, nextEntityId, nextParentId);
      }
      if (input.parentId !== undefined && input.parentId !== null) {
        if (input.parentId === unitId) {
          throw new ValidationError('A unit cannot be its own parent.');
        }
        const subtree = await findOrgUnitSubtree(tx, unitId);
        if (subtree.includes(input.parentId)) {
          throw new ValidationError('A unit cannot be moved beneath one of its own descendants.');
        }
      }

      return tx.organizationalUnit.update({
        where: { id: unitId },
        data: {
          ...(code === undefined ? {} : { code }),
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.type === undefined ? {} : { type: input.type }),
          ...(input.entityId === undefined ? {} : { entityId: input.entityId }),
          ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
        },
        select: UNIT_SELECT,
      });
    });

    await this.audit(companyId, principal.user.id, 'organization.unit_updated', unitId);
    return toUnitSummary(row);
  }

  async deleteUnit(companyId: string, principal: SessionPrincipal, unitId: string): Promise<void> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();

    await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await unitScopeWhere(tx, decision, principal.user.organizationalUnitId);
      const current = await tx.organizationalUnit.findFirst({
        where: { id: unitId, companyId, deletedAt: null, ...scopeWhere },
        select: { id: true },
      });
      if (current === null) {
        throw new NotFoundError('The organizational unit does not exist.');
      }
      const children = await tx.organizationalUnit.count({
        where: { parentId: unitId, companyId, deletedAt: null },
      });
      if (children > 0) {
        throw new ConflictError('Reassign the unit\u2019s child units before deleting it.');
      }
      const users = await tx.user.count({
        where: { organizationalUnitId: unitId, companyId, deletedAt: null },
      });
      if (users > 0) {
        throw new ConflictError('Reassign the unit\u2019s members before deleting it.');
      }
      await tx.organizationalUnit.update({
        where: { id: unitId },
        data: { deletedAt: new Date() },
      });
    });

    await this.audit(companyId, principal.user.id, 'organization.unit_deleted', unitId);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /**
   * The caller's record scope for the organization resource, or a hard denial when the
   * grant cannot be resolved. The controller has already checked `organization:view`;
   * this only narrows *which* rows that capability reaches.
   */
  private readScope(principal: SessionPrincipal): ScopeDecision {
    const decision = resolveScope(principal.permissions, 'organization', 'view', {
      userId: principal.user.id,
      unitId: principal.user.organizationalUnitId,
    });
    if (decision.kind === 'denied') {
      throw new OutOfScopeError(
        `Your "${decision.scope ?? 'unresolved'}" scope for organization.view cannot be resolved.`,
      );
    }
    return decision;
  }

  /** A new or moved unit must sit inside the caller's scope, never outside it. */
  private async assertPlacementInScope(
    tx: Prisma.TransactionClient,
    decision: ScopeDecision,
    principal: SessionPrincipal,
    entityId: string | null,
    parentId: string | null,
  ): Promise<void> {
    if (decision.kind === 'all') {
      await this.assertPlacementExists(tx, entityId, parentId);
      return;
    }

    if (parentId !== null) {
      const scopeWhere = await unitScopeWhere(tx, decision, principal.user.organizationalUnitId);
      const parent = await tx.organizationalUnit.findFirst({
        where: { id: parentId, deletedAt: null, ...scopeWhere },
        select: { id: true },
      });
      if (parent === null) {
        throw new OutOfScopeError('The parent unit is outside your permitted scope.');
      }
    } else if (entityId !== null) {
      const scopeWhere = await entityScopeWhere(tx, decision);
      const entity = await tx.entity.findFirst({
        where: { id: entityId, deletedAt: null, ...scopeWhere },
        select: { id: true },
      });
      if (entity === null) {
        throw new OutOfScopeError('The legal entity is outside your permitted scope.');
      }
    } else {
      throw new OutOfScopeError('Your scope does not allow creating a root unit.');
    }

    await this.assertPlacementExists(tx, entityId, parentId);
  }

  private async assertPlacementExists(
    tx: Prisma.TransactionClient,
    entityId: string | null,
    parentId: string | null,
  ): Promise<void> {
    if (entityId !== null) {
      const entity = await tx.entity.findFirst({
        where: { id: entityId, deletedAt: null },
        select: { id: true },
      });
      if (entity === null) {
        throw new ValidationError('The selected legal entity does not exist.');
      }
    }
    if (parentId !== null) {
      const parent = await tx.organizationalUnit.findFirst({
        where: { id: parentId, deletedAt: null },
        select: { id: true },
      });
      if (parent === null) {
        throw new ValidationError('The selected parent unit does not exist.');
      }
    }
  }

  private async assertEntityCodeFree(
    tx: Prisma.TransactionClient,
    companyId: string,
    code: string,
    excludeId: string | null,
  ): Promise<void> {
    const clash = await tx.entity.findFirst({
      where: {
        companyId,
        code,
        deletedAt: null,
        ...(excludeId === null ? {} : { id: { not: excludeId } }),
      },
      select: { id: true },
    });
    if (clash !== null) {
      throw new ConflictError(`A legal entity with the code "${code}" already exists.`);
    }
  }

  private async assertUnitCodeFree(
    tx: Prisma.TransactionClient,
    companyId: string,
    code: string,
    excludeId: string | null,
  ): Promise<void> {
    const clash = await tx.organizationalUnit.findFirst({
      where: {
        companyId,
        code,
        deletedAt: null,
        ...(excludeId === null ? {} : { id: { not: excludeId } }),
      },
      select: { id: true },
    });
    if (clash !== null) {
      throw new ConflictError(`An organizational unit with the code "${code}" already exists.`);
    }
  }

  private async audit(
    companyId: string,
    actorUserId: string,
    action: string,
    resourceId: string,
    payload?: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    await this.logs.recordEvent(companyId, {
      category: 'ACTIVITY',
      eventType: action,
      actorUserId,
      resource: 'organization',
      resourceId,
      status: 'SUCCESS',
    });
    await this.logs.writeAudit(companyId, {
      actorUserId,
      action,
      resource: 'organization',
      resourceId,
      ...(payload === undefined ? {} : { payload }),
    });
  }
}

async function entityScopeWhere(
  tx: Prisma.TransactionClient,
  decision: ScopeDecision,
): Promise<Prisma.EntityWhereInput> {
  switch (decision.kind) {
    case 'all':
      return {};
    case 'subtree':
    case 'entity': {
      const entityId = await findOrgUnitEntity(tx, decision.rootUnitId);
      return entityId ? { id: entityId } : { id: { in: [] } };
    }
    default:
      return { id: { in: [] } };
  }
}

async function unitScopeWhere(
  tx: Prisma.TransactionClient,
  decision: ScopeDecision,
  callerUnitId: string | null,
): Promise<Prisma.OrganizationalUnitWhereInput> {
  switch (decision.kind) {
    case 'all':
      return {};
    case 'self':
      return callerUnitId ? { id: callerUnitId } : { id: { in: [] } };
    case 'subtree': {
      const unitIds = await findOrgUnitSubtree(tx, decision.rootUnitId);
      return unitIds.length > 0 ? { id: { in: unitIds } } : { id: { in: [] } };
    }
    case 'entity': {
      const entityId = await findOrgUnitEntity(tx, decision.rootUnitId);
      return entityId ? { entityId } : { id: { in: [] } };
    }
    default:
      return { id: { in: [] } };
  }
}

function entitySearchWhere(search: string): Prisma.EntityWhereInput[] {
  const q = search.trim();
  if (q.length === 0) {
    return [];
  }
  return [
    { code: { contains: q, mode: 'insensitive' } },
    { name: { contains: q, mode: 'insensitive' } },
  ];
}

function unitSearchWhere(search: string): Prisma.OrganizationalUnitWhereInput[] {
  const q = search.trim();
  if (q.length === 0) {
    return [];
  }
  return [
    { code: { contains: q, mode: 'insensitive' } },
    { name: { contains: q, mode: 'insensitive' } },
  ];
}

function afterEntityCursor(values: readonly string[]): Prisma.EntityWhereInput {
  const createdAt = new Date(values[0] ?? '');
  const id = values[1] ?? '';
  return { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }] };
}

function afterUnitCursor(values: readonly string[]): Prisma.OrganizationalUnitWhereInput {
  const createdAt = new Date(values[0] ?? '');
  const id = values[1] ?? '';
  return { OR: [{ createdAt: { gt: createdAt } }, { createdAt, id: { gt: id } }] };
}

function toEntitySummary(row: EntityRow): OrganizationEntitySummary {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    countryCode: row.countryCode,
    currencyCode: row.currencyCode,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toUnitSummary(row: UnitRow): OrganizationalUnitSummary {
  return {
    id: row.id,
    entityId: row.entityId,
    parentId: row.parentId,
    type: row.type as OrganizationalUnitType,
    code: row.code,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
