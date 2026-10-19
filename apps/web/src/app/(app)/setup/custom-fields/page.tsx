import type { Metadata } from 'next';

import { CustomFieldsScreen } from '@/features/metadata/custom-fields-screen';

export const metadata: Metadata = { title: 'Custom Fields' };

export default function CustomFieldsPage() {
  return <CustomFieldsScreen />;
}
