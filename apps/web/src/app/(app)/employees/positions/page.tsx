import { RecordTableScreen } from '@/features/employee-records';
// Data comes from the plain module: the feature barrel is a 'use client'
// module, and imports from a server component would arrive as client
// references instead of the arrays (runtime: "<X>.map is not a function").
import { POSITIONS } from '@/features/organization/org-data';
import type { RecordRowView, RecordTableParams } from '@/features/employee-records';
import type { PositionRow } from '@/features/organization/org-data';

export const metadata = { title: 'Positions' } as const;

export default async function PositionListPage() {
  const rows: RecordRowView[] = POSITIONS.map((position: PositionRow) => ({
    employeeId: position.id,
    employeeName: position.name,
    cells: [
      position.code,
      position.department,
      position.grade ?? '',
      String(position.headcount),
      position.active ? 'Active' : 'Inactive',
    ],
  }));

  const table: RecordTableParams = {
    title: 'Positions',
    description:
      'Position master and position assignments — the jobs the workforce holds, with grades.',
    columns: ['Code', 'Department', 'Grade', 'People', 'State'],
    firstColumn: 'Position',
    rows,
  };

  return <RecordTableScreen table={table} />;
}
