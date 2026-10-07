import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { installLocalStorageStub } from '@/test/local-storage-stub';

import { NotificationBell } from './notification-bell';

type NotificationKind = 'warning' | 'success' | 'info';

type NotificationItem = {
  readonly id: string;
  readonly kind: NotificationKind;
  readonly title: string;
  readonly description: string;
  readonly href?: string;
};

const loadNotifications = vi.hoisted(() =>
  vi.fn(async (): Promise<readonly NotificationItem[]> => []),
);

vi.mock('@/app/notifications/actions', () => ({ loadNotifications }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

/** Each test starts fresh: no fetch calls carried over, no read state in storage. */
beforeEach(() => {
  installLocalStorageStub();
  window.localStorage.clear();
  loadNotifications.mockResolvedValue([]);
});

const notification = (overrides: Partial<NotificationItem> = {}): NotificationItem => ({
  id: 'n-1',
  kind: 'warning' as const,
  title: 'Probation ending soon',
  description: '2 employees finish probation in the next 30 days.',
  href: '/employees?status=PROBATION',
  ...overrides,
});

describe('NotificationBell', () => {
  it('announces unread count until the reader opens the menu', async () => {
    loadNotifications.mockResolvedValue([notification()]);
    render(<NotificationBell />);

    const trigger = await waitFor(() =>
      screen.getByRole('button', { name: 'Notifications, 1 unread' }),
    );

    fireEvent.click(trigger);

    expect(screen.getByText('Probation ending soon')).toBeInTheDocument();
    expect(screen.getByText('Mark all as read')).toBeInTheDocument();
  });

  it('stays quiet when there is nothing to report', async () => {
    render(<NotificationBell />);

    expect(
      await waitFor(() => screen.getByRole('button', { name: 'Notifications, no unread items' })),
    ).toBeInTheDocument();
  });

  it('marks everything read on demand', async () => {
    loadNotifications.mockResolvedValue([notification()]);
    render(<NotificationBell />);

    const trigger = await waitFor(() =>
      screen.getByRole('button', { name: 'Notifications, 1 unread' }),
    );
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));

    expect(
      screen.getByRole('button', { name: 'Notifications, no unread items' }),
    ).toBeInTheDocument();
    const stored = window.localStorage.getItem('hris:read-notifications');
    expect(stored).not.toBeNull();
    expect(stored).toContain('n-1');
  });
});
