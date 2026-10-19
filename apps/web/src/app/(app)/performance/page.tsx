import type { Metadata } from 'next';

import { PerformanceScreen, getPerformanceRepository } from '@/features/performance';

export const metadata: Metadata = { title: 'Performance' };

export default async function PerformancePage() {
  const repository = getPerformanceRepository();
  const [cycles, goals, reviews] = await Promise.all([
    repository.listCycles(),
    repository.listGoals(),
    repository.listReviews(),
  ]);

  return <PerformanceScreen cycles={cycles.items} goals={goals.items} reviews={reviews.items} />;
}
