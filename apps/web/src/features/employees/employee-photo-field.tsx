'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useCan } from '@/features/auth/session-context';
import { ApiRequestError } from '@/lib/api/http-client';

import { initialsFor } from './employee-presentation';
import { loadEmployeePhoto, uploadEmployeePhoto, type EmployeePhoto } from './employee-photo';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_BYTES = 5 * 1024 * 1024;

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'The photo could not be uploaded.';
}

/**
 * An employee's photo, and — when editing — the control that replaces it.
 *
 * The image is loaded from the object store with a short-lived presigned URL, so a
 * copied URL stops working. Uploading is immediate rather than part of the form submit:
 * the employee id already exists in edit mode, and a photo that only lands when an
 * unrelated field is saved would be a surprise. The employee row itself is untouched.
 */
export function EmployeePhotoField({
  employeeId,
  fullName,
  editable = false,
  compact = false,
  className,
}: {
  readonly employeeId: string;
  readonly fullName: string;
  readonly editable?: boolean;
  /** Render only the avatar, for headers and drawers. */
  readonly compact?: boolean;
  readonly className?: string;
}) {
  const { toast } = useToast();
  const canView = useCan('document.view');
  const canDownload = useCan('document.download');
  const canUpload = useCan('document.create');

  const [photo, setPhoto] = useState<EmployeePhoto | null>(null);
  const [loading, setLoading] = useState(canView && canDownload);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    if (!canView || !canDownload) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      setPhoto(await loadEmployeePhoto(employeeId));
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, [employeeId, canView, canDownload]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onChoose(file: File | undefined): Promise<void> {
    if (file === undefined) {
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Choose a PNG, JPEG, WebP or GIF image.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('The photo must be 5 MB or smaller.');
      return;
    }

    setBusy(true);
    setError(undefined);
    try {
      setPhoto(await uploadEmployeePhoto(employeeId, file));
      toast({
        title: 'Photo updated',
        description: `${fullName}'s photo was saved.`,
        variant: 'success',
      });
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
      if (inputRef.current !== null) {
        inputRef.current.value = '';
      }
    }
  }

  const initials = initialsFor(fullName);
  const showInitials = photo === null || photo.url === '';

  const avatar = (
    <Avatar
      aria-hidden="true"
      className={`size-16 shrink-0 border border-border ${compact ? 'size-11' : ''}`}
    >
      {photo !== null && photo.url !== '' && (
        <AvatarImage src={photo.url} alt="" className="object-cover" />
      )}
      <AvatarFallback className={compact ? 'text-sm font-medium' : 'text-lg font-medium'}>
        {loading ? '' : showInitials ? initials : ''}
      </AvatarFallback>
    </Avatar>
  );

  if (compact) {
    return <span className={className}>{avatar}</span>;
  }

  return (
    <div className={`flex items-center gap-4 ${className ?? ''}`}>
      {avatar}

      <div className="min-w-0">
        <p className="text-sm font-medium">Photo</p>
        <p className="text-xs text-muted-foreground">
          {editable
            ? 'PNG, JPEG, WebP or GIF, up to 5 MB. Uploads immediately.'
            : 'Employee photo from the document store.'}
        </p>
        {editable && canUpload && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              className="sr-only"
              id={`employee-photo-${employeeId}`}
              onChange={(event) => void onChoose(event.currentTarget.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? 'Uploading…' : photo === null ? 'Upload photo' : 'Change photo'}
            </Button>
          </>
        )}
        {error !== undefined && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
