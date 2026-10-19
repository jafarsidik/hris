import type { Metadata } from 'next';

import { IntegrationMonitorScreen } from '@/features/integrations/integration-monitor-screen';

export const metadata: Metadata = { title: 'Integration Monitor' };

export default function IntegrationMonitorPage() {
  return <IntegrationMonitorScreen />;
}
