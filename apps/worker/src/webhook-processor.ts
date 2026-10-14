import { type DatabaseClient, withTenantContext } from '@hris/database';
import {
  QUEUE_WEBHOOKS,
  WEBHOOK_DELIVERY_HEADER,
  WEBHOOK_DELIVERY_JOB,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  type WebhookDeliveryJob,
} from '@hris/shared-types';
import { Worker, type Job } from 'bullmq';

import { bullConnectionOptions, type WorkerConfig } from './config';
import type { Logger } from './logger';
import { decryptSecret, deriveKey, signPayload } from './webhook-crypto';

export interface WebhookWorkerDeps {
  readonly config: WorkerConfig;
  readonly prisma: DatabaseClient;
  readonly logger: Logger;
}

/**
 * Delivers signed domain events to tenant webhook endpoints.
 *
 * Runs on the `hris.webhooks` queue so an endpoint's latency is paid by the worker, not
 * the request that produced the event. BullMQ's `attempts`/exponential `backoff` (set at
 * enqueue time by the API) are the retry mechanism: a non-2xx response or thrown error
 * leaves the job to be retried with the same envelope id, and only the final attempt is
 * recorded as FAILED.
 */
export function createWebhookWorker(deps: WebhookWorkerDeps): Worker {
  const worker = new Worker(
    QUEUE_WEBHOOKS,
    (job) => deliverWebhook(job as Job<WebhookDeliveryJob>, deps),
    { connection: bullConnectionOptions(deps.config), concurrency: deps.config.concurrency },
  );

  worker.on('completed', (job) => {
    deps.logger.info('webhook delivered', {
      jobId: job.id,
      integrationId: job.data.integrationId,
      event: job.data.event.type,
    });
  });
  worker.on('failed', (job, error) => {
    deps.logger.error('webhook delivery failed', {
      jobId: job?.id,
      integrationId: job?.data?.integrationId,
      error: error.message,
    });
  });
  worker.on('error', (error) => {
    deps.logger.error('webhook worker error', { error: error.message });
  });

  return worker;
}

async function deliverWebhook(
  job: Job<WebhookDeliveryJob>,
  deps: WebhookWorkerDeps,
): Promise<void> {
  if (job.name !== WEBHOOK_DELIVERY_JOB) {
    throw new Error(`Unsupported job "${job.name}" on queue "${QUEUE_WEBHOOKS}".`);
  }

  const { companyId, integrationId, event } = job.data;
  const integration = await withTenantContext(deps.prisma, companyId, (tx) =>
    tx.integration.findFirst({
      where: { id: integrationId },
      select: { isEnabled: true, config: true, secretCiphertext: true },
    }),
  );

  // A webhook removed or disabled after the event was emitted is a no-op, not a failure:
  // retrying would only re-fail, and the tenant has expressed the endpoint is gone.
  if (integration === null || !integration.isEnabled) {
    deps.logger.warn('Webhook delivery skipped: endpoint removed or disabled', { integrationId });
    return;
  }

  const url = readUrl(integration.config);
  if (url === null) {
    deps.logger.warn('Webhook delivery skipped: endpoint URL missing or invalid', {
      integrationId,
    });
    return;
  }

  if (deps.config.webhookEncryptionKey === null) {
    // A misconfiguration that retrying cannot fix; surface it loudly and drop the attempt.
    deps.logger.error('Webhook delivery skipped: WEBHOOK_ENCRYPTION_KEY is not set', {
      integrationId,
    });
    return;
  }
  if (integration.secretCiphertext === null) {
    deps.logger.warn('Webhook delivery skipped: endpoint has no signing secret', { integrationId });
    return;
  }

  const secret = decryptSecret(
    deriveKey(deps.config.webhookEncryptionKey),
    integration.secretCiphertext,
  );
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [WEBHOOK_EVENT_HEADER]: event.type,
        [WEBHOOK_DELIVERY_HEADER]: event.id,
        [WEBHOOK_TIMESTAMP_HEADER]: String(timestamp),
        [WEBHOOK_SIGNATURE_HEADER]: signPayload(secret, timestamp, body),
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Endpoint responded with HTTP ${response.status}.`);
    }

    await recordAttempt(deps, companyId, integrationId, {
      operation: `webhook.${event.type}`,
      status: 'SUCCEEDED',
      attempt: job.attemptsMade + 1,
      durationMs: Date.now() - startedAt,
    });
    await setStatus(deps, companyId, integrationId, 'CONNECTED', 'Last delivery succeeded');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await recordAttempt(deps, companyId, integrationId, {
      operation: `webhook.${event.type}`,
      status: willRetry(job) ? 'RETRYING' : 'FAILED',
      attempt: job.attemptsMade + 1,
      error: message,
      durationMs: Date.now() - startedAt,
    });
    if (!willRetry(job)) {
      await setStatus(deps, companyId, integrationId, 'ERROR', message);
    }
    throw error;
  }
}

/** True when the queue will attempt this job again after the current failure. */
function willRetry(job: Job): boolean {
  return job.attemptsMade + 1 < (job.opts.attempts ?? 1);
}

/** Reads and validates the endpoint URL from an integration's non-secret config. */
function readUrl(config: unknown): string | null {
  if (config === null || typeof config !== 'object') {
    return null;
  }
  const value = (config as Record<string, unknown>)['url'];
  if (typeof value !== 'string') {
    return null;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** Appends a delivery-attempt row; best-effort so a logging failure never blocks a retry. */
async function recordAttempt(
  deps: WebhookWorkerDeps,
  companyId: string,
  integrationId: string,
  input: {
    operation: string;
    status: 'SUCCEEDED' | 'FAILED' | 'RETRYING';
    attempt: number;
    error?: string;
    durationMs: number;
  },
): Promise<void> {
  try {
    await withTenantContext(deps.prisma, companyId, (tx) =>
      tx.integrationDelivery.create({
        data: {
          companyId,
          integrationId,
          direction: 'OUTBOUND',
          operation: input.operation,
          status: input.status,
          attempt: input.attempt,
          error: input.error ?? null,
          durationMs: input.durationMs,
        },
      }),
    );
  } catch (error: unknown) {
    deps.logger.warn('Could not record webhook delivery attempt', {
      integrationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Reflects the latest delivery outcome on the integration's health fields. */
async function setStatus(
  deps: WebhookWorkerDeps,
  companyId: string,
  integrationId: string,
  status: 'CONNECTED' | 'ERROR',
  message: string,
): Promise<void> {
  try {
    await withTenantContext(deps.prisma, companyId, (tx) =>
      tx.integration.update({
        where: { id: integrationId },
        data: { status, lastCheckedAt: new Date(), lastMessage: message },
      }),
    );
  } catch (error: unknown) {
    deps.logger.warn('Could not update webhook integration status', {
      integrationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
