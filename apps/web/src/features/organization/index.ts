'use client';

import { apiOrganizationRepository } from './org-api';
import { mockOrganizationRepository } from './org-mock';
import type { OrganizationRepository } from './org-types';

/**
 * Organizational structure repository seam.
 *
 * Browser screens default to the live API. Point
 * `NEXT_PUBLIC_HRIS_ORGANIZATION_DATA_SOURCE=mock` to preview the screens against the
 * offline dataset (used by tests and demo environments without an API).
 */
export function getOrganization(): OrganizationRepository {
  const source = process.env['NEXT_PUBLIC_HRIS_ORGANIZATION_DATA_SOURCE'] ?? 'api';
  return source === 'mock' ? mockOrganizationRepository : apiOrganizationRepository;
}

export type {
  CreateEntityInput,
  CreateUnitInput,
  EntityListFilter,
  OrganizationRepository,
  PageInput,
  UnitListFilter,
  UpdateEntityInput,
  UpdateUnitInput,
} from './org-types';
