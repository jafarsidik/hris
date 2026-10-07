'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * `htmlFor` is required rather than optional.
 *
 * A `<label>` that names no control is an accessibility defect: a screen reader
 * announces the text with no field attached, and clicking it focuses nothing. The
 * platform never needs an unassociated label, so the type makes the association
 * impossible to forget and the attribute is passed explicitly so the
 * `label-has-associated-control` rule can verify it statically.
 */
function Label({
  className,
  htmlFor,
  ...props
}: React.ComponentProps<'label'> & { htmlFor: string }) {
  return (
    <label
      data-slot="label"
      htmlFor={htmlFor}
      className={cn(
        'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
