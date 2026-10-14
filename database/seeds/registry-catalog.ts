/**
 * Display catalogue for the platform metadata registry seed.
 *
 * The canonical keys come from `@hris/shared-types` (`MODULE_IDS`, `RESOURCES`,
 * `ACTIONS`); this file only supplies the human labels and classification that those
 * arrays do not carry. It follows the same pattern as `reference-data.ts`: the record
 * is keyed by the shared key, so a key added to the vocabulary without a label here is
 * a compile error rather than a silently missing row.
 */
import type { FieldDataType, ModuleId, Resource, ResourceType } from '@hris/shared-types';

/** Human label for a module identifier. */
export interface ModuleLabel {
  readonly name: string;
  readonly description: string;
}

export const MODULE_LABELS: Readonly<Record<ModuleId, ModuleLabel>> = Object.freeze({
  M00_AUTHENTICATION: {
    name: 'Authentication & Base System',
    description: 'Identity, access control, system configuration and audit',
  },
  M01_CORE_HR: {
    name: 'Core HR',
    description: 'Employee master data, organization and employment lifecycle',
  },
  M02_INDUSTRIAL_RELATIONS: {
    name: 'Industrial Relations',
    description: 'Employment relations, contracts, grievances and disciplinary matters',
  },
  M03_RECRUITMENT: {
    name: 'Recruitment',
    description: 'Workforce requests, candidates, hiring and talent acquisition',
  },
  M04_PERFORMANCE: {
    name: 'Performance',
    description: 'Goals, KPIs, appraisal, feedback and performance management',
  },
  M05_CLAIMS: {
    name: 'Claims & Benefits',
    description: 'Leave, reimbursement, employee benefits and claims',
  },
  M06_PAYROLL: {
    name: 'Payroll',
    description: 'Payroll processing, compensation, taxation and statutory reporting',
  },
  M07_ADMINISTRATION: {
    name: 'Administration',
    description: 'Company setup, organization, workflow and HR configuration',
  },
  M08_ATTENDANCE: {
    name: 'Attendance & Time',
    description: 'Attendance, shifts, rosters, overtime and working time',
  },
  M09_AI_ANALYTICS: {
    name: 'AI & Analytics',
    description: 'Workforce intelligence, HR analytics, forecasting and AI insights',
  },
  PLATFORM: {
    name: 'Platform',
    description: 'Platform health, monitoring, jobs and operational status',
  },
});

/** How a resource is classified in the registry. */
export interface ResourceSpec {
  readonly module: ModuleId;
  readonly type: ResourceType;
  /** Whether the resource exposes generic CRUD surfaces. */
  readonly crud?: boolean;
  /** Overrides the name derived from the key, for labels that do not title-case. */
  readonly name?: string;
}

/** Every RBAC resource, classified by owning module and resource type. */
export const RESOURCE_CATALOG: Readonly<Record<Resource, ResourceSpec>> = Object.freeze({
  setting: { module: 'M00_AUTHENTICATION', type: 'CONFIGURATION', crud: true },
  user: { module: 'M00_AUTHENTICATION', type: 'ENTITY', crud: true },
  role: { module: 'M00_AUTHENTICATION', type: 'REFERENCE', crud: true },
  permission: { module: 'M00_AUTHENTICATION', type: 'REFERENCE', crud: true },
  organization: { module: 'M01_CORE_HR', type: 'ENTITY' },
  employee: { module: 'M01_CORE_HR', type: 'ENTITY' },
  attendance: { module: 'M08_ATTENDANCE', type: 'TRANSACTION' },
  leave: { module: 'M05_CLAIMS', type: 'TRANSACTION' },
  claim: { module: 'M05_CLAIMS', type: 'TRANSACTION' },
  recruitment: { module: 'M03_RECRUITMENT', type: 'TRANSACTION' },
  performance: { module: 'M04_PERFORMANCE', type: 'TRANSACTION' },
  payroll: { module: 'M06_PAYROLL', type: 'TRANSACTION' },
  statutory: { module: 'M06_PAYROLL', type: 'REFERENCE' },
  'industrial-relation': { module: 'M02_INDUSTRIAL_RELATIONS', type: 'TRANSACTION' },
  asset: { module: 'M01_CORE_HR', type: 'ENTITY' },
  onboarding: { module: 'M01_CORE_HR', type: 'TRANSACTION' },
  offboarding: { module: 'M01_CORE_HR', type: 'TRANSACTION' },
  visitor: { module: 'M07_ADMINISTRATION', type: 'TRANSACTION' },
  document: { module: 'M07_ADMINISTRATION', type: 'DOCUMENT' },
  workflow: { module: 'M07_ADMINISTRATION', type: 'CONFIGURATION' },
  notification: { module: 'M00_AUTHENTICATION', type: 'TRANSACTION', crud: true },
  'audit-log': { module: 'M00_AUTHENTICATION', type: 'REFERENCE' },
  analytics: { module: 'M09_AI_ANALYTICS', type: 'REFERENCE' },
  ai: { module: 'M09_AI_ANALYTICS', type: 'CONFIGURATION', name: 'AI' },
  queue: { module: 'M00_AUTHENTICATION', type: 'CONFIGURATION' },
  'identity-provider': { module: 'M00_AUTHENTICATION', type: 'CONFIGURATION', crud: true },
  'approval-authority': { module: 'M00_AUTHENTICATION', type: 'CONFIGURATION', crud: true },
  registry: { module: 'M00_AUTHENTICATION', type: 'CONFIGURATION', crud: true },
  'api-client': { module: 'M00_AUTHENTICATION', type: 'CONFIGURATION' },
  integration: { module: 'M07_ADMINISTRATION', type: 'CONFIGURATION' },
});

/** A field to register for a resource. */
export interface FieldSpec {
  readonly key: string;
  readonly label: string;
  readonly dataType: FieldDataType;
  readonly required?: boolean;
  readonly isSensitive?: boolean;
}

/**
 * Fields registered for a subset of resources.
 *
 * Only the resources that already have a real shape are described here. A resource
 * absent from this map is registered with no fields, which is honest: the registry
 * should not invent a schema for a module that does not exist yet.
 */
export const RESOURCE_FIELDS: Readonly<Partial<Record<Resource, readonly FieldSpec[]>>> =
  Object.freeze({
    user: [
      { key: 'email', label: 'Email', dataType: 'STRING', required: true },
      { key: 'displayName', label: 'Display name', dataType: 'STRING', required: true },
      { key: 'status', label: 'Status', dataType: 'ENUM', required: true },
      { key: 'passwordHash', label: 'Password hash', dataType: 'STRING', isSensitive: true },
      { key: 'lastLoginAt', label: 'Last login', dataType: 'DATETIME' },
    ],
    role: [
      { key: 'key', label: 'Key', dataType: 'STRING', required: true },
      { key: 'name', label: 'Name', dataType: 'STRING', required: true },
      { key: 'description', label: 'Description', dataType: 'STRING' },
      { key: 'isSystem', label: 'System role', dataType: 'BOOLEAN' },
    ],
    permission: [
      { key: 'key', label: 'Key', dataType: 'STRING', required: true },
      { key: 'resource', label: 'Resource', dataType: 'STRING', required: true },
      { key: 'action', label: 'Action', dataType: 'ENUM', required: true },
    ],
    setting: [
      { key: 'group', label: 'Group', dataType: 'STRING', required: true },
      { key: 'key', label: 'Key', dataType: 'STRING', required: true },
      { key: 'value', label: 'Value', dataType: 'JSON' },
      { key: 'valueType', label: 'Value type', dataType: 'ENUM', required: true },
      { key: 'isSensitive', label: 'Sensitive', dataType: 'BOOLEAN' },
    ],
  });
