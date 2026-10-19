import type { Metadata } from 'next';

import { PerformanceMetricsScreen } from '@/features/platform/performance-metrics-screen';

export const metadata: Metadata = { title: 'Performance Metrics' };

export default function PerformanceMetricsPage() {
  return <PerformanceMetricsScreen />;
}
