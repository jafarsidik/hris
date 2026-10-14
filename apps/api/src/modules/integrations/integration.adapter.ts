import type { IntegrationKind } from '@hris/shared-types';

/** The context handed to an adapter when it is asked to test or exercise a connection. */
export interface IntegrationAdapterContext {
  readonly companyId: string;
  readonly integrationKey: string;
  readonly provider: string;
  readonly config: Readonly<Record<string, unknown>>;
}

/** The outcome of a connection test. */
export interface IntegrationAdapterResult {
  readonly ok: boolean;
  readonly message: string;
}

/**
 * A pluggable integration adapter.
 *
 * Adapters are code and integrations are data: a kind maps to exactly one adapter, and
 * every configured integration of that kind is exercised through it. Adapters read any
 * secret they need from encrypted System Settings rather than from the integration
 * record, so `config` never holds a credential.
 */
export interface IntegrationAdapter {
  readonly kind: IntegrationKind;
  testConnection(context: IntegrationAdapterContext): Promise<IntegrationAdapterResult>;
}
