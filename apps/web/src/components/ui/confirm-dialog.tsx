'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormErrorSummary } from '@/components/ui/form-field';

/**
 * A gate in front of an action the reader cannot undo from this screen.
 *
 * Why a component rather than `window.confirm`: the browser dialog cannot name the record
 * it is about, cannot say what will happen next, cannot report that the request failed, is
 * styled by the browser instead of the workspace, and blocks the main thread while it is
 * open. The IAM users screen suspended an account on a single click with none of that — the
 * status was already written to the database before the reader could reconsider, and the
 * row's own button was the only sign anything had happened.
 *
 * Controlled rather than trigger-based, because the actions that need it are reached from a
 * dropdown menu: the menu item closes its menu and then opens this dialog, which is state
 * the caller already owns. `pending` keeps the dialog open and locked while the mutation is
 * in flight, so the reader can neither double-submit nor dismiss a half-finished change.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  pending = false,
  error,
  onConfirm,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: React.ReactNode;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  /** `destructive` for actions that take something away or cut access off. */
  readonly tone?: 'default' | 'destructive';
  readonly pending?: boolean;
  /** A failed attempt, shown inside the dialog so the reader can retry or cancel. */
  readonly error?: string | undefined;
  readonly onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        /*
         * While the mutation is in flight the only safe state is open: dismissing here
         * would leave the reader with no way to learn whether it finished or failed.
         */
        if (!pending) {
          onOpenChange(next);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {error !== undefined && <FormErrorSummary>{error}</FormErrorSummary>}

        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'destructive' ? 'destructive' : 'default'}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? `${confirmLabel}…` : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
