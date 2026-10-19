import { RecordTableScreen } from '@/features/employee-records';
// Data comes from the plain module: the feature barrel is a 'use client'
// module, and imports from a server component would arrive as client
// references instead of the arrays (runtime: "<X>.map is not a function").
import { UNITS } from '@/features/organization/org-data';
import type { RecordRowView, RecordTableParams } from '@/features/employee-records';
import type { UnitRow } from '@/features/organization/org-data';

export const metadata = { title: 'Departments' } as const;

export default async function DepartmentListPage() {
  const rows: RecordRowView[] = UNITS.map((unit: UnitRow) => ({
    employeeId: unit.id,
    employeeName: unit.name,
    cells: [
      unit.code,
      unit.type.toLowerCase().replace(/_/g, ' '),
      unit.parent ?? '',
      String(unit.headcount),
    ],
  }));

  const table: RecordTableParams = {
    title: 'Departments',
    description:
      'Departments and organizational units — the structure people are placed into across the company.',
    columns: ['Code', 'Type', 'Parent', 'People'],
    firstColumn: 'Department',
    rows,
  };

  return <RecordTableScreen table={table} />;
}
