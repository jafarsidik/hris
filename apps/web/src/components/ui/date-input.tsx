import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * A date-only field.
 *
 * Wraps the native date input rather than a calendar popover: the browser picker is
 * keyboard accessible, supports translated labels, and needs no JavaScript to open.
 * The platform's calendars are ISO 8601 on the wire (the employee `hireDate` is a YYYY
 * -MM-DD string), which is exactly the native value format, so no parsing or
 * reformatting leaks between the field and the repository.
 */
function DateInput({ className, type: _type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type="date"
      data-slot="date-input"
      className={cn(
        'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:transition-opacity hover:[&::-webkit-calendar-picker-indicator]:opacity-100 md:text-sm',
        className,
      )}
      {...props}
    />
  );
}

export { DateInput };
