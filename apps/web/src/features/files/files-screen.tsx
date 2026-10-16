'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Trash2, Upload } from 'lucide-react';

import type { FileObjectStatus } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
 * Files held in the platform's S3-compatible object store.
 *
 * The browser uploads bytes directly to storage with a presigned URL — the API only mints
 * that URL and records the metadata — so this screen never proxies a payload. Download and
 * delete are re-authorised per request and per presign, which is why a link the user kept
 * stops working once the session or the permission goes away.
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
      setNotice(`Uploaded “${uploaded.name}”.`);
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

  const onDownload = useCallback(async (id: string) => {
    setError(undefined);
    try {
      const ticket = await filesApi.download(id);
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
    async (id: string, name: string) => {
      if (!window.confirm(`Delete “${name}”? Its bytes are removed immediately.`)) {
        return;
      }
      setError(undefined);
      setNotice(undefined);
      setBusy(true);
      try {
        await filesApi.remove(id);
        setNotice(`Deleted “${name}”.`);
        files.reload();
      } catch (cause) {
        setError(messageOf(cause));
      } finally {
        setBusy(false);
      }
    },
    [files],
  );

  const rows = files.data ?? [];

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

      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
          <CardDescription>
            {files.loading ? 'Loading…' : `${rows.length} ${rows.length === 1 ? 'file' : 'files'}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <PageToolbar>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status</span>
              <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
                <SelectTrigger className="w-40">
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
            </div>
            <Button variant="outline" size="sm" onClick={files.reload}>
              Refresh
            </Button>
          </PageToolbar>

          {files.error !== undefined && (
            <Alert variant="destructive">
              <AlertDescription>{files.error}</AlertDescription>
            </Alert>
          )}

          {files.loading && rows.length === 0 ? (
            <Skeleton className="h-40 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files match this view.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Retention</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium">{file.name}</TableCell>
                    <TableCell className="text-muted-foreground">{file.mimeType}</TableCell>
                    <TableCell>{formatBytes(file.size)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_TONE[file.status]}>{file.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTimestamp(file.createdAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTimestamp(file.retentionUntil)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canDownload || file.status !== 'AVAILABLE'}
                          onClick={() => void onDownload(file.id)}
                        >
                          <Download className="mr-1 size-4" aria-hidden />
                          Download
                        </Button>
                        {canDelete && file.status !== 'DELETED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => void onDelete(file.id, file.name)}
                          >
                            <Trash2 className="mr-1 size-4" aria-hidden />
                            Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageBody>
  );
}
