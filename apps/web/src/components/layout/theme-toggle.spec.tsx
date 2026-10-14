import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemePreferenceGroup, ThemeToggle } from './theme-toggle';

/**
 * Base UI error #36 — "MenuRootContext is missing. Menu parts must be placed within
 * `<Menu.Root>`" — is thrown when a `Menu.RadioItem` renders outside a root. The bare
 * preference group in the auth layout did exactly that, so every auth screen died on
 * hydration behind the route error boundary, and the setup screens surfaced the same
 * crash through their anonymous redirect to `/login`. These two shapes are the ones in
 * use: the self-contained control on its own, and the group inside the account menu.
 */
describe('ThemeToggle', () => {
  it('mounts standalone, carrying its own menu root', () => {
    render(<ThemeToggle />);

    expect(screen.getByRole('button', { name: 'Appearance' })).toBeInTheDocument();
  });

  it('offers the three theme choices once opened', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }));

    expect(screen.getByRole('menuitemradio', { name: /Light/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /Dark/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /System/ })).toBeInTheDocument();
  });

  it('mounts the preference group inside a surrounding menu', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger render={<button type="button">Account</button>} />
        <DropdownMenuContent>
          <ThemePreferenceGroup />
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
  });
});
