import type { Metadata } from 'next';

import { SettingsScreen } from '@/features/iam/settings-screen';

export const metadata: Metadata = { title: 'Localization' };

export default function LocalizationPage() {
  return (
    <SettingsScreen
      group="localization"
      title="Localization"
      description="Languages, time zones and date formatting for this company."
    />
  );
}
