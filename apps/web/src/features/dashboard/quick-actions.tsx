import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, ListPlus, Search } from 'lucide-react';
import Link from 'next/link';

const ACTIONS = [
  {
    href: '/employees?action=new',
    label: 'Add employee',
    description: 'Open the directory create form',
    icon: ListPlus,
  },
  {
    href: '/employees',
    label: 'Browse directory',
    description: 'Search, filter and page records',
    icon: Search,
  },
  {
    href: '#foundation',
    label: 'Module roadmap',
    description: 'What ships and what comes next',
    icon: ArrowRight,
  },
] as const;

/**
 * The three next action links a command-center user reaches for.
 *
 * Plain links rather than a bespoke widget: each leads somewhere real (the directory or
 * the foundation accordion on this page), so there is nothing to wire up that a routing
 * test does not already cover.
 */
export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Quick actions</h2>
        </CardTitle>
        <CardDescription>Start a task from here</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {ACTIONS.map(({ href, label, description, icon: Icon }) => (
          <Button
            key={href}
            variant="outline"
            render={<Link href={href} />}
            className="h-auto w-full justify-between gap-3 py-2.5"
          >
            <span className="flex min-w-0 items-center gap-3 text-left">
              <span
                aria-hidden="true"
                className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {description}
                </span>
              </span>
            </span>
            <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
