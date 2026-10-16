import type { Metadata } from 'next';

import { IntegrationDetailScreen } from '@/features/integrations/integration-detail-screen';

export const metadata: Metadata = { title: 'Integration' };

export default async function IntegrationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <IntegrationDetailScreen id={id} />;
}
