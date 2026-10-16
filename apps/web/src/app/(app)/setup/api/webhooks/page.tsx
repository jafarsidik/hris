import type { Metadata } from 'next';

import { IntegrationsScreen } from '@/features/integrations/integrations-screen';

export const metadata: Metadata = { title: 'Webhooks' };

export default function WebhooksPage() {
  return (
    <IntegrationsScreen
      kindFilter="WEBHOOK"
      createKind="WEBHOOK"
      title="Webhooks"
      description="Outbound endpoints that receive this tenant's domain events."
    />
  );
}
