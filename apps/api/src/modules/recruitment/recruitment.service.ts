import { Inject, Injectable } from '@nestjs/common';

import { withTenantContext } from '@hris/database';
import {
  buildPage,
  cursorFingerprint,
  resolveCursor,
  type JobApplicationQuery,
  type JobApplicationSummary,
  type JobRequisitionQuery,
  type JobRequisitionSummary,
  type Paginated,
  type PageParams,
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

const REQUISITION_SORT = { createdAt: 'desc', id: 'desc' } as const;
const APPLICATION_SORT = { createdAt: 'desc', id: 'desc' } as const;

export const APPLICATION_STAGES = [
  'APPLIED',
  'SCREENING',
  'INTERVIEW',
  'OFFER',
  'HIRED',
  'REJECTED',
] as const;

interface RequisitionRow {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly positionId: string | null;
  readonly department: string | null;
  readonly headcount: number;
  readonly status: string;
  readonly openedAt: Date | null;
  readonly closedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly deletedAt: Date | null;
  readonly position: { readonly name: string } | null;
}

interface ApplicationRow {
  readonly id: string;
  readonly requisitionId: string;
  readonly candidateId: string;
  readonly stage: string;
  readonly rating: number | null;
  readonly notes: string | null;
  readonly decidedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly deletedAt: Date | null;
  readonly requisition: { readonly id: string; readonly code: string; readonly title: string };
  readonly candidate: { readonly id: string; readonly fullName: string; readonly email: string };
}

/**
 * Recruitment: job requisitions, the candidate pool and the application
 * pipeline between them.
 *
 * Reads narrow through `recruitment:view`. Because requisitions and
 * candidates carry no organizational-unit anchor, `subtree`/`entity` scopes
 * see the full company pool while `self` scope sees only rows the caller
 * created.
 */
@Injectable()
export class RecruitmentService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  // ---------------------------------------------------------------------------
  // Requisitions
  // ---------------------------------------------------------------------------

  async listRequisitions(
    companyId: string,
    principal: SessionPrincipal,
    filter: JobRequisitionQuery,
    params: PageParams,
  ): Promise<Paginated<JobRequisitionSummary>> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const fingerprint = cursorFingerprint({
      filters: { ...filter, companyId },
      sort: REQUISITION_SORT,
    });
    const resolved = resolveCursor(params.cursor, fingerprint);
    if (!resolved.ok) {
      throw new ValidationError('The pagination cursor does not match the current filters');
    }

    const rows = await withTenantContext(
      client,
      companyId,
      async (tx) =>
        tx.jobRequisition.findMany({
          where: {
            companyId,
            deletedAt: null,
            ...scopeWhereForCreator(decision, principal.user.id),
            ...(filter.status ? { status: filter.status } : {}),
            ...(filter.search ? { OR: requisitionSearchWhere(filter.search) } : {}),
            ...(resolved.cursor.position.values.length > 0
              ? afterRequisitionCursor(resolved.cursor.position.values)
              : {}),
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: { position: { select: { name: true } } },
          take: params.limit + 1,
        }) as unknown as RequisitionRow[],
    );

    const items = rows.map(toRequisitionSummary);
    return buildPage(items, params, fingerprint, (item) => ({
      values: [item.createdAt, item.id],
    }));
  }

  async createRequisition(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly code: string;
      readonly title: string;
      readonly positionId: string | null;
      readonly department: string | null;
      readonly headcount: number;
    },
  ): Promise<JobRequisitionSummary> {
    const decision = this.readScope(principal);
    this.assertWritableScope(decision);
    if (input.headcount < 1) {
      throw new ValidationError('The headcount must be at least one.');
    }

    const client = this.prisma.getClient();
    const code = input.code.trim();
    const row = await withTenantContext(client, companyId, async (tx) => {
      const clash = await tx.jobRequisition.findFirst({
        where: { companyId, code, deletedAt: null },
        select: { id: true },
      });
      if (clash !== null) {
        throw new ConflictError(`A requisition with the code "${code}" already exists.`);
      }
      if (input.positionId !== null) {
        const position = await tx.position.findFirst({
          where: { id: input.positionId, companyId, deletedAt: null },
          select: { id: true },
        });
        if (position === null) {
          throw new NotFoundError('The position does not exist.');
        }
      }
      return tx.jobRequisition.create({
        data: {
          companyId,
          code,
          title: input.title.trim(),
          positionId: input.positionId,
          department: input.department,
          headcount: input.headcount,
          status: 'DRAFT',
          createdBy: principal.user.id,
        },
        include: { position: { select: { name: true } } },
      }) as unknown as RequisitionRow;
    });

    await this.audit(companyId, principal.user.id, 'recruitment.requisition_created', row.id, {
      code,
    });
    return toRequisitionSummary(row);
  }

  /** Advance a requisition: DRAFT → OPEN → FILLED → CLOSED. */
  async advanceRequisition(
    companyId: string,
    principal: SessionPrincipal,
    requisitionId: string,
  ): Promise<JobRequisitionSummary> {
    const decision = this.readScope(principal);
    this.assertWritableScope(decision);
    const client = this.prisma.getClient();

    const row = await withTenantContext(client, companyId, async (tx) => {
      const current = await tx.jobRequisition.findFirst({
        where: { id: requisitionId, companyId, deletedAt: null },
      });
      if (current === null) {
        throw new NotFoundError('The requisition does not exist.');
      }
      let nextStatus: string | null = null;
      let openedAt: Date | null = null;
      let closedAt: Date | null = null;
      switch (current.status) {
        case 'DRAFT':
          nextStatus = 'OPEN';
          openedAt = new Date();
          break;
        case 'OPEN':
          nextStatus = 'FILLED';
          break;
        case 'FILLED':
          nextStatus = 'CLOSED';
          closedAt = new Date();
          break;
        default:
          break;
      }
      if (nextStatus === null) {
        throw new ValidationError(
          `The requisition status "${current.status}" cannot be advanced further.`,
        );
      }
      return tx.jobRequisition.update({
        where: { id: requisitionId },
        data: {
          status: nextStatus,
          ...(openedAt === null ? {} : { openedAt }),
          ...(closedAt === null ? {} : { closedAt }),
        },
        include: { position: { select: { name: true } } },
      }) as unknown as RequisitionRow;
    });

    await this.audit(
      companyId,
      principal.user.id,
      'recruitment.requisition_advanced',
      requisitionId,
      { status: row.status },
    );
    return toRequisitionSummary(row);
  }

  // ---------------------------------------------------------------------------
  // Applications (pipeline)
  // ---------------------------------------------------------------------------

  async listApplications(
    companyId: string,
    principal: SessionPrincipal,
    filter: JobApplicationQuery,
    params: PageParams,
  ): Promise<Paginated<JobApplicationSummary>> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const fingerprint = cursorFingerprint({
      filters: { ...filter, companyId },
      sort: APPLICATION_SORT,
    });
    const resolved = resolveCursor(params.cursor, fingerprint);
    if (!resolved.ok) {
      throw new ValidationError('The pagination cursor does not match the current filters');
    }

    const rows = await withTenantContext(
      client,
      companyId,
      async (tx) =>
        tx.jobApplication.findMany({
          where: {
            companyId,
            deletedAt: null,
            ...scopeWhereForCreator(decision, principal.user.id),
            ...(filter.requisitionId ? { requisitionId: filter.requisitionId } : {}),
            ...(filter.stage ? { stage: filter.stage } : {}),
            ...(filter.search
              ? {
                  OR: [
                    {
                      candidate: {
                        fullName: { contains: filter.search, mode: 'insensitive' as const },
                      },
                    },
                    {
                      requisition: {
                        title: { contains: filter.search, mode: 'insensitive' as const },
                      },
                    },
                  ],
                }
              : {}),
            ...(resolved.cursor.position.values.length > 0
              ? afterApplicationCursor(resolved.cursor.position.values)
              : {}),
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: {
            requisition: { select: { id: true, code: true, title: true } },
            candidate: { select: { id: true, fullName: true, email: true } },
          },
          take: params.limit + 1,
        }) as unknown as ApplicationRow[],
    );

    const items = rows.map(toApplicationSummary);
    return buildPage(items, params, fingerprint, (item) => ({
      values: [item.createdAt, item.id],
    }));
  }

  async createApplication(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly requisitionId: string;
      readonly candidateId: string;
      readonly notes: string | null;
    },
  ): Promise<JobApplicationSummary> {
    const decision = this.readScope(principal);
    this.assertWritableScope(decision);
    const client = this.prisma.getClient();

    const row = await withTenantContext(client, companyId, async (tx) => {
      const requisition = await tx.jobRequisition.findFirst({
        where: { id: input.requisitionId, companyId, deletedAt: null },
        select: { status: true },
      });
      if (requisition === null) {
        throw new NotFoundError('The requisition does not exist.');
      }
      if (requisition.status !== 'OPEN') {
        throw new ValidationError('Applications can only be added to an open requisition.');
      }
      const candidate = await tx.jobCandidate.findFirst({
        where: { id: input.candidateId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (candidate === null) {
        throw new NotFoundError('The candidate does not exist.');
      }
      const existing = await tx.jobApplication.findFirst({
        where: {
          companyId,
          requisitionId: input.requisitionId,
          candidateId: input.candidateId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (existing !== null) {
        throw new ConflictError('The candidate has already applied to this requisition.');
      }
      return tx.jobApplication.create({
        data: {
          companyId,
          requisitionId: input.requisitionId,
          candidateId: input.candidateId,
          stage: 'APPLIED',
          notes: input.notes,
          createdBy: principal.user.id,
        },
        include: {
          requisition: { select: { id: true, code: true, title: true } },
          candidate: { select: { id: true, fullName: true, email: true } },
        },
      }) as unknown as ApplicationRow;
    });

    await this.audit(companyId, principal.user.id, 'recruitment.application_created', row.id);
    return toApplicationSummary(row);
  }

  /** Move one application to the next pipeline stage. */
  async advanceApplication(
    companyId: string,
    principal: SessionPrincipal,
    applicationId: string,
  ): Promise<JobApplicationSummary> {
    const decision = this.readScope(principal);
    this.assertWritableScope(decision);
    const client = this.prisma.getClient();

    const row = await withTenantContext(client, companyId, async (tx) => {
      const current = await tx.jobApplication.findFirst({
        where: { id: applicationId, companyId, deletedAt: null },
      });
      if (current === null) {
        throw new NotFoundError('The application does not exist.');
      }
      const index = APPLICATION_STAGES.indexOf(
        current.stage as (typeof APPLICATION_STAGES)[number],
      );
      if (index === -1 || index === APPLICATION_STAGES.length - 1) {
        throw new ValidationError(
          `The application stage "${current.stage}" cannot be advanced further.`,
        );
      }
      const nextStage: string = APPLICATION_STAGES[index + 1] ?? 'SCREENING';
      const decidedAt: Date | null =
        nextStage === 'HIRED' || nextStage === 'REJECTED' ? new Date() : null;
      return tx.jobApplication.update({
        where: { id: applicationId },
        data: { stage: nextStage, ...(decidedAt === null ? {} : { decidedAt }) },
        include: {
          requisition: { select: { id: true, code: true, title: true } },
          candidate: { select: { id: true, fullName: true, email: true } },
        },
      }) as unknown as ApplicationRow;
    });

    await this.audit(
      companyId,
      principal.user.id,
      'recruitment.application_advanced',
      applicationId,
      { stage: row.stage },
    );
    return toApplicationSummary(row);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private readScope(principal: SessionPrincipal): ScopeDecision {
    const decision = resolveScope(principal.permissions, 'recruitment', 'view', {
      userId: principal.user.id,
      unitId: principal.user.organizationalUnitId,
    });
    if (decision.kind === 'denied') {
      throw new OutOfScopeError(
        `Your "${decision.scope ?? 'unresolved'}" scope for recruitment.view cannot be resolved.`,
      );
    }
    return decision;
  }

  private assertWritableScope(decision: ScopeDecision): void {
    if (decision.kind === 'entity' && decision.rootUnitId === undefined) {
      throw new OutOfScopeError('Your scope cannot be resolved for recruitment changes.');
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
      resource: 'recruitment',
      resourceId,
      status: 'SUCCESS',
    });
    await this.logs.writeAudit(companyId, {
      actorUserId,
      action,
      resource: 'recruitment',
      resourceId,
      ...(payload === undefined ? {} : { payload }),
    });
  }
}

function scopeWhereForCreator(
  decision: ScopeDecision,
  callerUserId: string,
): Record<string, unknown> {
  if (decision.kind === 'self') {
    return { createdBy: callerUserId };
  }
  return {};
}

function requisitionSearchWhere(search: string): Record<string, unknown>[] {
  const q = search.trim();
  if (q.length === 0) return [];
  return [
    { title: { contains: q, mode: 'insensitive' as const } },
    { code: { contains: q, mode: 'insensitive' as const } },
    { department: { contains: q, mode: 'insensitive' as const } },
  ];
}

function afterRequisitionCursor(values: readonly string[]): Record<string, unknown> {
  const createdAt = new Date(values[0] ?? '');
  const id = values[1] ?? '';
  return { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }] };
}

function afterApplicationCursor(values: readonly string[]): Record<string, unknown> {
  const createdAt = new Date(values[0] ?? '');
  const id = values[1] ?? '';
  return { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }] };
}

function toRequisitionSummary(row: RequisitionRow): JobRequisitionSummary {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    positionId: row.positionId,
    positionTitle: row.position?.name ?? null,
    department: row.department,
    headcount: row.headcount,
    status: row.status,
    openedAt: row.openedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toApplicationSummary(row: ApplicationRow): JobApplicationSummary {
  return {
    id: row.id,
    requisitionId: row.requisitionId,
    requisitionCode: row.requisition.code,
    requisitionTitle: row.requisition.title,
    candidateId: row.candidateId,
    candidateName: row.candidate.fullName,
    candidateEmail: row.candidate.email,
    stage: row.stage,
    rating: row.rating,
    notes: row.notes,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
