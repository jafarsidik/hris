import type { Employee } from '@/features/employees/employee-types';

const escapeCell = (value: string): string => {
  const needsQuoting = /[",\n\r]/.test(value);
  return needsQuoting ? `"${value.replaceAll('"', '""')}"` : value;
};

const HEADERS = [
  'employeeNumber',
  'fullName',
  'email',
  'jobTitle',
  'department',
  'employmentType',
  'hireDate',
  'status',
] as const;

/**
 * Exports the given rows as a CSV download, browser-side.
 *
 * No server round-trip: the rows are already on the client (the directory's own state),
 * and generating a file for a few hundred rows client-side is instant. Newlines and
 * quotes are escaped per RFC 4180, and a UTF-8 BOM keeps Excel from misreading non-ASCII
 * names.
 */
export function exportEmployeesToCsv(rows: readonly Employee[]): void {
  const lines = [
    HEADERS.join(','),
    ...rows.map((row) => HEADERS.map((header) => escapeCell(String(row[header]))).join(',')),
  ];
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
