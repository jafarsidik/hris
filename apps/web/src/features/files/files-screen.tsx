'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, MoreHorizontalIcon, Trash2, Upload } from 'lucide-react';
import type { FileObjectStatus, FileObjectSummary } from '@hris/shared-types';

import {
  HrisDataTable,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
} from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { filesApi, uploadFile } from '@/features/files/files-api';
import { ApiRequestError } from '@/lib/api/http-client';

type BadgeTone =
  'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'outline';

const STATUS_TONE: Readonly<Record<FileObjectStatus, BadgeTone>> = {
  PENDING: 'warning',
  AVAILABLE: 'success',
  DELETED: 'secondary',
};

type StatusFilter = 'ALL' | FileObjectStatus;
const STATUS_FILTERS: readonly StatusFilter[] = ['ALL', 'AVAILABLE', 'PENDING', 'DELETED'];

/** Human-readable byte size, kept local so the screen has no shared formatting dependency. */
function formatBytes(bytes: number | null): string {
  if (bytes === null) {
    return '—';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB'] as const;
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit] ?? 'GB'}`;
}

function formatTimestamp(value: string | null): string {
  if (value === null) {
    return '—';
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

/** Turns an unknown rejection into a message a notice can render inline. */
function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'The request could not be completed.';
}

/**
 * The per-row actions menu for files.
 *
 * Download is disabled for files that are not available; delete is hidden for
 * files that are already deleted. The destructive direction is confirmed by
 * the screen's ConfirmDialog.
 */
function FileRowMenu({
  file,
  canDownload,
  canDelete,
  onDownload,
  onDelete,
}: {
  readonly file: FileObjectSummary;
  readonly canDownload: boolean;
  readonly canDelete: boolean;
  readonly onDownload: (file: FileObjectSummary) => void;
  readonly onDelete: (file: FileObjectSummary) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Actions for ${file.name}`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        <MoreHorizontalIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          disabled={!canDownload || file.status !== 'AVAILABLE'}
          onClick={() => onDownload(file)}
        >
          <Download aria-hidden="true" className="size-4" />
          Download
        </DropdownMenuItem>
        {canDelete && file.status !== 'DELETED' && (
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(file)}>
            <Trash2 aria-hidden="true" className="size-4" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Files held in the platform's S3-compatible object store.
 *
 * The browser uploads bytes directly to storage with a presigned URL — the API only mints
 * that URL and records the metadata — so this screen never proxies a payload. Download and
 * delete are re-authorised per request and per presign, which is why a link the user kept
 * stops working once the session or the permission goes away.
 *
 * The status filter is a server-side query — the API does not return deleted objects
 * unless asked — so it is passed through the table's `actions` slot and triggers a new
 * fetch. Search, sort and pagination run over the rows the fetch returned.
 */
export function FilesScreen() {
  const router = useRouter();
  const { state } = useSession();
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const files = useIamLoad(() => filesApi.list(status === 'ALL' ? {} : { status }), [status]);

  const canUpload = useCan('document.create');
  const canDownload = useCan('document.download');
  const canDelete = useCan('document.delete');

  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [confirming, setConfirming] = useState<FileObjectSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmError, setConfirmError] = useState<string | undefined>();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const onUpload = useCallback(async () => {
    const file = inputRef.current?.files?.[0];
    if (file === undefined) {
      setError('Choose a file to upload.');
      return;
    }
    setError(undefined);
    setNotice(undefined);
    setBusy(true);
    try {
      const uploaded = await uploadFile(file);
      setNotice(`Uploaded "${uploaded.name}".`);
      if (inputRef.current !== null) {
        inputRef.current.value = '';
      }
      files.reload();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }, [files]);

  const onDownload = useCallback(async (file: FileObjectSummary) => {
    setError(undefined);
    try {
      const ticket = await filesApi.download(file.id);
      // An anchor navigation honours the signed response-content-disposition, so the
      // server decides the filename rather than the browser.
      const anchor = document.createElement('a');
      anchor.href = ticket.downloadUrl;
      anchor.rel = 'noopener';
      anchor.click();
    } catch (cause) {
      setError(messageOf(cause));
    }
  }, []);

  const onDelete = useCallback(
    async (file: FileObjectSummary) => {
      setConfirmError(undefined);
      setDeleting(true);
      try {
        await filesApi.remove(file.id);
        setNotice(`Deleted "${file.name}".`);
        files.reload();
      } catch (cause) {
        setConfirmError(messageOf(cause));
      } finally {
        setDeleting(false);
      }
    },
    [files],
  );

  const rows = files.data ?? [];

  const columns: readonly DataTableColumn<FileObjectSummary>[] = [
    {
      id: 'name',
      header: 'Name',
      sortValue: (file) => file.name,
      cellClassName: 'font-medium',
      cell: (file) => file.name,
    },
    {
      id: 'type',
      header: 'Type',
      sortValue: (file) => file.mimeType,
      cellClassName: 'text-muted-foreground',
      cell: (file) => file.mimeType,
    },
    {
      id: 'size',
      header: 'Size',
      sortValue: (file) => file.size ?? 0,
      cell: (file) => formatBytes(file.size),
    },
    {
      id: 'status',
      header: 'Status',
      sortValue: (file) => file.status,
      cell: (file) => <Badge variant={STATUS_TONE[file.status]}>{file.status}</Badge>,
    },
    {
      id: 'uploaded',
      header: 'Uploaded',
      sortValue: (file) => file.createdAt,
      cellClassName: 'text-muted-foreground',
      cell: (file) => formatTimestamp(file.createdAt),
    },
    {
      id: 'retention',
      header: 'Retention',
      sortValue: (file) => file.retentionUntil ?? '',
      cellClassName: 'text-muted-foreground',
      cell: (file) => formatTimestamp(file.retentionUntil),
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (file) => (
        <FileRowMenu
          file={file}
          canDownload={canDownload}
          canDelete={canDelete}
          onDownload={(f) => void onDownload(f)}
          onDelete={(f) => setConfirming(f)}
        />
      ),
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="File storage"
        description="Documents held in the platform object store, with their retention."
      />

      {error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice !== undefined && (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {canUpload && (
        <Card>
          <CardHeader>
            <CardTitle>Upload</CardTitle>
            <CardDescription>
              Bytes go straight to object storage; the API records only the metadata.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="file-input">
                  File
                </label>
                <Input id="file-input" ref={inputRef} type="file" disabled={busy} />
              </div>
              <Button onClick={() => void onUpload()} disabled={busy}>
                <Upload className="mr-2 size-4" aria-hidden />
                {busy ? 'Uploading…' : 'Upload'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <HrisDataTable
        rows={rows}
        columns={columns}
        searchable
        searchText={(file) => `${file.name} ${file.mimeType} ${file.status}`}
        searchPlaceholder="Search by name, type or status…"
        selectable={false}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status</span>
            <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
              <SelectTrigger className="w-40" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === 'ALL' ? 'All (not deleted)' : option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={files.reload}>
              Refresh
            </Button>
          </div>
        }
        status={files.loading ? 'loading' : files.error !== undefined ? 'error' : 'ready'}
        errorCopy={files.error}
        onRetry={() => files.reload()}
        emptyTitle="No files match this view"
        emptyDescription="Upload a file to see it listed here."
        noResultsTitle="No files match this filter"
        noResultsDescription="Try a different search, or clear the filters to see every file."
      />

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirming(null);
            setConfirmError(undefined);
          }
        }}
        title={confirming !== null ? `Delete "${confirming.name}"?` : ''}
        description="The file's bytes are removed immediately. This cannot be undone."
        confirmLabel="Delete"
        tone="destructive"
        pending={deleting}
        error={confirmError}
        onConfirm={() => {
          if (confirming !== null) {
            void onDelete(confirming);
          }
        }}
      />
    </PageBody>
  );
}
