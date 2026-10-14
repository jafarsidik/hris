import type { ReactNode } from 'react';

import { AppShell } from '@/components/layout/app-shell';
import { SessionProvider } from '@/features/auth/session-context';

/**
 * The authenticated application frame.
 *
 * Session state is hydated client-side from `auth/me` (the browser holds the
 * `hris_session` cookie), so the shell renders immediately and the session menu /
 * permission gates reveal themselves once the fetch settles.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
