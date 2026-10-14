import type { ReactNode } from 'react';

import { ThemeToggle } from '@/components/layout/theme-toggle';

/**
 * The public authentication frame: a centered card with no application chrome.
 *
 * These screens are reached pre-login, so there is deliberately no `AppShell` and
 * no session hydration here — the `hris_session` cookie may be absent entirely.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col overflow-y-auto bg-background">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="text-sm font-semibold tracking-tight">HRIS</span>
        <ThemeToggle />
      </div>
      <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="px-4 pb-4 text-center text-xs text-muted-foreground">
        Enterprise HRIS &middot; foundation phase
      </footer>
    </div>
  );
}
