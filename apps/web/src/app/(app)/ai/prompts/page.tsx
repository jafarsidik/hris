import type { Metadata } from 'next';

import { PromptsScreen } from '@/features/ai/prompts-screen';

export const metadata: Metadata = { title: 'Prompts' };

export default function PromptsPage() {
  return <PromptsScreen />;
}
