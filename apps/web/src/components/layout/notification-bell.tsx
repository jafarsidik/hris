'use client';

import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { loadNotifications, type DerivedNotification } from '@/app/notifications/actions';
import { BellIcon, CheckCheck, Info, TriangleAlert, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const READ_STORAGE_KEY = 'hris:read-notifications';

/** The bell icon per notification kind. */
const KIND_ICONS: Readonly<Record<DerivedNotification['kind'], typeof Info>> = {
  warning: TriangleAlert,
  success: UserRound,
  info: Info,
};

/**
 * The notification bell in the header.
 *
 * Nothing in the platform emits events yet, so the bell derives what it can from the
 * directory — on leave, probation, confirmation windows, recent joiners — which are real
 * facts about the same data the other screens show. "Mark as read" is local to this
 * browser, because there is no inbox to persist reading state against yet; the footnote
 * says where the real workflow alerts will come from.
 */
export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = React.useState<readonly DerivedNotification[] | null>(null);
  const [read, setRead] = React.useState<ReadonlySet<string>>(new Set());

  React.useEffect(() => {
    let cancelled = false;

    loadNotifications()
      .then((next) => {
        if (cancelled) return;
        setItems(next);
      })
      .catch(() => {
        // The bell degrades to its empty state rather than breaking the shell; a failed
        // notification fetch is not a reason to take down the header.
        if (!cancelled) setItems([]);
      });

    try {
      const stored = window.localStorage.getItem(READ_STORAGE_KEY);
      if (stored !== null) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string')) {
          setRead(new Set(parsed));
        }
      }
    } catch {
      // Unreadable or absent storage; start fresh.
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const resolved = items ?? [];
  const unread = resolved.filter((item) => !read.has(item.id)).length;

  const markAllRead = () => {
    const next = new Set(resolved.map((item) => item.id));
    setRead(next);
    try {
      window.localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // Session-only read state.
    }
  };

  const openNotification = (item: DerivedNotification) => {
    if (item.href === undefined) return;
    setRead((current) => new Set(current).add(item.id));
    router.push(item.href);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={
              unread > 0 ? `Notifications, ${unread} unread` : 'Notifications, no unread items'
            }
            className="relative grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 outline-none"
          />
        }
      >
        <BellIcon aria-hidden="true" className="size-4" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-0.5 top-0.5 grid min-w-[1rem] place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground tabular-nums"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between pe-1 ps-1">
          <span className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
            Notifications
          </span>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CheckCheck aria-hidden="true" className="size-3.5" />
              Mark all as read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />

        {resolved.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <BellIcon aria-hidden="true" className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">You&apos;re all caught up</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Workflow, approval and payroll alerts will land here as modules ship.
            </p>
          </div>
        ) : (
          <>
            <div className="max-h-80 overflow-y-auto">
              {resolved.map((item) => {
                const Icon = KIND_ICONS[item.kind] ?? Info;
                const isRead = read.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={item.href === undefined}
                    onClick={() => openNotification(item)}
                    className={cn(
                      'flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors',
                      !isRead && 'bg-muted/40',
                      item.href !== undefined && 'hover:bg-muted',
                      'disabled:cursor-default',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-0.5 grid size-7 shrink-0 place-items-center rounded-md',
                        item.kind === 'warning'
                          ? 'bg-warning/10 text-warning'
                          : item.kind === 'success'
                            ? 'bg-success/10 text-success'
                            : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block truncate text-sm font-medium',
                          isRead && 'font-normal text-muted-foreground',
                        )}
                      >
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                    {!isRead && (
                      <span
                        aria-label="Unread"
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <DropdownMenuSeparator />
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Derived from sample data. Workflow and approval alerts land here when those modules
              ship.
            </p>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
