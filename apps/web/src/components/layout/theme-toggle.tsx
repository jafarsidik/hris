'use client';

import { useEffect, useState } from 'react';
import { Monitor, Moon, Palette, Sun } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'hris:theme';

const isPreference = (value: unknown): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system';

const systemDark = (): boolean => window.matchMedia('(prefers-color-scheme: dark)').matches;

const applyPreference = (preference: ThemePreference): void => {
  const dark = preference === 'dark' || (preference === 'system' && systemDark());
  document.documentElement.classList.toggle('dark', dark);
};

/** Reads the stored preference, defaulting to System. */
export function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isPreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

/**
 * The Light / Dark / System choices, as a radio group.
 *
 * Base UI renders these menu parts inside `Menu.Root`, so this component is deliberately
 * **not** usable on its own: it belongs inside a `DropdownMenu` (the account menu embeds
 * it below its "Appearance" heading). `ThemeToggle` is the self-contained menu for
 * surfaces that have no surrounding menu of their own.
 *
 * Writes the choice to `localStorage` and toggles the `.dark` class immediately, then keeps
 * a live listener so a System preference follows OS changes without a reload. The pre-paint
 * inline script in the root layout reads the same storage key, so there is no flash between
 * the server HTML (always light) and the selected theme.
 */
export function ThemePreferenceGroup() {
  const [preference, setPreference] = useState<ThemePreference>('system');

  useEffect(() => {
    setPreference(readThemePreference());
    applyPreference(readThemePreference());
  }, []);

  useEffect(() => {
    if (preference !== 'system') return undefined;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyPreference('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  const choose = (next: ThemePreference) => {
    setPreference(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode or a full storage; the class still applies for this session.
    }
    applyPreference(next);
  };

  const options: ReadonlyArray<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <DropdownMenuRadioGroup value={preference} onValueChange={choose}>
      {options.map(({ value, label, icon: Icon }) => (
        <DropdownMenuRadioItem key={value} value={value}>
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}

/**
 * The appearance control as a menu of its own.
 *
 * `Menu.RadioItem` throws — Base UI error #36, "MenuRootContext is missing" — when it is
 * rendered outside a `Menu.Root`, which is exactly what rendering the bare radio group in
 * the auth layout did: every auth screen died on hydration. Wrapping the group in a root
 * here means the component is safe wherever it is placed; `SessionMenu` embeds
 * `ThemePreferenceGroup` inside the account menu instead, so no menu nests within a menu.
 */
export function ThemeToggle() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Appearance"
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          />
        }
      >
        <Palette aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="flex items-center gap-1.5">
              <Palette aria-hidden="true" className="size-3.5" />
              Appearance
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <ThemePreferenceGroup />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
