import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiIamRepository } from './iam-api';
import { mockIamRepository } from './iam-mock';

/**
 * The Administration screens talk to one repository, whichever the factory returns.
 * This contract test locks the mock to the same read-model shapes the API-backed
 * repository serves, so a screen tested against the mock cannot diverge from the
 * live contract unnoticed.
 */
describe('IAM repository contract', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { items: [], pageInfo: { hasNextPage: false, endCursor: null } },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    delete process.env['NEXT_PUBLIC_HRIS_IAM_DATA_SOURCE'];
    vi.unstubAllGlobals();
  });

  it('defaults to the API repository', async () => {
    const { getIam } = await import('./index');
    expect(getIam()).toBe(apiIamRepository);
  });

  it('returns the mock repository when configured', async () => {
    process.env['NEXT_PUBLIC_HRIS_IAM_DATA_SOURCE'] = 'mock';
    const { getIam } = await import('./index');
    expect(getIam()).toBe(mockIamRepository);
  });

  it('rejects the mock when the configured source is unknown', async () => {
    process.env['NEXT_PUBLIC_HRIS_IAM_DATA_SOURCE'] = 'legacy';
    const { getIam } = await import('./index');
    // Unknown sources fall back to the live API rather than a silent empty dataset.
    expect(getIam()).toBe(apiIamRepository);
  });

  it('serves the same paginated shape from both repositories', async () => {
    const apiUserPage = await apiIamRepository.listUsers({}, {});
    const mockUserPage = await mockIamRepository.listUsers({}, {});
    expect(apiUserPage).toHaveProperty('items');
    expect(apiUserPage.pageInfo).toEqual({ hasNextPage: false, endCursor: null });
    expect(mockUserPage).toHaveProperty('items');
    expect(mockUserPage.pageInfo).toHaveProperty('hasNextPage');
  });

  it('serves usable read models from the mock', async () => {
    const settings = await mockIamRepository.listSettings();
    expect(settings.length).toBeGreaterThan(0);
    expect(settings[0]).toMatchObject({
      key: expect.any(String),
      group: expect.any(String),
      isSensitive: expect.any(Boolean),
      isEditable: true,
    });

    const roles = await mockIamRepository.listRoles();
    expect(roles.length).toBeGreaterThan(0);

    const users = await mockIamRepository.listUsers({}, {});
    expect(users.items.length).toBeGreaterThan(0);

    const permissions = await mockIamRepository.listPermissions();
    expect(permissions.length).toBeGreaterThan(0);
  });

  it('sends update items to the API repository and parses the response', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              group: 'general',
              key: 'x',
              value: '1',
              valueType: 'NUMBER',
              isSensitive: false,
              isEditable: true,
              description: null,
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const updated = await apiIamRepository.updateSettings([{ key: 'x', value: '1' }]);
    expect(updated).toHaveLength(1);
    const call = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(call[0].toString()).toContain('/settings');
    expect(call[1].method).toBe('PUT');
  });
});
