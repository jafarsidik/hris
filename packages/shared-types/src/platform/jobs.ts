/**
 * Background job vocabulary shared by the API (producer) and `apps/worker` (consumer).
 *
 * Queue and job names are a wire contract between two separately deployed processes,
 * so they live here rather than being duplicated as string literals on each side:
 * renaming a job silently orphans every queued message that still carries the old
 * name, and a typo on one side produces a queue that never drains.
 */

/** The BullMQ queue that carries every outbound email. */
export const QUEUE_NOTIFICATIONS = 'hris.notifications';

/** The BullMQ queue that carries every outbound webhook delivery. */
export const QUEUE_WEBHOOKS = 'hris.webhooks';

/** The BullMQ queue that carries workflow SLA/escalation jobs. */
export const QUEUE_WORKFLOW = 'hris.workflow';

/** Delivers one domain event to one subscribed webhook endpoint. */
export const WEBHOOK_DELIVERY_JOB = 'webhook.deliver';

/** Evaluates an SLA timer (due or escalation) for a workflow task. */
export const WORKFLOW_SLA_JOB = 'workflow.sla';

/** Kind of SLA evaluation to perform. */
export const WORKFLOW_SLA_KINDS = ['DUE', 'ESCALATION'] as const;

export type WorkflowSlaKind = (typeof WORKFLOW_SLA_KINDS)[number];

/** Payload for {@link WORKFLOW_SLA_JOB}. */
export interface WorkflowSlaJob {
  readonly companyId: string;
  readonly instanceId: string;
  readonly taskId: string;
  readonly stepKey: string;
  readonly kind: WorkflowSlaKind;
}

/**
 * The signed payload a webhook receiver sees.
 *
 * `id` is stable across delivery retries, so a receiver can de-duplicate: the worker
 * re-signs the same envelope on every attempt rather than minting a new id.
 */
export interface WebhookEventEnvelope {
  readonly id: string;
  readonly type: string;
  readonly companyId: string;
  readonly resource: string;
  readonly resourceId: string;
  readonly actorUserId: string | null;
  readonly occurredAt: string;
  readonly data: Readonly<Record<string, unknown>>;
}

/**
 * Payload for {@link WEBHOOK_DELIVERY_JOB}.
 *
 * The signing secret is deliberately absent: the worker decrypts it at delivery time
 * from the integration record, so a plaintext credential never lands in Redis.
 */
export interface WebhookDeliveryJob {
  readonly companyId: string;
  readonly integrationId: string;
  readonly event: WebhookEventEnvelope;
}

/**
 * The `t=<unix-seconds>,v1=<hex-hmac>` signature scheme, matching the convention
 * receivers already know from other providers: the HMAC covers `"<timestamp>.<body>"`,
 * so a captured payload cannot be replayed outside the receiver's tolerance window.
 */
export const WEBHOOK_SIGNATURE_HEADER = 'x-hris-signature';
export const WEBHOOK_EVENT_HEADER = 'x-hris-event';
export const WEBHOOK_DELIVERY_HEADER = 'x-hris-delivery';
export const WEBHOOK_TIMESTAMP_HEADER = 'x-hris-timestamp';

/** How many seconds a receiver should tolerate between signing and receipt. */
export const WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300;

/** Sends a rendered notification email; written back to a `notifications` row. */
export const NOTIFICATION_EMAIL_JOB = 'notification.email';

/** Sends a transactional email (password reset) with no persisted row. */
export const TRANSACTIONAL_EMAIL_JOB = 'send-email';

/** Transactional email template names the API may enqueue. */
export const TRANSACTIONAL_EMAIL_TEMPLATES = ['password-reset'] as const;

export type TransactionalEmailTemplate = (typeof TRANSACTIONAL_EMAIL_TEMPLATES)[number];

/**
 * Payload for {@link TRANSACTIONAL_EMAIL_JOB}.
 *
 * `companyId` travels with the job because the SMTP relay is company-scoped: the
 * worker resolves the company's settings before it can send.
 */
export interface TransactionalEmailJob {
  readonly companyId: string;
  readonly to: string;
  readonly template: TransactionalEmailTemplate;
  readonly context: Readonly<Record<string, string>>;
}

/**
 * Payload for {@link NOTIFICATION_EMAIL_JOB}.
 *
 * The message is pre-rendered by the API because the triggering event's metadata is
 * not persisted; the worker owns only transport and the delivery result written back
 * to the notification row.
 */
export interface NotificationEmailJob {
  readonly notificationId: string;
  readonly companyId: string;
  readonly recipientUserId: string;
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  readonly appName: string;
}

/**
 * Job states a monitoring client may filter by.
 *
 * Mirrors BullMQ's own set; kept here so the System -> Operations screen does not
 * depend on the queue library's types on the client.
 */
export const QUEUE_JOB_STATES = [
  'waiting',
  'active',
  'completed',
  'failed',
  'delayed',
  'paused',
] as const;

export type QueueJobState = (typeof QUEUE_JOB_STATES)[number];

export interface QueueCounts {
  readonly waiting: number;
  readonly active: number;
  readonly completed: number;
  readonly failed: number;
  readonly delayed: number;
  readonly paused: number;
}

export interface QueueSummary {
  readonly name: string;
  readonly isPaused: boolean;
  readonly counts: QueueCounts;
}

export interface QueueJobSummary {
  readonly id: string;
  readonly name: string;
  readonly state: QueueJobState;
  readonly attemptsMade: number;
  /** Populated when the most recent attempt failed. */
  readonly failedReason: string | null;
  readonly enqueuedAt: string;
  readonly processedAt: string | null;
  readonly finishedAt: string | null;
}

/** Processing latency over the retained completed jobs of one queue. */
export interface QueueLatencySummary {
  readonly avgMs: number;
  readonly p95Ms: number;
  readonly maxMs: number;
  /** How many completed jobs the percentiles were computed from. */
  readonly sample: number;
}

/** One queue's contribution to the platform's latency/throughput/saturation picture. */
export interface QueuePerformanceSummary {
  readonly queue: string;
  readonly isPaused: boolean;
  readonly counts: QueueCounts;
  readonly completedLastHour: number;
  readonly completedLast24h: number;
  readonly failedLastHour: number;
  /** `null` when no completed job has both a processing and a finish timestamp. */
  readonly latency: QueueLatencySummary | null;
}

/** Aggregated performance view behind the Operations -> Performance Metrics screen. */
export interface PerformanceMetricsSummary {
  readonly queues: readonly QueuePerformanceSummary[];
  readonly totals: {
    readonly waiting: number;
    readonly active: number;
    readonly delayed: number;
    readonly failed: number;
    readonly completedLastHour: number;
  };
  readonly sampledAt: string;
}
