import { DepartmentsScreen } from '@/features/organization';

export const metadata = { title: 'Departments' } as const;

/**
 * Departments route.
 *
 * The screen reads units from the API and mutates them through the same repository as
 * the organization structure screen, so this page is a focused view rather than a
 * second, hardcoded copy of the department list.
 */
export default function DepartmentListPage() {
  return <DepartmentsScreen />;
}
