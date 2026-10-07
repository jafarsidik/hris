'use client';

import * as React from 'react';
import { saveEmployee, type SaveEmployeeResult } from '@/app/employees/actions';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { FormField, FormSubmitButton } from '@/components/ui/form-field';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Employee } from '@/features/employees/employee-types';
import {
  EMPLOYEE_STATUSES,
  MOCK_DEPARTMENTS,
  MOCK_EMPLOYMENT_TYPES,
} from '@/features/employees/mock-employee-repository';

const STATUS_LABELS: Readonly<Partial<Record<string, string>>> = {
  ACTIVE: 'Active',
  ON_LEAVE: 'On leave',
  PROBATION: 'Probation',
  INACTIVE: 'Inactive',
};

const INITIAL_STATE: SaveEmployeeResult = { ok: false, fieldErrors: {} };

/**
 * The create / edit employee dialog body.
 *
 * Owns the form and its async submit via `useActionState`, so the server action is the
 * validation authority and a pending submit disables the button. Field errors the action
 * returns land next to their fields; a created or updated employee is handed to
 * `onSaved` exactly once.
 *
 * The dialog remounts this component per open (the popup unmounts when it closes), so
 * edits never leak between sessions and there is nothing to reset explicitly.
 */
export function EmployeeForm({
  employee,
  editing = false,
  onSaved,
  onCancel,
}: {
  /** Present when editing an existing record; omitted when creating. */
  employee?: Employee;
  editing?: boolean;
  onSaved: (saved: Employee, mode: 'created' | 'updated') => void;
  onCancel: () => void;
}) {
  const [state, formAction, isPending] = React.useActionState(saveEmployee, INITIAL_STATE);
  const handledRef = React.useRef<string | null>(null);

  const errors = state.ok ? {} : state.fieldErrors;

  // Fire onSaved (which closes the dialog and toasts) exactly once per successful save.
  React.useEffect(() => {
    if (!state.ok) return;
    const key = `${state.mode}:${state.employee.id}`;
    if (handledRef.current === key) return;
    handledRef.current = key;
    onSaved(state.employee, state.mode);
    // `state` intentionally absent: only a fresh successful submit should notify.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const field = (name: string) => (typeof errors[name] === 'string' ? errors[name] : undefined);
  const describe = (name: string, errorId: string) =>
    field(name) === undefined ? undefined : errorId;

  const title = editing ? 'Edit employee' : 'Add employee';
  const description = editing
    ? 'Update the record. Changes are saved as sample data and reset when the server restarts.'
    : 'Create a new employee record. Saved as sample data until the real endpoint exists.';

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <form action={formAction} noValidate className="grid gap-6">
        {employee !== undefined && <input type="hidden" name="id" value={employee.id} />}
        <input type="hidden" name="employeeNumber" value={employee?.employeeNumber ?? ''} />

        <fieldset className="grid gap-4">
          <legend className="text-sm font-medium">Personal information</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Full name"
              htmlFor="employee-fullName"
              required
              error={field('fullName')}
              errorId="err-fullName"
            >
              <Input
                id="employee-fullName"
                name="fullName"
                defaultValue={employee?.fullName}
                aria-invalid={field('fullName') !== undefined || undefined}
                aria-describedby={describe('fullName', 'err-fullName')}
                autoComplete="off"
                placeholder="e.g. Jordan Reyes"
              />
            </FormField>

            <FormField
              label="Email"
              htmlFor="employee-email"
              required
              hint="Work address used for notifications."
              error={field('email')}
              errorId="err-email"
            >
              <Input
                id="employee-email"
                name="email"
                type="email"
                inputMode="email"
                defaultValue={employee?.email}
                aria-invalid={field('email') !== undefined || undefined}
                aria-describedby={describe('email', 'err-email')}
                autoComplete="off"
                placeholder="name@company.com"
              />
            </FormField>

            <FormField
              label="Status"
              htmlFor="employee-status"
              required
              className="sm:col-span-2"
              error={field('status')}
              errorId="err-status"
            >
              <RadioGroup
                id="employee-status"
                name="status"
                defaultValue={employee?.status ?? 'ACTIVE'}
                className="flex flex-wrap gap-x-6"
              >
                {EMPLOYEE_STATUSES.map((status) => (
                  <label
                    key={status}
                    className="flex items-center gap-2 text-sm text-foreground select-none"
                  >
                    <RadioGroupItem value={status} />
                    {STATUS_LABELS[status] ?? status}
                  </label>
                ))}
              </RadioGroup>
            </FormField>
          </div>
        </fieldset>

        <fieldset className="grid gap-4">
          <legend className="text-sm font-medium">Employment</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Job title"
              htmlFor="employee-jobTitle"
              required
              error={field('jobTitle')}
              errorId="err-jobTitle"
            >
              <Input
                id="employee-jobTitle"
                name="jobTitle"
                defaultValue={employee?.jobTitle}
                aria-invalid={field('jobTitle') !== undefined || undefined}
                aria-describedby={describe('jobTitle', 'err-jobTitle')}
                autoComplete="off"
                placeholder="e.g. Payroll Specialist"
              />
            </FormField>

            <FormField
              label="Department"
              htmlFor="employee-department"
              required
              error={field('department')}
              errorId="err-department"
            >
              <Select name="department" defaultValue={employee?.department ?? undefined}>
                <SelectTrigger id="employee-department" className="w-full">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_DEPARTMENTS.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label="Employment type"
              htmlFor="employee-employmentType"
              required
              error={field('employmentType')}
              errorId="err-employmentType"
            >
              <Select name="employmentType" defaultValue={employee?.employmentType ?? undefined}>
                <SelectTrigger id="employee-employmentType" className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_EMPLOYMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label="Hire date"
              htmlFor="employee-hireDate"
              required
              error={field('hireDate')}
              errorId="err-hireDate"
            >
              <DateInput
                id="employee-hireDate"
                name="hireDate"
                defaultValue={employee?.hireDate}
                aria-invalid={field('hireDate') !== undefined || undefined}
                aria-describedby={describe('hireDate', 'err-hireDate')}
              />
            </FormField>
          </div>
        </fieldset>

        {!state.ok && Object.keys(state.fieldErrors).length > 0 && (
          <p className="sr-only" role="alert">
            {Object.keys(state.fieldErrors).length} field
            {Object.keys(state.fieldErrors).length === 1 ? '' : 's'} need attention.
          </p>
        )}

        <DialogFooter className="mt-2" showCloseButton={false}>
          <FormSubmitButton pending={isPending} pendingText={editing ? 'Saving…' : 'Adding…'}>
            {editing ? 'Save changes' : 'Add employee'}
          </FormSubmitButton>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
