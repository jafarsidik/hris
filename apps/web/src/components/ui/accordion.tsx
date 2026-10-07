'use client';

import * as React from 'react';
import { Accordion as AccordionPrimitive } from '@base-ui/react/accordion';
import { cn } from '@/lib/utils';
import { ChevronDownIcon } from 'lucide-react';

/*
 * Open/close is animated by keyframes defined in `globals.css` (`accordion-down` /
 * `accordion-up`). Base UI puts the measured panel height in `--panel-height` on the
 * panel element while it is open, which is what the keyframes interpolate against —
 * the same contract the old Radix `--radix-accordion-content-height` served.
 */

const Accordion = AccordionPrimitive.Root;

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn('border-b', className)}
      {...props}
    />
  );
}

function AccordionTrigger({ className, children, ...props }: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex" data-slot="accordion-header">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          'group flex flex-1 items-center justify-between gap-4 py-3 text-sm font-medium text-left transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground [&>svg]:transition-transform [&>svg]:group-data-[panel-open]:rotate-180',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon aria-hidden="true" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({ className, children, ...props }: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className={cn(
        'overflow-hidden text-sm transition-all data-open:animate-[accordion-down_200ms_ease-out] data-closed:animate-[accordion-up_200ms_ease-out]',
        className,
      )}
      {...props}
    >
      <div className="pt-0 pb-4">{children}</div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
