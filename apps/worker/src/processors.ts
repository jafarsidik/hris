import { type DatabaseClient, type Prisma, withTenantContext } from '@hris/database';
import {
  LOG_EVENT_TYPES,
  NOTIFICATION_EMAIL_JOB,
  QUEUE_NOTIFICATIONS,
  TRANSACTIONAL_EMAIL_JOB,
  type NotificationEmailJob,
  type TransactionalEmailJob,
} from '@hris/shared-types';
import { Worker, type Job } from 'bullmq';

import { bullConnectionOptions, type WorkerConfig } from './config';
import { renderNotificationEmail, renderTransactionalEmail } from './email-templates';
import type { Logger } from './logger';
import { createMailSender } from './mailer';
import { resolveSmtp } from './smtp-settings';

export interface WorkerDeps {
  readonly config: WorkerConfig;
  readonly prisma: DatabaseClient;
  readonly logger: Logger;
}

/**
 * Creates the BullMQ worker for the notification queue.
 *
 * One worker handles both job kinds because they share a transport and a retry policy;
 * splitting them would double the Redis connections for no operational benefit.
 */
export function createNotificationsWorker(deps: WorkerDeps): Worker {
  const worker = new Worker(
    QUEUE_NOTIFICATIONS,
    async (job) => {
      if (job.name === NOTIFICATION_EMAIL_JOB) {
        await handleNotificationEmail(job as Job<NotificationEmailJob>, deps);
        return;
      }
      if (job.name === TRANSACTIONAL_EMAIL_JOB) {
        await handleTransactionalEmail(job as Job<TransactionalEmailJob>, deps);
        return;
      }
      throw new Error(`Unsupported job "${job.name}" on queue "${QUEUE_NOTIFICATIONS}".`);
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

async function handleNotificationEmail(
  job: Job<NotificationEmailJob>,
  deps: WorkerDeps,
): Promise<void> {
  const data = job.data;
  const smtp = await resolveSmtp(deps.prisma, data.companyId, deps.config);

  if (!smtp) {
    await setDeliveryStatus(deps.prisma, data.companyId, data.notificationId, 'FAILED');
    await recordEmailEvent(
      deps.prisma,
      data.companyId,
      LOG_EVENT_TYPES['notification.email_failed'],
      {
        status: 'FAILED',
        notificationId: data.notificationId,
        reason: 'smtp-not-configured',
      },
    );
    deps.logger.warn('Email skipped: no SMTP relay configured', {
      companyId: data.companyId,
      notificationId: data.notificationId,
    });
    return;
  }

  const rendered = renderNotificationEmail({
    subject: data.subject,
    body: data.body,
    appName: data.appName || deps.config.appName,
  });

  const sender = createMailSender(smtp, deps.config.mailFrom);
  const startedAt = Date.now();
  try {
    await sender.send({ to: data.to, ...rendered });
    await setDeliveryStatus(deps.prisma, data.companyId, data.notificationId, 'SENT');
    await recordEmailEvent(
      deps.prisma,
      data.companyId,
      LOG_EVENT_TYPES['notification.email_delivered'],
      {
        status: 'SUCCESS',
        notificationId: data.notificationId,
        to: data.to,
      },
    );
    await recordIntegrationDelivery(deps, data.companyId, {
      operation: 'notification.email',
      status: 'SUCCEEDED',
      attempt: job.attemptsMade + 1,
      durationMs: Date.now() - startedAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await setDeliveryStatus(deps.prisma, data.companyId, data.notificationId, 'FAILED');
    await recordEmailEvent(
      deps.prisma,
      data.companyId,
      LOG_EVENT_TYPES['notification.email_failed'],
      {
        status: 'FAILED',
        notificationId: data.notificationId,
        to: data.to,
      },
    );
    await recordIntegrationDelivery(deps, data.companyId, {
      operation: 'notification.email',
      status: willRetry(job) ? 'RETRYING' : 'FAILED',
      attempt: job.attemptsMade + 1,
      error: message,
      durationMs: Date.now() - startedAt,
    });
    throw error;
  } finally {
    sender.close();
  }
}

async function handleTransactionalEmail(
  job: Job<TransactionalEmailJob>,
  deps: WorkerDeps,
): Promise<void> {
  const data = job.data;
  const smtp = await resolveSmtp(deps.prisma, data.companyId, deps.config);
  if (!smtp) {
    deps.logger.warn('Transactional email skipped: no SMTP relay configured', {
      companyId: data.companyId,
      template: data.template,
    });
    return;
  }

  const rendered = renderTransactionalEmail(data.template, data.context, {
    webBaseUrl: deps.config.webBaseUrl,
    appName: deps.config.appName,
  });

  const sender = createMailSender(smtp, deps.config.mailFrom);
  const startedAt = Date.now();
  try {
    await sender.send({ to: data.to, ...rendered });
    await recordIntegrationDelivery(deps, data.companyId, {
      operation: 'transactional.email',
      status: 'SUCCEEDED',
      attempt: job.attemptsMade + 1,
      durationMs: Date.now() - startedAt,
    });
  } catch (error: unknown) {
    await recordIntegrationDelivery(deps, data.companyId, {
      operation: 'transactional.email',
      status: willRetry(job) ? 'RETRYING' : 'FAILED',
      attempt: job.attemptsMade + 1,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    });
    throw error;
  } finally {
    sender.close();
  }
}

/** True when the queue will attempt this job again after the current failure. */
function willRetry(job: Job): boolean {
  const maxAttempts = job.opts.attempts ?? 1;
  return job.attemptsMade + 1 < maxAttempts;
}

/**
 * Appends a delivery record to the tenant's EMAIL integration, when one is registered.
 *
 * This is best-effort telemetry: an admin who has not registered an email integration
 * simply gets no delivery ledger, and a logging failure never masks the send outcome or
 * blocks the queue from retrying.
 */
async function recordIntegrationDelivery(
  deps: WorkerDeps,
  companyId: string,
  input: {
    operation: string;
    status: 'SUCCEEDED' | 'FAILED' | 'RETRYING';
    attempt: number;
    error?: string;
    durationMs?: number;
  },
): Promise<void> {
  try {
    await withTenantContext(deps.prisma, companyId, async (tx) => {
      const integration = await tx.integration.findFirst({
        where: { kind: 'EMAIL', isEnabled: true },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      if (integration === null) {
        return;
      }
      await tx.integrationDelivery.create({
        data: {
          companyId,
          integrationId: integration.id,
          direction: 'OUTBOUND',
          operation: input.operation,
          status: input.status,
          attempt: input.attempt,
          error: input.error ?? null,
          durationMs: input.durationMs ?? null,
        },
      });
    });
  } catch (error: unknown) {
    deps.logger.warn('Could not record integration delivery', {
      companyId,
      operation: input.operation,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function setDeliveryStatus(
  prisma: DatabaseClient,
  companyId: string,
  notificationId: string,
  status: 'SENT' | 'FAILED',
): Promise<void> {
  await withTenantContext(prisma, companyId, (tx) =>
    tx.notification.update({ where: { id: notificationId }, data: { deliveryStatus: status } }),
  );
}

async function recordEmailEvent(
  prisma: DatabaseClient,
  companyId: string,
  eventType: string,
  details: { readonly status: string; readonly notificationId: string } & Record<string, unknown>,
): Promise<void> {
  const { status, notificationId, ...metadata } = details;
  await withTenantContext(prisma, companyId, (tx) =>
    tx.logEvent.create({
      data: {
        companyId,
        category: 'ACTIVITY',
        eventType,
        resource: 'notification',
        resourceId: notificationId,
        status,
        metadata: metadata as Prisma.InputJsonValue,
      },
    }),
  );
}
