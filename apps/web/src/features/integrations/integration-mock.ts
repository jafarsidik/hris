import { WEBHOOK_WILDCARD } from '@hris/shared-types';

import type {
  IntegrationDeliverySummary,
  IntegrationKind,
  IntegrationRepository,
  IntegrationSummary,
  UpdateIntegrationInput,
} from './integration-types';

/**
 * Offline integrations for previews and tests.
 *
 * Serves a fixed, honest sample of the same read model the API returns so the screens can
 * be developed and exercised without the API running. The store is mutable so the
 * create/edit/delete/test/rotate flows work; it resets on reload.
 *
 * The one-time contract matches the API: a read never returns the webhook signing secret,
 * only rotation does.
 */
const integrationStore: IntegrationSummary[] = [
  {
    id: 'integration-1',
    key: 'primary-smtp',
    name: 'Primary SMTP relay',
    kind: 'EMAIL',
    provider: 'smtp',
    isEnabled: true,
    secretConfigured: false,
    status: 'CONNECTED',
    lastCheckedAt: '2026-02-09T08:00:00.000Z',
    lastMessage: 'Connection succeeded.',
    config: { host: 'smtp.example.com', port: 587 },
    createdAt: '2026-01-05T09:00:00.000Z',
    updatedAt: '2026-02-09T08:00:00.000Z',
  },
  {
    id: 'integration-2',
    key: 'payroll-events',
    name: 'Payroll events endpoint',
    kind: 'WEBHOOK',
    provider: 'http',
    isEnabled: true,
    secretConfigured: true,
    status: 'CONNECTED',
    lastCheckedAt: '2026-02-10T02:30:00.000Z',
    lastMessage: 'Connection succeeded.',
    config: { url: 'https://hooks.example.com/hris' },
    createdAt: '2026-01-18T14:20:00.000Z',
    updatedAt: '2026-02-10T02:30:00.000Z',
  },
];

const deliveryStore: IntegrationDeliverySummary[] = [
  {
    id: 'delivery-1',
    integrationId: 'integration-2',
    direction: 'OUTBOUND',
    operation: 'connection_test',
    status: 'SUCCEEDED',
    attempt: 1,
    error: null,
    durationMs: 82,
    createdAt: '2026-02-10T02:30:00.000Z',
  },
  {
    id: 'delivery-2',
    integrationId: 'integration-1',
    direction: 'OUTBOUND',
    operation: 'connection_test',
    status: 'SUCCEEDED',
    attempt: 1,
    error: null,
    durationMs: 34,
    createdAt: '2026-02-09T08:00:00.000Z',
  },
];

interface StoredSubscription {
  readonly id: string;
  readonly integrationId: string;
  readonly eventType: string;
  readonly isActive: boolean;
  readonly createdAt: string;
}

const subscriptionStore: StoredSubscription[] = [
  {
    id: 'subscription-1',
    integrationId: 'integration-2',
    eventType: 'user.welcome',
    isActive: true,
    createdAt: '2026-01-18T14:20:00.000Z',
  },
  {
    id: 'subscription-2',
    integrationId: 'integration-2',
    eventType: 'task.completed',
    isActive: true,
    createdAt: '2026-01-18T14:20:00.000Z',
  },
];

const now = (): string => new Date().toISOString();

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function integrationById(id: string): IntegrationSummary {
  const integration = integrationStore.find((candidate) => candidate.id === id);
  if (!integration) {
    throw new Error('The integration does not exist.');
  }
  return integration;
}

function assertWebhook(integration: IntegrationSummary): void {
  if (integration.kind !== 'WEBHOOK') {
    throw new Error('Only a webhook integration has event subscriptions.');
  }
}

function readUrl(config: Record<string, unknown>): string | null {
  const value = config['url'];
  if (typeof value !== 'string') {
    return null;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

function validate(kind: IntegrationKind, config: Record<string, unknown>): void {
  if (kind === 'WEBHOOK' && readUrl(config) === null) {
    throw new Error('A webhook integration requires a config.url that is an absolute http(s) URL.');
  }
}

/** Trims, drops blanks and de-duplicates an event list, preserving order. */
function normalizeEvents(events: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  for (const raw of events) {
    const type = raw.trim();
    if (type !== '') {
      seen.add(type);
    }
  }
  return [...seen];
}

export const mockIntegrationRepository: IntegrationRepository = {
  async listIntegrations() {
    return clone(integrationStore);
  },

  async getIntegration(id) {
    return clone(integrationById(id));
  },

  async createIntegration(input) {
    validate(input.kind, input.config ?? {});
    if (integrationStore.some((candidate) => candidate.key === input.key)) {
      throw new Error('An integration with that key already exists.');
    }
    const id = `integration-${integrationStore.length + 1}`;
    const timestamp = now();
    const row: IntegrationSummary = {
      id,
      key: input.key,
      name: input.name,
      kind: input.kind,
      provider: input.provider,
      isEnabled: input.isEnabled ?? true,
      secretConfigured: false,
      status: 'UNKNOWN',
      lastCheckedAt: null,
      lastMessage: null,
      config: input.config ?? {},
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    integrationStore.push(row);
    if (input.kind === 'WEBHOOK') {
      writeSubscriptions(id, input.events ?? [WEBHOOK_WILDCARD]);
    }
    return clone(row);
  },

  async updateIntegration(id, input: UpdateIntegrationInput) {
    const current = integrationById(id);
    const merged: IntegrationSummary = {
      ...current,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.provider !== undefined ? { provider: input.provider } : {}),
      ...(input.config !== undefined ? { config: input.config } : {}),
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
      updatedAt: now(),
    };
    validate(merged.kind, merged.config);
    const index = integrationStore.findIndex((candidate) => candidate.id === id);
    integrationStore[index] = merged;
    return clone(merged);
  },

  async deleteIntegration(id) {
    const index = integrationStore.findIndex((candidate) => candidate.id === id);
    if (index >= 0) {
      integrationStore.splice(index, 1);
    }
  },

  async testIntegration(id) {
    const integration = integrationById(id);
    const timestamp = now();
    const delivery: IntegrationDeliverySummary = {
      id: `delivery-${deliveryStore.length + 1}`,
      integrationId: id,
      direction: 'OUTBOUND',
      operation: 'connection_test',
      status: 'SUCCEEDED',
      attempt: 1,
      error: null,
      durationMs: 25,
      createdAt: timestamp,
    };
    deliveryStore.unshift(delivery);
    const index = integrationStore.findIndex((candidate) => candidate.id === id);
    integrationStore[index] = {
      ...integration,
      status: 'CONNECTED',
      lastCheckedAt: timestamp,
      lastMessage: 'Connection succeeded.',
      updatedAt: timestamp,
    };
    return {
      ok: true,
      status: 'CONNECTED',
      message: 'Connection succeeded.',
      checkedAt: timestamp,
    };
  },

  async listDeliveries(id) {
    integrationById(id);
    return clone(
      deliveryStore
        .filter((delivery) => delivery.integrationId === id)
        .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1)),
    );
  },

  async listSubscriptions(id) {
    const integration = integrationById(id);
    assertWebhook(integration);
    return clone(
      subscriptionStore
        .filter((subscription) => subscription.integrationId === id)
        .sort((left, right) => left.eventType.localeCompare(right.eventType)),
    );
  },

  async setSubscriptions(id, events) {
    const integration = integrationById(id);
    assertWebhook(integration);
    writeSubscriptions(id, events);
    return mockIntegrationRepository.listSubscriptions(id);
  },

  async rotateSecret(id) {
    const integration = integrationById(id);
    assertWebhook(integration);
    const index = integrationStore.findIndex((candidate) => candidate.id === id);
    integrationStore[index] = { ...integration, secretConfigured: true, updatedAt: now() };
    return {
      integrationId: id,
      secret: `whsec_mock_${integrationStore.length}${Math.floor(Math.random() * 1_000_000)}`,
      rotatedAt: now(),
    };
  },
};

/** Replaces an integration's subscriptions with exactly `events`. */
function writeSubscriptions(integrationId: string, events: readonly string[]): void {
  for (let index = subscriptionStore.length - 1; index >= 0; index -= 1) {
    if (subscriptionStore[index]?.integrationId === integrationId) {
      subscriptionStore.splice(index, 1);
    }
  }
  const existing = subscriptionStore.length;
  normalizeEvents(events).forEach((eventType, offset) => {
    subscriptionStore.push({
      id: `subscription-${existing + offset + 1}`,
      integrationId,
      eventType,
      isActive: true,
      createdAt: now(),
    });
  });
}
