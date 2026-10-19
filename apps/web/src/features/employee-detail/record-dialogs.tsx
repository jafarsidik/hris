'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DateInput } from '@/components/ui/date-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import type { ApiRequestError } from '@/lib/api/http-client';

import { recordSchemaFor, type RecordFieldDef } from './record-schema';
import { removeRecord, saveRecord, type RecordDraft, type RecordKind } from './record-mutations';

/**
 * One generic add / edit / delete surface for a profile record section.
 *
 * The schema ({@link recordSchemaFor}) describes the fields, so every kind
 * renders from the same loop; the only kind-specific wiring is inside
 * {@link saveRecord}. Deletes confirm in a small dialog — a record removal is
 * a real write, not a slip the undo stack forgives.
 */
export function RecordAddButton({ kind, employeeId }: { kind: RecordKind; employeeId: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={() => setOpen(true)}
      >
        <PlusIcon aria-hidden="true" className="size-3.5" />
        Add
      </Button>
      <RecordDialog kind={kind} employeeId={employeeId} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function RecordRowActions({
  kind,
  employeeId,
  id,
  draft,
}: {
  kind: RecordKind;
  employeeId: string;
  id: string;
  /** The record's own field values, for prefilled editing. */
  draft: RecordDraft;
}) {
  const [editing, setEditing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Edit record"
        className="size-6 p-0 text-muted-foreground"
        onClick={() => setEditing(true)}
      >
        <PencilIcon aria-hidden="true" className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Delete record"
        className="size-6 p-0 text-muted-foreground hover:text-destructive"
        onClick={() => setDeleting(true)}
      >
        <Trash2Icon aria-hidden="true" className="size-3.5" />
      </Button>

      <RecordDialog
        kind={kind}
        employeeId={employeeId}
        recordId={id}
        initial={draft}
        open={editing}
        onOpenChange={setEditing}
      />
      <RecordDeleteDialog
        kind={kind}
        employeeId={employeeId}
        recordId={id}
        open={deleting}
        onOpenChange={setDeleting}
      />
    </>
  );
}

function RecordDialog({
  kind,
  employeeId,
  recordId,
  initial,
  open,
  onOpenChange,
}: {
  kind: RecordKind;
  employeeId: string;
  /** Present in edit mode. */
  recordId?: string;
  initial?: RecordDraft;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const schema = recordSchemaFor(kind);
  const editing = recordId !== undefined;

  const [draft, setDraft] = React.useState<RecordDraft>({});
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  /* Mount-scoped state: the draft resets each time the dialog opens, whether it
   * is a fresh add or the next record being edited. */
  React.useEffect(() => {
    if (open) {
      setDraft((initial ?? {}) as RecordDraft);
      setFormError(null);
      setPending(false);
    }
  }, [open, initial]);

  const set = (name: string, value: string | boolean) => {
    setDraft((current) => ({ ...current, [name]: value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    for (const field of schema.fields) {
      if (field.required === true && String(draft[field.name] ?? '').trim() === '') {
        setFormError(`${field.label} is required.`);
        return;
      }
    }

    setPending(true);
    try {
      await saveRecord(kind, employeeId, draft, recordId);
      onOpenChange(false);
      router.refresh();
      toast({
        title: editing ? 'Record updated' : 'Record added',
        description: `${schema.singular} saved to the employee profile.`,
        variant: 'success',
      });
    } catch (error) {
      setFormError(describe(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit' : 'Add'} {schema.singular}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? `Update this ${schema.singular} — the change applies to the employee profile on save.`
              : `Add a new ${schema.singular} to the employee profile.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {formError !== null && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {schema.fields.map((field) => (
              <FormField
                key={field.name}
                label={field.label}
                htmlFor={`record-${field.name}`}
                required={field.required === true}
                hint={field.hint}
                errorId={`record-err-${field.name}`}
                className={field.type === 'textarea' ? 'sm:col-span-2' : undefined}
              >
                <RecordFieldInput
                  field={{
                    type: field.type,
                    name: field.name,
                    label: field.label,
                    required: field.required === true,
                    options: field.options,
                  }}
                  value={draft[field.name]}
                  onChange={(value) => set(field.name, value)}
                  onToggle={(checked) => set(field.name, checked)}
                />
              </FormField>
            ))}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending && <Loader2Icon aria-hidden="true" className="size-3.5 animate-spin" />}
              {editing ? 'Save changes' : 'Add record'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecordFieldInput({
  field,
  value,
  onChange,
  onToggle,
}: {
  field: {
    type: RecordFieldDef['type'];
    name: string;
    label: string;
    required?: boolean;
    options?: readonly string[];
  };
  value: string | boolean | undefined;
  onChange: (value: string) => void;
  onToggle: (checked: boolean) => void;
}): React.ReactElement {
  const id = `record-${field.name}`;
  if (field.type === 'date') {
    return (
      <DateInput id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
    );
  }
  if (field.type === 'checkbox') {
    return (
      <div className="flex items-center pt-1.5">
        <Checkbox
          id={id}
          checked={value === true}
          onCheckedChange={(checked) => onToggle(checked === true)}
        />
        <Label htmlFor={id} className="ml-2 font-normal text-muted-foreground">
          {field.label}
        </Label>
      </div>
    );
  }
  if (field.type === 'textarea') {
    return (
      <Textarea
        id={id}
        value={String(value ?? '')}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (field.type === 'select') {
    return (
      <Select
        value={String(value ?? '') || undefined}
        onValueChange={(next) => onChange(next ?? '')}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map((option) => (
            <SelectItem key={option} value={option}>
              {labelize(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  const number = field.type === 'number';
  return (
    <Input
      id={id}
      type={number ? 'number' : 'text'}
      inputMode={number ? 'numeric' : undefined}
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** `FIXED_TERM` reads as "Fixed term" in selects, matching the mock's tone. */
const labelize = (option: string): string => {
  const words = option.toLowerCase().split('_');
  const first = words[0] ?? '';
  const rest = words.slice(1).join(' ');
  return [first.charAt(0).toUpperCase() + first.slice(1), rest].filter(Boolean).join(' ');
};

function RecordDeleteDialog({
  kind,
  employeeId: _employeeId,
  recordId,
  open,
  onOpenChange,
}: {
  kind: RecordKind;
  employeeId: string;
  recordId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const schema = recordSchemaFor(kind);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setError(null);
      setPending(false);
    }
  }, [open]);

  const confirm = async () => {
    setPending(true);
    try {
      await removeRecord(kind, recordId);
      onOpenChange(false);
      router.refresh();
      toast({
        title: 'Record deleted',
        description: `${schema.singular} removed from the employee profile.`,
        variant: 'success',
      });
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete {schema.singular}?</DialogTitle>
          <DialogDescription>
            The record is removed from the employee profile. This cannot be undone from the screen.
          </DialogDescription>
        </DialogHeader>
        {error !== null && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={confirm}
          >
            {pending && <Loader2Icon aria-hidden="true" className="size-3.5 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One safe line for a failed write: the API's message, or a reason we can own. */
const describe = (error: unknown): string => {
  if ((error as Partial<ApiRequestError>)?.name === 'ApiRequestError') {
    const requestError = error as ApiRequestError;
    return requestError.status === 401
      ? 'Your session has expired. Refresh the page and sign in again.'
      : requestError.code === 'VALIDATION_ERROR'
        ? requestError.message || 'The record was rejected — check the fields and retry.'
        : requestError.message || 'The HRIS service could not be reached. Try again shortly.';
  }
  return 'Something went wrong while saving. Please try again.';
};
