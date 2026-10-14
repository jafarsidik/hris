import { Inject, Injectable } from '@nestjs/common';

import {
  findOrgUnitEntity,
  findOrgUnitIdsByEntity,
  findOrgUnitSubtree,
  withTenantContext,
} from '@hris/database';
import type { Prisma } from '@hris/database';

import { can, canViewSensitive } from '../../common/auth/authorization.guard';
import { resolveScope, type ScopeDecision } from '../../common/auth/data-scope';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import {
  ForbiddenError,
  NotFoundError,
  OutOfScopeError,
  ValidationError,
} from '../../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { DomainEventBus } from '../events/domain-event-bus.service';
import { LogService } from '../logs/log.service';
import { RecordActionRegistry } from './record-action.registry';

export interface ResourceRecordSummary {
  readonly id: string;
  readonly resource: string;
  readonly data: Record<string, unknown>;
  readonly unitId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RESERVED_UNIT_KEY = 'unitId';

interface RegisteredField {
  readonly key: string;
  readonly dataType:
    'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'DATETIME' | 'JSON' | 'ENUM' | 'REFERENCE';
  readonly required: boolean;
  readonly isSensitive: boolean;
}

/**
 * Generic CRUD runtime for registry-declared resources.
 *
 * A resource flagged `supportsCrud` gets storage and endpoints without any code change.
 * Field values are validated against the resource's registered fields and stored as
 * JSON; authorization is resolved per request against the caller's live permissions
 * (a route cannot carry a static `@RequirePermission` for a resource named in the URL),
 * and the data scope is applied as a real query predicate so a `TEAM`/`SELF` grant
 * narrows the rows rather than filtering them after the fact.
 */
@Injectable()
export class RecordsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
    @Inject(RecordActionRegistry) private readonly actions: RecordActionRegistry,
    @Inject(DomainEventBus) private readonly domainEvents: DomainEventBus,
  ) {}

  async list(
    companyId: string,
    principal: SessionPrincipal,
    resourceKey: string,
    limit = 50,
  ): Promise<readonly ResourceRecordSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      await this.resolveCrudResource(tx, resourceKey);
      const decision = this.authorize(principal, resourceKey, 'view');
      const scopeWhere = await recordScopeWhere(tx, decision, principal.user.id);
      const rows = await tx.resourceRecord.findMany({
        where: { companyId, resourceKey, deletedAt: null, ...scopeWhere },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: Math.min(Math.max(limit, 1), 200),
      });
      const fields = await this.resolveCrudResource(tx, resourceKey);
      const canViewSensitiveFields = canViewSensitive(principal.permissions, resourceKey);
      return rows.map((row) =>
        toSummary(row, { canViewSensitive: canViewSensitiveFields, fields }),
      );
    });
  }

  async get(
    companyId: string,
    principal: SessionPrincipal,
    resourceKey: string,
    id: string,
  ): Promise<ResourceRecordSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      await this.resolveCrudResource(tx, resourceKey);
      const decision = this.authorize(principal, resourceKey, 'view');
      const scopeWhere = await recordScopeWhere(tx, decision, principal.user.id);
      const row = await tx.resourceRecord.findFirst({
        where: { id, companyId, resourceKey, deletedAt: null, ...scopeWhere },
      });
      if (!row) {
        throw new NotFoundError('The record does not exist.');
      }
      const fields = await this.resolveCrudResource(tx, resourceKey);
      const canViewSensitiveFields = canViewSensitive(principal.permissions, resourceKey);
      return toSummary(row, { canViewSensitive: canViewSensitiveFields, fields });
    });
  }

  async create(
    companyId: string,
    principal: SessionPrincipal,
    resourceKey: string,
    body: Record<string, unknown>,
  ): Promise<ResourceRecordSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const fields = await this.resolveCrudResource(tx, resourceKey);
      const decision = this.authorize(principal, resourceKey, 'create');
      const { unitId, data } = preparePayload(fields, body, false);
      const resolvedUnitId = await this.resolveUnitForWrite(tx, decision, unitId);

      const created = await tx.resourceRecord.create({
        data: {
          companyId,
          resourceKey,
          data: data as Prisma.InputJsonValue,
          ownerUserId: principal.user.id,
          organizationalUnitId: resolvedUnitId,
          createdBy: principal.user.id,
        },
      });

      await this.logs.writeAudit(companyId, {
        actorUserId: principal.user.id,
        action: 'record.create',
        resource: resourceKey,
        resourceId: created.id,
      });
      const canViewSensitiveFields = canViewSensitive(principal.permissions, resourceKey);
      return toSummary(created, { canViewSensitive: canViewSensitiveFields, fields });
    });
  }

  async update(
    companyId: string,
    principal: SessionPrincipal,
    resourceKey: string,
    id: string,
    body: Record<string, unknown>,
  ): Promise<ResourceRecordSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const fields = await this.resolveCrudResource(tx, resourceKey);
      const decision = this.authorize(principal, resourceKey, 'update');
      const scopeWhere = await recordScopeWhere(tx, decision, principal.user.id);
      const existing = await tx.resourceRecord.findFirst({
        where: { id, companyId, resourceKey, deletedAt: null, ...scopeWhere },
      });
      if (!existing) {
        throw new NotFoundError('The record does not exist.');
      }

      const { unitId, data } = preparePayload(fields, body, true);
      const nextData = { ...(existing.data as Record<string, unknown>), ...data };
      const nextUnitId =
        unitId === undefined
          ? existing.organizationalUnitId
          : await this.resolveUnitForWrite(tx, decision, unitId);

      const updated = await tx.resourceRecord.update({
        where: { id },
        data: {
          data: nextData as Prisma.InputJsonValue,
          organizationalUnitId: nextUnitId,
          updatedAt: new Date(),
          createdBy: principal.user.id,
        },
      });

      await this.logs.writeAudit(companyId, {
        actorUserId: principal.user.id,
        action: 'record.update',
        resource: resourceKey,
        resourceId: id,
      });
      const canViewSensitiveFields = canViewSensitive(principal.permissions, resourceKey);
      return toSummary(updated, { canViewSensitive: canViewSensitiveFields, fields });
    });
  }

  async remove(
    companyId: string,
    principal: SessionPrincipal,
    resourceKey: string,
    id: string,
  ): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, companyId, async (tx) => {
      await this.resolveCrudResource(tx, resourceKey);
      const decision = this.authorize(principal, resourceKey, 'delete');
      const scopeWhere = await recordScopeWhere(tx, decision, principal.user.id);
      const existing = await tx.resourceRecord.findFirst({
        where: { id, companyId, resourceKey, deletedAt: null, ...scopeWhere },
      });
      if (!existing) {
        throw new NotFoundError('The record does not exist.');
      }
      await tx.resourceRecord.update({
        where: { id },
        data: { deletedAt: new Date(), createdBy: principal.user.id },
      });
      await this.logs.writeAudit(companyId, {
        actorUserId: principal.user.id,
        action: 'record.delete',
        resource: resourceKey,
        resourceId: id,
      });
    });
  }

  /**
   * Runs a custom action registered for a resource.
   *
   * The handler runs inside the tenant transaction and may return a field patch, which
   * is validated like any other write, plus domain events. Events are dispatched only
   * after the transaction commits, so a consumer never observes a fact that was rolled
   * back; a failing consumer is reported by the bus rather than failing the request.
   */
  async runAction(
    companyId: string,
    principal: SessionPrincipal,
    resourceKey: string,
    id: string,
    action: string,
    input: Record<string, unknown>,
  ): Promise<{ record: ResourceRecordSummary; result: unknown }> {
    const client = this.prisma.getClient();
    const outcome = await withTenantContext(client, companyId, async (tx) => {
      const fields = await this.resolveCrudResource(tx, resourceKey);
      const definition = this.actions.require(resourceKey, action);
      const { resource: permissionResource, action: permissionAction } = splitPermission(
        definition.permission,
      );
      if (permissionResource !== resourceKey) {
        throw new ValidationError(
          `The "${action}" action is misconfigured: it requires "${definition.permission}".`,
        );
      }
      const decision = this.authorize(principal, resourceKey, permissionAction);
      const scopeWhere = await recordScopeWhere(tx, decision, principal.user.id);
      const existing = await tx.resourceRecord.findFirst({
        where: { id, companyId, resourceKey, deletedAt: null, ...scopeWhere },
      });
      if (!existing) {
        throw new NotFoundError('The record does not exist.');
      }

      const handlerResult = await definition.handle({
        tx,
        companyId,
        principal,
        resourceKey,
        record: {
          id: existing.id,
          data: (existing.data as Record<string, unknown>) ?? {},
          unitId: existing.organizationalUnitId,
        },
        input,
      });

      let updated = existing;
      if (handlerResult.patch && Object.keys(handlerResult.patch).length > 0) {
        const { data } = preparePayload(fields, handlerResult.patch, true);
        const nextData = { ...(existing.data as Record<string, unknown>), ...data };
        updated = await tx.resourceRecord.update({
          where: { id },
          data: {
            data: nextData as Prisma.InputJsonValue,
            updatedAt: new Date(),
            createdBy: principal.user.id,
          },
        });
      }

      await this.logs.writeAudit(companyId, {
        actorUserId: principal.user.id,
        action: 'record.action',
        resource: resourceKey,
        resourceId: id,
        payload: { action },
      });

      const fieldsForRecord = await this.resolveCrudResource(tx, resourceKey);
      return {
        record: toSummary(updated, {
          canViewSensitive: canViewSensitive(principal.permissions, resourceKey),
          fields: fieldsForRecord,
        }),
        result: handlerResult.result ?? null,
        events: handlerResult.events ?? [],
      };
    });

    for (const event of outcome.events) {
      await this.domainEvents.emit({
        type: event.type,
        companyId,
        actorUserId: principal.user.id,
        resource: resourceKey,
        resourceId: id,
        payload: event.payload ?? {},
        occurredAt: new Date(),
      });
    }

    return { record: outcome.record, result: outcome.result };
  }

  /** Confirms the resource is registered, active and opted into generic CRUD. */
  private async resolveCrudResource(
    tx: Prisma.TransactionClient,
    resourceKey: string,
  ): Promise<readonly RegisteredField[]> {
    const resource = await tx.resourceDefinition.findUnique({
      where: { key: resourceKey },
      select: {
        isActive: true,
        supportsCrud: true,
        fields: { select: { key: true, dataType: true, required: true, isSensitive: true } },
      },
    });
    if (!resource || !resource.isActive || !resource.supportsCrud) {
      throw new NotFoundError(`There is no CRUD-enabled resource "${resourceKey}".`);
    }
    return resource.fields;
  }

  /** A route cannot declare a static permission for a URL-named resource, so it is checked here. */
  private authorize(
    principal: SessionPrincipal,
    resourceKey: string,
    action: string,
  ): ScopeDecision {
    if (!can(principal.permissions, resourceKey, action)) {
      throw new ForbiddenError(`You do not have the "${action}" permission on "${resourceKey}".`);
    }
    const decision = resolveScope(principal.permissions, resourceKey, action, {
      userId: principal.user.id,
      unitId: principal.user.organizationalUnitId,
    });
    if (decision.kind === 'denied') {
      throw new OutOfScopeError(
        `Your "${decision.scope ?? 'unresolved'}" scope for ${resourceKey}.${action} cannot be resolved.`,
      );
    }
    return decision;
  }

  /**
   * The unit a write lands in. A `SELF` grant does not constrain the unit (ownership
   * does); an org grant requires the unit to fall inside the caller's scope, defaulting
   * to the scope root when the caller omitted one.
   */
  private async resolveUnitForWrite(
    tx: Prisma.TransactionClient,
    decision: ScopeDecision,
    unitId: string | undefined,
  ): Promise<string | null> {
    if (decision.kind === 'all' || decision.kind === 'self') {
      if (unitId && !UUID_PATTERN.test(unitId)) {
        throw new ValidationError('The unit id must be a UUID.');
      }
      return unitId ?? null;
    }
    if (decision.kind === 'denied') {
      throw new OutOfScopeError('Your data scope for this resource cannot be resolved.');
    }

    const allowed = await scopeUnitIds(tx, decision);
    if (unitId === undefined) {
      return allowed[0] ?? null;
    }
    if (!UUID_PATTERN.test(unitId) || !allowed.includes(unitId)) {
      throw new ForbiddenError('The unit is outside your data scope.');
    }
    return unitId;
  }
}

async function recordScopeWhere(
  tx: Prisma.TransactionClient,
  decision: ScopeDecision,
  ownerUserId: string,
): Promise<Prisma.ResourceRecordWhereInput> {
  switch (decision.kind) {
    case 'all':
      return {};
    case 'self':
      return { ownerUserId };
    case 'subtree':
    case 'entity': {
      const unitIds = await scopeUnitIds(tx, decision);
      return unitIds.length > 0 ? { organizationalUnitId: { in: unitIds } } : { id: { in: [] } };
    }
    default:
      return { id: { in: [] } };
  }
}

async function scopeUnitIds(
  tx: Prisma.TransactionClient,
  decision: Extract<ScopeDecision, { kind: 'subtree' | 'entity' }>,
): Promise<string[]> {
  if (decision.kind === 'subtree') {
    return findOrgUnitSubtree(tx, decision.rootUnitId);
  }
  const entityId = await findOrgUnitEntity(tx, decision.rootUnitId);
  return entityId ? findOrgUnitIdsByEntity(tx, entityId) : [];
}

/**
 * Splits a request body into the reserved `unitId` and the field values, validating
 * every provided value against the registered field list. Unknown keys fail loudly; a
 * client that misspells a field must not have it silently dropped.
 */
function preparePayload(
  fields: readonly RegisteredField[],
  body: Record<string, unknown>,
  partial: boolean,
): { unitId: string | undefined; data: Record<string, unknown> } {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('The request body must be an object.');
  }

  const known = new Map(fields.map((field) => [field.key, field]));
  const data: Record<string, unknown> = {};
  let unitId: string | undefined;

  for (const [key, value] of Object.entries(body)) {
    if (key === RESERVED_UNIT_KEY) {
      if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
        throw new ValidationError('The unit id must be a UUID.');
      }
      unitId = value;
      continue;
    }
    const field = known.get(key);
    if (!field) {
      throw new ValidationError(`"${key}" is not a field of this resource.`);
    }
    data[key] = coerceFieldValue(field, value);
  }

  if (!partial) {
    for (const field of fields) {
      if (field.required && !(field.key in data)) {
        throw new ValidationError(`"${field.key}" is required.`);
      }
    }
  }

  return { unitId, data };
}

function coerceFieldValue(field: RegisteredField, value: unknown): unknown {
  if (value === null) {
    return null;
  }
  switch (field.dataType) {
    case 'NUMBER':
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new ValidationError(`"${field.key}" must be a number.`);
      }
      return value;
    case 'BOOLEAN':
      if (typeof value !== 'boolean') {
        throw new ValidationError(`"${field.key}" must be a boolean.`);
      }
      return value;
    case 'DATE':
    case 'DATETIME':
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
        throw new ValidationError(`"${field.key}" must be an ISO date string.`);
      }
      return value;
    case 'JSON':
      return value;
    default:
      if (typeof value !== 'string') {
        throw new ValidationError(`"${field.key}" must be a string.`);
      }
      return value;
  }
}

const REDACTED_PLACEHOLDER = '[REDACTED]';

function toSummary(
  row: {
    id: string;
    resourceKey: string;
    data: Prisma.JsonValue;
    organizationalUnitId: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  options?: { canViewSensitive?: boolean; fields?: readonly RegisteredField[] },
): ResourceRecordSummary {
  const data = (row.data as Record<string, unknown>) ?? {};
  if (options?.canViewSensitive === false && options.fields) {
    const masked: Record<string, unknown> = { ...data };
    for (const field of options.fields) {
      if (field.isSensitive && Object.prototype.hasOwnProperty.call(masked, field.key)) {
        masked[field.key] = REDACTED_PLACEHOLDER;
      }
    }
    return {
      id: row.id,
      resource: row.resourceKey,
      data: masked,
      unitId: row.organizationalUnitId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
  return {
    id: row.id,
    resource: row.resourceKey,
    data,
    unitId: row.organizationalUnitId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Splits a `resource.action` permission. The resource key may itself contain dots. */
function splitPermission(permission: string): { resource: string; action: string } {
  const dot = permission.lastIndexOf('.');
  if (dot <= 0 || dot === permission.length - 1) {
    throw new ValidationError(`"${permission}" is not a resource.action permission.`);
  }
  return { resource: permission.slice(0, dot), action: permission.slice(dot + 1) };
}
