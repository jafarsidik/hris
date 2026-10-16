import type { Metadata } from 'next';

import { AiAssistantScreen } from '@/features/ai';

export const metadata: Metadata = { title: 'AI Assistant' };

export default function AiAssistantPage() {
  return <AiAssistantScreen />;
}
