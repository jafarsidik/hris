import type { Metadata } from 'next';

import { MovementScreen } from '@/features/reports/movement-screen';
import { mockMovements } from '@/features/employment';

export const metadata: Metadata = { title: 'Employee Movement Report' };

/**
 * The employee movement report page.
 *
 * Reads the demo movement dataset and hands it to the client screen, which
 * derives all KPIs and breakdowns. The dataset is the mock set that ships
 * with the employment module; a real movements endpoint will replace it.
 */
export default function MovementReportPage() {
  const movements = mockMovements();

  return <MovementScreen movements={movements.items} />;
}
