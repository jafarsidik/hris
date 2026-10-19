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

// Wave 3 (top-level `/organization`, `/departments`, `/positions`, `/jobs`,
// `/locations`, `/org-chart`) screens and their deterministic data.
//
// Server pages must NOT read data through this barrel: it starts with
// 'use client', so anything a server component imports from here arrives as a
// client reference, not a value (runtime: "<X>.map is not a function"). Pages
// import the arrays from `./org-data` / `./job-config-data` directly; only
// type re-exports are safe here.
export { OrgTree, OrgTreeCard } from './org-tree';
export { OrgChartNew } from './org-chart-new';
export type { JobFamily, JobLevel } from './job-config-data';
export type { LocationRow, PositionRow, UnitRow } from './org-data';
