import type { EffectivePermission, PermissionKey } from '@hris/shared-types';

/**
 * The administration console: ten sections, one place to configure the platform.
 *
 * The shape follows the master specification's "Setup Administration Navigation": ten
 * named domains, each listing the surfaces that belong to it. The console is a curated
 * view over the same built routes the sidebar exposes, so it cannot drift from what
 * actually exists: a section links a route, and a `planned` item carries no `href` by
 * design (see `navigation.ts`). Items are gated on the effective permission the
 * surface's API enforces; UI gating is cosmetic and the API remains the boundary.
 *
 * The specification names a few surfaces in two domains (the Resource Registry under both
 * *Identity & Access* and *Application & Metadata*, Access Reviews under both *Identity &
 * Access* and *Audit & Security*). Those repeats are kept, because each domain is read on
 * its own; uniqueness is therefore required within a section, not across the console.
 *
 * Keeping the count fixed at ten is a product requirement, so it is asserted by a test
 * rather than left to reviewer memory.
 */
export type SectionItemStatus = 'built' | 'planned';

export interface ConsoleItem {
  readonly label: string;
  readonly description: string;
  /** Present only for a route that exists. */
  readonly href?: string;
  readonly status: SectionItemStatus;
  /** The `resource.action` the backing API checks. Absent means always available. */
  readonly permission?: PermissionKey;
}

export interface ConsoleSection {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly items: readonly ConsoleItem[];
}

export const CONSOLE_SECTIONS: readonly ConsoleSection[] = [
  {
    id: 'identity',
    label: 'Identity & Access',
    description: 'Accounts, groups, roles, permissions and the access review cycle.',
    items: [
      {
        label: 'Users',
        description: 'System users and employee accounts',
        href: '/setup/users',
        status: 'built',
        permission: 'user.view',
      },
      {
        label: 'Organizations',
        description: 'Legal entities and the organizational unit hierarchy',
        href: '/setup/organization',
        status: 'built',
        permission: 'organization.view',
      },
      {
        label: 'User Groups',
        description: 'Group users for bulk access assignment',
        href: '/setup/user-groups',
        status: 'built',
        permission: 'registry.view',
      },
      {
        label: 'Roles',
        description: 'Role definitions and access profiles',
        href: '/setup/roles',
        status: 'built',
        permission: 'role.view',
      },
      {
        label: 'Permission Manager',
        description: 'Resource × action × scope grants',
        href: '/setup/permissions',
        status: 'built',
        permission: 'permission.view',
      },
      {
        label: 'Resource Registry',
        description: 'Applications, modules and registered resources',
        href: '/setup/registry',
        status: 'built',
        permission: 'registry.view',
      },
      {
        label: 'Access Policies',
        description: 'Least-privilege and conditional access policy',
        href: '/setup/access-policies',
        status: 'built',
        permission: 'registry.view',
      },
      {
        label: 'Service Accounts',
        description: 'Non-human identities for automation',
        href: '/setup/service-accounts',
        status: 'built',
        permission: 'registry.view',
      },
      {
        label: 'Sessions',
        description: 'Active sessions and login devices',
        href: '/setup/account/sessions',
        status: 'built',
      },
      {
        label: 'Sign In Policy',
        description: 'Password, passkey and enterprise sign-in policy',
        href: '/setup/sign-in-policy',
        status: 'built',
        permission: 'user.view',
      },
      {
        label: 'MFA & SSO',
        description: 'Multi-factor authentication and enterprise single sign-on',
        href: '/setup/security/sso',
        status: 'built',
        permission: 'identity-provider.view',
      },
      {
        label: 'Access Reviews',
        description: 'Periodic certification of existing access',
        href: '/setup/access-reviews',
        status: 'built',
        permission: 'registry.view',
      },
    ],
  },
  {
    id: 'api',
    label: 'API & Developers',
    description: 'Machine credentials, OAuth applications, webhooks and API documentation.',
    items: [
      {
        label: 'API Clients',
        description: 'Programmatic clients with scoped credentials',
        href: '/setup/api/clients',
        status: 'built',
        permission: 'api-client.view',
      },
      {
        label: 'API Credentials',
        description: 'Keys and secrets issued to API clients',
        href: '/setup/api/credentials',
        status: 'built',
        permission: 'api-client.view',
      },
      {
        label: 'OAuth Applications',
        description: 'OAuth clients, redirect URIs and consent',
        status: 'planned',
      },
      {
        label: 'API Scopes',
        description: 'Grantable scopes for machine access',
        href: '/setup/api/scopes',
        status: 'built',
        permission: 'registry.view',
      },
      {
        label: 'API Usage',
        description: 'Request volume and error rates by client',
        href: '/setup/api/usage',
        status: 'built',
        permission: 'api-client.view',
      },
      {
        label: 'Webhooks',
        description: 'Outbound event subscriptions and delivery',
        href: '/setup/api/webhooks',
        status: 'built',
        permission: 'integration.view',
      },
      {
        label: 'API Documentation',
        description: 'The published OpenAPI reference',
        href: '/setup/api/docs',
        status: 'built',
        permission: 'api-client.view',
      },
    ],
  },
  {
    id: 'ai',
    label: 'AI Services',
    description: 'Providers, models, prompts and the agents built on them.',
    items: [
      {
        label: 'Providers',
        description: 'Configured AI model providers',
        href: '/ai/providers',
        status: 'built',
        permission: 'ai.view',
      },
      {
        label: 'Models',
        description: 'Available models and their capabilities',
        href: '/ai/models',
        status: 'built',
        permission: 'ai.view',
      },
      {
        label: 'Prompts',
        description: 'Versioned prompt templates',
        href: '/ai/prompts',
        status: 'built',
        permission: 'ai.view',
      },
      {
        label: 'Agents',
        description: 'Autonomous assistants and their tools',
        href: '/ai/agents',
        status: 'built',
        permission: 'ai.view',
      },
      {
        label: 'Tools',
        description: 'Callable functions an agent may use',
        href: '/ai/tools',
        status: 'built',
        permission: 'ai.view',
      },
      {
        label: 'Knowledge Sources',
        description: 'Documents and data grounding AI answers',
        href: '/ai/assistant',
        status: 'built',
        permission: 'ai.view',
      },
      {
        label: 'Usage & Cost',
        description: 'Token consumption and spend',
        href: '/ai/usage',
        status: 'built',
        permission: 'ai.view',
      },
      {
        label: 'AI Logs',
        description: 'Model requests and responses for audit',
        href: '/ai/logs',
        status: 'built',
        permission: 'ai.view',
      },
    ],
  },
  {
    id: 'workflow',
    label: 'Workflow & Automation',
    description: 'Workflow definitions, business rules and automation history.',
    items: [
      {
        label: 'Workflow Definitions',
        description: 'Versioned approval and routing definitions',
        href: '/setup/workflows',
        status: 'built',
        permission: 'workflow.view',
      },
      {
        label: 'Business Rules',
        description: 'Conditional logic evaluated at runtime',
        href: '/setup/business-rules',
        status: 'built',
        permission: 'workflow.view',
      },
      {
        label: 'Event Registry',
        description: 'Domain events a rule or workflow may react to',
        href: '/setup/events',
        status: 'built',
        permission: 'workflow.view',
      },
      {
        label: 'Scheduled Actions',
        description: 'Recurring and time-based automation',
        href: '/setup/scheduled-actions',
        status: 'built',
        permission: 'workflow.view',
      },
      {
        label: 'Execution History',
        description: 'Past workflow runs and their outcomes',
        href: '/setup/workflows/instances',
        status: 'built',
        permission: 'workflow.view',
      },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations & Communication',
    description: 'External connections, messaging channels and notification delivery.',
    items: [
      {
        label: 'Integrations',
        description: 'External integration health and delivery log',
        href: '/setup/integrations',
        status: 'built',
        permission: 'integration.view',
      },
      {
        label: 'Connections',
        description: 'Reusable outbound connections',
        href: '/setup/connections',
        status: 'built',
        permission: 'integration.view',
      },
      {
        label: 'Email',
        description: 'Outbound email transport and sender identity',
        href: '/setup/email',
        status: 'built',
        permission: 'setting.view',
      },
      {
        label: 'Messaging Channels',
        description: 'SMS, chat and push delivery channels',
        href: '/setup/messaging-channels',
        status: 'built',
        permission: 'setting.view',
      },
      {
        label: 'Notification Templates',
        description: 'Email and in-app message templates',
        href: '/setup/notification-templates',
        status: 'built',
        permission: 'notification.view',
      },
      {
        label: 'Notification Preferences',
        description: 'Channel preferences and quiet hours',
        href: '/setup/notification-preferences',
        status: 'built',
      },
      {
        label: 'Delivery Logs',
        description: 'Per-message delivery outcomes',
        href: '/setup/delivery-logs',
        status: 'built',
        permission: 'integration.view',
      },
      {
        label: 'Integration Monitor',
        description: 'External integration health and errors',
        href: '/setup/integration-monitor',
        status: 'built',
        permission: 'integration.view',
      },
    ],
  },
  {
    id: 'metadata',
    label: 'Application & Metadata',
    description: 'Register applications, modules, resources, fields and extensions.',
    items: [
      {
        label: 'Application Registry',
        description: 'Deployed applications on the platform',
        href: '/setup/applications',
        status: 'built',
        permission: 'registry.view',
      },
      {
        label: 'Module Registry',
        description: 'Modules owned by each application',
        href: '/setup/modules',
        status: 'built',
        permission: 'registry.view',
      },
      {
        label: 'Resource Registry',
        description: 'Applications, modules and registered resources',
        href: '/setup/registry',
        status: 'built',
        permission: 'registry.view',
      },
      {
        label: 'Custom Fields',
        description: 'Tenant-defined fields on registered resources',
        href: '/setup/custom-fields',
        status: 'built',
        permission: 'registry.view',
      },
      {
        label: 'Configuration Schemas',
        description: 'Validated configuration shapes per resource',
        href: '/setup/configuration-schemas',
        status: 'built',
        permission: 'registry.view',
      },
      {
        label: 'Feature Flags',
        description: 'Feature rollout and configuration',
        href: '/platform/feature-flags',
        status: 'built',
        permission: 'registry.view',
      },
      {
        label: 'Extension Registry',
        description: 'Third-party and customer extensions',
        href: '/setup/extensions',
        status: 'built',
        permission: 'registry.view',
      },
    ],
  },
  {
    id: 'system',
    label: 'System Configuration',
    description: 'Platform parameters, localization, storage and data policy.',
    items: [
      {
        label: 'System Parameters',
        description: 'System-wide settings and configuration',
        href: '/setup/settings',
        status: 'built',
        permission: 'setting.view',
      },
      {
        label: 'Localization',
        description: 'Languages, locales and formatting',
        href: '/setup/localization',
        status: 'built',
        permission: 'setting.view',
      },
      {
        label: 'File Storage',
        description: 'Object storage backends and retention',
        href: '/setup/files',
        status: 'built',
        permission: 'document.view',
      },
      {
        label: 'Data Policies',
        description: 'Classification and handling rules',
        href: '/setup/data-policies',
        status: 'built',
        permission: 'registry.view',
      },
      {
        label: 'System Defaults',
        description: 'Company and platform default values',
        href: '/setup/system-defaults',
        status: 'built',
        permission: 'setting.view',
      },
    ],
  },
  {
    id: 'audit',
    label: 'Audit & Security',
    description: 'Audit trail, security events and data retention.',
    items: [
      {
        label: 'Audit Log',
        description: 'System-wide audit trail',
        href: '/setup/logs/audit',
        status: 'built',
        permission: 'audit-log.view',
      },
      {
        label: 'Security Events',
        description: 'Security events and access audit trail',
        href: '/setup/security-audit',
        status: 'built',
        permission: 'audit-log.view',
      },
      {
        label: 'Login History',
        description: 'Authentication and login activity',
        href: '/setup/login-history',
        status: 'built',
        permission: 'user.view',
      },
      {
        label: 'API Access Log',
        description: 'Requests made by machine clients',
        href: '/setup/api/access-log',
        status: 'built',
        permission: 'api-client.view',
      },
      {
        label: 'Access Reviews',
        description: 'Periodic certification of existing access',
        href: '/setup/access-reviews',
        status: 'built',
        permission: 'registry.view',
      },
      {
        label: 'Data Retention',
        description: 'Retention and purge schedules',
        href: '/setup/data-retention',
        status: 'built',
        permission: 'document.view',
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operations & Observability',
    description: 'Queues, scheduled jobs, logs and platform health.',
    items: [
      {
        label: 'Queue Monitor',
        description: 'Background queue health and failed jobs',
        href: '/setup/operations/queues',
        status: 'built',
        permission: 'queue.view',
      },
      {
        label: 'Scheduled Jobs',
        description: 'Recurring job schedule',
        href: '/setup/scheduled-actions',
        status: 'built',
        permission: 'workflow.view',
      },
      {
        label: 'Failed Jobs',
        description: 'Dead-lettered jobs and retries',
        href: '/setup/operations/failed-jobs',
        status: 'built',
        permission: 'queue.view',
      },
      {
        label: 'System Logs',
        description: 'Application and integration logs',
        href: '/setup/logs',
        status: 'built',
        permission: 'audit-log.view',
      },
      {
        label: 'Health Monitor',
        description: 'Live dependency probes',
        href: '/status',
        status: 'built',
      },
      {
        label: 'Performance Metrics',
        description: 'Latency, throughput and saturation',
        href: '/setup/operations/metrics',
        status: 'built',
        permission: 'queue.view',
      },
      {
        label: 'Backup & Restore',
        description: 'Backup schedules and restore points',
        href: '/setup/backup-restore',
        status: 'built',
        permission: 'setting.update',
      },
    ],
  },
  {
    id: 'tenants',
    label: 'Tenant Management',
    description: 'Tenants, entitlements, quotas and cross-tenant activity.',
    items: [
      {
        label: 'Tenants',
        description: 'Customer tenants on the platform',
        href: '/platform/tenants',
        status: 'built',
        permission: 'registry.view',
      },
      {
        label: 'Tenant Settings',
        description: 'Per-tenant configuration',
        href: '/setup/tenant-settings',
        status: 'built',
        permission: 'setting.view',
      },
      {
        label: 'Modules & Entitlements',
        description: 'Which modules each tenant may use',
        href: '/setup/modules-entitlements',
        status: 'built',
        permission: 'registry.view',
      },
      {
        label: 'Usage & Quotas',
        description: 'Consumption limits per tenant',
        href: '/setup/usage-quotas',
        status: 'built',
        permission: 'registry.view',
      },
      {
        label: 'Tenant Activity',
        description: 'Cross-tenant operational activity',
        href: '/setup/tenant-activity',
        status: 'built',
        permission: 'audit-log.view',
      },
    ],
  },
];

/**
 * Whether the caller holds a fully-qualified `resource.action`.
 *
 * Takes a `string` rather than the `PermissionKey` union because the registry can name a
 * resource at runtime; the static union only covers the bootstrap vocabulary.
 */
export function holdsPermission(permissions: readonly EffectivePermission[], key: string): boolean {
  const separator = key.lastIndexOf('.');
  const resource = key.slice(0, separator);
  const action = key.slice(separator + 1);
  return permissions.some(
    (permission) => permission.resource === resource && permission.action === action,
  );
}

export const isItemVisible = (
  item: ConsoleItem,
  permissions: readonly EffectivePermission[],
): boolean => item.permission === undefined || holdsPermission(permissions, item.permission);

/**
 * The id of the curated section that absorbs registry-derived items.
 *
 * Registered applications/modules/resources are metadata about the platform, so a
 * newly registered resource belongs beside the Resource Registry rather than in a
 * section of its own — and the console's ten-section shape stays fixed.
 */
export const REGISTRY_SECTION_ID = 'metadata';

/**
 * The console as the caller may see it: every section is present, but an item whose
 * permission the caller lacks is removed, and a section left empty reports `isEmpty`.
 *
 * `extraItems` are appended to {@link REGISTRY_SECTION_ID} before filtering. They carry
 * the same `resource.action` gate as a curated item, so a resource registered at runtime
 * is shown only to a caller who can actually open it. Passing them here (rather than in
 * {@link CONSOLE_SECTIONS}) keeps the curated map static while the metadata section grows
 * with the registry.
 */
export function consoleFor(
  permissions: readonly EffectivePermission[],
  extraItems: readonly ConsoleItem[] = [],
): readonly (ConsoleSection & {
  readonly items: readonly ConsoleItem[];
  readonly isEmpty: boolean;
})[] {
  return CONSOLE_SECTIONS.map((section) => {
    const items =
      section.id === REGISTRY_SECTION_ID
        ? [...section.items, ...dedupe(extraItems, section.items)]
        : section.items;
    const visible = items.filter((item) => isItemVisible(item, permissions));
    return { ...section, items: visible, isEmpty: visible.length === 0 };
  });
}

/** De-duplicates an extra item that repeats a curated label or href. */
function dedupe(extra: readonly ConsoleItem[], curated: readonly ConsoleItem[]): ConsoleItem[] {
  const labels = new Set(curated.map((item) => item.label));
  const hrefs = new Set(curated.map((item) => item.href));
  return extra.filter(
    (item) => !labels.has(item.label) && (item.href === undefined || !hrefs.has(item.href)),
  );
}
