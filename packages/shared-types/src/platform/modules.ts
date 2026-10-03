/**
 * Platform module identifiers (MASTER_PRD section 5).
 *
 * Used for audit-log module attribution and for grouping permissions.
 */
export const MODULE_IDS = [
  'M00_AUTHENTICATION',
  'M01_CORE_HR',
  'M02_INDUSTRIAL_RELATIONS',
  'M03_RECRUITMENT',
  'M04_PERFORMANCE',
  'M05_CLAIMS',
  'M06_PAYROLL',
  'M07_ADMINISTRATION',
  'M08_ATTENDANCE',
  'M09_AI_ANALYTICS',
  'PLATFORM',
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];
