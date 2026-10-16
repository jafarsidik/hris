import { Inject, Injectable, type OnModuleInit, Logger } from '@nestjs/common';

import { withTenantContext, type Prisma } from '@hris/database';
import { type BusinessRuleAction, type BusinessRuleSummary } from '@hris/shared-types';

import { NotFoundError } from '../../common/errors/app-error';
import { DomainEventBus } from '../events/domain-event-bus.service';
import type { DomainEvent } from '../events/domain-event.types';
import { LogService } from '../logs/log.service';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../database/prisma.service';
import { WorkflowService, type WorkflowActor } from '../workflows/workflow.service';

/**
 * CRUD input, validated by the controller's DTO; kept structural here so the
 * service can be exercised without Nest's validation pipe (e.g. from a test).
 */
export interface BusinessRuleInput {
  readonly name: string;
  readonly description: string | null;
  readonly eventType: string;
  readonly condition: Record<string, unknown>;
  readonly actions: readonly BusinessRuleAction[];
  readonly priority: number;
  readonly isEnabled: boolean;
}

interface RuleRow {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly eventType: string;
  readonly condition: unknown;
  readonly actions: unknown;
  readonly priority: number;
  readonly isEnabled: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function toRule(row: RuleRow): BusinessRuleSummary {
  const condition =
    typeof row.condition === 'object' && row.condition !== null && !Array.isArray(row.condition)
      ? (row.condition as Record<string, unknown>)
      : {};
  const actions = Array.isArray(row.actions) ? (row.actions as readonly BusinessRuleAction[]) : [];
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    eventType: row.eventType,
    condition,
    actions,
    priority: row.priority,
    isEnabled: row.isEnabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function resolveField(payload: unknown, field: string): unknown {
  return field.split('.').reduce<unknown>((acc, part) => {
    if (typeof acc === 'object' && acc !== null) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, payload);
}

function evaluateClause(clause: unknown, payload: unknown): boolean {
  if (typeof clause !== 'object' || clause === null) {
    return true;
  }
  const c = clause as { field?: unknown; op?: unknown; value?: unknown };
  if (typeof c.field !== 'string' || typeof c.op !== 'string') {
    return true;
  }
  const value = resolveField(payload, c.field);
  switch (c.op) {
    case 'eq':
      return value === c.value;
    case 'ne':
      return value !== c.value;
    case 'contains':
      if (typeof value === 'string' && typeof c.value === 'string') {
        return value.includes(c.value);
      }
      if (Array.isArray(value)) {
        return value.includes(c.value);
      }
      return false;
    case 'in':
      return Array.isArray(c.value) && (c.value as readonly unknown[]).includes(value);
    case 'gt':
      return typeof value === 'number' && typeof c.value === 'number' && value > c.value;
    case 'gte':
      return typeof value === 'number' && typeof c.value === 'number' && value >= c.value;
    case 'lt':
      return typeof value === 'number' && typeof c.value === 'number' && value < c.value;
    case 'lte':
      return typeof value === 'number' && typeof c.value === 'number' && value <= c.value;
    case 'exists':
      return value !== undefined && value !== null;
    case 'notExists':
      return value === undefined || value === null;
    default:
      return false;
  }
}

function evaluateNode(node: unknown, payload: unknown): boolean {
  if (typeof node !== 'object' || node === null) {
    return true;
  }
  if ('field' in (node as Record<string, unknown>) && 'op' in (node as Record<string, unknown>)) {
    return evaluateClause(node, payload);
  }
  const root = node as { all?: unknown; any?: unknown };
  let result = true;
  if (Array.isArray(root.all)) {
    result = result && root.all.every((child) => evaluateNode(child, payload));
  }
  if (Array.isArray(root.any)) {
    result = result && root.any.some((child) => evaluateNode(child, payload));
  }
  // An otherwise-empty condition is treated as always true.
  if (!Array.isArray(root.all) && !Array.isArray(root.any)) {
    return true;
  }
  return result;
}

/**
 * Returns true when the event satisfies the rule's condition.
 */
function ruleMatches(rule: RuleRow, event: DomainEvent): boolean {
  return evaluateNode(rule.condition, event.payload);
}

/**
 * Business rules: event trigger + condition + actions.
 *
 * The engine subscribes to every domain event on startup; for a matching event type
 * the rules (sorted by priority, then creation time) are evaluated, and each one
 * that matches runs its actions in isolation so a failing action cannot block its
 * neighbour or the request that produced the event.
 */
@Injectable()
export class BusinessRulesService implements OnModuleInit {
  private readonly logger = new Logger(BusinessRulesService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
    @Inject(NotificationService) private readonly notifications: NotificationService,
    @Inject(WorkflowService) private readonly workflows: WorkflowService,
    @Inject(DomainEventBus) private readonly bus: DomainEventBus,
  ) {}

  onModuleInit(): void {
    // Subscribe generically so rules can be added for any event type the platform emits.
    this.bus.subscribeAll<Record<string, unknown>>((event) => this.handleEvent(event));
  }

  /** Runs every enabled rule for the event's type. Best-effort, never throws. */
  private async handleEvent<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    try {
      const client = this.prisma.getClient();
      await withTenantContext(client, event.companyId, async (tx) => {
        const rules = await tx.businessRule.findMany({
          where: { eventType: event.type, isEnabled: true },
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        });
        const rulesTyped = rules as unknown as RuleRow[];
        for (const rule of rulesTyped) {
          if (!ruleMatches(rule, event as DomainEvent)) {
            continue;
          }
          await this.executeActions(rule, event as DomainEvent);
          await this.logs.writeAudit(event.companyId, {
            actorUserId: event.actorUserId ?? undefined,
            action: 'business_rule.triggered',
            resource: 'business_rule',
            resourceId: rule.id,
            payload: { eventType: event.type },
          });
        }
      });
    } catch (error: unknown) {
      this.logger.error(
        `Business rules for "${event.type}" failed: ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  /** Runs one rule's actions; a failing action is logged and skipped. */
  private async executeActions(rule: RuleRow, event: DomainEvent): Promise<void> {
    const actions = Array.isArray(rule.actions)
      ? (rule.actions as readonly BusinessRuleAction[])
      : [];
    const actor: WorkflowActor = {
      companyId: event.companyId,
      userId: event.actorUserId ?? '',
      permissions: [],
    };

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'NOTIFY':
            if (action.recipientUserId !== undefined) {
              await this.notifications.emit(event.companyId, event.actorUserId, {
                eventKey: 'settings.changed',
                userId: action.recipientUserId,
                title: action.title,
                description: action.description,
                href: action.href,
                metadata: { resource: event.resource, resourceId: event.resourceId },
              });
            } else if (action.recipientRole !== undefined) {
              // Static recipients are resolved when the action runs; for a v1 best-effort
              // implementation we emit against the triggering actor, since role resolution
              // would need the user store and risks expanding beyond the scope of this wave.
              if (event.actorUserId !== null) {
                await this.notifications.emit(event.companyId, event.actorUserId, {
                  eventKey: 'settings.changed',
                  userId: event.actorUserId,
                  title: action.title,
                  description: action.description,
                  href: action.href,
                  metadata: {
                    resource: event.resource,
                    resourceId: event.resourceId,
                    role: action.recipientRole,
                  },
                });
              }
            }
            break;
          case 'START_WORKFLOW':
            try {
              await this.workflows.startInstance(actor, {
                definitionId: action.definitionId,
                resource: action.resource ?? event.resource,
                resourceId: action.resourceId ?? event.resourceId,
              });
            } catch (error: unknown) {
              this.logger.warn(
                `START_WORKFLOW action failed: ` +
                  (error instanceof Error ? error.message : String(error)),
              );
            }
            break;
          case 'EMIT_WEBHOOK':
            // Re-emits a derived event so subscribed webhooks (and other rules) can react.
            await this.bus.emit({
              type: action.eventType,
              companyId: event.companyId,
              actorUserId: event.actorUserId,
              resource: event.resource,
              resourceId: event.resourceId,
              payload: { ...(event.payload as Record<string, unknown>), ...(action.payload ?? {}) },
              occurredAt: new Date(),
            });
            break;
          default:
            this.logger.warn(`Unknown business-rule action type.`);
            break;
        }
      } catch (error: unknown) {
        this.logger.error(
          `Business-rule action "${action.type}" failed for "${rule.name}": ` +
            (error instanceof Error ? error.message : String(error)),
        );
      }
    }
  }

  // ---------------------------------------------------------------- CRUD ----

  async list(companyId: string, eventType?: string): Promise<BusinessRuleSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const rows = await tx.businessRule.findMany({
        where: eventType === undefined ? {} : { eventType },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      });
      return rows.map((row: RuleRow) => toRule(row as unknown as RuleRow));
    });
  }

  async get(companyId: string, id: string): Promise<BusinessRuleSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const row = await tx.businessRule.findFirst({ where: { id } });
      if (row === null) {
        throw new NotFoundError('The business rule does not exist.');
      }
      return toRule(row as unknown as RuleRow);
    });
  }

  async create(
    actor: { companyId: string; userId: string },
    input: BusinessRuleInput,
  ): Promise<BusinessRuleSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const row = await tx.businessRule.create({
        data: {
          companyId: actor.companyId,
          name: input.name,
          description: input.description,
          eventType: input.eventType,
          condition: input.condition as unknown as object,
          actions: input.actions as unknown as object[],
          priority: input.priority,
          isEnabled: input.isEnabled,
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'business_rule.create',
        resource: 'business_rule',
        resourceId: row.id,
        payload: { name: input.name, eventType: input.eventType },
      });
      return toRule(row as unknown as RuleRow);
    });
  }

  async update(
    actor: { companyId: string; userId: string },
    id: string,
    input: Partial<BusinessRuleInput>,
  ): Promise<BusinessRuleSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const existing = await tx.businessRule.findFirst({
        where: { id },
      });
      if (existing === null) {
        throw new NotFoundError('The business rule does not exist.');
      }
      const row = await tx.businessRule.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.eventType !== undefined ? { eventType: input.eventType } : {}),
          ...(input.condition !== undefined ? { condition: input.condition } : {}),
          ...(input.actions !== undefined ? { actions: input.actions as unknown as object[] } : {}),
          ...(input.priority !== undefined ? { priority: input.priority } : {}),
          ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
        } as unknown as Prisma.BusinessRuleUpdateInput,
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'business_rule.update',
        resource: 'business_rule',
        resourceId: id,
        payload: { name: existing.name },
      });
      return toRule(row as unknown as RuleRow);
    });
  }

  async remove(actor: { companyId: string; userId: string }, id: string): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, actor.companyId, async (tx) => {
      const existing = await tx.businessRule.findFirst({
        where: { id },
      });
      if (existing === null) {
        throw new NotFoundError('The business rule does not exist.');
      }
      await tx.businessRule.delete({ where: { id } });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'business_rule.delete',
        resource: 'business_rule',
        resourceId: id,
        payload: { name: existing.name },
      });
    });
  }

  async toggle(
    actor: { companyId: string; userId: string },
    id: string,
    isEnabled: boolean,
  ): Promise<BusinessRuleSummary> {
    return this.update(actor, id, { isEnabled });
  }
}
