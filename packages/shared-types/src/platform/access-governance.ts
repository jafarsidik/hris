export interface UserGroupSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly memberCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface UserGroupMemberSummary {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
}

export interface DataPolicySummary {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly classification: string;
  readonly targetResource: string;
  readonly maskingAction: string;
  readonly isEnabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}
