import { createTransport, type Transporter } from 'nodemailer';

import type { ResolvedSmtp } from './smtp-settings';

export interface OutboundMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export interface MailSender {
  send(message: OutboundMessage): Promise<void>;
  close(): void;
}

/**
 * Wraps a nodemailer transport for one resolved relay.
 *
 * The transport is built once per resolved relay because a company's settings rarely
 * change within a process lifetime; building a pool per message would defeat
 * connection reuse. Delivery failures are surfaced to the caller (and therefore to
 * BullMQ's retry policy) rather than swallowed.
 */
export function createMailSender(
  smtp: ResolvedSmtp,
  from: { readonly address: string; readonly name: string },
): MailSender {
  const transport: Transporter = createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    ...(smtp.user === null ? {} : { auth: { user: smtp.user, pass: smtp.password ?? '' } }),
    pool: true,
  });

  return {
    async send(message: OutboundMessage): Promise<void> {
      await transport.sendMail({
        from: { address: from.address, name: from.name },
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    },
    close(): void {
      transport.close();
    },
  };
}
