/**
 * Business-rule vocabulary shared by the API and the web tier.
 */

export const BUSINESS_RULE_ACTION_TYPES = ['NOTIFY', 'START_WORKFLOW', 'EMIT_WEBHOOK'] as const;

export type BusinessRuleActionType = (typeof BUSINESS_RULE_ACTION_TYPES)[number];

export type BusinessRuleAction =
  | {
      readonly type: 'NOTIFY';
      readonly recipientUserId?: string;
      readonly recipientRole?: string;
      readonly title?: string;
      readonly description?: string;
      readonly href?: string;
    }
  | {
      readonly type: 'START_WORKFLOW';
      readonly definitionId: string;
      readonly resource?: string | null;
      readonly resourceId?: string | null;
    }
  | {
      readonly type: 'EMIT_WEBHOOK';
      readonly eventType: string;
      readonly payload?: Record<string, unknown>;
    };

export interface BusinessRuleSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly eventType: string;
  readonly condition: Record<string, unknown>;
  readonly actions: readonly BusinessRuleAction[];
  readonly priority: number;
  readonly isEnabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}
