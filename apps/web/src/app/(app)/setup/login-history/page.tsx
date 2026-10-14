import type { Metadata } from 'next';

import { LogsScreen } from '@/features/iam/logs-screen';

export const metadata: Metadata = { title: 'Login History' };

export default function LoginHistoryPage() {
  return (
    <LogsScreen
      presetCategory="SECURITY"
      title="Login History"
      description="Authentication and login activity."
    />
  );
}
