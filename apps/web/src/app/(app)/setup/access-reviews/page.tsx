import type { Metadata } from 'next';

import { AccessReviewsScreen } from '@/features/governance/access-reviews-screen';

export const metadata: Metadata = { title: 'Access Reviews' };

export default function AccessReviewsPage() {
  return <AccessReviewsScreen />;
}
