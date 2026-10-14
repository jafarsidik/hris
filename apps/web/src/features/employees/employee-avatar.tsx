import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

import { initialsFor } from './employee-presentation';
import type { Employee } from './employee-types';

/**
 * The initials chip every employee row leads with.
 *
 * Purely cosmetic: a name with no initials renders nothing rather than a stray circle,
 * matching the presentation helper's contract.
 */
export function EmployeeAvatar({
  employee,
  className,
}: {
  employee: Employee;
  className?: string;
}) {
  const initials = initialsFor(employee.fullName);
  if (initials === '') return null;

  return (
    <Avatar aria-hidden="true" className={cn('size-8 shrink-0', className)}>
      <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
    </Avatar>
  );
}
