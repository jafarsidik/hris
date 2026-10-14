/** Who an approval authority rule applies to. */
export const APPROVAL_SUBJECT_TYPES = ['USER', 'ROLE'] as const;

export type ApprovalSubjectType = (typeof APPROVAL_SUBJECT_TYPES)[number];

/**
 * An approval authority rule: who may approve what, up to an optional monetary limit.
 *
 * Configurable in the System menu today; the M07 workflow engine consumes these rules
 * when routing approvals.
 */
export interface ApprovalAuthoritySummary {
  readonly id: string;
  readonly subjectType: ApprovalSubjectType;
  readonly subjectId: string;
  readonly resource: string | null;
  readonly category: string | null;
  readonly maxAmount: string | null;
  readonly currencyCode: string | null;
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly createdAt: string;
}

/** A temporary delegation of approval authority from one user to another. */
export interface ApprovalDelegationSummary {
  readonly id: string;
  readonly delegatorUserId: string;
  readonly delegateeUserId: string;
  readonly resource: string | null;
  readonly category: string | null;
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly reason: string | null;
  readonly createdAt: string;
}
