/**
 * Organizational hierarchy vocabulary.
 *
 * A tenant models its structure as legal entities (the employing company, a branch, a
 * subsidiary) and, under them, a tree of organizational units. Entities carry the
 * statutory attributes (country, reporting currency); units carry the operational shape
 * (division, department, section, team). Every user is placed on one unit, and the
 * record-level `entity`/`team`/`department` data scopes resolve through this tree.
 */

/** The kind of organizational unit, from the broadest to the most granular. */
export const ORGANIZATIONAL_UNIT_TYPES = ['DIVISION', 'DEPARTMENT', 'SECTION', 'TEAM'] as const;

export type OrganizationalUnitType = (typeof ORGANIZATIONAL_UNIT_TYPES)[number];

/** A legal entity within the tenant. */
export interface OrganizationEntitySummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly countryCode: string;
  readonly currencyCode: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * One node of the organizational tree.
 *
 * `parentId` is null at the root of an entity's tree; `entityId` may be null while a tree
 * is being built and is inherited up the lineage by the `entity` data scope.
 */
export interface OrganizationalUnitSummary {
  readonly id: string;
  readonly entityId: string | null;
  readonly parentId: string | null;
  readonly type: OrganizationalUnitType;
  readonly code: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
