import type { Metadata } from 'next';

import { ShiftPatternsScreen, getShiftPatterns } from '@/features/attendance';

export const metadata: Metadata = { title: 'Shift Patterns' };

export default async function ShiftPatternsPage() {
  const rows = getShiftPatterns();

  return <ShiftPatternsScreen rows={rows} />;
}
