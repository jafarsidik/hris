import type { Metadata } from 'next';

import { ToolsScreen } from '@/features/ai/tools-screen';

export const metadata: Metadata = { title: 'Tools' };

export default function ToolsPage() {
  return <ToolsScreen />;
}
