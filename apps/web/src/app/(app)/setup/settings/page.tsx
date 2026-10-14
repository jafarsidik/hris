import type { Metadata } from 'next';

import { SettingsScreen } from '@/features/iam/settings-screen';

export const metadata: Metadata = { title: 'System Parameters' };

export default function SettingsPage() {
  return <SettingsScreen />;
}
