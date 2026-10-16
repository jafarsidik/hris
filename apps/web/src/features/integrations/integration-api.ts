import { apiRequestV1 } from '@/lib/api/client-config';

import type {
  CreateIntegrationInput,
  IntegrationConnectionTestResult,
  IntegrationDeliverySummary,
  IntegrationRepository,
  IntegrationSummary,
  UpdateIntegrationInput,
  WebhookSecretRotation,
  WebhookSubscriptionSummary,
} from './integration-types';

/**
 * Integrations against the live API.
 *
 * Browser calls carry the `hris_session` cookie, so no bearer token is attached here. The
 * webhook signing secret is present only in the rotate response; it is never returned by a
 * read.
 */
export const apiIntegrationRepository: IntegrationRepository = {
  async listIntegrations() {
    return apiRequestV1<readonly IntegrationSummary[]>('/integrations');
  },

  async getIntegration(id) {
    return apiRequestV1<IntegrationSummary>(`/integrations/${id}`);
  },

  async createIntegration(input: CreateIntegrationInput) {
    return apiRequestV1<IntegrationSummary>('/integrations', { method: 'POST', body: input });
  },

  async updateIntegration(id, input: UpdateIntegrationInput) {
    return apiRequestV1<IntegrationSummary>(`/integrations/${id}`, {
      method: 'PATCH',
      body: input,
    });
  },

  async deleteIntegration(id) {
    await apiRequestV1<never>(`/integrations/${id}`, { method: 'DELETE' });
  },

  async testIntegration(id) {
    return apiRequestV1<IntegrationConnectionTestResult>(`/integrations/${id}/test`, {
      method: 'POST',
    });
  },

  async listDeliveries(id) {
    return apiRequestV1<readonly IntegrationDeliverySummary[]>(`/integrations/${id}/deliveries`);
  },

  async listSubscriptions(id) {
    return apiRequestV1<readonly WebhookSubscriptionSummary[]>(`/integrations/${id}/subscriptions`);
  },

  async setSubscriptions(id, events) {
    return apiRequestV1<readonly WebhookSubscriptionSummary[]>(
      `/integrations/${id}/subscriptions`,
      {
        method: 'PUT',
        body: { events },
      },
    );
  },

  async rotateSecret(id) {
    return apiRequestV1<WebhookSecretRotation>(`/integrations/${id}/secret`, { method: 'POST' });
  },
};
