import type { ImportResult } from '@/components/import/import-dialog';

/**
 * Reads a directory CSV and reports what it found.
 *
 * This phase has no import backend, so the handler does the only honest thing: read
 * the file, count the usable rows, and say plainly that nothing was saved. The count
 * is real — a valid file is genuinely readable — but the record never leaves the
 * browser, and the returned `note` makes the dialog say so on the success toast so a
 * screenshot of "Import finished" cannot be mistaken for a working feature.
 */

/** Column headers the directory accepts, case-insensitive, first row. */
const EXPECTED_HEADERS = [
  'fullName',
  'full name',
  'name',
  'email',
  'employeeNumber',
  'jobTitle',
  'job title',
  'department',
  'employmentType',
  'employment type',
  'hireDate',
  'hire date',
  'status',
] as const;

export const EMPLOYEE_IMPORT_NOTE =
  'Nothing was saved — importing into a database is not connected yet.';

export async function importEmployeesFromCsv(file: File): Promise<ImportResult> {
  const text = await file.text();

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');

  const dataRows = dropHeaderIfPresent(lines);

  return {
    imported: dataRows.length,
    skipped: 0,
    fileName: file.name,
    note: EMPLOYEE_IMPORT_NOTE,
  };
}

function dropHeaderIfPresent(lines: readonly string[]): readonly string[] {
  const first = lines[0];
  if (first === undefined) return lines;

  const firstCell = first.split(',')[0]?.trim().toLowerCase();
  return firstCell !== undefined && (EXPECTED_HEADERS as readonly string[]).includes(firstCell)
    ? lines.slice(1)
    : lines;
}
