import type { PageParams } from '../common/pagination';

/** One daily attendance record. */
export interface AttendanceRecordSummary {
  readonly id: string;
  readonly employeeId: string;
  readonly employeeName: string;
  readonly employeeNumber: string;
  readonly attendanceDate: string;
  readonly clockIn: string | null;
  readonly clockOut: string | null;
  readonly breakMinutes: number;
  readonly status: string;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** One shift pattern definition. */
export interface ShiftPatternSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly startTime: string;
  readonly endTime: string;
  readonly breakMinutes: number;
  readonly workDays: string;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Fields used to create or update an attendance record. */
export interface CreateAttendanceRecordInput {
  readonly employeeId: string;
  readonly attendanceDate: string;
  readonly clockIn: string | null;
  readonly clockOut: string | null;
  readonly breakMinutes?: number;
  readonly status?: string;
  readonly notes?: string | null;
}

/** Fields used to update an attendance record. All optional. */
export interface UpdateAttendanceRecordInput {
  readonly clockIn?: string | null;
  readonly clockOut?: string | null;
  readonly breakMinutes?: number;
  readonly status?: string;
  readonly notes?: string | null;
}

/** Fields used to create or update a shift pattern. */
export interface CreateShiftPatternInput {
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly startTime: string;
  readonly endTime: string;
  readonly breakMinutes?: number;
  readonly workDays?: string;
  readonly isActive?: boolean;
}

/** Fields used to update a shift pattern. All optional. */
export interface UpdateShiftPatternInput {
  readonly name?: string;
  readonly description?: string | null;
  readonly startTime?: string;
  readonly endTime?: string;
  readonly breakMinutes?: number;
  readonly workDays?: string;
  readonly isActive?: boolean;
}

/** Attendance record list query. */
export interface AttendanceRecordQuery {
  readonly employeeId?: string;
  readonly status?: string;
  readonly fromDate?: string;
  readonly toDate?: string;
  readonly search?: string;
  readonly page?: PageParams;
}

/** Shift pattern list query. */
export interface ShiftPatternQuery {
  readonly search?: string;
  readonly isActive?: boolean;
  readonly page?: PageParams;
}
