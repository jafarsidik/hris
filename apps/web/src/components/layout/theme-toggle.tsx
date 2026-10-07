'use client';

import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';

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
 * The Appearance control for the account menu.
 *
 * Writes the choice to `localStorage` and toggles the `.dark` class immediately, then keeps
 * a live listener so a System preference follows OS changes without a reload. The pre-paint
 * inline script in the root layout reads the same storage key, so there is no flash between
 * the server HTML (always light) and the selected theme.
 */
export function ThemeToggle() {
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
