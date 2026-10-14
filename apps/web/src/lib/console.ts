import type { EffectivePermission, PermissionKey } from '@hris/shared-types';

/**
 * The administration console: ten sections, one place to configure the platform.
 *
 * The console is a curated view over the same built routes the sidebar exposes, so it
 * cannot drift from what actually exists: a section links a route, and a `planned` item
 * carries no `href` by design (see `navigation.ts`). Items are gated on the effective
 * permission the surface's API enforces; UI gating is cosmetic and the API remains the
 * boundary.
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
    description: 'Accounts, roles, permissions and approval authority.',
    items: [
      {
        label: 'Users',
        description: 'System users and employee accounts',
        href: '/setup/users',
        status: 'built',
        permission: 'user.view',
      },
      {
        label: 'Roles',
        description: 'Role definitions and access profiles',
        href: '/setup/roles',
        status: 'built',
        permission: 'role.view',
      },
      {
        label: 'Permissions',
        description: 'Fine-grained permissions and data access',
        href: '/setup/permissions',
        status: 'built',
        permission: 'permission.view',
      },
      {
        label: 'Approval Authority',
        description: 'Approval limits and delegation authority',
        href: '/setup/approval-authority',
        status: 'built',
        permission: 'approval-authority.view',
      },
    ],
  },
  {
    id: 'metadata',
    label: 'Applications & Metadata',
    description: 'Register applications, modules, resources, fields and actions.',
    items: [
      {
        label: 'Resource Registry',
        description: 'Applications, modules and registered resources',
        href: '/setup/registry',
        status: 'built',
        permission: 'registry.view',
      },
    ],
  },
  {
    id: 'security',
    label: 'Sign-in & Security',
    description: 'Authentication policy, SSO, multi-factor and security activity.',
    items: [
      {
        label: 'Sign In Policy',
        description: 'Password, passkey and enterprise sign-in policy',
        href: '/setup/sign-in-policy',
        status: 'built',
        permission: 'user.view',
      },
      {
        label: 'SSO',
        description: 'Enterprise SSO and identity provider integration',
        href: '/setup/security/sso',
        status: 'built',
        permission: 'identity-provider.view',
      },
      {
        label: 'Login History',
        description: 'Authentication and login activity',
        href: '/setup/login-history',
        status: 'built',
        permission: 'user.view',
      },
      {
        label: 'Security Audit',
        description: 'Security events and access audit trail',
        href: '/setup/security-audit',
        status: 'built',
        permission: 'audit-log.view',
      },
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'In-app notifications, templates and delivery preferences.',
    items: [
      {
        label: 'Notifications',
        description: 'In-app notifications and delivery status',
        href: '/notifications',
        status: 'built',
        permission: 'notification.view',
      },
      {
        label: 'Notification Templates',
        description: 'Email and in-app message templates',
        status: 'planned',
      },
      {
        label: 'Notification Preferences',
        description: 'Channel preferences and quiet hours',
        status: 'planned',
      },
    ],
  },
  {
    id: 'configuration',
    label: 'Configuration',
    description: 'System parameters and platform-wide settings.',
    items: [
      {
        label: 'System Parameters',
        description: 'System-wide settings and configuration',
        href: '/setup/settings',
        status: 'built',
        permission: 'setting.view',
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    description: 'Background jobs and external integrations.',
    items: [
      {
        label: 'Queue Monitor',
        description: 'Background queue health and failed jobs',
        href: '/setup/operations/queues',
        status: 'built',
        permission: 'queue.view',
      },
      {
        label: 'Integrations',
        description: 'External integration health and delivery log',
        status: 'planned',
        permission: 'integration.view',
      },
    ],
  },
  {
    id: 'observability',
    label: 'Observability & Audit',
    description: 'Audit trail and application logs.',
    items: [
      {
        label: 'Audit Log',
        description: 'System-wide audit trail',
        href: '/setup/logs/audit',
        status: 'built',
        permission: 'audit-log.view',
      },
      {
        label: 'System Logs',
        description: 'Application and integration logs',
        href: '/setup/logs',
        status: 'built',
        permission: 'audit-log.view',
      },
      {
        label: 'System Activity',
        description: 'Platform activity and operational events',
        status: 'planned',
      },
    ],
  },
  {
    id: 'account',
    label: 'My Account',
    description: 'Your personal profile and security.',
    items: [
      {
        label: 'My Account',
        description: 'Personal account and security settings',
        href: '/setup/account',
        status: 'built',
      },
      {
        label: 'Sessions',
        description: 'Active sessions and login devices',
        href: '/setup/account/sessions',
        status: 'built',
      },
    ],
  },
  {
    id: 'people',
    label: 'People',
    description: 'The employee directory and workforce records.',
    items: [
      {
        label: 'Employees',
        description: 'Employee master directory',
        href: '/employees',
        status: 'built',
        permission: 'employee.view',
      },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    description: 'Platform overview and live dependency status.',
    items: [
      {
        label: 'Overview',
        description: 'What the platform foundation delivers',
        href: '/',
        status: 'built',
      },
      {
        label: 'Health',
        description: 'Live dependency probes',
        href: '/status',
        status: 'built',
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
