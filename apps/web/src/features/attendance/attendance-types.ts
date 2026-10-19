import type { PageParams, Paginated } from '@hris/shared-types';

export interface AttendanceRecord {
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

export interface ShiftPattern {
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

export interface AttendanceRecordQuery {
  readonly employeeId?: string;
  readonly status?: string;
  readonly fromDate?: string;
  readonly toDate?: string;
  readonly search?: string;
  readonly page?: PageParams;
}

export type AttendanceRecordPage = Paginated<AttendanceRecord>;

export interface AttendanceRepository {
  listRecords(query: AttendanceRecordQuery): Promise<AttendanceRecordPage>;
  getRecord(id: string): Promise<AttendanceRecord | null>;
  createRecord(input: {
    readonly employeeId: string;
    readonly attendanceDate: string;
    readonly clockIn: string | null;
    readonly clockOut: string | null;
    readonly breakMinutes?: number;
    readonly status?: string;
    readonly notes?: string | null;
  }): Promise<AttendanceRecord>;
  updateRecord(
    id: string,
    input: {
      readonly clockIn?: string | null;
      readonly clockOut?: string | null;
      readonly breakMinutes?: number;
      readonly status?: string;
      readonly notes?: string | null;
    },
  ): Promise<AttendanceRecord>;
  deleteRecord(id: string): Promise<void>;
}
