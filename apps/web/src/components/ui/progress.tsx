import * as React from 'react';
import { Progress as ProgressPrimitive } from '@base-ui/react/progress';
import { cn } from '@/lib/utils';

function Progress({
  className,
  value,
  ...props
}: Omit<ProgressPrimitive.Root.Props, 'value' | 'ref'> & { readonly value?: number | null }) {
  return (
    <ProgressPrimitive.Root
      value={value ?? null}
      data-slot="progress"
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full bg-primary"
        style={{
          transform: `translateX(-${100 - Math.min(100, Math.max(0, Number(value) || 0))}%)`,
        }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
