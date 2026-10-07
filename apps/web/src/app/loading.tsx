import { PageSkeleton } from '@/components/feedback/page-skeleton';

/**
 * Route-level loading boundary.
 *
 * Applies to every route under this segment, which at the root is all of them. Next
 * renders this instead of the route while its server component awaits data.
 */
export default function Loading() {
  return <PageSkeleton />;
}
