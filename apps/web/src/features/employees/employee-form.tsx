'use client';

import * as React from 'react';
import { saveEmployee, type SaveEmployeeResult } from '@/app/(app)/employees/actions';
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
import { EMPLOYMENT_TYPES } from '@hris/shared-types';
import { EmployeePhotoField } from '@/features/employees/employee-photo-field';
import type { Employee } from '@/features/employees/employee-types';
import { EMPLOYEE_STATUSES, MOCK_DEPARTMENTS } from '@/features/employees/mock-employee-repository';

const STATUS_LABELS: Readonly<Partial<Record<string, string>>> = {
  ACTIVE: 'Active',
  ON_LEAVE: 'On leave',
  PROBATION: 'Probation',
  SUSPENDED: 'Suspended',
  INACTIVE: 'Inactive',
  TERMINATED: 'Terminated',
};

const TYPE_LABELS: Readonly<Record<string, string>> = {
  PERMANENT: 'Permanent',
  FIXED_TERM: 'Fixed term',
  CONTRACT: 'Contract',
  INTERN: 'Intern',
  PART_TIME: 'Part time',
  TEMPORARY: 'Temporary',
};

const INITIAL_STATE: SaveEmployeeResult = { ok: false, fieldErrors: {} };

/**
 * The status options the form offers: the API's lifecycle statuses, plus the mock
 * source's `PROBATION` so switching data sources keeps the same form working.
 */
const STATUS_OPTIONS: readonly string[] = [...new Set([...EMPLOYEE_STATUSES, 'PROBATION'])];

/**
 * The create / edit employee dialog body.
 *
 * Owns the form and its async submit via `useActionState`, so the server action is the
 * validation authority and a pending submit disables the button. Field errors the action
 * returns land next to their fields; a `form`-keyed error (an API rejection without
 * field details) shows above the actions instead of crashing the page. A created or
 * updated employee is handed to `onSaved` exactly once.
 *
 * When real units/positions are passed in, Department and Job title become selects over
 * the actual structure and the ids ride along to the API; without them the form falls
 * back to the mock's vocabulary. The dialog remounts this component per open, so edits
 * never leak between sessions and there is nothing to reset explicitly.
 */
export function EmployeeForm({
  employee,
  editing = false,
  onSaved,
  onCancel,
  units,
  positions = [],
}: {
  /** Present when editing an existing record; omitted when creating. */
  employee?: Employee;
  editing?: boolean;
  onSaved: (saved: Employee, mode: 'created' | 'updated') => void;
  onCancel: () => void;
  /** Real units from the API; absent means the mock's department list. */
  units?: readonly { readonly id: string; readonly name: string }[];
  /** Real positions from the API, each optionally tied to one unit. */
  positions?: readonly {
    readonly id: string;
    readonly name: string;
    readonly unitId: string | null;
  }[];
}) {
  const [state, formAction, isPending] = React.useActionState(saveEmployee, INITIAL_STATE);
  const handledRef = React.useRef<string | null>(null);
  const errors = state.ok ? {} : state.fieldErrors;

  const usesRealOptions = units !== undefined;
  const departmentLabel = (id: string): string => units?.find((unit) => unit.id === id)?.name ?? '';
  const positionLabel = (id: string): string =>
    positions.find((position) => position.id === id)?.name ?? '';

  const [unitId, setUnitId] = React.useState<string>(() =>
    usesRealOptions ? (unitForLabel(employee?.department)?.id ?? '') : '',
  );
  const [positionId, setPositionId] = React.useState<string>(() =>
    usesRealOptions ? (positionForLabel(employee?.jobTitle)?.id ?? '') : '',
  );

  function unitForLabel(label: string | undefined): { id: string; name: string } | undefined {
    if (label === undefined || units === undefined) return undefined;
    return units.find((unit) => unit.name === label);
  }
  function positionForLabel(label: string | undefined): { id: string; name: string } | undefined {
    if (label === undefined) return undefined;
    return positions.find((position) => position.name === label);
  }

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
  const description = editing ? 'Update the record.' : 'Create a new employee record.';

  const employmentTypeOptions: readonly string[] = [
    ...EMPLOYMENT_TYPES,
    ...(employee?.employmentType !== undefined &&
    !(EMPLOYMENT_TYPES as readonly string[]).includes(employee.employmentType)
      ? [employee.employmentType]
      : []),
  ];

  const positionChoices = positions.filter(
    (position) => unitId === '' || position.unitId === null || position.unitId === unitId,
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <form action={formAction} noValidate className="grid gap-6">
        {employee !== undefined && <input type="hidden" name="id" value={employee.id} />}
        <input type="hidden" name="employeeNumber" value={employee?.employeeNumber ?? ''} />
        {employee !== undefined && (
          <EmployeePhotoField
            employeeId={employee.id}
            fullName={employee.fullName}
            editable
            className="rounded-lg border border-border bg-muted/30 p-3"
          />
        )}
        {usesRealOptions && (
          <>
            <input type="hidden" name="unitId" value={unitId} />
            <input type="hidden" name="department" value={departmentLabel(unitId)} />
            <input type="hidden" name="positionId" value={positionId} />
            <input type="hidden" name="jobTitle" value={positionLabel(positionId)} />
          </>
        )}

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
                {STATUS_OPTIONS.map((status) => (
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
            {usesRealOptions ? (
              <>
                <FormField
                  label="Department"
                  htmlFor="employee-department"
                  required
                  error={field('department')}
                  errorId="err-department"
                >
                  <Select
                    name="unitIdSelect"
                    value={unitId || undefined}
                    onValueChange={(value: string | null) => setUnitId(value ?? '')}
                  >
                    <SelectTrigger id="employee-department" className="w-full">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {(units ?? []).map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField
                  label="Job title"
                  htmlFor="employee-jobTitle"
                  required
                  error={field('jobTitle')}
                  errorId="err-jobTitle"
                >
                  <Select
                    name="positionIdSelect"
                    value={positionId || undefined}
                    onValueChange={(value: string | null) => setPositionId(value ?? '')}
                  >
                    <SelectTrigger id="employee-jobTitle" className="w-full">
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      {positionChoices.map((position) => (
                        <SelectItem key={position.id} value={position.id}>
                          {position.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </>
            ) : (
              <>
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
              </>
            )}

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
                  {employmentTypeOptions.map((type) => (
                    <SelectItem key={type} value={type}>
                      {TYPE_LABELS[type] ?? type}
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

        {field('form') !== undefined && (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {field('form')}
          </div>
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
