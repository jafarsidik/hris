import type { DeliveryLogEntry, IntegrationHealthSummary } from '@hris/shared-types';

import { apiRequestV1 } from '@/lib/api/client-config';

/**
 * Cross-integration read surfaces: one feed of delivery attempts and one health rollup,
 * so the Delivery Logs and Integration Monitor screens do not poll every integration's
 * own window separately.
 */
export const integrationOpsApi = {
  deliveryLog: (limit = 100): Promise<readonly DeliveryLogEntry[]> =>
    apiRequestV1<readonly DeliveryLogEntry[]>(`/integrations/deliveries?limit=${limit}`),

  monitor: (): Promise<readonly IntegrationHealthSummary[]> =>
    apiRequestV1<readonly IntegrationHealthSummary[]>('/integrations/monitor'),
};
