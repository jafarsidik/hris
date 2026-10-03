import { HEALTH_PATHS } from '@hris/config';

import { serverPlatformRequest } from './server-config';

export interface ApiLiveness {
  readonly status: 'ok';
  readonly service: string;
  readonly environment: string;
  readonly uptimeSeconds: number;
}

export interface ApiReadiness {
  readonly status: 'ok' | 'error';
  readonly info?: Record<string, unknown>;
  readonly error?: Record<string, unknown>;
}

/**
 * Platform probes are only ever issued from the server, so they use the
 * server-side configuration rather than the browser-facing URLs.
 */
export const fetchLiveness = (signal?: AbortSignal): Promise<ApiLiveness> =>
  serverPlatformRequest<ApiLiveness>(HEALTH_PATHS.live, signal ? { signal } : undefined);

export const fetchReadiness = (signal?: AbortSignal): Promise<ApiReadiness> =>
  serverPlatformRequest<ApiReadiness>(HEALTH_PATHS.ready, signal ? { signal } : undefined);