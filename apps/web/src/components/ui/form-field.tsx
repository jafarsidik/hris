'use client';

import * as React from 'react';
import type { Button as ButtonPrimitive } from '@base-ui/react/button';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { AlertCircleIcon, Loader2Icon } from 'lucide-react';

import { Button, type buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

/**
 * One labelled field in a form.
 *
 * Associates the label with a control through `htmlFor`, like every label in the
 * platform (see {@link Label}). The control is provided by the caller exactly because
 * fields can be inputs, selects, date inputs or radio groups, and only the caller knows
 * which `id` each control renders so the described-by / invalid wiring this component
 * hands back can land on it.
 */
function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  errorId,
  className,
  children,
}: {
  label: string;
  /** Must match the `id` of the control or group this label names. */
  htmlFor: string;
  required?: boolean;
  /** Shown below the control when there is no error; hidden while an error shows. */
  hint?: React.ReactNode;
  error?: string;
  /** The `id` to announce the error under `aria-describedby`. */
  errorId: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-slot="form-field" className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        )}
      </Label>
      {children}
      {error !== undefined ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        hint !== undefined && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/**
 * The submit button of an async form.
 *
 * `pending` comes from `useActionState`, the one place the pending flag is known
 * without duplicating state. While pending, the button is disabled, shows a spinner
 * and swaps its label so a submit cannot be double-fired.
 */
function FormSubmitButton({
  pending,
  pendingText = 'Saving…',
  className,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    pending: boolean;
    pendingText?: string;
  }) {
  return (
    <Button type="submit" disabled={pending} className={cn('gap-1.5', className)} {...props}>
      {pending && <Loader2Icon aria-hidden="true" className="size-3.5 animate-spin" />}
      {pending ? pendingText : children}
    </Button>
  );
}

/**
 * A server-level (non-field) failure at the top of a form.
 *
 * `Alert` already carries `role="alert"`, so a failed submission is announced as it
 * lands. Field-level errors stay next to their fields; this is only for errors that
 * belong to the form as a whole.
 */
function FormErrorSummary({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-slot="form-error-summary"
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-sm text-destructive"
    >
      <AlertCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export { FormErrorSummary, FormField, FormSubmitButton };
