/**
 * System settings vocabulary shared by the API and the Administration surface.
 *
 * Settings are company-scoped key/value rows stored as JSON; these constants name
 * the groups and value types so the API validates and the UI renders from the same
 * contract. Clients remain presentation-only: what is editable is re-validated by
 * the server against each setting's row.
 */

/** The groups rendered as tabs in the System Settings surface (brief section 35). */
export const SETTING_GROUPS = [
  'general',
  'authentication',
  'security',
  'email',
  'notification',
  'localization',
  'files',
  'logging',
  'backup',
  'sessions',
  'api',
] as const;

export type SettingGroup = (typeof SETTING_GROUPS)[number];

export const isSettingGroup = (value: unknown): value is SettingGroup =>
  typeof value === 'string' && (SETTING_GROUPS as readonly string[]).includes(value);

/** How a stored value is typed, validated and rendered. Mirrors `SettingValueType`. */
export const SETTING_VALUE_TYPES = ['STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'STRING_LIST'] as const;

export type SettingValueType = (typeof SETTING_VALUE_TYPES)[number];

export interface SystemSetting {
  readonly id: string;
  readonly group: SettingGroup;
  readonly key: string;
  /** `null` for unset values; otherwise the value honoured by the JSON type. */
  readonly value: unknown;
  readonly valueType: SettingValueType;
  readonly isSensitive: boolean;
  readonly isEditable: boolean;
  readonly description: string | null;
  readonly updatedAt: string;
}

/**
 * A setting sent back to a client. Sensitive values are masked server-side, so the
 * client can show "set/unset" affordances but never the stored value.
 */
export interface SystemSettingReadModel {
  readonly group: SettingGroup;
  readonly key: string;
  readonly value: string | null;
  readonly valueType: SettingValueType;
  readonly isSensitive: boolean;
  readonly isEditable: boolean;
  readonly description: string | null;
}

/**
 * A default row the seed provisions for every company, and the fallback the API
 * uses when a key has no row yet. One catalogue, so the seed and the runtime
 * cannot disagree about the policy defaults a fresh company starts with.
 */
export interface SystemSettingDefault {
  readonly group: SettingGroup;
  readonly key: string;
  readonly value: unknown;
  readonly valueType: SettingValueType;
  readonly isSensitive?: boolean;
  readonly isEditable?: boolean;
  readonly description?: string;
}

export const SYSTEM_SETTING_DEFAULTS: readonly SystemSettingDefault[] = [
  {
    group: 'general',
    key: 'general.company.displayName',
    value: 'Enterprise HRIS',
    valueType: 'STRING',
    description: 'Display name of the company',
  },
  {
    group: 'general',
    key: 'general.company.language',
    value: 'id',
    valueType: 'STRING',
    description: 'Default interface language',
  },
  {
    group: 'general',
    key: 'ai.enabled',
    value: false,
    valueType: 'BOOLEAN',
    description: 'Enable AI assistant features for this company',
  },
  {
    group: 'localization',
    key: 'localization.timeZone',
    value: 'Asia/Jakarta',
    valueType: 'STRING',
    description: 'IANA time zone used when formatting dates for this company',
  },
  {
    group: 'localization',
    key: 'localization.dateFormat',
    value: 'iso',
    valueType: 'STRING',
    description: 'Date presentation: iso (2026-10-18), numeric (18/10/2026) or long (18 Oct 2026)',
  },
  {
    group: 'authentication',
    key: 'authentication.password.minLength',
    value: 8,
    valueType: 'NUMBER',
    description: 'Minimum password length',
  },
  {
    group: 'authentication',
    key: 'authentication.password.complexityRequired',
    value: true,
    valueType: 'BOOLEAN',
    description: 'Require upper, lower and digit in passwords',
  },
  {
    group: 'authentication',
    key: 'authentication.password.expiryDays',
    value: 90,
    valueType: 'NUMBER',
    description: 'Days until a password must be rotated (0 disables)',
  },
  {
    group: 'authentication',
    key: 'authentication.lockout.maxAttempts',
    value: 5,
    valueType: 'NUMBER',
    description: 'Failed attempts before account lockout',
  },
  {
    group: 'authentication',
    key: 'authentication.lockout.lockoutSeconds',
    value: 900,
    valueType: 'NUMBER',
    description: 'Duration a locked account stays locked',
  },
  {
    group: 'authentication',
    key: 'authentication.session.idleTimeoutMinutes',
    value: 30,
    valueType: 'NUMBER',
    description: 'Idle minutes before a session is considered stale',
  },
  {
    group: 'security',
    key: 'security.mfa.required',
    value: false,
    valueType: 'BOOLEAN',
    description: 'Require MFA for all users',
  },
  {
    group: 'security',
    key: 'security.mfa.requiredForRoles',
    value: [],
    valueType: 'STRING_LIST',
    description: 'Role keys that must use MFA',
  },
  {
    group: 'security',
    key: 'security.sso.enabled',
    value: true,
    valueType: 'BOOLEAN',
    description: 'Allow sign-in through configured identity providers',
  },
  {
    group: 'security',
    key: 'security.passkeys.enabled',
    value: true,
    valueType: 'BOOLEAN',
    description: 'Allow users to register and sign in with passkeys',
  },
  {
    group: 'security',
    key: 'security.signIn.passwordEnabled',
    value: true,
    valueType: 'BOOLEAN',
    description: 'Allow email and password sign-in',
  },
  {
    group: 'security',
    key: 'security.signIn.ssoEnabled',
    value: true,
    valueType: 'BOOLEAN',
    description: 'Offer single sign-on on the sign-in screen',
  },
  {
    group: 'security',
    key: 'security.signIn.passkeyEnabled',
    value: true,
    valueType: 'BOOLEAN',
    description: 'Offer passkey sign-in on the sign-in screen',
  },
  {
    group: 'notification',
    key: 'notification.inApp.enabled',
    value: true,
    valueType: 'BOOLEAN',
    description: 'Deliver in-app notifications',
  },
  {
    group: 'notification',
    key: 'notification.email.enabled',
    value: true,
    valueType: 'BOOLEAN',
    description: 'Deliver email notifications',
  },
  {
    group: 'notification',
    key: 'notification.push.enabled',
    value: false,
    valueType: 'BOOLEAN',
    description: 'Deliver push notifications',
  },
  {
    group: 'email',
    key: 'email.senderAddress',
    value: 'no-reply@hris.local',
    valueType: 'STRING',
    description: 'From address for transactional email',
  },
  {
    group: 'email',
    key: 'email.smtpHost',
    value: null,
    valueType: 'STRING',
    description: 'SMTP relay host; null disables outbound email delivery',
  },
  {
    group: 'email',
    key: 'email.smtpPort',
    value: 587,
    valueType: 'NUMBER',
    description: 'SMTP relay port',
  },
  {
    group: 'email',
    key: 'email.smtpUser',
    value: null,
    valueType: 'STRING',
    description: 'SMTP authentication username',
  },
  {
    group: 'email',
    key: 'email.smtpPassword',
    value: null,
    valueType: 'STRING',
    isSensitive: true,
    description: 'SMTP account password',
  },
  {
    group: 'email',
    key: 'email.smtpSsl',
    value: false,
    valueType: 'BOOLEAN',
    description: 'Use TLS for the SMTP relay',
  },
  {
    group: 'sessions',
    key: 'sessions.absoluteTtlSeconds',
    value: 43200,
    valueType: 'NUMBER',
    description: 'Absolute session lifetime in seconds',
  },
  {
    group: 'backup',
    key: 'backup.schedule',
    value: 'daily',
    valueType: 'STRING',
    description: 'Automated backup frequency',
  },
  {
    group: 'backup',
    key: 'backup.retentionDays',
    value: 30,
    valueType: 'NUMBER',
    description: 'Days to retain automated backups',
  },
];
