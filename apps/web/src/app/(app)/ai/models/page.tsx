import type { Metadata } from 'next';

import { ModelsScreen } from '@/features/ai/models-screen';

export const metadata: Metadata = { title: 'Models' };

export default function ModelsPage() {
  return <ModelsScreen />;
}
