import { connect } from 'node:net';

import { Inject, Injectable } from '@nestjs/common';

import { SettingsService } from '../settings/settings.service';
import type {
  IntegrationAdapter,
  IntegrationAdapterContext,
  IntegrationAdapterResult,
} from './integration.adapter';

/** How long a TCP connection test may take before it is reported as unreachable. */
const CONNECT_TIMEOUT_MS = 4000;

/**
 * Email adapter.
 *
 * The platform's first adapter. It resolves the tenant's SMTP relay from System
 * Settings (an explicit `email.smtpHost` with a null value disables email) and proves
 * reachability with a TCP connect to the host and port. A full SMTP handshake would
 * require the stored password and a mail library in the API process; a reachability
 * check is dependency-free and is the part that actually fails when a relay is
 * misconfigured, while the worker remains the component that authenticates and sends.
 */
@Injectable()
export class EmailAdapter implements IntegrationAdapter {
  readonly kind = 'EMAIL' as const;

  constructor(@Inject(SettingsService) private readonly settings: SettingsService) {}

  async testConnection(context: IntegrationAdapterContext): Promise<IntegrationAdapterResult> {
    const host = await this.resolveString(context, 'email.smtpHost', 'host');
    if (host === null) {
      return { ok: false, message: 'No SMTP relay is configured for this company.' };
    }

    const port = await this.resolvePort(context);
    const reachable = await canConnect(host, port);
    return reachable
      ? { ok: true, message: `Connected to the SMTP relay at ${host}:${port}.` }
      : { ok: false, message: `Could not reach the SMTP relay at ${host}:${port}.` };
  }

  private async resolveString(
    context: IntegrationAdapterContext,
    settingKey: string,
    configKey: string,
  ): Promise<string | null> {
    const configured = context.config[configKey];
    if (typeof configured === 'string' && configured.trim() !== '') {
      return configured.trim();
    }
    const value = await this.settings.getEffectiveSetting(context.companyId, settingKey);
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
  }

  private async resolvePort(context: IntegrationAdapterContext): Promise<number> {
    const configured = context.config['port'];
    if (typeof configured === 'number' && Number.isInteger(configured) && configured > 0) {
      return configured;
    }
    const value = await this.settings.getEffectiveSetting(context.companyId, 'email.smtpPort');
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 587;
  }
}

/** Resolves true when a TCP connection to host:port opens within the timeout. */
function canConnect(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const finish = (result: boolean): void => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(CONNECT_TIMEOUT_MS);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}
