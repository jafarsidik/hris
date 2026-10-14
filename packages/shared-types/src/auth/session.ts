/**
 * Session and current-user shapes shared by the API and the web application.
 *
 * The API is the only place that ever sees a token; these are the *read models*
 * derived from it (ADR 0010), so a client only receives the session record and the
 * current user, never the token or its hash.
 */

export interface SessionInfo {
  readonly id: string;
  readonly userId: string;
  readonly userAgent: string | null;
  readonly ipAddress: string | null;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  /** The session that issued the request this list was fetched from. */
  readonly isCurrent: boolean;
}

export interface CurrentUserSummary {
  readonly id: string;
  readonly companyId: string;
  readonly email: string;
  readonly displayName: string;
  readonly status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  readonly hasVerifiedEmail: boolean;
  readonly lastLoginAt: string | null;
  readonly roles: readonly { key: string; name: string }[];
}

/**
 * A resolved capability for the current user. Scope is the widest grant the user
 * holds for this resource/action pair across their roles.
 */
export interface EffectivePermission {
  readonly resource: string;
  readonly action: string;
  readonly scope: 'SELF' | 'TEAM' | 'DEPARTMENT' | 'ENTITY' | 'COMPANY' | 'GLOBAL';
  /**
   * Optional organizational-unit id that narrows an org-level scope (TEAM,
   * DEPARTMENT, ENTITY) to that unit instead of the caller's own. A null or absent
   * value means the caller's own placement anchors the scope.
   */
  readonly scopeId?: string | null;
}

export interface CurrentSession {
  readonly user: CurrentUserSummary;
  readonly permissions: readonly EffectivePermission[];
}
