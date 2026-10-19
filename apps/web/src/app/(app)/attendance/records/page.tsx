import type { Metadata } from 'next';

import { AttendanceRecordsScreen } from '@/features/attendance';
import { getAttendanceRepository } from '@/features/attendance';

export const metadata: Metadata = { title: 'Attendance' };

export default async function AttendanceRecordsPage() {
  const repository = getAttendanceRepository();
  const page = await repository.listRecords({});

  return <AttendanceRecordsScreen initialRows={page.items} />;
}
