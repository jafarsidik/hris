'use client';

import * as React from 'react';
import { searchPeople, type PeopleSearchResult } from '@/app/employees/actions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { initialsFor } from '@/features/employees/employee-presentation';
import { BUILT_ITEMS, MODULE_MENUS, type ModuleId } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { CommandIcon, CornerDownLeft, History, ListPlus, SearchIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

const QUICK_ACTIONS = [
  {
    id: 'action:create',
    label: 'Add employee',
    description: 'Open the directory create form',
    href: '/employees?action=new',
    icon: ListPlus,
  },
  {
    id: 'action:directory',
    label: 'Browse directory',
    description: 'Search, filter and page employee records',
    href: '/employees',
    icon: SearchIcon,
  },
] as const;

const RECENT_STORAGE_KEY = 'hris:recent-searches';
const MAX_RECENT = 5;

type PersonItem = {
  readonly kind: 'person';
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly href: string;
  readonly initials: string;
};

type StaticItem = {
  readonly kind: 'action' | 'page' | 'recent';
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly href: string;
  readonly icon: LucideIcon;
};

type SelectableItem = PersonItem | StaticItem;

type PlannedItem = {
  readonly kind: 'planned';
  readonly label: string;
  readonly moduleLabel: string;
};

interface Section {
  readonly key: string;
  readonly label: string;
  readonly items: readonly (SelectableItem | PlannedItem)[];
}

const ICONS: Readonly<Record<ModuleId, LucideIcon>> = Object.fromEntries(
  MODULE_MENUS.map((entry) => [entry.module, entry.icon]),
) as unknown as Record<ModuleId, LucideIcon>;

const MODULE_LABELS: Readonly<Record<ModuleId, string>> = Object.fromEntries(
  MODULE_MENUS.map((entry) => [entry.module, entry.label]),
) as unknown as Record<ModuleId, string>;

/** Built href → owning module, derived once from the flattened list. */
const BY_MODULE: Readonly<Record<string, ModuleId>> = Object.fromEntries(
  BUILT_ITEMS.map(({ item, module }) => [item.href, module]),
) as unknown as Record<string, ModuleId>;

/** Reads recent searches from storage; never throws. */
const readRecentSearches = (): string[] => {
  try {
    const stored = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (stored === null) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string')
      ? parsed.slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
};

/**
 * The ⌘K command palette.
 *
 * Keyboard-first: ↑/↓ move the highlight, Enter navigates, Esc closes. Typing searches
 * people (via the directory's own filter, so a hit here is the same record the directory
 * would find) plus built pages and quick actions; planned menu items appear at the bottom
 * labelled "coming soon". Successful runs are remembered as recent searches for next time.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [highlight, setHighlight] = React.useState(0);
  const [people, setPeople] = React.useState<readonly PeopleSearchResult[]>([]);
  const [recent, setRecent] = React.useState<string[]>([]);
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setRecent(readRecentSearches());
  }, []);

  React.useEffect(() => {
    const needle = query.trim();
    if (needle === '') {
      setPeople([]);
      return undefined;
    }

    // Debounced so each keystroke does not fire a server round-trip. The `cancelled`
    // guard also drops out-of-order responses, so a slow earlier query cannot overwrite a
    // later one.
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      searchPeople(needle)
        .then((matches) => {
          if (!cancelled) setPeople(matches);
        })
        .catch(() => {
          if (!cancelled) setPeople([]);
        });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [query]);

  React.useEffect(() => {
    if (!open) return undefined;
    // Focusing after the dialog mounts means the first keystroke lands in the box
    // without depending on the `autoFocus` attribute, which also dodges a bad UX for
    // screen reader users who tab in with the palette already open.
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const needle = query.trim().toLowerCase();
  const matches = (...values: readonly string[]) =>
    needle === '' || values.some((value) => value.toLowerCase().includes(needle));

  const matchedActions: StaticItem[] = QUICK_ACTIONS.filter((action) =>
    matches(action.label, action.description),
  ).map((action) => ({ kind: 'action', ...action }));

  const matchedPages: StaticItem[] = BUILT_ITEMS.filter(({ item, group, module }) =>
    matches(item.label, item.description ?? '', group.label, MODULE_LABELS[module]),
  ).map(({ item, group }) => {
    // Captured before the narrowing so the index into `ICONS` is guarded once, not
    // re-read through a computed key that TypeScript cannot constant-fold.
    const ownerModule = BY_MODULE[item.href];

    return {
      kind: 'page' as const,
      id: item.href,
      label: item.label,
      description: item.description ?? group.label,
      href: item.href,
      icon: ownerModule !== undefined ? ICONS[ownerModule] : SearchIcon,
    };
  });

  const planned: PlannedItem[] =
    needle === ''
      ? []
      : MODULE_MENUS.flatMap((entry) =>
          entry.groups.flatMap((group) =>
            group.items
              .filter((item) => item.status === 'planned')
              .map((item) => ({
                kind: 'planned' as const,
                label: item.label,
                moduleLabel: MODULE_LABELS[entry.module],
              })),
          ),
        ).filter((entry) => matches(entry.label, entry.moduleLabel));

  const recentItems: StaticItem[] = recent.map((search) => ({
    kind: 'recent',
    id: `recent:${search}`,
    label: search,
    description: 'Jump to the filtered directory',
    href: `/employees?search=${encodeURIComponent(search)}`,
    icon: History,
  }));

  const personItems: PersonItem[] = people.map((person) => ({
    kind: 'person',
    id: person.id,
    label: person.fullName,
    description: `${person.email} · ${person.department}`,
    href: `/employees/${person.id}`,
    initials: initialsFor(person.fullName),
  }));

  const sections: Section[] = [];
  if (needle === '') {
    if (recentItems.length > 0) {
      sections.push({ key: 'recent', label: 'Recent searches', items: recentItems });
    }
    sections.push({ key: 'actions', label: 'Quick actions', items: matchedActions });
    sections.push({ key: 'pages', label: 'Pages', items: matchedPages });
  } else {
    if (personItems.length > 0) {
      sections.push({ key: 'people', label: 'People', items: personItems });
    }
    sections.push({ key: 'actions', label: 'Quick actions', items: matchedActions });
    sections.push({ key: 'pages', label: 'Pages', items: matchedPages });
  }
  if (planned.length > 0) {
    sections.push({ key: 'planned', label: 'Coming soon', items: planned });
  }

  const flat = sections.flatMap((section) => section.items);
  const count = flat.length;

  const close = () => {
    setOpen(false);
    setHighlight(0);
  };

  const remember = () => {
    const trimmed = query.trim();
    if (trimmed === '') return;
    setRecent((current) => {
      const next = [trimmed, ...current.filter((entry) => entry !== trimmed)].slice(0, MAX_RECENT);
      try {
        window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Session-only.
      }
      return next;
    });
  };

  const run = (item: SelectableItem) => {
    remember();
    close();
    router.push(item.href);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((current) => (count === 0 ? 0 : (current + 1) % count));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((current) => (count === 0 ? 0 : (current - 1 + count) % count));
    } else if (event.key === 'Enter') {
      const target = flat[highlight];
      if (target !== undefined && target.kind !== 'planned') run(target);
    }
  };

  React.useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-highlighted="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  const renderItem = (item: SelectableItem | PlannedItem, index: number): React.ReactElement => {
    const highlighted = index === highlight;

    if (item.kind === 'planned') {
      return (
        <li key={`planned-${item.label}`}>
          <button
            type="button"
            data-highlighted={highlighted}
            disabled
            onMouseMove={() => setHighlight(index)}
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm"
          >
            <span
              aria-hidden="true"
              className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"
            >
              <CommandIcon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-muted-foreground">{item.label}</span>
              <span className="block truncate text-xs text-muted-foreground/70">
                Coming soon · {item.moduleLabel}
              </span>
            </span>
          </button>
        </li>
      );
    }

    if (item.kind === 'person') {
      return (
        <li key={item.id}>
          <button
            id={`command-result-${index}`}
            type="button"
            data-highlighted={highlighted}
            onClick={() => run(item)}
            onMouseMove={() => setHighlight(index)}
            className={cn(
              'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm',
              highlighted ? 'bg-primary text-primary-foreground' : 'text-foreground',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'grid size-7 shrink-0 place-items-center rounded-md',
                highlighted
                  ? 'bg-primary-foreground/15 text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              <Avatar className="size-6">
                <AvatarFallback className="bg-transparent text-[11px] font-medium">
                  {item.initials}
                </AvatarFallback>
              </Avatar>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{item.label}</span>
              <span
                className={cn(
                  'block truncate text-xs',
                  highlighted ? 'text-primary-foreground/80' : 'text-muted-foreground',
                )}
              >
                {item.description}
              </span>
            </span>
            {highlighted && (
              <CornerDownLeft
                aria-hidden="true"
                className={cn('size-3.5 shrink-0', highlighted && 'text-primary-foreground/70')}
              />
            )}
          </button>
        </li>
      );
    }

    const Icon = item.icon;
    return (
      <li key={item.id}>
        <button
          id={`command-result-${index}`}
          type="button"
          data-highlighted={highlighted}
          onClick={() => run(item)}
          onMouseMove={() => setHighlight(index)}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm',
            highlighted ? 'bg-primary text-primary-foreground' : 'text-foreground',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'grid size-7 shrink-0 place-items-center rounded-md',
              highlighted
                ? 'bg-primary-foreground/15 text-primary-foreground'
                : 'bg-muted text-muted-foreground',
            )}
          >
            <Icon className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{item.label}</span>
            <span
              className={cn(
                'block truncate text-xs',
                highlighted ? 'text-primary-foreground/80' : 'text-muted-foreground',
              )}
            >
              {item.description}
            </span>
          </span>
          {highlighted && (
            <CornerDownLeft
              aria-hidden="true"
              className={cn('size-3.5 shrink-0', highlighted && 'text-primary-foreground/70')}
            />
          )}
        </button>
      </li>
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search the workspace"
        className="flex h-8 w-8 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-muted/60 text-muted-foreground transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none sm:h-7 sm:w-56 sm:justify-start sm:px-2"
      >
        <SearchIcon aria-hidden="true" className="size-4 shrink-0 sm:size-3.5" />
        <span className="hidden truncate sm:block">Search…</span>
        <kbd
          aria-hidden="true"
          className="ml-auto hidden shrink-0 items-center gap-0.5 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:flex"
        >
          <CommandIcon className="size-3" />K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[18%] gap-0 p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogDescription className="sr-only">
            Find employees, jump to a page or a quick action, or see what is planned.
          </DialogDescription>

          <div className="flex items-center gap-2 border-b border-border px-3">
            <SearchIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlight(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search employees, pages and actions…"
              aria-activedescendant={count > 0 ? `command-result-${highlight}` : undefined}
              role="combobox"
              aria-expanded="true"
              aria-controls="command-results"
              aria-label="Search"
              className="h-11 flex-1 border-transparent bg-transparent shadow-none focus-visible:border-transparent focus-visible:ring-0"
            />
            <kbd
              aria-hidden="true"
              className="hidden shrink-0 items-center rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:flex"
            >
              Esc
            </kbd>
          </div>

          <div ref={listRef} id="command-results" className="max-h-80 overflow-y-auto p-1.5">
            {count === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                {query.trim() === ''
                  ? 'Type to search employees, pages and actions.'
                  : `Nothing matches "${query}".`}
              </p>
            ) : (
              sections.map((section) => {
                let index = 0;
                return (
                  <div key={section.key}>
                    <p className="px-2 pb-1 pt-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {section.label}
                    </p>
                    <ul>
                      {section.items.map((item) => {
                        const current = index;
                        index += 1;
                        return renderItem(item, current);
                      })}
                    </ul>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
