import type { TransactionalEmailTemplate } from '@hris/shared-types';

export interface RenderedEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export interface RenderOptions {
  readonly webBaseUrl: string;
  readonly appName: string;
}

interface LayoutInput {
  readonly appName: string;
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly action?: { readonly label: string; readonly url: string };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

/** Renders a plain, dependency-free HTML shell plus a matching text body. */
function layout(input: LayoutInput): { readonly text: string; readonly html: string } {
  const textParts = [...input.paragraphs];
  if (input.action) {
    textParts.push(`${input.action.label}: ${input.action.url}`);
  }
  textParts.push('', `Sent by ${input.appName}.`);

  const paragraphs = input.paragraphs
    .map(
      (paragraph) =>
        `<p style="font-size:14px;line-height:1.6;margin:0 0 12px">${escapeHtml(paragraph)}</p>`,
    )
    .join('');
  const action = input.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(input.action.url)}" style="background:#111827;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">${escapeHtml(input.action.label)}</a></p>`
    : '';

  const html = `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:18px;margin:0 0 16px">${escapeHtml(input.title)}</h1>
    ${paragraphs}
    ${action}
    <p style="font-size:12px;color:#6b7280;margin-top:32px">Sent by ${escapeHtml(input.appName)}.</p>
  </div></body></html>`;

  return { text: textParts.join('\n'), html };
}

/**
 * Renders a transactional email (invite, password reset).
 *
 * Links are reconstructed from a token because the API only enqueues the token; the
 * worker owns the browser-facing base URL so a single deployment can point staging and
 * production at different web origins without touching the API.
 */
export function renderTransactionalEmail(
  template: TransactionalEmailTemplate,
  context: Readonly<Record<string, string>>,
  options: RenderOptions,
): RenderedEmail {
  switch (template) {
    case 'password-reset': {
      const token = context.resetToken ?? '';
      const url = `${options.webBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
      const body = layout({
        appName: options.appName,
        title: 'Reset your password',
        paragraphs: [
          'We received a request to reset your password.',
          'This link expires in one hour. If you did not request it, you can ignore this email.',
        ],
        action: { label: 'Reset password', url },
      });
      return { subject: `Reset your ${options.appName} password`, ...body };
    }
    case 'user-invite': {
      const token = context.inviteToken ?? '';
      const url = `${options.webBaseUrl}/accept-invite?token=${encodeURIComponent(token)}`;
      const body = layout({
        appName: options.appName,
        title: `You are invited to ${options.appName}`,
        paragraphs: [
          'An account has been created for you. Set your password to activate it.',
          'If you were not expecting this invitation, you can ignore this email.',
        ],
        action: { label: 'Accept invitation', url },
      });
      return { subject: `Your ${options.appName} invitation`, ...body };
    }
  }
}

/** Renders the message an in-app notification produced for its email channel. */
export function renderNotificationEmail(input: {
  readonly subject: string;
  readonly body: string;
  readonly appName: string;
}): RenderedEmail {
  const body = layout({
    appName: input.appName,
    title: input.subject,
    paragraphs: input.body.split(/\n{2,}/u).filter((paragraph) => paragraph.trim() !== ''),
  });
  return { subject: input.subject, ...body };
}
