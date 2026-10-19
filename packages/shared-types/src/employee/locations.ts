import type { PageParams } from '../common/pagination';

/** A work location (office or site). */
export interface WorkLocationSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly city: string | null;
  readonly country: string | null;
  readonly address: string | null;
  readonly timezone: string | null;
  readonly isHeadquarters: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateWorkLocationInput {
  readonly code: string;
  readonly name: string;
  readonly city: string | null;
  readonly country: string | null;
  readonly address: string | null;
  readonly timezone: string | null;
  readonly isHeadquarters: boolean;
}

export interface UpdateWorkLocationInput {
  readonly code?: string;
  readonly name?: string;
  readonly city?: string | null;
  readonly country?: string | null;
  readonly address?: string | null;
  readonly timezone?: string | null;
  readonly isHeadquarters?: boolean;
}

export interface WorkLocationQuery {
  readonly city?: string;
  readonly search?: string;
  readonly page?: PageParams;
}
