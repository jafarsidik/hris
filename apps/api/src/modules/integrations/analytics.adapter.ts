import type { IntegrationAdapterContext } from './integration.adapter';
import { readUrl } from './webhook.adapter';

export class AnalyticsAdapter {
  readonly kind = 'ANALYTICS' as const;

  async testConnection(
    context: IntegrationAdapterContext,
  ): Promise<{ ok: boolean; message: string }> {
    const url = readUrl(context.config);
    if (url === null) {
      return { ok: false, message: 'The analytics configuration is missing a valid "url".' };
    }

    const startedAt = Date.now();
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });
      const durationMs = Date.now() - startedAt;
      if (response.status >= 500) {
        return {
          ok: false,
          message: `The analytics endpoint answered with HTTP ${response.status} after ${durationMs}ms.`,
        };
      }
      return {
        ok: true,
        message: `The analytics endpoint is reachable (HTTP ${response.status} in ${durationMs}ms).`,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `The analytics endpoint could not be reached: ${message}` };
    }
  }
}
