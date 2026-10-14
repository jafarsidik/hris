import type { Metadata } from 'next';

import { ConsoleHome } from '@/features/console';

export const metadata: Metadata = { title: 'Console' };

export default function ConsolePage() {
  return <ConsoleHome />;
}
