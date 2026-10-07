import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Multi-line input, styled to match the single-line {@link Input}.
 *
 * Base UI has no textarea primitive, so this is a plain `<textarea>` carrying the same
 * border, focus ring and invalid-state classes as the input so the two read as one
 * field system.
 */
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 md:text-sm',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
