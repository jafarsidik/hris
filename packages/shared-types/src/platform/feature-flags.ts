export interface FeatureFlagSummary {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly scope: 'global' | 'tenant';
  readonly enabled: boolean;
  readonly rollout: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}
export interface TenantFeatureFlagDecision {
  readonly key: string;
  readonly enabled: boolean;
}
