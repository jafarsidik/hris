/**
 * Integration registry vocabulary.
 *
 * The platform talks to the outside world through adapters. Each configured integration
 * is one adapter instance for a tenant (an SMTP relay, a webhook endpoint, a storage
 * bucket): the registry stores its non-secret configuration and health, and a connection
 * test records the outcome. Adapters are code; integrations are data.
 */

/** The kind of external system an integration speaks to. */
export const INTEGRATION_KINDS = ['EMAIL', 'WEBHOOK', 'STORAGE', 'ANALYTICS', 'OTHER'] as const;

export type IntegrationKind = (typeof INTEGRATION_KINDS)[number];

/** The last observed health of an integration. */
export const INTEGRATION_STATUSES = ['UNKNOWN', 'CONNECTED', 'DISCONNECTED', 'ERROR'] as const;

export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

/** The direction of one integration operation. */
export const INTEGRATION_DELIVERY_DIRECTIONS = ['OUTBOUND', 'INBOUND'] as const;

export type IntegrationDeliveryDirection = (typeof INTEGRATION_DELIVERY_DIRECTIONS)[number];

/** The outcome of one integration operation. */
export const INTEGRATION_DELIVERY_STATUSES = ['SUCCEEDED', 'FAILED', 'RETRYING'] as const;

export type IntegrationDeliveryStatus = (typeof INTEGRATION_DELIVERY_STATUSES)[number];

/** A configured integration. `config` holds non-secret settings only. */
export interface IntegrationSummary {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly kind: IntegrationKind;
  readonly provider: string;
  readonly isEnabled: boolean;
  status: IntegrationStatus;
  /** Whether a webhook signing secret has been set (the secret itself is never read back). */
  readonly secretConfigured: boolean;
  readonly lastCheckedAt: string | null;
  readonly lastMessage: string | null;
  readonly config: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** One recorded integration operation (a connection test or a delivery attempt). */
export interface IntegrationDeliverySummary {
  readonly id: string;
  readonly integrationId: string;
  readonly direction: IntegrationDeliveryDirection;
  readonly operation: string;
  readonly status: IntegrationDeliveryStatus;
  readonly attempt: number;
  readonly error: string | null;
  readonly durationMs: number | null;
  readonly createdAt: string;
}

/** The outcome of running an integration's connection test. */
export interface IntegrationConnectionTestResult {
  readonly ok: boolean;
  readonly status: IntegrationStatus;
  readonly message: string;
  readonly checkedAt: string;
}

/**
 * Subscribes a webhook endpoint to one domain event type.
 *
 * A subscription is stored per event type rather than as an array in `config` so the
 * dispatcher's lookup is a join and a newly emitted event type is opt-in rather than an
 * implicit broadcast. {@link WEBHOOK_WILDCARD} subscribes to every event.
 */
export const WEBHOOK_WILDCARD = '*';

export interface WebhookSubscriptionSummary {
  readonly id: string;
  readonly integrationId: string;
  readonly eventType: string;
  readonly isActive: boolean;
  readonly createdAt: string;
}

/** The one-time result of creating or rotating a webhook signing secret. */
export interface WebhookSecretRotation {
  readonly integrationId: string;
  /** Shown once and never readable again; store it in the receiver's secret store. */
  readonly secret: string;
  readonly rotatedAt: string;
}
