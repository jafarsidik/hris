'use server';

import { MAX_PAGE_SIZE } from '@hris/shared-types';

import { getEmployeeRepository } from '@/features/employees';
import { computeDirectoryFacts } from '@/features/employees/directory-facts';

/**
 * Notifications derived from the directory — the only source of workflow-adjacent facts
 * this phase has.
 *
 * Nothing emits events yet, so an inbox cannot be *triggered*; these are computed from the
 * same repository the dashboard and directory read, which keeps the bell honest: the same
 * employment facts, surfaced at a glance. When workflow modules ship, this becomes a fold
 * of real events rather than a place they were fabricated.
 */

export interface DerivedNotification {
  readonly id: string;
  readonly kind: 'warning' | 'success' | 'info';
  readonly title: string;
  readonly description: string;
  readonly href: string | undefined;
}

export async function loadNotifications(): Promise<readonly DerivedNotification[]> {
  const { items } = await getEmployeeRepository().list({
    sort: 'hireDate',
    page: { limit: MAX_PAGE_SIZE },
  });
  const facts = computeDirectoryFacts(items);

  const notifications: DerivedNotification[] = [];

  if (facts.onLeave > 0) {
    notifications.push({
      id: 'attendance:on-leave',
      kind: 'warning',
      title: `${facts.onLeave} ${facts.onLeave === 1 ? 'employee is' : 'employees are'} on leave`,
      description: 'Currently marked on leave in the directory.',
      href: '/employees?status=ON_LEAVE',
    });
  }

  if (facts.probation > 0) {
    notifications.push({
      id: 'lifecycle:probation',
      kind: 'info',
      title: `${facts.probation} ${facts.probation === 1 ? 'employee is' : 'employees are'} in probation`,
      description: 'Status marked PROBATION; confirmation decisions sit beside them.',
      href: '/employees?status=PROBATION',
    });
  }

  if (facts.confirmingSoon > 0) {
    notifications.push({
      id: 'lifecycle:confirmation-soon',
      kind: 'warning',
      title: `${facts.confirmingSoon} reach the end of probation within 30 days`,
      description: 'Assuming a six-month period; contract data will make this precise.',
      href: '/employees?status=PROBATION',
    });
  }

  if (facts.recentJoiners > 0) {
    notifications.push({
      id: 'lifecycle:joiners',
      kind: 'success',
      title: `${facts.recentJoiners} joined in the last 30 days`,
      description: 'Newest records in the directory.',
      href: '/employees',
    });
  }

  return notifications;
}
