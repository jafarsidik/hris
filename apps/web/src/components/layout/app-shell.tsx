import Link from 'next/link';
import type { ReactNode } from 'react';

interface NavigationItem {
  readonly href: string;
  readonly label: string;
  /**
   * Presentational hint only. Navigation is filtered per role once
   * authentication exists; the API re-authorises every request regardless, so a
   * client-side change here is never a security control.
   */
  readonly requiresModule?: string;
}

const NAVIGATION: readonly NavigationItem[] = [
  { href: '/', label: 'Overview' },
  { href: '/status', label: 'Platform status' },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          backgroundColor: 'var(--hris-color-surface)',
          borderBottom: '1px solid var(--hris-color-border)',
          padding: 'var(--hris-space-4) var(--hris-space-5)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--hris-space-5)',
          flexWrap: 'wrap',
        }}
      >
        <Link
          href="/"
          style={{
            fontWeight: 700,
            fontSize: '1.125rem',
            textDecoration: 'none',
            color: 'var(--hris-color-text)',
          }}
        >
          HRIS
        </Link>
        <nav aria-label="Primary">
          <ul
            style={{
              display: 'flex',
              gap: 'var(--hris-space-4)',
              listStyle: 'none',
              margin: 0,
              padding: 0,
            }}
          >
            {NAVIGATION.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main
        id="main-content"
        style={{
          flex: 1,
          width: '100%',
          maxWidth: '72rem',
          margin: '0 auto',
          padding: 'var(--hris-space-5)',
        }}
      >
        {children}
      </main>

      <footer
        style={{
          borderTop: '1px solid var(--hris-color-border)',
          padding: 'var(--hris-space-4) var(--hris-space-5)',
          color: 'var(--hris-color-text-muted)',
          fontSize: '0.875rem',
        }}
      >
        Enterprise HRIS &middot; Phase 0 foundation
      </footer>
    </div>
  );
}
