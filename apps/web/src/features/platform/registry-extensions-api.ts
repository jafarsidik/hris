import type {
  ConfigurationSchemaInput,
  ConfigurationSchemaSummary,
  ExtensionInput,
  ExtensionSummary,
} from '@hris/shared-types';

import { apiRequestV1 } from '@/lib/api/client-config';

export const configurationSchemasApi = {
  list: (): Promise<readonly ConfigurationSchemaSummary[]> =>
    apiRequestV1('/registry/configuration-schemas'),
  create: (input: ConfigurationSchemaInput) =>
    apiRequestV1<ConfigurationSchemaSummary>('/registry/configuration-schemas', {
      method: 'POST',
      body: input,
    }),
  update: (id: string, patch: Partial<ConfigurationSchemaInput>) =>
    apiRequestV1<ConfigurationSchemaSummary>(
      `/registry/configuration-schemas/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: patch },
    ),
  remove: (id: string) =>
    apiRequestV1<never>(`/registry/configuration-schemas/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  toggle: (id: string, isActive: boolean) =>
    apiRequestV1<ConfigurationSchemaSummary>(
      `/registry/configuration-schemas/${encodeURIComponent(id)}/toggle`,
      { method: 'POST', body: { isActive } },
    ),
};

export const extensionsApi = {
  list: (): Promise<readonly ExtensionSummary[]> => apiRequestV1('/registry/extensions'),
  create: (input: ExtensionInput) =>
    apiRequestV1<ExtensionSummary>('/registry/extensions', { method: 'POST', body: input }),
  update: (id: string, patch: Partial<ExtensionInput>) =>
    apiRequestV1<ExtensionSummary>(`/registry/extensions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: patch,
    }),
  remove: (id: string) =>
    apiRequestV1<never>(`/registry/extensions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  toggle: (id: string, isEnabled: boolean) =>
    apiRequestV1<ExtensionSummary>(`/registry/extensions/${encodeURIComponent(id)}/toggle`, {
      method: 'POST',
      body: { isEnabled },
    }),
};
