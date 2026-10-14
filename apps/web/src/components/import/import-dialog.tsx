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
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { FileSpreadsheetIcon, UploadCloudIcon, XIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface ImportResult {
  readonly imported: number;
  readonly skipped: number;
  readonly fileName: string;
  /** Caller-supplied honesty copy, e.g. that nothing was written to a database. */
  readonly note?: string;
}

export type ImportHandler = (file: File) => Promise<ImportResult> | ImportResult;

/** How many bytes a `.csv` we accept is allowed to claim. */
const DEFAULT_MAX_SIZE_MB = 5;

/**
 * The shared entry point for "bring rows in from a spreadsheet".
 *
 * The dialog owns the file interaction — choose a file, drop it, see its size and
 * extension, and run the importer — and nothing else. What an import means (parse the
 * rows, map them to a record, save them) is the caller's `onImport`, so the same
 * surface serves employees today, attendance tomorrow, and a real endpoint later
 * without the dialog changing.
 */
export function ImportDialog({
  open,
  onOpenChange,
  title = 'Import rows',
  description = 'Choose a CSV file to import. Nothing is written until you confirm on the next step.',
  accept = '.csv,text/csv',
  maxSizeMb = DEFAULT_MAX_SIZE_MB,
  template,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  accept?: string;
  maxSizeMb?: number;
  /** Shown under the drop zone so the file follows the expected columns. */
  template?: ReactNode;
  onImport: ImportHandler;
}) {
  const { toast } = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [running, setRunning] = React.useState(false);

  const reset = () => {
    setFile(null);
    setError(null);
    setDragging(false);
    if (inputRef.current !== null) inputRef.current.value = '';
  };

  // A closed dialog must not keep a stale half-chosen file waiting.
  React.useEffect(() => {
    if (open) return;
    setFile(null);
    setError(null);
    setDragging(false);
    if (inputRef.current !== null) inputRef.current.value = '';
  }, [open]);

  const choose = (candidate: File) => {
    const extOk = candidate.name.toLowerCase().endsWith('.csv');
    const sizeOk = candidate.size <= maxSizeMb * 1024 * 1024;

    if (!extOk) {
      setError('Only .csv files are accepted. Choose a file exported from a spreadsheet.');
      return;
    }
    if (!sizeOk) {
      setError(`The file is larger than ${maxSizeMb} MB. Split it and try again.`);
      return;
    }

    setError(null);
    setFile(candidate);
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped !== undefined) choose(dropped);
  };

  const run = async () => {
    if (file === null) return;

    setRunning(true);
    try {
      const result = await onImport(file);
      toast({
        title: 'Import finished',
        description: `${result.imported} row${result.imported === 1 ? '' : 's'} read from ${
          result.fileName
        }.${result.note === undefined ? '' : ` ${result.note}`}`,
        variant: result.skipped > 0 ? 'info' : 'success',
      });
      onOpenChange(false);
    } catch {
      toast({
        title: 'Import failed',
        description: 'The file could not be read. It may not be a valid CSV.',
        variant: 'error',
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors focus-within:ring-2 focus-within:ring-ring/50 focus-within:outline-none',
              file === null &&
                !dragging &&
                'border-muted-foreground/30 hover:border-muted-foreground/60',
              dragging && 'border-primary bg-primary/[0.04]',
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              className="sr-only"
              aria-label="Choose a CSV file"
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (selected !== undefined) choose(selected);
              }}
            />

            {file === null ? (
              <>
                <UploadCloudIcon aria-hidden="true" className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">
                  Drag a CSV here, or <span className="underline underline-offset-2">browse</span>
                </p>
                <p className="text-xs text-muted-foreground">Up to {maxSizeMb} MB</p>
              </>
            ) : (
              <span className="flex items-center gap-2 text-sm font-medium">
                <FileSpreadsheetIcon aria-hidden="true" className="size-5 text-primary" />
                <span className="min-w-0 truncate">{file.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatBytes(file.size)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="-ml-1 -mr-1 text-muted-foreground hover:text-foreground"
                  aria-label="Remove file"
                  onClick={(event) => {
                    event.preventDefault();
                    reset();
                  }}
                >
                  <XIcon aria-hidden="true" className="size-3.5" />
                </Button>
              </span>
            )}
          </label>

          {error !== null && <p className="text-sm text-destructive">{error}</p>}

          {template !== undefined && (
            <div className="space-y-1 rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
              {template}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={run} disabled={file === null || running}>
            {running ? 'Importing…' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}
