/**
 * Developer API client administration.
 *
 * Mirrors the API's `/developers/clients` surface. The secret is returned only by the
 * create and rotate responses, so it is modelled on a distinct result type the screens
 * can show exactly once rather than on the ordinary read model.
 */
import type { Paginated } from '@hris/shared-types';

export interface DeveloperApiClient {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly clientId: string;
  readonly scopes: readonly string[];
  readonly isActive: boolean;
  readonly lastUsedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A client together with the one-time secret returned when it is created or rotated. */
export interface DeveloperApiClientWithSecret extends DeveloperApiClient {
  readonly secret: string;
}

export interface CreateApiClientInput {
  readonly name: string;
  readonly description?: string;
  readonly scopes: readonly string[];
}

export interface UpdateApiClientInput {
  readonly name?: string;
  readonly description?: string;
  readonly scopes?: readonly string[];
  readonly isActive?: boolean;
}

/** Optional window and client filter shared by the usage report and the request log. */
export interface ApiUsageFilter {
  /** Inclusive lower bound, ISO-8601. */
  readonly from?: string;
  /** Inclusive upper bound, ISO-8601. */
  readonly to?: string;
  readonly clientId?: string;
}

/** Per-client request volume and error rate over a window. */
export interface ApiUsageRow {
  readonly clientId: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly requestCount: number;
  readonly errorCount: number;
  readonly avgDurationMs: number | null;
}

export interface ApiUsageReport {
  readonly items: readonly ApiUsageRow[];
  readonly from: string | null;
  readonly to: string | null;
  readonly totalRequests: number;
  readonly totalErrors: number;
}

/** One recorded request made with an API key. */
export interface ApiRequestLogEntry {
  readonly id: string;
  readonly clientId: string;
  readonly clientName: string;
  readonly method: string;
  readonly path: string;
  readonly statusCode: number;
  readonly durationMs: number;
  readonly correlationId: string | null;
  readonly occurredAt: string;
}

/** A page of recorded requests, with the filters and cursor that produced it. */
export interface ApiRequestListFilter extends ApiUsageFilter {
  readonly cursor?: string;
  readonly limit?: number;
}

export interface DeveloperRepository {
  listClients(): Promise<readonly DeveloperApiClient[]>;
  getClient(id: string): Promise<DeveloperApiClient>;
  createClient(input: CreateApiClientInput): Promise<DeveloperApiClientWithSecret>;
  updateClient(id: string, input: UpdateApiClientInput): Promise<DeveloperApiClient>;
  rotateClient(id: string): Promise<DeveloperApiClientWithSecret>;
  deleteClient(id: string): Promise<void>;
  getUsage(filter: ApiUsageFilter): Promise<ApiUsageReport>;
  listRequests(filter: ApiRequestListFilter): Promise<Paginated<ApiRequestLogEntry>>;
}
