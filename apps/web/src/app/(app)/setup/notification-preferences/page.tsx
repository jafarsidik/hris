import type { Metadata } from 'next';

import { NotificationPreferencesScreen } from '@/features/platform/notification-preferences-screen';

export const metadata: Metadata = { title: 'Notification Preferences' };

export default function NotificationPreferencesPage() {
  return <NotificationPreferencesScreen />;
}
