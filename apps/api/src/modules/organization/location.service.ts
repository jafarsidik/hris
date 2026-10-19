import { Inject, Injectable } from '@nestjs/common';

import { type Prisma, withTenantContext } from '@hris/database';
import {
  buildPage,
  cursorFingerprint,
  resolveCursor,
  type Paginated,
  type PageParams,
  type WorkLocationQuery,
  type WorkLocationSummary,
} from '@hris/shared-types';

import { PrismaService } from '../database/prisma.service';
import { LogService } from '../logs/log.service';
import { resolveScope, type ScopeDecision } from '../../common/auth/data-scope';
import { type SessionPrincipal } from '../../common/auth/permission.service';
import { NotFoundError, OutOfScopeError, ValidationError } from '../../common/errors/app-error';

const LOCATION_SORT = [{ createdAt: 'asc' as const }, { id: 'asc' as const }];

const LOCATION_SELECT = {
  id: true,
  code: true,
  name: true,
  city: true,
  country: true,
  address: true,
  timezone: true,
  isHeadquarters: true,
  createdAt: true,
  updatedAt: true,
} as const;

interface LocationRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly city: string | null;
  readonly country: string | null;
  readonly address: string | null;
  readonly timezone: string | null;
  readonly isHeadquarters: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Work locations: offices and sites of the company.
 *
 * Reads require `organization:view`; writes require company-wide scope,
 * matching the legal-entity and unit gateways in `OrganizationService`.
 */
@Injectable()
export class LocationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  async list(
    companyId: string,
    principal: SessionPrincipal,
    filter: WorkLocationQuery,
    params: PageParams,
  ): Promise<Paginated<WorkLocationSummary>> {
    this.readScope(principal);
    const client = this.prisma.getClient();
    const fingerprint = cursorFingerprint({
      filters: { ...filter, companyId },
      sort: LOCATION_SORT,
    });
    const resolved = resolveCursor(params.cursor, fingerprint);
    if (!resolved.ok) {
      throw new ValidationError('The pagination cursor does not match the current filters');
    }
    const values = resolved.cursor.position.values;
    const after: Record<string, unknown> =
      values.length > 0
        ? {
            OR: [
              { createdAt: { gt: new Date(values[0] ?? '') } },
              { createdAt: new Date(values[0] ?? ''), id: { gt: values[1] ?? '' } },
            ],
          }
        : {};

    const rows = await withTenantContext(client, companyId, async (tx) => {
      const city = filter.city?.trim() ?? '';
      return tx.workLocation.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
          ...(filter.search
            ? {
                OR: locationSearch(filter.search),
              }
            : {}),
          ...after,
        },
        orderBy: LOCATION_SORT,
        select: LOCATION_SELECT,
        take: params.limit + 1,
      }) as unknown as LocationRow[];
    });

    const items = rows.map(toLocationSummary);
    return buildPage(items, params, fingerprint, (item) => ({
      values: [item.createdAt, item.id],
    }));
  }

  async create(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly code: string;
      readonly name: string;
      readonly city: string | null;
      readonly country: string | null;
      readonly address: string | null;
      readonly timezone: string | null;
      readonly isHeadquarters: boolean;
    },
  ): Promise<WorkLocationSummary> {
    this.assertWritable(principal);
    const client = this.prisma.getClient();
    const code = input.code.trim();
    const row = await withTenantContext(client, companyId, async (tx) => {
      await this.assertCodeFree(tx, companyId, code, null);
      return tx.workLocation.create({
        data: {
          companyId,
          code,
          name: input.name.trim(),
          city: input.city,
          country: input.country,
          address: input.address,
          timezone: input.timezone,
          isHeadquarters: input.isHeadquarters,
          createdBy: principal.user.id,
        },
        select: LOCATION_SELECT,
      }) as unknown as LocationRow;
    });
    await this.audit(companyId, principal.user.id, 'organization.location_created', row.id);
    return toLocationSummary(row);
  }

  async update(
    companyId: string,
    principal: SessionPrincipal,
    id: string,
    input: {
      readonly code?: string;
      readonly name?: string;
      readonly city?: string | null;
      readonly country?: string | null;
      readonly address?: string | null;
      readonly timezone?: string | null;
      readonly isHeadquarters?: boolean;
    },
  ): Promise<WorkLocationSummary> {
    this.assertWritable(principal);
    const client = this.prisma.getClient();
    const row = await withTenantContext(client, companyId, async (tx) => {
      const existing = await tx.workLocation.findFirst({
        where: { id, companyId, deletedAt: null },
        select: { id: true, code: true },
      });
      if (existing === null) {
        throw new NotFoundError('The work location does not exist.');
      }
      if (input.code !== undefined && input.code.trim() !== existing.code) {
        await this.assertCodeFree(tx, companyId, input.code.trim(), id);
      }
      return tx.workLocation.update({
        where: { id },
        data: {
          ...(input.code === undefined ? {} : { code: input.code.trim() }),
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.city === undefined ? {} : { city: input.city }),
          ...(input.country === undefined ? {} : { country: input.country }),
          ...(input.address === undefined ? {} : { address: input.address }),
          ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
          ...(input.isHeadquarters === undefined ? {} : { isHeadquarters: input.isHeadquarters }),
        },
        select: LOCATION_SELECT,
      }) as unknown as LocationRow;
    });
    await this.audit(companyId, principal.user.id, 'organization.location_updated', row.id);
    return toLocationSummary(row);
  }

  async remove(companyId: string, principal: SessionPrincipal, id: string): Promise<void> {
    this.assertWritable(principal);
    const client = this.prisma.getClient();
    await withTenantContext(client, companyId, async (tx) => {
      const existing = await tx.workLocation.findFirst({
        where: { id, companyId, deletedAt: null },
        select: { id: true },
      });
      if (existing === null) {
        throw new NotFoundError('The work location does not exist.');
      }
      await tx.workLocation.update({
        where: { id },
        data: { deletedAt: new Date() },
        select: { id: true },
      });
    });
    await this.audit(companyId, principal.user.id, 'organization.location_deleted', id);
  }

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

  private assertWritable(principal: SessionPrincipal): void {
    const decision = this.readScope(principal);
    if (decision.kind !== 'all') {
      throw new OutOfScopeError('Your scope does not allow editing work locations.');
    }
  }

  private async assertCodeFree(
    tx: Prisma.TransactionClient,
    companyId: string,
    code: string,
    excludeId: string | null,
  ): Promise<void> {
    const clash = await tx.workLocation.findFirst({
      where: {
        companyId,
        code: { equals: code, mode: 'insensitive' },
        deletedAt: null,
        ...(excludeId === null ? {} : { id: { not: excludeId } }),
      },
      select: { id: true },
    });
    if (clash !== null) {
      throw new ValidationError(`A work location with code ${code} already exists.`);
    }
  }

  private async audit(
    companyId: string,
    actorUserId: string,
    action: string,
    resourceId: string,
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
    });
  }
}

function toLocationSummary(row: LocationRow): WorkLocationSummary {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    city: row.city,
    country: row.country,
    address: row.address,
    timezone: row.timezone,
    isHeadquarters: row.isHeadquarters,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function locationSearch(search: string): Record<string, unknown>[] {
  const q = search.trim();
  return [
    { name: { contains: q, mode: 'insensitive' } },
    { code: { contains: q, mode: 'insensitive' } },
    { city: { contains: q, mode: 'insensitive' } },
  ];
}
