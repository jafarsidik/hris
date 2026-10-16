import type { Metadata } from 'next';

import { BusinessRulesScreen } from '@/features/automation';

export const metadata: Metadata = { title: 'Business Rules' };

export default function BusinessRulesPage() {
  return <BusinessRulesScreen />;
}
