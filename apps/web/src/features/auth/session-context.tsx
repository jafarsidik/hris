'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { CurrentSession, EffectivePermission, PermissionKey } from '@hris/shared-types';

import { apiRequestV1 } from '@/lib/api/client-config';

export type SessionState =
  | { readonly status: 'loading' }
  | { readonly status: 'anonymous' }
  | { readonly status: 'authenticated'; readonly session: CurrentSession };

interface SessionContextValue {
  readonly state: SessionState;
  /** Re-reads `auth/me`. Used after login, logout and password changes. */
  readonly refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Client-side session provider for the authenticated shell.
 *
 * The browser authenticates to the API with the `hris_session` cookie (ADR 0010),
 * so there is no token to keep; fetching `/auth/me` is enough to hydrate the user,
 * their roles and their effective permissions. The public screens (`/login`, ...)
 * render outside this provider.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const mounted = useRef(true);

  const load = useCallback(async (): Promise<CurrentSession | null> => {
    try {
      const session = await apiRequestV1<CurrentSession>('/auth/me');
      if (mounted.current) {
        setState({ status: 'authenticated', session });
      }
      return session;
    } catch (error) {
      if (mounted.current) {
        setState({ status: 'anonymous' });
      }
      void error;
      return null;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return <SessionContext.Provider value={{ state, refresh }}>{children}</SessionContext.Provider>;
}

/** Reads the current session state. Must be rendered under SessionProvider. */
export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return value;
}

/**
 * Effective-permission lookup for the current user.
 *
 * `permission` is a fully-qualified key ("user.create"). UI gating is cosmetic
 * only; the API authorises every command independently.
 */
export function can<I extends PermissionKey>(
  permissions: readonly EffectivePermission[],
  permission: I,
): boolean {
  const [resource, action] = permission.split('.') as [string, string];
  return permissions.some((grant) => grant.resource === resource && grant.action === action);
}

export function useCan(permission: PermissionKey): boolean {
  const { state } = useSession();
  if (state.status !== 'authenticated') {
    return false;
  }
  return can(state.session.permissions, permission);
}
