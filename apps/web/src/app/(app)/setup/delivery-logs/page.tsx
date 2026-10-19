import type { Metadata } from 'next';

import { DeliveryLogsScreen } from '@/features/integrations/delivery-logs-screen';

export const metadata: Metadata = { title: 'Delivery Logs' };

export default function DeliveryLogsPage() {
  return <DeliveryLogsScreen />;
}
