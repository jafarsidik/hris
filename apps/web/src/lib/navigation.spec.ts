import { MODULE_IDS } from '@hris/shared-types';
import { describe, expect, it } from 'vitest';

import {
  BUILT_ITEMS,
  MODULE_MENUS,
  ROUTES,
  activeModule,
  breadcrumbTrail,
  isActiveRoute,
  locatePath,
  moduleMenu,
} from './navigation';

const PATH_PATTERN = /^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/;

describe('BUILT_ITEMS', () => {
  it('contains only unique paths', () => {
    const paths = BUILT_ITEMS.map((entry) => entry.item.href);

    expect(new Set(paths).size, paths.join(', ')).toBe(paths.length);
  });

  it('gives every item a well-formed path', () => {
    for (const entry of BUILT_ITEMS) {
      expect(entry.item.href, entry.item.label).toMatch(PATH_PATTERN);
    }
  });

  it('gives every item a module from the shared contract', () => {
    const known = new Set<string>(MODULE_IDS);

    for (const entry of BUILT_ITEMS) {
      expect(known.has(entry.module), `${entry.item.href} uses ${entry.module}`).toBe(true);
    }
  });

  it('gives every item a label and a description', () => {
    for (const entry of BUILT_ITEMS) {
      expect(entry.item.label.length, entry.item.href).toBeGreaterThan(0);
      // The description is the collapsed tooltip and the accessible title. An empty one
      // makes a collapsed icon unlabelled.
      expect(entry.item.description.length, entry.item.href).toBeGreaterThan(0);
    }
  });

  it('has no duplicate labels', () => {
    const labels = BUILT_ITEMS.map((entry) => entry.item.label);

    expect(new Set(labels).size, labels.join(', ')).toBe(labels.length);
  });

  it('includes an overview at the root', () => {
    expect(BUILT_ITEMS.some((entry) => entry.item.href === '/')).toBe(true);
  });

  it('carries the group and module each item was flattened from', () => {
    // A flattened list is easy to build by hand and easy to get subtly wrong: an item
    // filed under the wrong group renders in the right sidebar with the wrong siblings.
    for (const entry of BUILT_ITEMS) {
      const menu = moduleMenu(entry.module);

      expect(menu, entry.module).toBeDefined();
      expect(menu?.groups, entry.module).toContain(entry.group);
      expect(entry.group.items, `${entry.item.href} in ${entry.group.label}`).toContainEqual(
        entry.item,
      );
    }
  });
});

describe('ROUTES', () => {
  it('is exactly the set of built item paths', () => {
    expect([...ROUTES].sort()).toEqual([...BUILT_ITEMS.map((e) => e.item.href)].sort());
  });

  it('holds no planned path, so no link can 404', () => {
    // The whole reason planned items are separated from built ones. If a planned item ever
    // acquired an href it would appear in this list and become a link to a missing page.
    const plannedWithHref = MODULE_MENUS.flatMap((entry) =>
      entry.groups.flatMap((group) =>
        group.items
          .filter((item) => item.status === 'planned')
          .map((item) => ({ path: item.href, label: item.label })),
      ),
    ).filter((item) => item.path !== undefined);

    expect(plannedWithHref).toEqual([]);
    expect(ROUTES).not.toContain(undefined);
  });
});

describe('MODULE_MENUS', () => {
  it('covers every module in the shared contract, in order', () => {
    // Derived, so a module added to the contract cannot be left out of the rail.
    expect(MODULE_MENUS.map((entry) => entry.module)).toEqual([...MODULE_IDS]);
  });

  it('gives every module a label and a description', () => {
    for (const entry of MODULE_MENUS) {
      expect(entry.label.length, entry.module).toBeGreaterThan(0);
      // The description is the rail tooltip and the sidebar footer text. An empty one
      // makes an unlabelled icon and an unexplained section.
      expect(entry.description.length, entry.module).toBeGreaterThan(0);
    }
  });

  it('has no duplicate labels', () => {
    const labels = MODULE_MENUS.map((entry) => entry.label);

    expect(new Set(labels).size, labels.join(', ')).toBe(labels.length);
  });

  it('gives every module at least one group', () => {
    // A module with no groups renders an empty sidebar, which looks like a bug rather
    // than like a module that has nothing built yet.
    for (const entry of MODULE_MENUS) {
      expect(entry.groups.length, entry.module).toBeGreaterThan(0);
    }
  });

  it('gives every group an id and a label, unique within its module', () => {
    // The id is the React key and the collapsible identity; a duplicate makes one
    // section's open state leak into another.
    for (const entry of MODULE_MENUS) {
      const ids = entry.groups.map((group) => group.id);

      for (const group of entry.groups) {
        expect(group.id.length, entry.module).toBeGreaterThan(0);
        expect(group.label.length, entry.module).toBeGreaterThan(0);
      }

      expect(new Set(ids).size, `${entry.module}: ${ids.join(', ')}`).toBe(ids.length);
    }
  });

  it('gives every group at least one item', () => {
    // An empty collapsible is a header that expands to nothing.
    for (const entry of MODULE_MENUS) {
      for (const group of entry.groups) {
        expect(group.items.length, `${entry.module}/${group.label}`).toBeGreaterThan(0);
      }
    }
  });

  it('gives every item a label, a description and a known status', () => {
    for (const entry of MODULE_MENUS) {
      for (const group of entry.groups) {
        for (const item of group.items) {
          expect(item.label.length, group.label).toBeGreaterThan(0);
          expect(item.description.length, `${group.label}/${item.label}`).toBeGreaterThan(0);
          expect(['built', 'planned'], `${group.label}/${item.label}`).toContain(item.status);
        }
      }
    }
  });

  it('has no duplicate href within a module', () => {
    // Two links to the same page in one sidebar make the active state ambiguous.
    for (const entry of MODULE_MENUS) {
      const hrefs = entry.groups
        .flatMap((group) => group.items)
        .map((item) => item.href)
        .filter((href) => href !== undefined);

      expect(new Set(hrefs).size, `${entry.module}: ${hrefs.join(', ')}`).toBe(hrefs.length);
    }
  });

  it('marks exactly the modules that have a route', () => {
    const withRoutes = new Set(BUILT_ITEMS.map((entry) => entry.module));

    for (const entry of MODULE_MENUS) {
      expect(entry.hasSurface, entry.module).toBe(withRoutes.has(entry.module));
    }
  });

  it('shows most modules as not yet built', () => {
    // The point of the rail is to be honest about scope. If everything reported a
    // surface, the strip would be decoration.
    expect(MODULE_MENUS.filter((entry) => !entry.hasSurface).length).toBeGreaterThan(0);
  });
});

describe('activeModule', () => {
  it('names the module that owns each built route', () => {
    for (const entry of BUILT_ITEMS) {
      expect(activeModule(entry.item.href), entry.item.href).toBe(entry.module);
    }
  });

  it('resolves a nested path to its containing module', () => {
    expect(activeModule('/employees/42')).toBe('M01_CORE_HR');
  });

  it('is null for a path outside every module', () => {
    // Not every page belongs to a module, and a rail that highlighted the wrong one would
    // be a lie about where the reader is.
    expect(activeModule('/nowhere')).toBeNull();
  });

  it('does not claim a module for a path that only shares a prefix', () => {
    expect(activeModule('/employees-archive')).toBeNull();
  });
});

describe('locatePath', () => {
  it('returns the containing group for a built route', () => {
    const located = locatePath('/employees');

    expect(located?.module).toBe('M01_CORE_HR');
    expect(located?.item.label).toBe('Employees');
  });

  it('is null where nothing matches', () => {
    expect(locatePath('/nowhere')).toBeNull();
  });
});

describe('isActiveRoute', () => {
  // The signature is (pathname, href): the page being viewed, then the entry's target.
  // Getting these the wrong way round still returns a boolean, so the mistake survives
  // a typecheck — several of these assertions passed for the wrong reason until the
  // order was fixed.
  it('is true for the exact path', () => {
    expect(isActiveRoute('/', '/')).toBe(true);
    expect(isActiveRoute('/employees', '/employees')).toBe(true);
  });

  it('is false for a different path', () => {
    expect(isActiveRoute('/employees', '/status')).toBe(false);
    expect(isActiveRoute('/employees', '/')).toBe(false);
  });

  it('matches a child path on a segment boundary', () => {
    expect(isActiveRoute('/employees/123', '/employees')).toBe(true);
    expect(isActiveRoute('/employees/123/edit', '/employees')).toBe(true);
  });

  it('does not match a path that merely shares a prefix', () => {
    // "/employees-archive" is a different page. A raw `startsWith` would light up the
    // employee directory while the reader is somewhere else entirely.
    expect(isActiveRoute('/employees-archive', '/employees')).toBe(false);
  });

  it('does not treat the root as active for every path', () => {
    expect(isActiveRoute('/employees', '/')).toBe(false);
    expect(isActiveRoute('/status', '/')).toBe(false);
  });

  it('is not symmetric, which is why argument order matters', () => {
    // A nested entry cannot be "active" for its own parent, or an entry added for a
    // detail route would light up the whole directory it sits inside.
    expect(isActiveRoute('/employees', '/employees/123')).toBe(false);
  });

  it('marks exactly one entry active for each navigable route', () => {
    for (const current of BUILT_ITEMS) {
      const active = BUILT_ITEMS.filter((entry) =>
        isActiveRoute(current.item.href, entry.item.href),
      );
      expect(active.length, current.item.href).toBe(1);
    }
  });
});

describe('breadcrumbTrail', () => {
  it('gives the root a single unlinked crumb', () => {
    // Not a link to "/" — the reader is on the root, so that control goes nowhere.
    expect(breadcrumbTrail('/')).toEqual([{ label: 'Overview' }]);
  });

  it('names a known single-level route', () => {
    expect(breadcrumbTrail('/employees')).toEqual([{ label: 'Employees' }]);
  });

  it('links only crumbs that correspond to a route that exists', () => {
    // A crumb is a link when its path is in ROUTES, and plain text otherwise. The
    // alternative — linking every intermediate segment — would put a link to
    // /employees/123 on screen, which is a 404 today. A dead link is worse than text.
    const trail = breadcrumbTrail('/employees/123/edit');
    const linked = trail.filter((crumb) => crumb.href !== undefined);

    expect(linked).toEqual([{ label: 'Employees', href: '/employees' }]);
  });

  it('prepends the module only on a path deeper than its own route', () => {
    // "Employees" is unambiguous on /employees; "Core HR / Employees" is noise. On a deep
    // link the module is the only thing telling the reader they are below the top level.
    expect(breadcrumbTrail('/employees')).toEqual([{ label: 'Employees' }]);
    expect(breadcrumbTrail('/employees/42')[0]).toEqual({ label: 'Core HR' });
  });

  it('never links the module crumb, which has no page of its own', () => {
    for (const path of ['/employees/42', '/status/deep/er']) {
      const first = breadcrumbTrail(path)[0];

      expect(first?.href, path).toBeUndefined();
    }
  });

  it('never links the crumb for the page being viewed', () => {
    // Linking the current page to itself is a dead control.
    for (const entry of BUILT_ITEMS) {
      const trail = breadcrumbTrail(entry.item.href);
      expect(trail[trail.length - 1]?.href, entry.item.href).toBeUndefined();
    }
  });

  it('links only to paths that are in ROUTES', () => {
    const known = new Set(ROUTES);

    for (const path of ['/employees', '/employees/123', '/a/b/c', '/status/deep/er']) {
      for (const crumb of breadcrumbTrail(path)) {
        if (crumb.href !== undefined) {
          expect(known.has(crumb.href), `${path} links to ${crumb.href}`).toBe(true);
        }
      }
    }
  });

  it('resolves a nested path to its known parent', () => {
    expect(breadcrumbTrail('/employees/123')).toEqual([
      { label: 'Core HR' },
      { label: 'Employees', href: '/employees' },
      { label: '123' },
    ]);
  });

  it('renders each segment of a deep unknown path', () => {
    // The module is omitted here: /a/b/c belongs to no module, and inventing one would
    // put a crumb on screen that points at nothing.
    expect(breadcrumbTrail('/a/b/c/edit')).toEqual([
      { label: 'A' },
      { label: 'B' },
      { label: 'C' },
      { label: 'Edit' },
    ]);
  });

  it('renders unknown segments rather than dropping them', () => {
    // A deep link with no navigation entry should still say where the reader is,
    // instead of looking like a top-level page.
    expect(breadcrumbTrail('/nowhere')).toEqual([{ label: 'Nowhere' }]);
    expect(breadcrumbTrail('/a/b/c')).toEqual([{ label: 'A' }, { label: 'B' }, { label: 'C' }]);
  });

  it('turns a dashed segment into title case', () => {
    expect(breadcrumbTrail('/payroll-runs')[0]?.label).toBe('Payroll Runs');
  });

  it('prefers a known label over the derived one', () => {
    expect(breadcrumbTrail('/status')[0]?.label).toBe('Health');
  });

  it('ignores surrounding whitespace', () => {
    expect(breadcrumbTrail('  /employees  ')).toEqual([{ label: 'Employees' }]);
  });

  it('ignores repeated and trailing slashes', () => {
    expect(breadcrumbTrail('//employees//')).toEqual([{ label: 'Employees' }]);
  });

  it('treats a path with no segments as the root', () => {
    // A blank or slash-only path has nowhere to be other than the overview, so it gets
    // the overview crumb rather than an empty trail that renders as nothing.
    const root = [{ label: 'Overview' }];

    expect(breadcrumbTrail('')).toEqual(root);
    expect(breadcrumbTrail('   ')).toEqual(root);
    expect(breadcrumbTrail('/')).toEqual(root);
  });

  it('produces a trail for every navigable route', () => {
    for (const entry of BUILT_ITEMS) {
      const trail = breadcrumbTrail(entry.item.href);

      expect(trail.length, entry.item.href).toBeGreaterThan(0);
      expect(
        trail.some((crumb) => crumb.label === entry.item.label),
        `${entry.item.href} should end at "${entry.item.label}"`,
      ).toBe(true);
    }
  });

  it('has one crumb per path segment, plus the module only when there is one', () => {
    // The count is a real invariant, not a formatting detail: a missing crumb hides where
    // the reader is, and a surplus one names a place that does not exist.
    for (const path of ['/', '/employees', '/employees/123', '/a/b/c/d']) {
      const segments = path.split('/').filter(Boolean).length;
      // The module crumb appears only on a path deeper than its own route, matching the
      // rule asserted above: /employees is one crumb, /employees/42 is two plus a module.
      const modulePrefix = segments > 1 && activeModule(path) !== null ? 1 : 0;
      const expected = path === '/' ? 1 : segments + modulePrefix;

      expect(breadcrumbTrail(path).length, path).toBe(expected);
    }
  });
});
