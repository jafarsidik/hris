import type {
  ApiRequestListFilter,
  ApiRequestLogEntry,
  ApiUsageFilter,
  ApiUsageReport,
  CreateApiClientInput,
  DeveloperApiClient,
  DeveloperRepository,
  UpdateApiClientInput,
} from './developer-types';

/**
 * Offline developer API clients for previews and tests.
 *
 * Serves a fixed, honest sample of the same read model the API returns so the screen can
 * be developed and exercised without the API running. The store is mutable so the
 * create/edit/rotate/delete flows work; it resets on reload.
 *
 * The full key is `${clientId}.${secret}`; the mock keeps the same one-time contract as
 * the API — a read never returns the secret, only create and rotate do.
 */
interface StoredClient extends DeveloperApiClient {
  secret: string;
}

const clientStore: StoredClient[] = [
  {
    id: 'client-1',
    name: 'Reporting service',
    description: 'Nightly headcount export.',
    clientId: 'hris_ak_0123456789abcdef01234567',
    scopes: ['user.view', 'organization.view'],
    isActive: true,
    lastUsedAt: '2026-02-10T03:15:00.000Z',
    createdAt: '2026-01-12T09:00:00.000Z',
    updatedAt: '2026-02-10T03:15:00.000Z',
    secret: 'mock-secret-reporting',
  },
  {
    id: 'client-2',
    name: 'Payroll bridge',
    description: null,
    clientId: 'hris_ak_89abcdef0123456789abcdef',
    scopes: ['user.view'],
    isActive: false,
    lastUsedAt: null,
    createdAt: '2026-01-20T11:30:00.000Z',
    updatedAt: '2026-01-20T11:30:00.000Z',
    secret: 'mock-secret-payroll',
  },
];

const now = (): string => new Date().toISOString();

/** A recorded request in the offline sample, keyed to one of the stored clients. */
interface StoredRequest {
  readonly id: string;
  readonly clientId: string;
  readonly method: string;
  readonly path: string;
  readonly statusCode: number;
  readonly durationMs: number;
  readonly correlationId: string | null;
  readonly occurredAt: string;
}

/**
 * A fixed sample of recorded requests.
 *
 * Paired with the two sample clients so the usage rollup and the request log have
 * something honest to show offline: one client with a healthy stream and one with a
 * failure, matching the client list.
 */
const requestStore: StoredRequest[] = [
  {
    id: 'request-1',
    clientId: 'client-1',
    method: 'GET',
    path: '/api/v1/users',
    statusCode: 200,
    durationMs: 34,
    correlationId: 'a1b2c3d4-0001-4000-8000-000000000001',
    occurredAt: '2026-02-10T03:15:00.000Z',
  },
  {
    id: 'request-2',
    clientId: 'client-1',
    method: 'GET',
    path: '/api/v1/organization/units',
    statusCode: 200,
    durationMs: 51,
    correlationId: 'a1b2c3d4-0002-4000-8000-000000000002',
    occurredAt: '2026-02-10T03:14:30.000Z',
  },
  {
    id: 'request-3',
    clientId: 'client-1',
    method: 'GET',
    path: '/api/v1/roles',
    statusCode: 403,
    durationMs: 12,
    correlationId: 'a1b2c3d4-0003-4000-8000-000000000003',
    occurredAt: '2026-02-10T03:14:02.000Z',
  },
  {
    id: 'request-4',
    clientId: 'client-2',
    method: 'GET',
    path: '/api/v1/users',
    statusCode: 200,
    durationMs: 28,
    correlationId: null,
    occurredAt: '2026-02-09T22:01:00.000Z',
  },
];

/** Whether a request falls inside the filter's inclusive window. */
function withinWindow(occurredAt: string, filter: ApiUsageFilter): boolean {
  const at = new Date(occurredAt).getTime();
  if (filter.from !== undefined && at < new Date(filter.from).getTime()) {
    return false;
  }
  if (filter.to !== undefined && at > new Date(filter.to).getTime()) {
    return false;
  }
  return true;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Projects a stored client onto the read model, dropping the secret. */
function toSummary(row: StoredClient): DeveloperApiClient {
  return clone({
    id: row.id,
    name: row.name,
    description: row.description,
    clientId: row.clientId,
    scopes: row.scopes,
    isActive: row.isActive,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function clientById(id: string): StoredClient {
  const client = clientStore.find((candidate) => candidate.id === id);
  if (!client) {
    throw new Error('The API client does not exist.');
  }
  return client;
}

function randomToken(length: number): string {
  let value = '';
  for (let i = 0; i < length; i += 1) {
    value += Math.floor(Math.random() * 16).toString(16);
  }
  return value;
}

export const mockDeveloperRepository: DeveloperRepository = {
  async listClients() {
    return clientStore.map(toSummary);
  },

  async getClient(id) {
    return toSummary(clientById(id));
  },

  async createClient(input: CreateApiClientInput) {
    const clientId = `hris_ak_${randomToken(24)}`;
    const secret = `mock-secret-${randomToken(16)}`;
    const row: StoredClient = {
      id: `client-${clientStore.length + 1}`,
      name: input.name,
      description: input.description ?? null,
      clientId,
      scopes: [...new Set(input.scopes)],
      isActive: true,
      lastUsedAt: null,
      createdAt: now(),
      updatedAt: now(),
      secret,
    };
    clientStore.push(row);
    return { ...toSummary(row), secret: `${clientId}.${secret}` };
  },

  async updateClient(id, input: UpdateApiClientInput) {
    const client = clientById(id);
    const updated: StoredClient = {
      ...client,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.scopes !== undefined ? { scopes: [...new Set(input.scopes)] } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedAt: now(),
    };
    const index = clientStore.findIndex((candidate) => candidate.id === id);
    clientStore[index] = updated;
    return toSummary(updated);
  },

  async rotateClient(id) {
    const client = clientById(id);
    const secret = `mock-secret-${randomToken(16)}`;
    const rotated: StoredClient = { ...client, secret, updatedAt: now() };
    const index = clientStore.findIndex((candidate) => candidate.id === id);
    clientStore[index] = rotated;
    return { ...toSummary(rotated), secret: `${rotated.clientId}.${secret}` };
  },

  async deleteClient(id) {
    const index = clientStore.findIndex((candidate) => candidate.id === id);
    if (index >= 0) {
      clientStore.splice(index, 1);
    }
  },

  async getUsage(filter: ApiUsageFilter) {
    const rows = clientStore.filter(
      (client) => filter.clientId === undefined || client.id === filter.clientId,
    );

    const items = rows.map((client) => {
      const requests = requestStore.filter(
        (request) => request.clientId === client.id && withinWindow(request.occurredAt, filter),
      );
      const errors = requests.filter((request) => request.statusCode >= 400);
      const mean =
        requests.length === 0
          ? null
          : Math.round(
              requests.reduce((sum, request) => sum + request.durationMs, 0) / requests.length,
            );
      return {
        clientId: client.id,
        name: client.name,
        isActive: client.isActive,
        requestCount: requests.length,
        errorCount: errors.length,
        avgDurationMs: mean,
      };
    });

    const report: ApiUsageReport = {
      items,
      from: filter.from ?? null,
      to: filter.to ?? null,
      totalRequests: items.reduce((sum, row) => sum + row.requestCount, 0),
      totalErrors: items.reduce((sum, row) => sum + row.errorCount, 0),
    };
    return clone(report);
  },

  async listRequests(filter: ApiRequestListFilter) {
    const nameOf = (clientId: string): string =>
      clientStore.find((client) => client.id === clientId)?.name ?? 'Unknown client';

    const items: ApiRequestLogEntry[] = requestStore
      .filter((request) => filter.clientId === undefined || request.clientId === filter.clientId)
      .filter((request) => withinWindow(request.occurredAt, filter))
      .sort((left, right) =>
        left.occurredAt < right.occurredAt ? 1 : left.occurredAt > right.occurredAt ? -1 : 0,
      )
      .map((request) => ({
        id: request.id,
        clientId: request.clientId,
        clientName: nameOf(request.clientId),
        method: request.method,
        path: request.path,
        statusCode: request.statusCode,
        durationMs: request.durationMs,
        correlationId: request.correlationId,
        occurredAt: request.occurredAt,
      }));

    const limited = items.slice(0, filter.limit ?? 20);
    return clone({ items: limited, pageInfo: { hasNextPage: false, endCursor: null } });
  },
};
