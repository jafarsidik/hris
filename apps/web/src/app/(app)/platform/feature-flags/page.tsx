import type { Metadata } from 'next';

import { FeatureFlagsScreen } from '@/features/feature-flags/feature-flags-screen';

export const metadata: Metadata = { title: 'Feature Flags' };

export default function FeatureFlagsPage() {
  return <FeatureFlagsScreen />;
}
