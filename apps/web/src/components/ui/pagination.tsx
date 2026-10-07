'use client';

import * as React from 'react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';

function usePageRange({
  pageIndex,
  pageCount,
  siblingCount = 1,
  boundaryCount = 1,
}: {
  pageIndex: number;
  pageCount: number;
  siblingCount?: number;
  boundaryCount?: number;
}): readonly (number | 'ellipsis-left' | 'ellipsis-right')[] {
  return React.useMemo(() => {
    if (pageCount === 0) return [];
    if (pageCount <= (boundaryCount + siblingCount) * 2 + 2) {
      return Array.from({ length: pageCount }, (_, i) => i);
    }

    const range: (number | 'ellipsis-left' | 'ellipsis-right')[] = [];
    const start = Math.max(boundaryCount, pageIndex - siblingCount);
    const end = Math.min(pageCount - 1 - boundaryCount, pageIndex + siblingCount);

    for (let i = 0; i < boundaryCount; i += 1) range.push(i);
    if (start > boundaryCount) range.push('ellipsis-left');
    for (let i = start; i <= end; i += 1) range.push(i);
    if (end < pageCount - 1 - boundaryCount) range.push('ellipsis-right');
    for (let i = pageCount - boundaryCount; i < pageCount; i += 1) range.push(i);

    return range;
  }, [boundaryCount, pageIndex, pageCount, siblingCount]);
}

function PaginationSummary({ from, to, total }: { from: number; to: number; total: number }) {
  return (
    <span data-slot="pagination-summary" className="text-sm text-muted-foreground tabular-nums">
      {from}–{to} of {total}
    </span>
  );
}

function Pagination({
  pageIndex,
  pageCount,
  onPageChange,
  buildHref,
  className,
  size = 'sm',
}: {
  /** Zero-based current page. */
  pageIndex: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** When provided, pages render as links instead of buttons. */
  buildHref?: (page: number) => string;
  className?: string;
  size?: 'xs' | 'sm' | 'default';
}) {
  const page = React.useCallback(
    (index: number) => Math.min(pageCount - 1, Math.max(0, index)),
    [pageCount],
  );
  const range = usePageRange({ pageIndex, pageCount });

  const renderPage = (index: number) => {
    const active = index === pageIndex;
    const classes = buttonVariants({
      variant: active ? 'default' : 'ghost',
      size,
      className: 'size-7 min-w-7 aria-disabled:pointer-events-none aria-disabled:opacity-40',
    });
    const label = `Page ${index + 1}`;

    if (buildHref !== undefined) {
      return (
        <Link
          key={index}
          href={buildHref(index)}
          aria-label={label}
          aria-current={active ? 'page' : undefined}
          className={classes}
        >
          {index + 1}
        </Link>
      );
    }
    return (
      <button
        key={index}
        type="button"
        onClick={() => onPageChange(index)}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        disabled={active}
        className={classes}
      >
        {index + 1}
      </button>
    );
  };

  const hasPrevious = pageIndex > 0;
  const hasNext = pageIndex < pageCount - 1;

  const navClasses = buttonVariants({ variant: 'ghost', size, className: 'size-7' });

  return (
    <nav
      data-slot="pagination"
      aria-label="Pagination"
      className={cn('flex items-center gap-1', className)}
    >
      {buildHref !== undefined ? (
        hasPrevious && (
          <Link href={buildHref(pageIndex - 1)} aria-label="Previous page" className={navClasses}>
            <ChevronLeftIcon aria-hidden="true" className="size-3.5" />
          </Link>
        )
      ) : (
        <button
          type="button"
          onClick={() => onPageChange(page(pageIndex - 1))}
          aria-label="Previous page"
          disabled={!hasPrevious}
          className={navClasses}
        >
          <ChevronLeftIcon aria-hidden="true" className="size-3.5" />
        </button>
      )}

      {range.map((item) =>
        item === 'ellipsis-left' || item === 'ellipsis-right' ? (
          <span key={item} aria-hidden="true" className="px-1 text-muted-foreground">
            …
          </span>
        ) : (
          renderPage(item)
        ),
      )}

      {buildHref !== undefined ? (
        hasNext && (
          <Link href={buildHref(pageIndex + 1)} aria-label="Next page" className={navClasses}>
            <ChevronRightIcon aria-hidden="true" className="size-3.5" />
          </Link>
        )
      ) : (
        <button
          type="button"
          onClick={() => onPageChange(page(pageIndex + 1))}
          aria-label="Next page"
          disabled={!hasNext}
          className={navClasses}
        >
          <ChevronRightIcon aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </nav>
  );
}

export { Pagination, PaginationSummary };
