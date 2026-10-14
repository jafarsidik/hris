import type { EffectivePermission } from '@hris/shared-types';
import { describe, expect, it } from 'vitest';

import { CONSOLE_SECTIONS, consoleFor, isItemVisible } from './console';
import { ROUTES } from './navigation';

const PERMISSION = (resource: string, action: string): EffectivePermission =>
  ({ resource, action }) as EffectivePermission;

const ITEMS = CONSOLE_SECTIONS.flatMap((section) => section.items);

const ALL_PERMISSIONS: readonly EffectivePermission[] = ITEMS.flatMap((item) =>
  item.permission === undefined
    ? []
    : [
        PERMISSION(
          item.permission.slice(0, item.permission.lastIndexOf('.')),
          item.permission.slice(item.permission.lastIndexOf('.') + 1),
        ),
      ],
);

const findItem = (permission: string) => ITEMS.find((item) => item.permission === permission);

/** Narrows an optional lookup, failing the test loudly rather than with `!`. */
function must<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('expected a console entry');
  }
  return value;
}

describe('CONSOLE_SECTIONS', () => {
  it('has exactly ten sections', () => {
    expect(CONSOLE_SECTIONS).toHaveLength(10);
  });

  it('gives every section a unique id, label and description', () => {
    const ids = CONSOLE_SECTIONS.map((section) => section.id);
    const labels = CONSOLE_SECTIONS.map((section) => section.label);

    expect(new Set(ids).size, ids.join(', ')).toBe(ids.length);
    expect(new Set(labels).size, labels.join(', ')).toBe(labels.length);

    for (const section of CONSOLE_SECTIONS) {
      expect(section.id.length, section.label).toBeGreaterThan(0);
      expect(section.label.length).toBeGreaterThan(0);
      expect(section.description.length, section.label).toBeGreaterThan(0);
      expect(section.items.length, section.label).toBeGreaterThan(0);
    }
  });

  it('links only routes that exist', () => {
    // A console item is a shortcut into a built page; a link to anything else is a 404.
    for (const section of CONSOLE_SECTIONS) {
      for (const item of section.items) {
        if (item.status === 'built') {
          expect(item.href, `${section.label}/${item.label}`).toBeDefined();
          expect(ROUTES, item.href).toContain(item.href);
        } else {
          expect(item.href, `${section.label}/${item.label}`).toBeUndefined();
        }
      }
    }
  });

  it('has unique item labels and paths', () => {
    const labels = ITEMS.map((item) => item.label);
    const hrefs = ITEMS.map((item) => item.href).filter(
      (href): href is string => href !== undefined,
    );

    expect(new Set(labels).size, labels.join(', ')).toBe(labels.length);
    expect(new Set(hrefs).size, hrefs.join(', ')).toBe(hrefs.length);
  });

  it('gives every item a description and a status', () => {
    for (const section of CONSOLE_SECTIONS) {
      for (const item of section.items) {
        expect(item.description.length, `${section.label}/${item.label}`).toBeGreaterThan(0);
        expect(['built', 'planned'], `${section.label}/${item.label}`).toContain(item.status);
      }
    }
  });
});

describe('isItemVisible', () => {
  it('shows an ungated item to everyone', () => {
    const item = must(ITEMS.find((candidate) => candidate.permission === undefined));

    expect(isItemVisible(item, [])).toBe(true);
  });

  it('hides a gated item from a caller without the permission', () => {
    const item = must(findItem('user.view'));

    expect(isItemVisible(item, [])).toBe(false);
    expect(isItemVisible(item, [PERMISSION('user', 'view')])).toBe(true);
  });

  it('does not treat one action as another', () => {
    expect(isItemVisible(must(findItem('user.view')), [PERMISSION('user', 'create')])).toBe(false);
  });
});

describe('consoleFor', () => {
  it('keeps all ten sections for a fully privileged caller', () => {
    const sections = consoleFor(ALL_PERMISSIONS);

    expect(sections).toHaveLength(10);
    expect(sections.every((section) => !section.isEmpty)).toBe(true);
  });

  it('empties a section the caller cannot see rather than dropping it', () => {
    // The console is a fixed map of the platform; a hidden section would make the whole
    // surface look incomplete instead of merely restricted.
    const withoutUserView = ALL_PERMISSIONS.filter(
      (permission) => !(permission.resource === 'user' && permission.action === 'view'),
    );
    const identity = must(consoleFor(withoutUserView).find((section) => section.id === 'identity'));

    expect(identity.items.some((item) => item.label === 'Users')).toBe(false);
    expect(identity.isEmpty).toBe(false);
  });

  it('flags a section as empty when none of its items are visible', () => {
    const sections = consoleFor([]);
    const emptyIds = sections.filter((section) => section.isEmpty).map((section) => section.id);

    expect(sections).toHaveLength(10);
    expect(emptyIds).toContain('identity');
    expect(emptyIds).toContain('configuration');
    // A section with ungated items stays populated for an unprivileged caller.
    expect(emptyIds).not.toContain('account');
  });
});
