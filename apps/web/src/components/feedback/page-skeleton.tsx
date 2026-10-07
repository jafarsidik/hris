import { Skeleton } from '@/components/ui/skeleton';

/**
 * The placeholder shown while a route's data is being fetched.
 *
 * Skeletons mirror the shape of the content they stand in for. A single centred
 * spinner would also be correct and far less code, but it hides the page's structure,
 * so the layout jumps once the data lands. On a list screen the row count is a guess
 * rather than a claim about how many results exist, which is why it is passed in rather
 * than hard-coded to a number that implies a total.
 */
export function PageSkeleton({
  rows = 5,
  showHeader = true,
}: {
  rows?: number;
  showHeader?: boolean;
}) {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      {showHeader && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
      )}

      <div className="space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-lg" />
        ))}
      </div>

      {/* The label is what makes the wait legible. Without it the skeleton is a blank
          region that reads as a rendering fault rather than as pending work. */}
      <span className="sr-only">Loading content</span>
    </div>
  );
}
