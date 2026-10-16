export const TENANT_STATUSES = ['ACTIVE', 'TRIAL', 'SUSPENDED', 'ARCHIVED'] as const;

export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const TENANT_PLANS = ['STANDARD', 'PROFESSIONAL', 'ENTERPRISE', 'TRIAL'] as const;

export type TenantPlan = (typeof TENANT_PLANS)[number];

export interface TenantSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly status: TenantStatus;
  readonly plan: TenantPlan;
  readonly seatLimit: number | null;
  readonly storageQuotaBytes: number | null;
  readonly storageUsedBytes: number;
  readonly userCount: number;
  readonly trialEndsAt: string | null;
  readonly suspendedAt: string | null;
  readonly createdAt: string;
}

export interface TenantUpdateInput {
  readonly status?: TenantStatus;
  readonly plan?: TenantPlan;
  readonly seatLimit?: number | null;
  readonly storageQuotaBytes?: number | null;
  readonly trialEndsAt?: string | null;
  readonly suspend?: boolean;
}
