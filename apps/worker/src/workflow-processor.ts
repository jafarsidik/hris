import {
  LOG_EVENT_TYPES,
  NOTIFICATION_EVENT_KINDS,
  NOTIFICATION_TEMPLATE_DEFAULTS,
  QUEUE_WORKFLOW,
  WORKFLOW_SLA_JOB,
  parsePermissionKey,
  renderNotificationMessage,
  type NotificationChannel,
  type NotificationEventKey,
  type WorkflowSlaJob,
  type WorkflowStepDefinition,
} from '@hris/shared-types';
import { type DatabaseClient, type Prisma, withTenantContext } from '@hris/database';
import { Worker, type Job } from 'bullmq';

import { bullConnectionOptions, type WorkerConfig } from './config';
import type { Logger } from './logger';

export interface WorkflowWorkerDeps {
  readonly config: WorkerConfig;
  readonly prisma: DatabaseClient;
  readonly logger: Logger;
}

type DbNotificationKind = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

const KIND_TO_DB: Readonly<Record<string, DbNotificationKind>> = {
  info: 'INFO',
  success: 'SUCCESS',
  warning: 'WARNING',
  error: 'ERROR',
};

/** The permission that owns escalation when a step does not name its own policy. */
const DEFAULT_ESCALATION_POLICY = 'workflow.manage';

/**
 * Creates the BullMQ worker for the workflow queue.
 *
 * The only job on this queue is the delayed SLA timer the API arms when a step opens
 * a task. When it fires the worker decides whether the task is still open and, if so,
 * escalates it to a higher authority. It runs in this process — not the API — so a
 * slow database does not stall request handling, and so the timer survives an API
 * restart: it lives in Redis, not in memory.
 */
export function createWorkflowWorker(deps: WorkflowWorkerDeps): Worker {
  const worker = new Worker(
    QUEUE_WORKFLOW,
    async (job) => {
      if (job.name === WORKFLOW_SLA_JOB) {
        await handleWorkflowSla(job as Job<WorkflowSlaJob>, deps);
        return;
      }
      throw new Error(`Unsupported job "${job.name}" on queue "${QUEUE_WORKFLOW}".`);
    },
    {
      connection: bullConnectionOptions(deps.config),
      concurrency: deps.config.concurrency,
    },
  );

  worker.on('completed', (job) => {
    deps.logger.info('job completed', { jobId: job.id, name: job.name });
  });
  worker.on('failed', (job, error) => {
    deps.logger.error('job failed', { jobId: job?.id, name: job?.name, error: error.message });
  });
  worker.on('error', (error) => {
    deps.logger.error('worker error', { error: error.message });
  });

  return worker;
}

/**
 * Applies one SLA timer.
 *
 * Idempotent by construction: every guard returns without writing, so a timer that
 * fires twice — a retry, or a stale duplicate — never escalates a task twice. A task
 * a human already decided, an instance that has settled, and a task whose deadline
 * has not actually arrived are all no-ops.
 */
async function handleWorkflowSla(
  job: Job<WorkflowSlaJob>,
  deps: WorkflowWorkerDeps,
): Promise<void> {
  const data = job.data;
  const logger = deps.logger;

  await withTenantContext(deps.prisma, data.companyId, async (tx) => {
    const instance = await tx.workflowInstance.findFirst({ where: { id: data.instanceId } });
    if (instance === null || instance.status !== 'IN_PROGRESS') {
      return;
    }

    const task = await tx.workflowTask.findFirst({ where: { id: data.taskId } });
    if (task === null || (task.status !== 'PENDING' && task.status !== 'CLAIMED')) {
      return;
    }

    const version = await tx.workflowVersion.findFirst({ where: { id: instance.versionId } });
    if (version === null) {
      return;
    }
    const step = readSteps(version.steps).find((candidate) => candidate.key === data.stepKey);
    if (step === undefined) {
      return;
    }

    const now = new Date();
    const deadline = task.escalationAt ?? task.dueAt;
    if (deadline !== null && now.getTime() < deadline.getTime()) {
      return;
    }

    const policy = step.escalationPolicy ?? DEFAULT_ESCALATION_POLICY;
    const targets = await resolveEscalationTargets(tx, policy);
    if (targets.length === 0) {
      // No one can take over: leave the task open rather than expire it and strand the
      // step, and log loudly enough that an admin can see the policy is unstaffed.
      logger.warn('workflow escalation has no recipients', {
        taskId: data.taskId,
        stepKey: data.stepKey,
        policy,
      });
      return;
    }

    // The escalated tasks replace the ones that timed out. The originals are kept as
    // EXPIRED so the audit trail still shows who let the SLA lapse; the decision rule
    // ignores them when it judges whether the step is satisfied.
    await tx.workflowTask.updateMany({
      where: {
        instanceId: instance.id,
        stepKey: task.stepKey,
        status: { in: ['PENDING', 'CLAIMED'] },
      },
      data: { status: 'EXPIRED', decidedAt: new Date(), comment: 'escalated' },
    });

    for (const userId of targets) {
      await tx.workflowTask.create({
        data: {
          companyId: data.companyId,
          instanceId: instance.id,
          stepKey: task.stepKey,
          stateKey: task.stateKey,
          status: 'PENDING',
          assigneeUserId: userId,
          requiredPermission: task.requiredPermission,
          dueAt: null,
          escalationAt: null,
        },
      });
      await emitInApp(tx, deps, {
        companyId: data.companyId,
        userId,
        instanceId: instance.id,
        eventKey: 'workflow.task_escalated',
        detail: `Step "${step.name}" is overdue and has been escalated to you.`,
      });
    }

    await tx.workflowInstance.update({
      where: { id: instance.id },
      data: { dueAt: null, escalationAt: null },
    });

    await tx.logEvent.create({
      data: {
        companyId: data.companyId,
        category: 'ACTIVITY',
        eventType: LOG_EVENT_TYPES['workflow.task_escalated'],
        resource: 'workflow',
        resourceId: data.taskId,
        status: 'SUCCESS',
        metadata: {
          stepKey: task.stepKey,
          instanceId: instance.id,
          escalatedTo: targets,
        } as Prisma.InputJsonValue,
      },
    });

    logger.info('workflow task escalated', {
      taskId: data.taskId,
      stepKey: task.stepKey,
      recipients: targets.length,
    });
  });
}

/**
 * Users active in the company whose roles grant the `resource.action` policy.
 *
 * Mirrors the engine's candidate resolution. The two run in different processes, so
 * the query is duplicated rather than shared through the API's service layer; the
 * permission vocabulary it depends on is shared.
 */
async function resolveEscalationTargets(
  tx: Prisma.TransactionClient,
  permission: string,
): Promise<readonly string[]> {
  const parsed = parsePermissionKey(permission);
  if (parsed === null) {
    return [];
  }
  const rolePermissions = await tx.rolePermission.findMany({
    where: { permission: { resource: parsed.resource, action: parsed.action } },
    select: { roleId: true },
  });
  const roleIds = [...new Set(rolePermissions.map((row) => row.roleId))];
  if (roleIds.length === 0) {
    return [];
  }
  const memberships = await tx.userRole.findMany({
    where: { roleId: { in: roleIds } },
    select: { userId: true },
  });
  const userIds = [...new Set(memberships.map((row) => row.userId))];
  if (userIds.length === 0) {
    return [];
  }
  const users = await tx.user.findMany({
    where: { id: { in: userIds }, status: 'ACTIVE' },
    select: { id: true },
  });
  return users.map((user) => user.id);
}

/** Persists one in-app notification from the shared template defaults. */
async function emitInApp(
  tx: Prisma.TransactionClient,
  deps: WorkflowWorkerDeps,
  input: {
    readonly companyId: string;
    readonly userId: string;
    readonly instanceId: string;
    readonly eventKey: NotificationEventKey;
    readonly detail: string;
  },
): Promise<void> {
  const channel: NotificationChannel = 'IN_APP';
  const template = NOTIFICATION_TEMPLATE_DEFAULTS[input.eventKey][channel];
  const message = renderNotificationMessage(input.eventKey, channel, template, {
    appName: deps.config.appName,
    appUrl: deps.config.webBaseUrl,
    detail: input.detail,
  });
  await tx.notification.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      kind: KIND_TO_DB[NOTIFICATION_EVENT_KINDS[input.eventKey]] ?? 'INFO',
      eventKey: input.eventKey,
      title: message.title,
      description: message.description,
      href: null,
      channel,
      deliveryStatus: 'DELIVERED',
      correlationId: input.instanceId,
    },
  });
}

function readSteps(value: unknown): WorkflowStepDefinition[] {
  return Array.isArray(value) ? (value as WorkflowStepDefinition[]) : [];
}
