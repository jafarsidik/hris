import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import { withTenantContext } from '@hris/database';

import type { ScheduledActionAction, ScheduledActionSummary } from '@hris/shared-types';

import { ValidationError, NotFoundError } from '../../common/errors/app-error';
import { DomainEventBus } from '../events/domain-event-bus.service';
import { LogService } from '../logs/log.service';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../database/prisma.service';
import { WorkflowService, type WorkflowActor } from '../workflows/workflow.service';
import { nextCronDate } from './cron';

export interface ScheduledActionInput {
  readonly name: string;
  readonly description: string | null;
  readonly cron: string;
  readonly action: ScheduledActionAction;
  readonly isEnabled: boolean;
}

interface ActionRow {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly cron: string;
  readonly action: unknown;
  readonly isEnabled: boolean;
  readonly nextRunAt: Date | null;
  readonly lastRunAt: Date | null;
  readonly lastError: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function asAction(value: unknown): ScheduledActionAction {
  if (typeof value === 'object' && value !== null && !Array.isArray(value) && 'type' in value) {
    return value as ScheduledActionAction;
  }
  return { type: 'NOTIFY', recipientUserId: '', title: '' } as ScheduledActionAction;
}

function toSummary(row: ActionRow): ScheduledActionSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    cron: row.cron,
    action: asAction(row.action),
    isEnabled: row.isEnabled,
    nextRunAt: row.nextRunAt === null ? null : row.nextRunAt.toISOString(),
    lastRunAt: row.lastRunAt === null ? null : row.lastRunAt.toISOString(),
    lastError: row.lastError,
  };
}

/** Raw claim: identifies a tenant the runner must tenant-context into. */
interface DueRow {
  readonly id: string;
  readonly company_id: string;
  readonly cron: string;
  readonly action: unknown;
}

/**
 * Scheduled actions: cron-triggered automation. The runner ticks on a timer, scans the
 * privileged `next_due_scheduled_actions` function for due rows across tenants, claims
 * each one atomically and executes its action in-process.
 */
@Injectable()
export class ScheduledActionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScheduledActionsService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
    @Inject(NotificationService) private readonly notifications: NotificationService,
    @Inject(WorkflowService) private readonly workflows: WorkflowService,
    @Inject(DomainEventBus) private readonly bus: DomainEventBus,
  ) {}

  onModuleInit(): void {
    // Disable the background tick under tests; tests call `runDue()` themselves.
    if (process.env.NODE_ENV !== 'test') {
      this.timer = setInterval(() => {
        void this.runDue();
      }, 60_000);
    }
  }

  onModuleDestroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async list(companyId: string): Promise<ScheduledActionSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const rows = await tx.scheduledAction.findMany({
        orderBy: { name: 'asc' },
      });
      return rows.map((row) => toSummary(row as unknown as ActionRow));
    });
  }

  async get(companyId: string, id: string): Promise<ScheduledActionSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const row = await tx.scheduledAction.findFirst({ where: { id } });
      if (row === null) {
        throw new NotFoundError('The scheduled action does not exist.');
      }
      return toSummary(row as unknown as ActionRow);
    });
  }

  async create(
    actor: { companyId: string; userId: string },
    input: ScheduledActionInput,
  ): Promise<ScheduledActionSummary> {
    if (nextCronDate(input.cron, new Date()) === null) {
      throw new ValidationError('The cron expression is invalid.');
    }
    const client = this.prisma.getClient();
    const initialNext = nextCronDate(input.cron, new Date());
    return withTenantContext(client, actor.companyId, async (tx) => {
      const row = await tx.scheduledAction.create({
        data: {
          companyId: actor.companyId,
          name: input.name,
          description: input.description,
          cron: input.cron,
          action: input.action as unknown as object,
          isEnabled: input.isEnabled,
          nextRunAt: initialNext,
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'scheduled_action.create',
        resource: 'scheduled_action',
        resourceId: row.id,
        payload: { name: input.name, cron: input.cron },
      });
      return toSummary(row as unknown as ActionRow);
    });
  }

  async update(
    actor: { companyId: string; userId: string },
    id: string,
    input: Partial<ScheduledActionInput>,
  ): Promise<ScheduledActionSummary> {
    if (input.cron !== undefined && nextCronDate(input.cron, new Date()) === null) {
      throw new ValidationError('The cron expression is invalid.');
    }
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const existing = await tx.scheduledAction.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The scheduled action does not exist.');
      }
      const nextCron = input.cron ?? existing.cron;
      const row = await tx.scheduledAction.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.cron !== undefined ? { cron: input.cron } : {}),
          ...(input.action !== undefined ? { action: input.action as unknown as object } : {}),
          ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
          nextRunAt: nextCronDate(nextCron, new Date()),
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'scheduled_action.update',
        resource: 'scheduled_action',
        resourceId: id,
        payload: { name: existing.name },
      });
      return toSummary(row as unknown as ActionRow);
    });
  }

  async remove(actor: { companyId: string; userId: string }, id: string): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, actor.companyId, async (tx) => {
      const existing = await tx.scheduledAction.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The scheduled action does not exist.');
      }
      await tx.scheduledAction.delete({ where: { id } });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'scheduled_action.delete',
        resource: 'scheduled_action',
        resourceId: id,
        payload: { name: existing.name },
      });
    });
  }

  async toggle(
    actor: { companyId: string; userId: string },
    id: string,
    isEnabled: boolean,
  ): Promise<ScheduledActionSummary> {
    return this.update(actor, id, { isEnabled });
  }

  /** Runs one action immediately, ignoring its schedule. */
  async runNow(
    actor: { companyId: string; userId: string },
    id: string,
  ): Promise<{ readonly ok: boolean; readonly error?: string }> {
    const client = this.prisma.getClient();
    const row = await withTenantContext(client, actor.companyId, async (tx) => {
      return tx.scheduledAction.findFirst({ where: { id } });
    });
    if (row === null) {
      throw new NotFoundError('The scheduled action does not exist.');
    }
    const error = await this.executeOne(
      actor.companyId,
      toSummary(row as unknown as ActionRow).cron,
      asAction(row.action as unknown),
    );
    if (error === null) {
      await withTenantContext(client, actor.companyId, async (tx) => {
        await tx.scheduledAction.update({
          where: { id },
          data: { lastRunAt: new Date(), lastError: null },
        });
      });
    } else {
      await withTenantContext(client, actor.companyId, async (tx) => {
        await tx.scheduledAction.update({
          where: { id },
          data: { lastRunAt: new Date(), lastError: error.slice(0, 1000) },
        });
      });
    }
    return { ok: error === null, ...(error === null ? {} : { error }) };
  }

  /**
   * Claims and executes every action due across tenants.
   *
   * Used by the background timer and by tests. Returns the number of actions
   * that were due at the start, regardless of whether they succeeded.
   */
  async runDue(): Promise<number> {
    const client = this.prisma.getClient();
    let due = 0;
    try {
      const rows =
        (await client.$queryRaw`SELECT * FROM next_due_scheduled_actions(${new Date()}, ${50})`) as DueRow[];
      due = rows.length;
      for (const row of rows) {
        const companyId = String(row.company_id);
        const id = String(row.id);
        const cron = String(row.cron);
        const action = asAction(row.action);
        const next = nextCronDate(cron, new Date());
        // Atomic claim: only the first replica to update the row's next_run_at wins.
        let claimed = false;
        await withTenantContext(client, companyId, async (tx) => {
          const result = await tx.scheduledAction.updateMany({
            where: { id, isEnabled: true, nextRunAt: { lte: new Date() } },
            data: { nextRunAt: next ?? undefined },
          });
          claimed = result.count === 1;
        });
        if (!claimed) {
          continue;
        }
        const error = await this.executeOne(companyId, cron, action);
        await withTenantContext(client, companyId, async (tx) => {
          await tx.scheduledAction.update({
            where: { id },
            data: {
              lastRunAt: new Date(),
              lastError: error === null ? null : error.slice(0, 1000),
            },
          });
        });
      }
    } catch (error: unknown) {
      this.logger.error(
        `Scheduled action runner failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return due;
  }

  /** Returns an error message on failure, or null on success. */
  private async executeOne(
    companyId: string,
    cron: string,
    action: ScheduledActionAction,
  ): Promise<string | null> {
    const actor: WorkflowActor = { companyId, userId: '', permissions: [] };
    try {
      switch (action.type) {
        case 'START_WORKFLOW':
          try {
            await this.workflows.startInstance(actor, {
              definitionId: action.definitionId,
              resource: action.resource ?? null,
              resourceId: action.resourceId ?? null,
            });
          } catch (error: unknown) {
            return error instanceof Error ? error.message : String(error);
          }
          break;
        case 'NOTIFY':
          if (action.recipientUserId !== undefined && action.recipientUserId !== '') {
            try {
              await this.notifications.emit(companyId, action.recipientUserId, {
                eventKey: 'settings.changed',
                userId: action.recipientUserId,
                title: action.title,
                description: action.description,
                href: action.href,
                metadata: { fromScheduledAction: true },
              });
            } catch (error: unknown) {
              return error instanceof Error ? error.message : String(error);
            }
          }
          break;
        case 'EMIT_EVENT':
          await this.bus.emit({
            type: action.eventType,
            companyId,
            actorUserId: null,
            resource: 'scheduled-action',
            resourceId: companyId,
            payload: action.payload ?? {},
            occurredAt: new Date(),
          });
          break;
        default:
          return `Unknown action type.`;
      }
    } catch (error: unknown) {
      return error instanceof Error ? error.message : String(error);
    }
    return null;
  }
}
