import type { Metadata } from 'next';

import { EventRegistryScreen } from '@/features/automation';

export const metadata: Metadata = { title: 'Event Registry' };

export default function EventRegistryPage() {
  return <EventRegistryScreen />;
}
