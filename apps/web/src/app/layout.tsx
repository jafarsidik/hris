import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/layout/app-shell';

import './globals.css';

/**
 * Every page is rendered per request.
 *
 * Two reasons, and both are correctness rather than preference:
 *
 * 1. The Content-Security-Policy in `middleware.ts` carries a per-request nonce.
 *    A statically prerendered page is served from a prebuilt HTML file, so the
 *    nonce can never be attached to its inline scripts and every one of them is
 *    blocked, leaving the page dead to JavaScript.
 * 2. An HRIS page is scoped to a session, a tenant and a permission set. Serving
 *    one person's HTML from a shared cache to another is a data leak, so these
 *    responses must never be cached as static artefacts.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: 'HRIS',
    template: '%s | HRIS',
  },
  description: 'Enterprise Human Resources Information System',
  robots: {
    // An internal HR platform must never be indexed by a public crawler.
    index: false,
    follow: false,
    nocache: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
