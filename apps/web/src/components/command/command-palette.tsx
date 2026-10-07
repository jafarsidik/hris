'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { BUILT_ITEMS, MODULE_MENUS, type ModuleId } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { ListPlus, SearchIcon, CommandIcon, CornerDownLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

const QUICK_ACTIONS = [
  {
    id: 'action:create',
    label: 'Add employee',
    description: 'Open the directory create form',
    href: '/employees?action=new',
  },
  {
    id: 'action:directory',
    label: 'Browse directory',
    description: 'Search, filter and page employee records',
    href: '/employees',
  },
] as const;

type Result =
  | { kind: 'action'; id: string; label: string; description: string; href: string }
  | {
      kind: 'page';
      id: string;
      label: string;
      description: string;
      href: string;
      moduleLabel: string;
    };

interface PlannedEntry {
  label: string;
  moduleLabel: string;
}

const ICONS: Readonly<Record<ModuleId, React.ComponentType<{ className?: string }>>> =
  Object.fromEntries(MODULE_MENUS.map((entry) => [entry.module, entry.icon])) as unknown as Record<
    ModuleId,
    React.ComponentType<{ className?: string }>
  >;

const MODULE_LABELS: Readonly<Record<ModuleId, string>> = Object.fromEntries(
  MODULE_MENUS.map((entry) => [entry.module, entry.label]),
) as unknown as Record<ModuleId, string>;

function planResults(raw: string): { results: Result[]; planned: PlannedEntry[] } {
  const needle = raw.trim().toLowerCase();
  const matches = (...values: readonly string[]) =>
    needle === '' || values.some((value) => value.toLowerCase().includes(needle));

  const results: Result[] = [
    ...QUICK_ACTIONS.filter((action) => matches(action.label, action.description)).map<Result>(
      (action) => ({ kind: 'action', ...action }),
    ),
    ...BUILT_ITEMS.filter(({ item, group, module }) =>
      matches(item.label, item.description ?? '', group.label, MODULE_LABELS[module]),
    ).map<Result>(({ item, group, module }) => ({
      kind: 'page',
      id: item.href,
      label: item.label,
      description: item.description ?? group.label,
      href: item.href,
      moduleLabel: MODULE_LABELS[module],
    })),
  ];

  const planned: PlannedEntry[] =
    needle === ''
      ? []
      : MODULE_MENUS.flatMap((entry) =>
          entry.groups.flatMap((group) =>
            group.items
              .filter((item) => item.status === 'planned')
              .map((item) => ({
                label: item.label,
                moduleLabel: MODULE_LABELS[entry.module],
              })),
          ),
        ).filter((entry) => matches(entry.label, entry.moduleLabel));

  return { results, planned };
}

/**
 * The ⌘K command palette.
 *
 * A runner for the built pages plus quick actions. Keyboard-first: ↑/↓ move the
 * highlight, Enter navigates, Esc closes, and the shortcut badge shows the opener.
 * Planned menu items appear at the bottom once typing — labelled "coming soon" — so the
 * palette also reads as a map of the roadmap, not just a search box for what exists.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [highlight, setHighlight] = React.useState(0);
  const listRef = React.useRef<HTMLUListElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

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

  const { results, planned } = planResults(query);
  const count = results.length + planned.length;

  const close = () => {
    setOpen(false);
    setHighlight(0);
  };

  const run = (result: Result) => {
    if (result.kind === 'action' && result.href === '') return;
    close();
    router.push(result.href);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((current) => (count === 0 ? 0 : (current + 1) % count));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((current) => (count === 0 ? 0 : (current - 1 + count) % count));
    } else if (event.key === 'Enter') {
      const target = [...results, ...planned].filter((entry): entry is Result => 'href' in entry)[
        highlight
      ];
      if (target !== undefined) run(target);
    }
  };

  React.useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-highlighted="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

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
            Jump to a page or a quick action, or see what is planned.
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
              placeholder="Search pages and actions…"
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

          <div id="command-results" className="max-h-80 overflow-y-auto p-1.5">
            {results.length === 0 && planned.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                {query.trim() === ''
                  ? 'Type to search built pages and quick actions.'
                  : `Nothing matches "${query}".`}
              </p>
            ) : (
              <ul ref={listRef}>
                {results.map((result, index) => {
                  const moduleId = result.kind === 'page' ? BY_MODULE[result.href] : undefined;
                  const Icon =
                    result.kind === 'page'
                      ? ((moduleId !== undefined ? ICONS[moduleId] : undefined) ?? SearchIcon)
                      : ListPlus;
                  const highlighted = index === highlight;
                  return (
                    <li key={result.id}>
                      <button
                        id={`command-result-${index}`}
                        type="button"
                        data-highlighted={highlighted}
                        onClick={() => run(result)}
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
                          <span className="block truncate font-medium">{result.label}</span>
                          <span
                            className={cn(
                              'block truncate text-xs',
                              highlighted ? 'text-primary-foreground/80' : 'text-muted-foreground',
                            )}
                          >
                            {result.description}
                          </span>
                        </span>
                        {highlighted && (
                          <CornerDownLeft
                            aria-hidden="true"
                            className={cn(
                              'size-3.5 shrink-0',
                              highlighted && 'text-primary-foreground/70',
                            )}
                          />
                        )}
                      </button>
                    </li>
                  );
                })}

                {planned.map((entry, index) => {
                  const resultIndex = results.length + index;
                  const highlighted = resultIndex === highlight;
                  return (
                    <li key={`planned-${entry.label}`}>
                      <button
                        type="button"
                        data-highlighted={highlighted}
                        disabled
                        onMouseMove={() => setHighlight(resultIndex)}
                        className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm"
                      >
                        <span
                          aria-hidden="true"
                          className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"
                        >
                          <CommandIcon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-muted-foreground">
                            {entry.label}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground/70">
                            Coming soon · {entry.moduleLabel}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Built href → owning module, derived once from the flattened list. */
const BY_MODULE: Readonly<Record<string, ModuleId>> = Object.fromEntries(
  BUILT_ITEMS.map(({ item, module }) => [item.href, module]),
) as unknown as Record<string, ModuleId>;
