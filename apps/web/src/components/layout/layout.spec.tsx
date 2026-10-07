import { fireEvent, render, screen, within } from '@testing-library/react';
import { MODULE_IDS } from '@hris/shared-types';
import { describe, expect, it, vi } from 'vitest';

import { BUILT_ITEMS, ROUTES, moduleLabel, type ModuleId } from '@/lib/navigation';

import { AppShell } from './app-shell';
import { BreadcrumbTrail } from './breadcrumb-trail';
import { PageHeader } from './page-header';

/**
 * The shell is a client component, so it is tested as one.
 *
 * `next/navigation` is mocked rather than a router, because the components only read the
 * pathname. Mocking the module also lets a test set the current route, which is the input
 * every active-state assertion depends on.
 */
const pathname = vi.hoisted(() => ({ current: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

/**
 * Mirrors `hasSurface`, computed independently so the two can disagree.
 *
 * Typed as `ModuleId` rather than `string` on purpose: widening it would let a typo pass
 * as a module that is simply unbuilt, which is exactly the kind of failure these
 * assertions exist to catch.
 */
const hasSurface = (moduleId: ModuleId) => BUILT_ITEMS.some((entry) => entry.module === moduleId);

/**
 * The rail is the navigation landmark; the tree beside it is scoped to one module.
 * Both are always rendered, so a test must address them by name rather than position.
 */
const rail = () => screen.getByRole('navigation', { name: 'Modules' });
const tree = () => screen.getByRole('navigation', { name: /menus$/i });

const moduleButton = (moduleId: ModuleId) =>
  within(rail()).getByRole('button', { name: new RegExp(`^${moduleLabel(moduleId)}[.]`, 'i') });

const renderShell = () => render(<AppShell>{<p>content</p>}</AppShell>);

describe('ModuleRail', () => {
  it('labels the module landmark', () => {
    pathname.current = '/';
    renderShell();

    // A strip of icon buttons with no landmark is announced as an unlabelled group.
    expect(rail()).toBeInTheDocument();
  });

  it('offers every module in the shared contract', () => {
    pathname.current = '/';
    renderShell();

    // A module silently missing from the rail is a capability the product stops
    // advertising, with no error anywhere.
    for (const moduleId of MODULE_IDS) {
      expect(moduleButton(moduleId), moduleId).toBeInTheDocument();
    }
  });

  it('names each module in words, not by icon alone', () => {
    pathname.current = '/';
    renderShell();

    // Icons are aria-hidden, so the accessible name is the only thing left. An empty name
    // makes the rail unusable with a screen reader.
    for (const moduleId of MODULE_IDS) {
      expect(moduleButton(moduleId)).toHaveAccessibleName(
        expect.stringContaining(moduleLabel(moduleId)) as unknown as string,
      );
    }
  });

  it('marks exactly the module owning the current route', () => {
    pathname.current = '/employees';
    renderShell();

    const current = within(rail()).getAllByRole('button', { current: 'page' });

    expect(current).toHaveLength(1);
    expect(moduleButton('M01_CORE_HR')).toHaveAttribute('aria-current', 'page');
  });

  it('marks no module current on a route outside the platform', () => {
    pathname.current = '/somewhere-else';
    renderShell();

    // Claiming a module the reader is not in would misstate where they are.
    expect(within(rail()).queryAllByRole('button', { current: 'page' })).toHaveLength(0);
  });

  it('opens the selected module, which is also the current one on arrival', () => {
    pathname.current = '/employees';
    renderShell();

    expect(moduleButton('M01_CORE_HR')).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks not-yet-built modules by outline, not only by dimming', () => {
    pathname.current = '/';
    renderShell();

    // "Not built" is a different fact from "available". Reduced opacity does not say which,
    // so the dashed outline carries it and `hasSurface` is what it is derived from.
    const unbuilt = MODULE_IDS.filter((moduleId) => !hasSurface(moduleId));

    expect(unbuilt.length).toBeGreaterThan(0);
    for (const moduleId of unbuilt) {
      expect(moduleButton(moduleId).className, moduleId).toContain('border-dashed');
    }
  });

  it('gives built modules no dashed outline', () => {
    pathname.current = '/';
    renderShell();

    for (const moduleId of MODULE_IDS.filter(hasSurface)) {
      expect(moduleButton(moduleId).className, moduleId).not.toContain('border-dashed');
    }
  });
});

describe('SidebarTree', () => {
  it('names its landmark after the module it is showing', () => {
    pathname.current = '/employees';
    renderShell();

    // Two navigation landmarks that are both "primary" are announced ambiguously.
    expect(tree()).toHaveAccessibleName('Core HR menus');
  });

  it('shows the menus of the module owning the current route', () => {
    pathname.current = '/employees';
    renderShell();

    expect(within(tree()).getByText('Workforce')).toBeInTheDocument();
    expect(within(tree()).getByRole('link', { name: /employees/i })).toBeInTheDocument();
  });

  it('expands the group holding the current page', () => {
    pathname.current = '/employees';
    renderShell();

    // Collapsed by default would leave the reader on a page with no visible entry for it.
    // `getByRole` ignores hidden content, so this asserts the items are really shown.
    expect(within(tree()).getByRole('link', { name: /employees/i })).toBeVisible();
  });

  it('collapses groups that do not hold the current page', () => {
    pathname.current = '/employees';
    renderShell();

    expect(within(tree()).queryByRole('link', { name: /payroll runs/i })).not.toBeInTheDocument();
  });

  it('marks the current route with aria-current', () => {
    pathname.current = '/employees';
    renderShell();

    expect(within(tree()).getByRole('link', { name: /employees/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('keeps a parent route active while a child route is open', () => {
    pathname.current = '/employees/42';
    renderShell();

    expect(within(tree()).getByRole('link', { name: /employees/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('renders planned items as text, never as links', () => {
    pathname.current = '/employees';
    renderShell();

    // Only routes that exist are navigable. A link to a planned screen is a 404 that looks
    // like a working feature.
    for (const name of [/payroll runs/i, /headcount/i]) {
      const element = within(tree()).queryByRole('link', { name });

      if (element !== null) {
        expect(element, 'planned item must not be a link').toBeNull();
      }
    }
  });

  it('says in words that a planned item is not built', () => {
    pathname.current = '/employees';
    renderShell();

    // The explanation is visible text, not a tooltip on a disabled control: a disabled
    // element cannot be focused and a tooltip never appears on it, so the state was
    // previously unreachable for exactly the entries that needed saying.
    const planned = within(tree()).getAllByText(/planned/);

    expect(planned.length).toBeGreaterThan(0);
  });

  it('counts the planned items in the group header', () => {
    pathname.current = '/employees';
    renderShell();

    // A header that says how much is left to build is the difference between a roadmap
    // and a list of greyed-out rows. Scoped to the group holding the current page: other
    // groups carry the same count, so a bare text match would be ambiguous.
    expect(within(tree()).getByRole('button', { name: /^Workforce/ })).toHaveTextContent(
      '4 planned',
    );
  });

  it('links only to routes that exist', () => {
    pathname.current = '/';
    renderShell();

    for (const link of screen.getAllByRole('link')) {
      const href = link.getAttribute('href') ?? '';

      if (href === '' || href.startsWith('#')) {
        continue; // In-page and placeholder links, not navigation.
      }

      expect([...ROUTES], link.textContent ?? '').toContain(href);
    }
  });

  it('gives a planned item no href at all', () => {
    pathname.current = '/employees';
    renderShell();

    // The failure this guards against is a link that renders fine and 404s when clicked.
    // `href` absent is the only state that cannot be clicked by accident.
    // `closest('a')` returning null is the assertion: an anchor without an href is not a
    // link, has no link role, and silently drops its text from the accessibility tree.
    const planned = within(tree()).getByText('Employee Directory');

    expect(planned.closest('a')).toBeNull();
    expect(planned.closest('[data-slot="sidebar-menu-sub-button"]')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('marks planned items in the accessible name, not only in colour', () => {
    pathname.current = '/employees';
    renderShell();

    // Read as text within the tree, not lifted from `title`.
    expect(
      within(tree())
        .getByText('Employee Directory')
        .closest('[data-slot="sidebar-menu-sub-button"]'),
    ).toHaveTextContent('planned, not built yet');
  });
});

describe('module selection', () => {
  it('scopes the sidebar to the module chosen in the rail', () => {
    pathname.current = '/';
    renderShell();

    expect(tree()).toHaveAccessibleName('Platform menus');

    fireEvent.click(moduleButton('M01_CORE_HR'));

    expect(tree()).toHaveAccessibleName('Core HR menus');
    expect(within(tree()).getByText('Workforce')).toBeInTheDocument();
    expect(within(tree()).queryByRole('link', { name: /employees/i })).not.toBeInTheDocument();
  });

  it('marks the chosen module pressed and leaves the current one marked current', () => {
    pathname.current = '/';
    renderShell();

    fireEvent.click(moduleButton('M06_PAYROLL'));

    // Browsing a module is not navigating to it. Collapsing these two states would make
    // looking at a module look like going there.
    expect(moduleButton('M06_PAYROLL')).toHaveAttribute('aria-pressed', 'true');
    expect(moduleButton('M06_PAYROLL')).not.toHaveAttribute('aria-current');
    expect(moduleButton('PLATFORM')).toHaveAttribute('aria-current', 'page');
  });

  it('reopens the group holding the current page after switching back', () => {
    pathname.current = '/employees';
    renderShell();

    fireEvent.click(moduleButton('M06_PAYROLL'));
    fireEvent.click(moduleButton('M01_CORE_HR'));

    // The group is mounted collapsed when its module is not shown, so returning to the
    // current module must not land the reader on a collapsed section.
    expect(within(tree()).getByRole('link', { name: /employees/i })).toBeVisible();
  });

  it('hides a group when it is collapsed and shows it again when reopened', () => {
    pathname.current = '/employees';
    renderShell();

    const workforce = within(tree()).getByRole('button', { name: /^Workforce/ });

    expect(workforce).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(workforce);
    expect(within(tree()).queryByRole('link', { name: /employees/i })).not.toBeInTheDocument();

    fireEvent.click(workforce);
    expect(within(tree()).getByRole('link', { name: /employees/i })).toBeVisible();
  });

  it('opens a group that was closed when its module was not in view', () => {
    pathname.current = '/';
    renderShell();

    // `Workforce` holds nothing that is the current page, so it mounts closed. Opening it is
    // then the reader's only route into its menus, which is the point of the group.
    fireEvent.click(moduleButton('M01_CORE_HR'));

    const workforce = within(tree()).getByRole('button', { name: /^Workforce/ });
    expect(workforce).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(workforce);

    expect(within(tree()).getByRole('link', { name: /employees/i })).toBeVisible();
  });
});
describe('BreadcrumbTrail', () => {
  it('names the current page with aria-current', () => {
    pathname.current = '/employees';
    render(<BreadcrumbTrail />);

    expect(screen.getByRole('link', { name: 'Employees' })).toHaveAttribute('aria-current', 'page');
  });

  it('marks the current page as not a link', () => {
    pathname.current = '/employees';
    render(<BreadcrumbTrail />);

    // The page you are on should not be a control that navigates to itself.
    const current = screen.getByRole('link', { name: 'Employees' });
    expect(current).toHaveAttribute('aria-disabled', 'true');
    expect(current).not.toHaveAttribute('href');
  });

  it('links an ancestor crumb', () => {
    pathname.current = '/employees/42';
    render(<BreadcrumbTrail />);

    expect(screen.getByRole('link', { name: 'Employees' })).toHaveAttribute('href', '/employees');
  });

  it('shows a single unlinked crumb at the root', () => {
    // "Overview" with no link: the reader is on it, so a link would go nowhere. It is
    // still worth naming, so the header does not collapse to an empty strip.
    pathname.current = '/';
    render(<BreadcrumbTrail />);

    const current = screen.getByRole('link', { name: 'Overview' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).not.toHaveAttribute('href');
  });

  it('links no crumb when there is nowhere above to go', () => {
    pathname.current = '/';
    render(<BreadcrumbTrail />);

    expect(screen.queryAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Overview' }).hasAttribute('href')).toBe(false);
  });

  it('keeps separators as siblings of items, never children', () => {
    // Both `BreadcrumbItem` and `BreadcrumbSeparator` render an `<li>`. A separator
    // nested inside an item is `<li>` within `<li>`, which React rejects outright and
    // which the browser repairs differently from React's output — a hydration error that
    // only appears in the console, never in a failing assertion.
    pathname.current = '/employees/42/edit';
    const { container } = render(<BreadcrumbTrail />);

    const list = container.querySelector('[data-slot="breadcrumb-list"]');
    expect(list).not.toBeNull();

    const items = container.querySelectorAll('[data-slot="breadcrumb-item"]');
    const separators = container.querySelectorAll('[data-slot="breadcrumb-separator"]');

    // Module, Employees, 42, Edit — the module crumb appears because this path is deeper
    // than its own route.
    expect(items).toHaveLength(4);
    // One fewer separator than items: no trailing separator.
    expect(separators).toHaveLength(3);

    for (const item of items) {
      expect(item.parentElement, 'item must sit directly in the list').toBe(list);
      expect(item.querySelector('li'), 'item must not contain a list item').toBeNull();
    }
  });

  it('renders every crumb as a direct child of the list', () => {
    pathname.current = '/employees/42';
    const { container } = render(<BreadcrumbTrail />);

    const list = container.querySelector('[data-slot="breadcrumb-list"]');
    const children = [...(list?.children ?? [])] as HTMLElement[];

    // Only items and separators, in order, interleaved.
    expect(children.every((child) => child.tagName === 'LI')).toBe(true);
    // Module, Employees, 42.
    expect(children.filter((child) => child.dataset.slot === 'breadcrumb-item')).toHaveLength(3);
  });

  it('renders every segment of an unknown path, linking only the last as current', () => {
    pathname.current = '/nowhere/at/all';
    const { container } = render(<BreadcrumbTrail />);

    // Three segments, three items. None is a link because none is in NAVIGATION; only the
    // final one is marked as the current page.
    expect(container.querySelectorAll('[data-slot="breadcrumb-item"]')).toHaveLength(3);
    expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1);
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('All');
  });

  it('exposes exactly one breadcrumb landmark', () => {
    pathname.current = '/employees/42';
    render(<BreadcrumbTrail />);

    // Two nested nav landmarks are invalid markup and are announced ambiguously.
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
  });
});

describe('PageHeader', () => {
  it('renders the title as the page heading', () => {
    render(<PageHeader title="Employees" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Employees' })).toBeInTheDocument();
  });

  it('renders a description when given one', () => {
    render(<PageHeader title="Employees" description="Search the directory." />);

    expect(screen.getByText('Search the directory.')).toBeInTheDocument();
  });

  it('omits the description paragraph when there is none', () => {
    render(<PageHeader title="Employees" />);

    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument();
  });

  it('renders actions alongside the title', () => {
    render(<PageHeader title="Employees" actions={<button type="button">Add employee</button>} />);

    expect(screen.getByRole('button', { name: 'Add employee' })).toBeInTheDocument();
  });
});
