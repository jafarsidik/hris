import type { IntegrationAdapter, IntegrationAdapterContext } from './integration.adapter';

/**
 * Webhook endpoints.
 *
 * A webhook integration's non-secret `config` holds only the destination `url`. The
 * signing secret is stored encrypted on the integration row and is never read here; the
 * connection test only proves the endpoint is reachable, because an inbound URL probe
 * cannot validate a secret it does not own.
 *
 * The test sends a `HEAD` request rather than a `POST`: a receiver should not have to
 * accept a bodyless probe, and a HEAD is the least intrusive way to observe that DNS,
 * TLS and the listener all work. Any status below 500 counts as reachable; a 4xx means
 * the endpoint answered, which is all a connectivity test can honestly claim.
 */
export class WebhookAdapter implements IntegrationAdapter {
  readonly kind = 'WEBHOOK' as const;

  async testConnection(
    context: IntegrationAdapterContext,
  ): Promise<{ ok: boolean; message: string }> {
    const url = readUrl(context.config);
    if (url === null) {
      return { ok: false, message: 'The webhook configuration is missing a valid "url".' };
    }

    const startedAt = Date.now();
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });
      const durationMs = Date.now() - startedAt;
      if (response.status >= 500) {
        return {
          ok: false,
          message: `The endpoint answered with HTTP ${response.status} after ${durationMs}ms.`,
        };
      }
      return {
        ok: true,
        message: `The endpoint is reachable (HTTP ${response.status} in ${durationMs}ms).`,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `The endpoint could not be reached: ${message}` };
    }
  }
}

/** Reads and validates the endpoint URL from an integration's non-secret config. */
export function readUrl(config: Readonly<Record<string, unknown>>): string | null {
  const value = config['url'];
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}
