import { afterEach, describe, expect, it } from 'vitest';

import { apiIntegrationRepository } from './integration-api';
import { mockIntegrationRepository } from './integration-mock';

/**
 * The integration screens talk to one repository, whichever the factory returns. This
 * contract test locks the mock to the same behaviour the API-backed repository serves, so
 * a screen exercised against the mock cannot diverge from the live contract unnoticed.
 */
describe('integration repository contract', () => {
  afterEach(() => {
    delete process.env['NEXT_PUBLIC_HRIS_INTEGRATIONS_DATA_SOURCE'];
  });

  it('defaults to the API repository', async () => {
    const { getIntegrations } = await import('./index');
    expect(getIntegrations()).toBe(apiIntegrationRepository);
  });

  it('returns the mock repository when configured', async () => {
    process.env['NEXT_PUBLIC_HRIS_INTEGRATIONS_DATA_SOURCE'] = 'mock';
    const { getIntegrations } = await import('./index');
    expect(getIntegrations()).toBe(mockIntegrationRepository);
  });

  it('rejects the mock when the configured source is unknown', async () => {
    process.env['NEXT_PUBLIC_HRIS_INTEGRATIONS_DATA_SOURCE'] = 'legacy';
    const { getIntegrations } = await import('./index');
    expect(getIntegrations()).toBe(apiIntegrationRepository);
  });

  it('serves a sample with a webhook and no secret on a read', async () => {
    const rows = await mockIntegrationRepository.listIntegrations();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => row.kind === 'WEBHOOK')).toBe(true);
    expect(rows.every((row) => !('secret' in row))).toBe(true);
  });

  it('rejects an unknown integration id', async () => {
    await expect(mockIntegrationRepository.getIntegration('missing')).rejects.toThrow(
      /does not exist/i,
    );
  });

  it('requires an http(s) url for a webhook', async () => {
    await expect(
      mockIntegrationRepository.createIntegration({
        key: 'bad-hook',
        name: 'Bad hook',
        kind: 'WEBHOOK',
        provider: 'http',
      }),
    ).rejects.toThrow(/url/i);
  });

  it('rejects a duplicate key', async () => {
    await expect(
      mockIntegrationRepository.createIntegration({
        key: 'primary-smtp',
        name: 'Duplicate',
        kind: 'EMAIL',
        provider: 'smtp',
      }),
    ).rejects.toThrow(/already exists/i);
  });

  it('creates a webhook, defaults its subscription to the wildcard, then deletes it', async () => {
    const created = await mockIntegrationRepository.createIntegration({
      key: 'contract-hook',
      name: 'Contract hook',
      kind: 'WEBHOOK',
      provider: 'http',
      config: { url: 'https://example.com/hook' },
    });
    expect(created.secretConfigured).toBe(false);

    const subscriptions = await mockIntegrationRepository.listSubscriptions(created.id);
    expect(subscriptions.map((entry) => entry.eventType)).toEqual(['*']);

    await mockIntegrationRepository.deleteIntegration(created.id);
    await expect(mockIntegrationRepository.getIntegration(created.id)).rejects.toThrow(
      /does not exist/i,
    );
  });

  it('replaces the subscription set', async () => {
    const subscriptions = await mockIntegrationRepository.setSubscriptions('integration-2', [
      'user.welcome',
      'payroll.completed',
    ]);
    expect(subscriptions.map((entry) => entry.eventType).sort()).toEqual([
      'payroll.completed',
      'user.welcome',
    ]);
  });

  it('rotates a webhook secret and marks it configured', async () => {
    const rotation = await mockIntegrationRepository.rotateSecret('integration-2');
    expect(rotation.secret).toMatch(/^whsec_/);
    expect(rotation.integrationId).toBe('integration-2');

    const after = await mockIntegrationRepository.getIntegration('integration-2');
    expect(after.secretConfigured).toBe(true);
  });

  it('refuses subscriptions and secrets on a non-webhook', async () => {
    await expect(mockIntegrationRepository.listSubscriptions('integration-1')).rejects.toThrow(
      /webhook/i,
    );
    await expect(mockIntegrationRepository.rotateSecret('integration-1')).rejects.toThrow(
      /webhook/i,
    );
  });

  it('records a delivery when testing a connection', async () => {
    const before = await mockIntegrationRepository.listDeliveries('integration-1');
    const result = await mockIntegrationRepository.testIntegration('integration-1');
    expect(result.ok).toBe(true);

    const after = await mockIntegrationRepository.listDeliveries('integration-1');
    expect(after.length).toBe(before.length + 1);
  });

  it('updates an integration', async () => {
    const created = await mockIntegrationRepository.createIntegration({
      key: 'update-me',
      name: 'Before',
      kind: 'EMAIL',
      provider: 'smtp',
    });
    const updated = await mockIntegrationRepository.updateIntegration(created.id, {
      name: 'After',
      isEnabled: false,
    });
    expect(updated.name).toBe('After');
    expect(updated.isEnabled).toBe(false);

    await mockIntegrationRepository.deleteIntegration(created.id);
  });
});
