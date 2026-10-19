import type { Metadata } from 'next';

import { SettingsScreen } from '@/features/iam/settings-screen';

export const metadata: Metadata = { title: 'Email' };

export default function EmailPage() {
  return (
    <SettingsScreen
      group="email"
      title="Email"
      description="Outbound email transport and sender identity for this tenant."
    />
  );
}
