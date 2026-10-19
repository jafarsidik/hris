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

export interface AccessReviewSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly scope: string;
  readonly reviewerId: string;
  readonly status: string;
  readonly dueAt: string | null;
  readonly completedAt: string | null;
  readonly itemCount: number;
  readonly decidedCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AccessReviewItemSummary {
  readonly id: string;
  readonly reviewId: string;
  readonly userId: string;
  readonly userEmail: string;
  readonly userDisplayName: string;
  readonly resource: string;
  readonly resourceId: string | null;
  readonly permissions: readonly string[];
  readonly decision: string;
  readonly decidedAt: string | null;
  readonly notes: string | null;
}

export interface ServiceAccountSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly key: string;
  readonly isActive: boolean;
  readonly expiresAt: string | null;
  readonly lastUsedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
