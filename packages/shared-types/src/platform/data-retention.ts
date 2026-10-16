export interface DataRetentionScheduleSummary {
  readonly id: string;
  readonly resource: string;
  readonly retentionDays: number;
  readonly purgeAfterDays: number;
  readonly isEnabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DataRetentionScheduleInput {
  readonly resource: string;
  readonly retentionDays: number;
  readonly purgeAfterDays?: number;
  readonly isEnabled?: boolean;
}
