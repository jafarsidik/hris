import type { Metadata } from 'next';

import { AccessLogScreen } from '@/features/developers/access-log-screen';

export const metadata: Metadata = { title: 'API Access Log' };

export default function ApiAccessLogPage() {
  return <AccessLogScreen />;
}
