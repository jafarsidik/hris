import { PositionsScreen } from '@/features/employees/positions-screen';

export const metadata = { title: 'Positions' } as const;

/**
 * Positions route.
 *
 * Reads and writes the position master through the API, so the employee form's job-title
 * select and this table show the same rows.
 */
export default function PositionListPage() {
  return <PositionsScreen />;
}
