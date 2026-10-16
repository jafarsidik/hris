import type { CurrentSession, SessionInfo } from '@hris/shared-types';

import { apiRequestV1 } from '@/lib/api/client-config';

/**
 * Browser-side calls for the authentication surface.
 *
 * Everything goes through the `hris_session` cookie, so no token is ever stored or
 * attached by the web app; the server sets the cookie on login and clears it on
 * logout (ADR 0010). Pre-login screens call these directly from the client.
 */

export interface LoginResult {
  readonly token: string;
  readonly expiresAt: string;
  readonly session: CurrentSession;
}

/** Mints a session. On success the API also sets the `hris_session` cookie. */
export async function login(input: { email: string; password: string }): Promise<LoginResult> {
  return apiRequestV1<LoginResult>('/auth/login', { method: 'POST', body: input });
}

/** Ends the current session (cookie and server-side token are both invalidated). */
export async function logout(): Promise<void> {
  await apiRequestV1<never>('/auth/logout', { method: 'POST' });
}

export async function forgotPassword(input: { email: string }): Promise<void> {
  await apiRequestV1<never>('/auth/forgot-password', { method: 'POST', body: input });
}

export async function resetPassword(input: {
  resetToken: string;
  password: string;
}): Promise<void> {
  await apiRequestV1<never>('/auth/reset-password', { method: 'POST', body: input });
}

export async function verifyEmail(input: { verificationToken: string }): Promise<void> {
  await apiRequestV1<never>('/auth/verify-email', { method: 'POST', body: input });
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await apiRequestV1<never>('/auth/change-password', { method: 'POST', body: input });
}

export async function listSessions(): Promise<readonly SessionInfo[]> {
  return apiRequestV1<readonly SessionInfo[]>('/auth/sessions');
}

export async function revokeOtherSessions(): Promise<void> {
  await apiRequestV1<never>('/auth/sessions/revoke-others', { method: 'POST' });
}

export async function revokeSession(sessionId: string): Promise<void> {
  await apiRequestV1<never>(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
}
