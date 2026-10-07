import type { Employee } from './employee-types';

/**
 * Writes made while the employee source is still the mock.
 *
 * There is no employee endpoint yet, so `saveEmployee` cannot persist anywhere real. It
 * writes here instead, and the mock repository overlays this store onto its generated
 * rows on every `list`. The result is that a created or edited employee shows up in the
 * directory for the lifetime of the server process — and disappears on restart, which is
 * exactly how a placeholder data source should behave. The UI says "sample" wherever a
 * save happens so nobody mistakes this for storage.
 */
const STORED = new Map<string, Employee>();

export function upsertStoredEmployee(employee: Employee): void {
  STORED.set(employee.id, employee);
}

export function getStoredEmployees(): readonly Employee[] {
  return [...STORED.values()];
}

export function clearStoredEmployees(): void {
  STORED.clear();
}

export function findStoredEmployee(id: string): Employee | undefined {
  return STORED.get(id);
}
