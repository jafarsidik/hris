import type { Metadata } from 'next';

import { LogsScreen } from '@/features/iam/logs-screen';

export const metadata: Metadata = { title: 'Security Audit' };

export default function SecurityAuditPage() {
  return (
    <LogsScreen
      mode="audit"
      title="Security Audit"
      description="Security events and access audit trail."
    />
  );
}
