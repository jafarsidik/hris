/**
 * RBAC vocabulary shared by the API and all clients.
 *
 * The clients import these constants so that navigation and form affordances
 * are driven by the same vocabulary the server authorises against. Clients are
 * never the security boundary: every value here is presentation-only and must
 * be re-validated server-side.
 */

/** Actions a permission can grant on a resource (ARCHITECTURE section 9). */
export const ACTIONS = [
  'view',
  'create',
  'update',
  'delete',
  'approve',
  'reject',
  'export',
  'download',
  'manage',
] as const;

export type Action = (typeof ACTIONS)[number];

/** Hierarchical data scope a permission applies to. */
export const DATA_SCOPES = ['SELF', 'TEAM', 'DEPARTMENT', 'ENTITY', 'COMPANY', 'GLOBAL'] as const;

export type DataScope = (typeof DATA_SCOPES)[number];

/**
 * Ordering from narrowest to widest. A user holding several scopes keeps the
 * widest one for a given resource/action pair.
 */
export const DATA_SCOPE_RANK: Readonly<Record<DataScope, number>> = Object.freeze({
  SELF: 1,
  TEAM: 2,
  DEPARTMENT: 3,
  ENTITY: 4,
  COMPANY: 5,
  GLOBAL: 6,
});

/** Business resources exposed by the platform modules M00-M09. */
export const RESOURCES = [
  'user',
  'role',
  'permission',
  'organization',
  'employee',
  'attendance',
  'leave',
  'claim',
  'recruitment',
  'performance',
  'payroll',
  'statutory',
  'industrial-relation',
  'asset',
  'onboarding',
  'offboarding',
  'visitor',
  'document',
  'workflow',
  'notification',
  'audit-log',
  'analytics',
  'ai',
] as const;

export type Resource = (typeof RESOURCES)[number];

export type PermissionKey = `${Resource}.${Action}`;

export function isResource(value: unknown): value is Resource {
  return typeof value === 'string' && (RESOURCES as readonly string[]).includes(value);
}

export function isAction(value: unknown): value is Action {
  return typeof value === 'string' && (ACTIONS as readonly string[]).includes(value);
}

export function isDataScope(value: unknown): value is DataScope {
  return typeof value === 'string' && (DATA_SCOPES as readonly string[]).includes(value);
}

export function buildPermissionKey(resource: Resource, action: Action): PermissionKey {
  return `${resource}.${action}`;
}

export function parsePermissionKey(key: string): { resource: Resource; action: Action } | null {
  const separatorIndex = key.indexOf('.');
  if (separatorIndex <= 0 || separatorIndex === key.length - 1) {
    return null;
  }
  const resource = key.slice(0, separatorIndex);
  const action = key.slice(separatorIndex + 1);
  if (!isResource(resource) || !isAction(action)) {
    return null;
  }
  return { resource, action };
}

export function isPermissionKey(key: unknown): key is PermissionKey {
  return typeof key === 'string' && parsePermissionKey(key) !== null;
}

/**
 * A permission granted to a subject (user or role).
 *
 * `scopeId` narrows a permission to a single organizational subtree, e.g.
 * `DEPARTMENT` scoped to one department id.
 */
export interface PermissionGrant {
  readonly resource: Resource;
  readonly action: Action;
  readonly scope: DataScope;
  readonly scopeId?: string;
}

export interface RoleDefinition {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly isSystem: boolean;
}

/**
 * Baseline system roles. Permissions are resolved from the database; these
 * definitions exist so that roles are referenceable by a stable key and can be
 * provisioned idempotently by migrations/seeds.
 */
export const SYSTEM_ROLES: readonly RoleDefinition[] = Object.freeze([
  {
    key: 'SYSTEM_ADMIN',
    name: 'System Administrator',
    description: 'Unrestricted platform configuration and access administration.',
    isSystem: true,
  },
  {
    key: 'HR_MANAGER',
    name: 'HR Manager',
    description: 'Manages employee master data and HR processes within assigned entities.',
    isSystem: true,
  },
  {
    key: 'HR_OFFICER',
    name: 'HR Officer',
    description: 'Day-to-day employee record administration within assigned entities.',
    isSystem: true,
  },
  {
    key: 'MANAGER',
    name: 'Manager',
    description: 'Manages an assigned team: attendance, leave, claims and performance.',
    isSystem: true,
  },
  {
    key: 'EMPLOYEE',
    name: 'Employee',
    description: 'Self-service access to own records only.',
    isSystem: true,
  },
  {
    key: 'RECRUITER',
    name: 'Recruiter',
    description: 'Manages requisitions, candidates, interviews and offers.',
    isSystem: true,
  },
  {
    key: 'PAYROLL_OFFICER',
    name: 'Payroll Officer',
    description: 'Runs payroll processing, statutory calculation and payslips.',
    isSystem: true,
  },
  {
    key: 'PAYROLL_APPROVER',
    name: 'Payroll Approver',
    description: 'Approves and locks payroll runs; cannot initiate calculation changes.',
    isSystem: true,
  },
  {
    key: 'IR_ER_OFFICER',
    name: 'IR/ER Officer',
    description: 'Restricted access to grievance and disciplinary case records.',
    isSystem: true,
  },
  {
    key: 'FINANCE',
    name: 'Finance',
    description: 'Read access to payroll and claims for authorised entities.',
    isSystem: true,
  },
  {
    key: 'EXECUTIVE',
    name: 'Executive',
    description: 'Read-only access to workforce analytics dashboards.',
    isSystem: true,
  },
] as const);

export const SYSTEM_ROLE_KEYS = SYSTEM_ROLES.map((role) => role.key);
