import type {
  ApprovalAuthoritySummary,
  ApprovalDelegationSummary,
  ApplicationSummary,
  CreateApplicationInput,
  CreateModuleInput,
  CreateRegisteredActionInput,
  CreateResourceFieldInput,
  CreateResourceInput,
  IdentityProviderSummary,
  ModuleSummary,
  NotificationReadModel,
  PasskeySummary,
  QueueJobState,
  QueueJobSummary,
  QueueSummary,
  ResourceSummary,
  UpdateApplicationInput,
  UpdateModuleInput,
  UpdateResourceInput,
} from '@hris/shared-types';

import { apiRequestV1 } from '@/lib/api/client-config';

export interface MfaStatus {
  readonly enrolled: boolean;
  readonly confirmedAt: string | null;
  readonly recoveryCodesRemaining: number;
}

export interface MfaEnrollment {
  readonly factorId: string;
  readonly secret: string;
  readonly otpauthUrl: string;
  readonly qrDataUrl: string;
}

export interface CreateIdentityProviderInput {
  readonly name: string;
  readonly type: 'OIDC' | 'SAML';
  readonly enabled?: boolean;
  readonly domains?: readonly string[];
  readonly oidc?: {
    readonly issuer: string;
    readonly clientId: string;
    readonly clientSecret?: string;
    readonly scopes?: readonly string[];
  };
  readonly saml?: {
    readonly entryPoint: string;
    readonly issuer: string;
    readonly idpCert: string;
    readonly idpEntityId?: string;
  };
}

export interface CreateAuthorityInput {
  readonly subjectType: 'USER' | 'ROLE';
  readonly subjectId: string;
  readonly resource?: string;
  readonly category?: string;
  readonly maxAmount?: string;
  readonly currencyCode?: string;
}

export interface CreateDelegationInput {
  readonly delegatorUserId: string;
  readonly delegateeUserId: string;
  readonly resource?: string;
  readonly reason?: string;
}

/** Platform operations and security endpoints, called from the browser with the session cookie. */
export const platformApi = {
  // MFA ---------------------------------------------------------------------
  mfaStatus: (): Promise<MfaStatus> => apiRequestV1<MfaStatus>('/mfa/status'),
  mfaEnroll: (label?: string): Promise<MfaEnrollment> =>
    apiRequestV1<MfaEnrollment>('/mfa/enroll', { method: 'POST', body: { label } }),
  mfaConfirm: (factorId: string, code: string): Promise<{ codes: readonly string[] }> =>
    apiRequestV1<{ codes: readonly string[] }>(`/mfa/enroll/${factorId}/confirm`, {
      method: 'POST',
      body: { code },
    }),
  mfaDisable: (): Promise<void> => apiRequestV1<never>('/mfa/disable', { method: 'POST' }),

  // Passkeys ----------------------------------------------------------------
  listPasskeys: (): Promise<readonly PasskeySummary[]> =>
    apiRequestV1<readonly PasskeySummary[]>('/passkeys'),
  deletePasskey: (id: string): Promise<void> =>
    apiRequestV1<never>(`/passkeys/${id}`, { method: 'DELETE' }),
  passkeyRegistrationOptions: (): Promise<Record<string, unknown>> =>
    apiRequestV1<Record<string, unknown>>('/passkeys/registration/options', { method: 'POST' }),
  passkeyRegistrationVerify: (response: unknown, deviceName?: string): Promise<PasskeySummary> =>
    apiRequestV1<PasskeySummary>('/passkeys/registration/verify', {
      method: 'POST',
      body: { response, deviceName },
    }),

  // Identity providers (SSO) ------------------------------------------------
  listIdentityProviders: (): Promise<readonly IdentityProviderSummary[]> =>
    apiRequestV1<readonly IdentityProviderSummary[]>('/identity-providers'),
  createIdentityProvider: (input: CreateIdentityProviderInput): Promise<IdentityProviderSummary> =>
    apiRequestV1<IdentityProviderSummary>('/identity-providers', { method: 'POST', body: input }),
  deleteIdentityProvider: (id: string): Promise<void> =>
    apiRequestV1<never>(`/identity-providers/${id}`, { method: 'DELETE' }),

  // Approval authority ------------------------------------------------------
  listAuthorities: (): Promise<readonly ApprovalAuthoritySummary[]> =>
    apiRequestV1<readonly ApprovalAuthoritySummary[]>('/approval-authorities'),
  createAuthority: (input: CreateAuthorityInput): Promise<ApprovalAuthoritySummary> =>
    apiRequestV1<ApprovalAuthoritySummary>('/approval-authorities', {
      method: 'POST',
      body: input,
    }),
  deleteAuthority: (id: string): Promise<void> =>
    apiRequestV1<never>(`/approval-authorities/${id}`, { method: 'DELETE' }),
  listDelegations: (): Promise<readonly ApprovalDelegationSummary[]> =>
    apiRequestV1<readonly ApprovalDelegationSummary[]>('/approval-delegations'),
  createDelegation: (input: CreateDelegationInput): Promise<ApprovalDelegationSummary> =>
    apiRequestV1<ApprovalDelegationSummary>('/approval-delegations', {
      method: 'POST',
      body: input,
    }),
  deleteDelegation: (id: string): Promise<void> =>
    apiRequestV1<never>(`/approval-delegations/${id}`, { method: 'DELETE' }),

  // Notifications -----------------------------------------------------------
  listNotifications: (): Promise<readonly NotificationReadModel[]> =>
    apiRequestV1<readonly NotificationReadModel[]>('/notifications'),
  unreadNotificationCount: (): Promise<{ readonly count: number }> =>
    apiRequestV1<{ readonly count: number }>('/notifications/unread-count'),
  markNotificationRead: (id: string): Promise<NotificationReadModel> =>
    apiRequestV1<NotificationReadModel>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: (): Promise<{ readonly marked: number }> =>
    apiRequestV1<{ readonly marked: number }>('/notifications/read-all', { method: 'PATCH' }),

  // Queues ------------------------------------------------------------------
  listQueues: (): Promise<readonly QueueSummary[]> =>
    apiRequestV1<readonly QueueSummary[]>('/platform/queues'),
  listQueueJobs: (name: string, state: QueueJobState): Promise<readonly QueueJobSummary[]> =>
    apiRequestV1<readonly QueueJobSummary[]>(
      `/platform/queues/${encodeURIComponent(name)}/jobs?state=${state}`,
    ),
  retryQueueJob: (name: string, jobId: string): Promise<void> =>
    apiRequestV1<never>(
      `/platform/queues/${encodeURIComponent(name)}/jobs/${encodeURIComponent(jobId)}/retry`,
      { method: 'POST' },
    ),

  // Platform metadata registry (System -> Application & Metadata) -------------
  listRegistryApplications: (): Promise<readonly ApplicationSummary[]> =>
    apiRequestV1<readonly ApplicationSummary[]>('/platform/registry/applications'),
  listRegistryModules: (): Promise<readonly ModuleSummary[]> =>
    apiRequestV1<readonly ModuleSummary[]>('/platform/registry/modules'),
  listRegistryResources: (): Promise<readonly ResourceSummary[]> =>
    apiRequestV1<readonly ResourceSummary[]>('/platform/registry/resources'),
  createRegistryApplication: (input: CreateApplicationInput): Promise<ApplicationSummary> =>
    apiRequestV1<ApplicationSummary>('/platform/registry/applications', {
      method: 'POST',
      body: input,
    }),
  updateRegistryApplication: (
    key: string,
    input: UpdateApplicationInput,
  ): Promise<ApplicationSummary> =>
    apiRequestV1<ApplicationSummary>(`/platform/registry/applications/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      body: input,
    }),
  createRegistryModule: (input: CreateModuleInput): Promise<ModuleSummary> =>
    apiRequestV1<ModuleSummary>('/platform/registry/modules', { method: 'POST', body: input }),
  updateRegistryModule: (key: string, input: UpdateModuleInput): Promise<ModuleSummary> =>
    apiRequestV1<ModuleSummary>(`/platform/registry/modules/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      body: input,
    }),
  createRegistryResource: (input: CreateResourceInput): Promise<ResourceSummary> =>
    apiRequestV1<ResourceSummary>('/platform/registry/resources', { method: 'POST', body: input }),
  updateRegistryResource: (key: string, input: UpdateResourceInput): Promise<ResourceSummary> =>
    apiRequestV1<ResourceSummary>(`/platform/registry/resources/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      body: input,
    }),
  addRegistryResourceField: (
    key: string,
    input: CreateResourceFieldInput,
  ): Promise<ResourceSummary> =>
    apiRequestV1<ResourceSummary>(
      `/platform/registry/resources/${encodeURIComponent(key)}/fields`,
      { method: 'POST', body: input },
    ),
  addRegistryResourceAction: (
    key: string,
    input: CreateRegisteredActionInput,
  ): Promise<ResourceSummary> =>
    apiRequestV1<ResourceSummary>(
      `/platform/registry/resources/${encodeURIComponent(key)}/actions`,
      { method: 'POST', body: input },
    ),
};
