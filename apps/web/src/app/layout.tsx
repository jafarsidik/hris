import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/layout/app-shell';
import { ThemeScript } from '@/components/layout/theme-script';
import { ToastProvider } from '@/components/ui/toast';

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

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The per-request nonce the middleware mints for its Content-Security-Policy. It is
  // read here and handed to the theme script so that script is `script-src`-abiding;
  // without a nonce an inline script is blocked and the saved theme never applies.
  const nonce = (await headers()).get('x-nonce') ?? '';

  return (
    <html lang="en" suppressHydrationWarning>
      {/*
        `suppressHydrationWarning` is required by the sidebar, not for appearance.
        `SidebarProvider` persists its collapsed state in a cookie and the sidebar
        primitives write layout-affecting data attributes on the first client render.
        Without this, a reader whose cookie says "collapsed" sees a hydration mismatch
        on the navigation rail, and React discards the server-rendered tree to recover.
        The mismatch is expected and harmless: the cookie is the source of truth, and
        the visual difference is only which of two valid states is shown.
      */}
      <body>
        {/*
          Applies the saved theme before first paint. It has to run before the token
          values are read, so it sits at the very top of the body rather than in a
          component that mounts later; without it the page flashes light before the
          theme toggle reacts.
        */}
        <ThemeScript nonce={nonce} />
        {/*
          Visually hidden until focused, then pinned to the top-left so a
          keyboard user lands on it immediately. Tailwind's `sr-only` clips the
          element to a 1px box; `not-sr-only` reverses that on focus.

          The target is the `<main>` that `SidebarInset` renders inside `AppShell`,
          which carries this id. There is exactly one main landmark on the page.
        */}
        <a
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
          href="#main-content"
        >
          Skip to main content
        </a>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
