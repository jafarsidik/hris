import type {
  IntegrationConnectionTestResult,
  IntegrationDeliverySummary,
  IntegrationKind,
  IntegrationSummary,
  WebhookSecretRotation,
  WebhookSubscriptionSummary,
} from '@hris/shared-types';

export type {
  IntegrationConnectionTestResult,
  IntegrationDeliverySummary,
  IntegrationKind,
  IntegrationSummary,
  WebhookSecretRotation,
  WebhookSubscriptionSummary,
};

/** Fields accepted when registering a new integration. */
export interface CreateIntegrationInput {
  readonly key: string;
  readonly name: string;
  readonly kind: IntegrationKind;
  readonly provider: string;
  /** Non-secret configuration only; the API rejects credential-like keys. */
  readonly config?: Record<string, unknown>;
  readonly isEnabled?: boolean;
  /** Event types a WEBHOOK subscribes to; defaults to `['*']` server-side. */
  readonly events?: readonly string[];
}

export interface UpdateIntegrationInput {
  readonly name?: string;
  readonly kind?: IntegrationKind;
  readonly provider?: string;
  readonly config?: Record<string, unknown>;
  readonly isEnabled?: boolean;
}

/**
 * The integration registry seam.
 *
 * Reads require `integration.view`; create/update/delete require the matching action, a
 * connection test and secret rotation require `integration.manage`, and replacing webhook
 * subscriptions requires `integration.update`. The screens are affordances; the API is
 * the boundary.
 */
export interface IntegrationRepository {
  listIntegrations(): Promise<readonly IntegrationSummary[]>;
  getIntegration(id: string): Promise<IntegrationSummary>;
  createIntegration(input: CreateIntegrationInput): Promise<IntegrationSummary>;
  updateIntegration(id: string, input: UpdateIntegrationInput): Promise<IntegrationSummary>;
  deleteIntegration(id: string): Promise<void>;
  testIntegration(id: string): Promise<IntegrationConnectionTestResult>;
  listDeliveries(id: string): Promise<readonly IntegrationDeliverySummary[]>;
  listSubscriptions(id: string): Promise<readonly WebhookSubscriptionSummary[]>;
  setSubscriptions(
    id: string,
    events: readonly string[],
  ): Promise<readonly WebhookSubscriptionSummary[]>;
  rotateSecret(id: string): Promise<WebhookSecretRotation>;
}
