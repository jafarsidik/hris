import { EmptyState } from '@/components/feedback/empty-state';
import { FileQuestion } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Global 404.
 *
 * Reached for any address with no route, so the copy has to work for a mistyped URL as
 * well as for a link from inside the app. It offers the overview rather than a bare
 * "go back", because "back" is unpredictable on a page that may have been opened
 * directly from a bookmark.
 */
export default function NotFound() {
  return (
    <EmptyState
      icon={FileQuestion}
      title="That page does not exist"
      description="The address may be mistyped, or the page may have been moved. Nothing on this screen affects your data."
      action={<Button render={<Link href="/" />}>Back to overview</Button>}
    />
  );
}
