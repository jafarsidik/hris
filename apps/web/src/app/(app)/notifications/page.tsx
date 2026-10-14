import type { Metadata } from 'next';

import { NotificationsScreen } from '@/features/platform';

export const metadata: Metadata = { title: 'Notifications' };

export default function NotificationsPage() {
  return <NotificationsScreen />;
}
