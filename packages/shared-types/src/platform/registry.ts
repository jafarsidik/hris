/**
 * Platform metadata registry contracts.
 *
 * The registry is the platform's own catalogue of what it exposes: applications,
 * their modules, the resources those modules own, the fields and actions a resource
 * carries. It is data rather than code, so a module or resource can be registered
 * without changing a business module.
 *
 * Phase 1 registers the existing HRIS vocabulary (`MODULE_IDS`, `RESOURCES`,
 * `ACTIONS`). Later phases make the registry the source the authorization layer
 * generates permissions from; until then the RBAC vocabulary remains authoritative.
 */

/** The kind of thing a registered resource represents. Mirrors the `ResourceType` enum. */
export const RESOURCE_TYPES = [
  'ENTITY',
  'REFERENCE',
  'CONFIGURATION',
  'DOCUMENT',
  'TRANSACTION',
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

/** The data type of a registered resource field. Mirrors the `FieldDataType` enum. */
export const FIELD_DATA_TYPES = [
  'STRING',
  'NUMBER',
  'BOOLEAN',
  'DATE',
  'DATETIME',
  'JSON',
  'ENUM',
  'REFERENCE',
] as const;

export type FieldDataType = (typeof FIELD_DATA_TYPES)[number];

/** A deployed application on the platform. */
export interface ApplicationSummary {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
}

/** A module of an application. */
export interface ModuleSummary {
  readonly id: string;
  readonly applicationId: string;
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly moduleId: string | null;
  readonly isActive: boolean;
  readonly sortOrder: number;
}

/** A field a registered resource exposes. */
export interface ResourceFieldSummary {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly dataType: FieldDataType;
  readonly required: boolean;
  readonly isSensitive: boolean;
  readonly sortOrder: number;
}

/** An action a registered resource supports. */
export interface RegisteredActionSummary {
  readonly id: string;
  readonly action: string;
  readonly name: string;
  readonly description: string | null;
  readonly isCustom: boolean;
}

/** A resource a module owns, with its fields and actions. */
export interface ResourceSummary {
  readonly id: string;
  readonly applicationId: string;
  readonly moduleId: string | null;
  readonly moduleKey: string | null;
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly resourceType: ResourceType;
  readonly supportsCrud: boolean;
  readonly isActive: boolean;
  readonly fields: readonly ResourceFieldSummary[];
  readonly actions: readonly RegisteredActionSummary[];
}

/* ------------------------------------------------------------------ write inputs */

/** Registers a new application. `key` is a stable, URL-safe identifier. */
export interface CreateApplicationInput {
  readonly key: string;
  readonly name: string;
  readonly description?: string;
}

export interface UpdateApplicationInput {
  readonly name?: string;
  readonly description?: string;
  readonly isActive?: boolean;
}

/** Registers a module under an application. */
export interface CreateModuleInput {
  readonly applicationKey: string;
  readonly key: string;
  readonly name: string;
  readonly description?: string;
  readonly sortOrder?: number;
}

export interface UpdateModuleInput {
  readonly name?: string;
  readonly description?: string;
  readonly isActive?: boolean;
  readonly sortOrder?: number;
}

/**
 * Registers a resource under an application and, optionally, a module.
 *
 * A registered resource becomes visible in the registry and in the permission
 * matrix immediately; making it authoritative for permissions is Phase 3.
 */
export interface CreateResourceInput {
  readonly applicationKey: string;
  readonly moduleKey?: string;
  readonly key: string;
  readonly name: string;
  readonly description?: string;
  readonly resourceType: ResourceType;
  readonly supportsCrud?: boolean;
}

export interface UpdateResourceInput {
  readonly name?: string;
  readonly description?: string;
  readonly resourceType?: ResourceType;
  readonly supportsCrud?: boolean;
  readonly isActive?: boolean;
}

/** Describes one field a registered resource exposes. */
export interface CreateResourceFieldInput {
  readonly key: string;
  readonly label: string;
  readonly dataType: FieldDataType;
  readonly required?: boolean;
  readonly isSensitive?: boolean;
  readonly sortOrder?: number;
}

/**
 * Edits a field in place. The key and data type are deliberately immutable: stored
 * extension values key on the field key, and a silent type change would reinterpret
 * them. A field whose shape must change is removed and re-added.
 */
export interface UpdateResourceFieldInput {
  readonly label?: string;
  readonly required?: boolean;
  readonly isSensitive?: boolean;
  readonly sortOrder?: number;
}

/** Registers an action a resource supports. A resource may have many. */
export interface CreateRegisteredActionInput {
  readonly action: string;
  readonly name: string;
  readonly description?: string;
  readonly isCustom?: boolean;
}
