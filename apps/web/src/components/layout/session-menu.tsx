'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemePreferenceGroup } from '@/components/layout/theme-toggle';
import { useSession } from '@/features/auth/session-context';
import { logout as apiLogout } from '@/features/auth/auth-api';
import { CircleUser, LifeBuoy, LogIn, LogOut, Palette, Settings, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * The account control in the header.
 *
 * Anonymous readers get a single "Sign in" action. Signed-in readers get their
 * initials, role, account/session links and sign-out. Session state comes from the
 * client `SessionProvider`, which hydrates `auth/me` through the `hris_session`
 * cookie, so this menu never handles tokens.
 */
export function SessionMenu() {
  const router = useRouter();
  const { state, refresh } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  const displayName =
    state.status === 'authenticated'
      ? state.session.user.displayName || state.session.user.email
      : null;
  const initials = displayName
    ? displayName
        .split(' ')
        .map((part) => part[0] ?? '')
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '';

  async function signOut() {
    setSigningOut(true);
    try {
      await apiLogout();
    } catch {
      // The cookie is cleared client-side too, so the user is still signed out.
    }
    await refresh();
    router.replace('/login');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Account"
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          />
        }
      >
        {state.status === 'authenticated' ? (
          <span className="grid size-6 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {initials}
          </span>
        ) : (
          <CircleUser aria-hidden="true" className="size-5" />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {state.status === 'authenticated' ? (
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <span className="block truncate font-medium text-foreground">{displayName}</span>
              <span className="block truncate font-normal">{state.session.user.email}</span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
        ) : (
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {state.status === 'loading' ? 'Loading session…' : 'Not signed in'}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
        )}
        <DropdownMenuSeparator />

        {state.status === 'authenticated' ? (
          <>
            <DropdownMenuItem onClick={() => router.push('/setup/account')}>
              <UserRound aria-hidden="true" className="size-4" />
              My Account
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/setup/account/sessions')}>
              <Settings aria-hidden="true" className="size-4" />
              Sessions
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/status')}>
              <LifeBuoy aria-hidden="true" className="size-4" />
              Help
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem
            onClick={() => router.push('/login')}
            disabled={state.status === 'loading'}
          >
            <LogIn aria-hidden="true" className="size-4" />
            Sign in
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <Palette aria-hidden="true" className="size-3.5" />
            Appearance
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <ThemePreferenceGroup />

        {state.status === 'authenticated' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={signingOut}
              onSelect={() => void signOut()}
            >
              <LogOut aria-hidden="true" className="size-4" />
              Sign out
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
