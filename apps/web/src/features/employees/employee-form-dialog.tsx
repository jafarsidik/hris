'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { EmployeeForm } from '@/features/employees/employee-form';
import type { Employee } from '@/features/employees/employee-types';
import { useToast } from '@/components/ui/toast';

/**
 * Shared shell for the create and edit dialogs.
 *
 * One component for both modes: the dialog body is the same form and the only
 * differences (title, defaults, submit copy) all key off `editing` in the form itself.
 *
 * The toast callback lives in a child that only mounts while the dialog is open, so the
 * ambient `ToastProvider` is pulled in exactly when a save happens — the closed dialog
 * demands nothing of its surroundings. The toast text states the sample nature of a
 * save up front, because nothing here hits a database.
 */
export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present in edit mode only. */
  employee?: Employee;
  onSaved: (saved: Employee, mode: 'created' | 'updated') => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <FormWithToast employee={employee} onOpenChange={onOpenChange} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

function FormWithToast({
  employee,
  onOpenChange,
  onSaved,
}: {
  employee?: Employee;
  onOpenChange: (open: boolean) => void;
  onSaved: (saved: Employee, mode: 'created' | 'updated') => void;
}) {
  const { toast } = useToast();

  const handleSaved = (saved: Employee, mode: 'created' | 'updated') => {
    onOpenChange(false);
    onSaved(saved, mode);
    toast({
      title: mode === 'created' ? 'Employee added' : 'Employee updated',
      description: `${saved.fullName} saved as sample data — it resets when the server restarts.`,
      variant: 'success',
    });
  };

  return (
    <EmployeeForm
      employee={employee}
      editing={employee !== undefined}
      onSaved={handleSaved}
      onCancel={() => onOpenChange(false)}
    />
  );
}

/** The primary "Add employee" control used in the toolbar. */
export function AddEmployeeButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" onClick={onClick}>
      <span aria-hidden="true" className="text-base leading-none">
        +
      </span>
      Add employee
    </Button>
  );
}
