'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

export interface ProfileTab {
  readonly value: string;
  readonly label: string;
  /** The already-rendered panel content (server components may fill this). */
  readonly content: React.ReactNode;
}

/**
 * The profile's own underlined section bar.
 *
 * Dedicated markup instead of the shared pill `Tabs` because the reference
 * layout wants a full-width hairline bar with text tabs whose active state is
 * a 2px underline — a shape the shared component's pill list does not give
 * while keeping keyboard behaviour trivially correct.
 */
export function ProfileTabs({ tabs }: { tabs: readonly ProfileTab[] }) {
  const [active, setActive] = React.useState<string>(tabs[0]?.value ?? 'overview');

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (direction === 0) {
      return;
    }
    const next = (index + direction + tabs.length) % tabs.length;
    const nextTab = tabs[next];
    if (nextTab !== undefined) {
      setActive(nextTab.value);
    }
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Employee sections"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`profile-tab-${tab.value}`}
            aria-controls={`profile-panel-${tab.value}`}
            aria-selected={tab.value === active}
            tabIndex={tab.value === active ? 0 : -1}
            onClick={() => setActive(tab.value)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
            className={cn(
              '-mb-px flex-none border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
              tab.value === active
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.value}
          id={`profile-panel-${tab.value}`}
          role="tabpanel"
          aria-labelledby={`profile-tab-${tab.value}`}
          hidden={tab.value !== active}
          className="pt-5"
          tabIndex={tab.value === active ? 0 : undefined}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
