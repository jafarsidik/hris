'use client';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { breadcrumbTrail } from '@/lib/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';

/**
 * The breadcrumb trail for the current route.
 *
 * A client component because the trail follows the current pathname. The derivation
 * itself lives in `lib/navigation` so it can be tested without a DOM.
 *
 * Two structural rules, both of which produce a hydration error when broken.
 *
 * `BreadcrumbItem` and `BreadcrumbSeparator` are both `<li>`, so the separator is a
 * **sibling** of the items, never a child. A separator inside an item produces
 * `<li>` within `<li>`, which React rejects and which the browser repairs differently
 * from React's own output.
 *
 * The final crumb is not a link. It is the page being viewed, so a link would navigate to
 * itself; `BreadcrumbPage` renders it with `aria-current="page"` and no `href`.
 *
 * `Breadcrumb` supplies its own `<nav>`. This must not be wrapped in another one: nested
 * navigation landmarks are announced ambiguously and are invalid markup.
 */
export function BreadcrumbTrail() {
  const pathname = usePathname();
  const trail = breadcrumbTrail(pathname);

  if (trail.length === 0) {
    return null;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1;
          const key = `${crumb.href ?? 'current'}-${crumb.label}`;

          return (
            <Fragment key={key}>
              <BreadcrumbItem>
                {isLast ? (
                  /*
                    Checked first. The final crumb is the page being viewed, and
                    `breadcrumbTrail` deliberately gives it no href — testing for a
                    missing href before testing for last would render it as plain text and
                    lose `aria-current` entirely.
                  */
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : crumb.href === undefined ? (
                  /*
                    An intermediate crumb with no route to point at, such as a record id
                    on a path that has no navigation entry. Rendered as plain text:
                    linking it would produce a 404 that looks like navigation.
                  */
                  <span>{crumb.label}</span>
                ) : (
                  <BreadcrumbLink render={<Link href={crumb.href} />}>{crumb.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>

              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
