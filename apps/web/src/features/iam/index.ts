'use client';

import { apiIamRepository } from './iam-api';
import { mockIamRepository } from './iam-mock';
import type { IamRepository } from './iam-types';

/**
 * Administration repository seam.
 *
 * Browser screens default to the live API. Point
 * `NEXT_PUBLIC_HRIS_IAM_DATA_SOURCE=mock` to preview the screens against the
 * offline dataset (used by tests and demo environments without an API).
 */
export function getIam(): IamRepository {
  const source = process.env['NEXT_PUBLIC_HRIS_IAM_DATA_SOURCE'] ?? 'api';
  return source === 'mock' ? mockIamRepository : apiIamRepository;
}
