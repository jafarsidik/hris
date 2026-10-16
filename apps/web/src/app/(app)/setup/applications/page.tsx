import type { Metadata } from 'next';

import { ApplicationsScreen } from '@/features/platform/applications-screen';

export const metadata: Metadata = { title: 'Application Registry' };

export default function ApplicationsPage() {
  return <ApplicationsScreen />;
}
