'use client';

import * as React from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { BookmarkIcon, PencilLineIcon, PlusIcon, StarIcon, Trash2Icon } from 'lucide-react';

import type { PersistedView } from './views-storage';

/**
 * Saved directory views.
 *
 * Built-in views come from the page and are never persisted; saved views live in
 * localStorage (see {@link import('./views-storage')}). Both are applied through the
 * same `onApply`, so selecting a built-in and recalling a saved one reach the table's
 * filters through one path.
 */
export function DataTableViews({
  builtIn,
  saved,
  defaultId,
  activeId,
  onApply,
  onSaveCurrent,
  onRename,
  onDelete,
  onSetDefault,
}: {
  builtIn: readonly { readonly id: string; readonly name: string }[];
  saved: readonly PersistedView[];
  defaultId: string | undefined;
  activeId: string | undefined;
  onApply: (id: string) => void;
  onSaveCurrent: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string | undefined) => void;
}) {
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [manageOpen, setManageOpen] = React.useState(false);
  const [draftName, setDraftName] = React.useState('');
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameDraft, setRenameDraft] = React.useState('');

  const openSave = () => {
    setDraftName('');
    setSaveOpen(true);
  };

  const openRename = (view: PersistedView) => {
    setRenamingId(view.id);
    setRenameDraft(view.name);
  };

  const entries = [
    ...builtIn.map((view) => ({ id: view.id, name: view.name, builtIn: true })),
    ...saved.map((view) => ({ id: view.id, name: view.name, builtIn: false })),
  ];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
            />
          }
        >
          <BookmarkIcon aria-hidden="true" className="size-3.5" />
          Views
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuRadioGroup value={activeId ?? ''} onValueChange={onApply}>
            {entries.map((view) => (
              <DropdownMenuRadioItem key={view.id} value={view.id}>
                <span className="min-w-0 flex-1 truncate">{view.name}</span>
                {view.id === defaultId && (
                  <StarIcon aria-hidden="true" className="size-3.5 fill-current text-warning" />
                )}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={openSave}>
            <PlusIcon aria-hidden="true" className="size-4" />
            Save current view…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setManageOpen(true)} disabled={saved.length === 0}>
            <PencilLineIcon aria-hidden="true" className="size-4" />
            Manage views…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save current view</DialogTitle>
            <DialogDescription>
              The filters, search, sort and columns currently applied will be recalled from the
              Views menu.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSaveCurrent(draftName.trim());
              setSaveOpen(false);
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <label htmlFor="view-name">
                <span className="text-sm font-medium">View name</span>
              </label>
              <Input
                id="view-name"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="e.g. Engineering team"
                required
                maxLength={60}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={draftName.trim() === ''}>
                Save view
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage views</DialogTitle>
            <DialogDescription>
              Saved views are stored in this browser. The default view opens every time you visit
              Employees.
            </DialogDescription>
          </DialogHeader>

          <ul className="max-h-72 space-y-1 overflow-auto">
            {saved.map((view) => (
              <li
                key={view.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5"
              >
                {renamingId === view.id ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (renameDraft.trim() !== '') onRename(view.id, renameDraft.trim());
                      setRenamingId(null);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-1.5"
                  >
                    <Input
                      value={renameDraft}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      aria-label="View name"
                      className="h-7"
                    />
                    <Button type="submit" size="sm">
                      Save
                    </Button>
                  </form>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm">{view.name}</span>
                    {view.id === defaultId && (
                      <span className="text-xs text-muted-foreground">Default</span>
                    )}
                    <div className="flex items-center gap-0.5">
                      {view.id !== defaultId && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onSetDefault(view.id)}
                          aria-label={`Make ${view.name} the default view`}
                        >
                          <StarIcon aria-hidden="true" className="size-3.5" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openRename(view)}
                        aria-label={`Rename ${view.name}`}
                      >
                        <PencilLineIcon aria-hidden="true" className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onDelete(view.id)}
                        aria-label={`Delete ${view.name}`}
                      >
                        <Trash2Icon aria-hidden="true" className="size-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setManageOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
