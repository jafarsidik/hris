'use client';

import { apiDeveloperRepository } from './developer-api';
import { mockDeveloperRepository } from './developer-mock';
import type { DeveloperRepository } from './developer-types';

/**
 * Developer API client repository seam.
 *
 * Browser screens default to the live API. Point
 * `NEXT_PUBLIC_HRIS_DEVELOPERS_DATA_SOURCE=mock` to preview the screens against the
 * offline dataset (used by tests and demo environments without an API).
 */
export function getDevelopers(): DeveloperRepository {
  const source = process.env['NEXT_PUBLIC_HRIS_DEVELOPERS_DATA_SOURCE'] ?? 'api';
  return source === 'mock' ? mockDeveloperRepository : apiDeveloperRepository;
}

export type {
  ApiRequestListFilter,
  ApiRequestLogEntry,
  ApiUsageFilter,
  ApiUsageReport,
  ApiUsageRow,
  CreateApiClientInput,
  DeveloperApiClient,
  DeveloperApiClientWithSecret,
  DeveloperRepository,
  UpdateApiClientInput,
} from './developer-types';
