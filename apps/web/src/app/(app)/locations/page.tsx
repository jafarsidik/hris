import { RecordTableScreen } from '@/features/employee-records';
// Data comes from the plain module: the feature barrel is a 'use client'
// module, and imports from a server component would arrive as client
// references instead of the arrays (runtime: "<X>.map is not a function").
import { LOCATIONS } from '@/features/organization/org-data';
import type { RecordRowView, RecordTableParams } from '@/features/employee-records';
import type { LocationRow } from '@/features/organization/org-data';

export const metadata = { title: 'Locations' } as const;

export default async function LocationListPage() {
  const rows: RecordRowView[] = LOCATIONS.map((location: LocationRow) => ({
    employeeId: location.id,
    employeeName: location.name,
    cells: [
      location.code,
      location.city,
      location.country,
      location.timezone,
      location.isHeadquarters ? 'Headquarters' : '',
    ],
  }));

  const table: RecordTableParams = {
    title: 'Locations',
    description: 'Work locations and office sites — the sites people are assigned to.',
    columns: ['Code', 'City', 'Country', 'Timezone', 'Priority'],
    firstColumn: 'Location',
    rows,
  };

  return <RecordTableScreen table={table} />;
}
