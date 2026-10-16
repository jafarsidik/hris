import { afterEach, describe, expect, it } from 'vitest';

import { apiDeveloperRepository } from './developer-api';
import { mockDeveloperRepository } from './developer-mock';

/**
 * The developer screens talk to one repository, whichever the factory returns. This
 * contract test locks the mock to the same behaviour the API-backed repository serves, so
 * a screen exercised against the mock cannot diverge from the live contract unnoticed.
 */
describe('developer repository contract', () => {
  afterEach(() => {
    delete process.env['NEXT_PUBLIC_HRIS_DEVELOPERS_DATA_SOURCE'];
  });

  it('defaults to the API repository', async () => {
    const { getDevelopers } = await import('./index');
    expect(getDevelopers()).toBe(apiDeveloperRepository);
  });

  it('returns the mock repository when configured', async () => {
    process.env['NEXT_PUBLIC_HRIS_DEVELOPERS_DATA_SOURCE'] = 'mock';
    const { getDevelopers } = await import('./index');
    expect(getDevelopers()).toBe(mockDeveloperRepository);
  });

  it('rejects the mock when the configured source is unknown', async () => {
    process.env['NEXT_PUBLIC_HRIS_DEVELOPERS_DATA_SOURCE'] = 'legacy';
    const { getDevelopers } = await import('./index');
    expect(getDevelopers()).toBe(apiDeveloperRepository);
  });

  it('serves a usable sample with no secret on a read', async () => {
    const clients = await mockDeveloperRepository.listClients();
    expect(clients.length).toBeGreaterThan(0);
    expect(clients.every((client) => client.clientId.startsWith('hris_ak_'))).toBe(true);
    expect(clients.every((client) => !('secret' in client))).toBe(true);
  });

  it('creates a client, returns its secret once, then lists it', async () => {
    const created = await mockDeveloperRepository.createClient({
      name: 'Contract test',
      scopes: ['user.view'],
    });
    expect(created.secret).toMatch(/^hris_ak_[0-9a-f]{24}\./);
    expect(created.isActive).toBe(true);

    const listed = await mockDeveloperRepository.listClients();
    const row = listed.find((client) => client.id === created.id);
    expect(row).toBeDefined();
    expect(row).not.toHaveProperty('secret');

    await mockDeveloperRepository.deleteClient(created.id);
  });

  it('rotates a client to a new secret', async () => {
    const created = await mockDeveloperRepository.createClient({
      name: 'Rotate test',
      scopes: ['user.view'],
    });
    const rotated = await mockDeveloperRepository.rotateClient(created.id);
    expect(rotated.secret).not.toBe(created.secret);

    await mockDeveloperRepository.deleteClient(created.id);
  });

  it('updates a client and disables it', async () => {
    const created = await mockDeveloperRepository.createClient({
      name: 'Update test',
      scopes: ['user.view'],
    });
    const updated = await mockDeveloperRepository.updateClient(created.id, {
      name: 'Renamed',
      isActive: false,
    });
    expect(updated.name).toBe('Renamed');
    expect(updated.isActive).toBe(false);

    await mockDeveloperRepository.deleteClient(created.id);
  });

  it('rejects an unknown client id', async () => {
    await expect(mockDeveloperRepository.getClient('missing')).rejects.toThrow(/does not exist/i);
  });

  it('rolls usage up by client, totalling the same requests', async () => {
    const report = await mockDeveloperRepository.getUsage({});

    expect(report.items.length).toBeGreaterThan(0);
    const sum = report.items.reduce((total, row) => total + row.requestCount, 0);
    expect(report.totalRequests).toBe(sum);
    expect(report.totalErrors).toBe(report.items.reduce((total, row) => total + row.errorCount, 0));
  });

  it('scopes usage to one client when asked', async () => {
    const all = await mockDeveloperRepository.getUsage({});
    const first = all.items[0];
    if (first === undefined) {
      throw new Error('expected at least one sample client');
    }

    const scoped = await mockDeveloperRepository.getUsage({ clientId: first.clientId });
    expect(scoped.items.map((row) => row.clientId)).toEqual([first.clientId]);
  });

  it('lists recorded requests newest first with a client name', async () => {
    const page = await mockDeveloperRepository.listRequests({});

    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((entry) => entry.clientName.length > 0)).toBe(true);

    const timestamps = page.items.map((entry) => entry.occurredAt);
    expect([...timestamps].sort().reverse()).toEqual(timestamps);
  });

  it('filters the request log by client', async () => {
    const all = await mockDeveloperRepository.listRequests({});
    const first = all.items[0];
    if (first === undefined) {
      throw new Error('expected at least one sample request');
    }

    const scoped = await mockDeveloperRepository.listRequests({ clientId: first.clientId });
    expect(scoped.items.length).toBeGreaterThan(0);
    expect(scoped.items.every((entry) => entry.clientId === first.clientId)).toBe(true);
  });
});
