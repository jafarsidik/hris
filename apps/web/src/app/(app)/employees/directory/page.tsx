import { EmployeeDirectoryBrowse } from '@/features/employees/employee-directory-browse';
import { getEmployeeRepository } from '@/features/employees';
import { MAX_PAGE_SIZE } from '@hris/shared-types';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Employee Directory' };

export default async function EmployeeDirectoryPage() {
  const page = await getEmployeeRepository().list({
    status: 'ALL',
    department: 'ALL',
    employmentType: 'ALL',
    sort: 'name',
    page: { limit: MAX_PAGE_SIZE },
  });

  return <EmployeeDirectoryBrowse initialRows={page.items} />;
}
