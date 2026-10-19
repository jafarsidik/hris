import { mockAttendanceRepository } from './mock-attendance-repository';
import { AttendanceRecordsScreen } from './attendance-records-screen';
import { ShiftPatternsScreen } from './shift-patterns-screen';
import { SHIFT_PATTERNS } from './shift-pattern-data';
import type { AttendanceRepository, ShiftPattern } from './attendance-types';

export function getAttendanceRepository(): AttendanceRepository {
  return mockAttendanceRepository;
}

export function getShiftPatterns(): readonly ShiftPattern[] {
  return SHIFT_PATTERNS;
}

export { AttendanceRecordsScreen, ShiftPatternsScreen };

export type {
  AttendanceRecord,
  AttendanceRecordPage,
  AttendanceRecordQuery,
  AttendanceRepository,
} from './attendance-types';
