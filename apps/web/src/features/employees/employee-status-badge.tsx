import { Badge } from '@/components/ui/badge';

import { describeStatus } from './employee-presentation';

/**
 * The status badge as the directory renders it.
 *
 * Every presentation decision (label, colour) lives in {@link describeStatus}, so the
 * row cell and a future summary card can never disagree about what a status means.
 */
export function EmployeeStatusBadge({ status }: { status: string }) {
  const presentation = describeStatus(status);
  return <Badge variant={presentation.variant}>{presentation.label}</Badge>;
}
