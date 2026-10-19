import type { Metadata } from 'next';

import { NotificationTemplatesScreen } from '@/features/platform/notification-templates-screen';

export const metadata: Metadata = { title: 'Notification Templates' };

export default function NotificationTemplatesPage() {
  return <NotificationTemplatesScreen />;
}
