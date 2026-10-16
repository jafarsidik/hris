'use client';

import { apiIntegrationRepository } from './integration-api';
import { mockIntegrationRepository } from './integration-mock';
import type { IntegrationRepository } from './integration-types';

/**
 * Integration registry repository seam.
 *
 * Browser screens default to the live API. Point
 * `NEXT_PUBLIC_HRIS_INTEGRATIONS_DATA_SOURCE=mock` to preview the screens against the
 * offline dataset (used by tests and demo environments without an API).
 */
export function getIntegrations(): IntegrationRepository {
  const source = process.env['NEXT_PUBLIC_HRIS_INTEGRATIONS_DATA_SOURCE'] ?? 'api';
  return source === 'mock' ? mockIntegrationRepository : apiIntegrationRepository;
}

export type {
  CreateIntegrationInput,
  IntegrationConnectionTestResult,
  IntegrationDeliverySummary,
  IntegrationKind,
  IntegrationRepository,
  IntegrationSummary,
  UpdateIntegrationInput,
  WebhookSecretRotation,
  WebhookSubscriptionSummary,
} from './integration-types';
