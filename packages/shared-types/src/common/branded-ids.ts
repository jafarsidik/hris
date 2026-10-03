/**
 * Branded identifier types.
 *
 * Every aggregate in the HRIS has its own identifier type. Branding prevents a
 * class of defect that is particularly dangerous in a multi-entity system:
 * passing an `EntityId` where an `EmployeeId` is expected. This directly
 * supports the rule that entity and employee identifiers supplied by a client
 * are never trusted (MASTER_PRD section 19).
 */

declare const brandSymbol: unique symbol;

export type Brand<TValue, TBrand extends string> = TValue & {
  readonly [brandSymbol]: TBrand;
};

export type UserId = Brand<string, 'UserId'>;
export type EmployeeId = Brand<string, 'EmployeeId'>;
export type CompanyId = Brand<string, 'CompanyId'>;
export type EntityId = Brand<string, 'EntityId'>;
export type OrganizationalUnitId = Brand<string, 'OrganizationalUnitId'>;
export type PositionId = Brand<string, 'PositionId'>;
export type JobGradeId = Brand<string, 'JobGradeId'>;
export type PayrollPeriodId = Brand<string, 'PayrollPeriodId'>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates the canonical UUID representation used by the PostgreSQL schema.
 *
 * @returns `true` when `value` is a syntactically valid UUID.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/**
 * Converts an untrusted string into a typed identifier.
 *
 * Throws rather than returning `undefined` so that a malformed identifier can
 * never silently propagate into a query or an authorization check.
 */
export function toIdentifier<TIdentifier extends string>(
  value: unknown,
  brand: string,
): TIdentifier {
  if (!isUuid(value)) {
    throw new TypeError(`Invalid ${brand}: expected a UUID`);
  }
  return value as TIdentifier;
}

export const asUserId = (value: unknown): UserId => toIdentifier<UserId>(value, 'UserId');
export const asEmployeeId = (value: unknown): EmployeeId =>
  toIdentifier<EmployeeId>(value, 'EmployeeId');
export const asCompanyId = (value: unknown): CompanyId =>
  toIdentifier<CompanyId>(value, 'CompanyId');
export const asEntityId = (value: unknown): EntityId => toIdentifier<EntityId>(value, 'EntityId');
export const asOrganizationalUnitId = (value: unknown): OrganizationalUnitId =>
  toIdentifier<OrganizationalUnitId>(value, 'OrganizationalUnitId');
export const asPositionId = (value: unknown): PositionId =>
  toIdentifier<PositionId>(value, 'PositionId');
export const asJobGradeId = (value: unknown): JobGradeId =>
  toIdentifier<JobGradeId>(value, 'JobGradeId');
export const asPayrollPeriodId = (value: unknown): PayrollPeriodId =>
  toIdentifier<PayrollPeriodId>(value, 'PayrollPeriodId');