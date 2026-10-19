import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { RecordDraft, RecordKind } from './record-mutations';
import { RecordAddButton, RecordRowActions } from './record-dialogs';

export interface SectionRow {
  readonly cells: readonly string[];
  /** The record's id — present when the section is editable. */
  readonly id?: string;
  /** The record's own field values, for the prefilled edit dialog. */
  readonly draft?: RecordDraft;
}

export interface SectionTableProps {
  readonly title: string;
  readonly description: string;
  readonly columns: readonly string[];
  readonly rows: readonly SectionRow[];
  /** The employee these records belong to (needed by the dialog writes). */
  readonly employeeId?: string;
  /** API record kind — present when the section is editable (add/edit/delete). */
  readonly kind?: RecordKind;
}

/**
 * One flat record section inside the employee profile panels: an `h2`
 * heading, a muted description, then the plain table — sections are separated
 * only by a hairline, matching the reference layout, without card chrome.
 *
 * Server component on purpose: rows and columns arrive pre-shaped as strings
 * from the profile page. Editing stays interactive through the two small
 * client islands — the section's Add button and each row's Edit/Delete — one
 * node each, so the hydration cost is one per button group, not per section.
 */
export function RecordSection({
  title,
  description,
  columns,
  rows,
  employeeId,
  kind,
}: SectionTableProps) {
  const editable = kind !== undefined && employeeId !== undefined && employeeId !== '';
  const tableColumns = editable && rows.length > 0 ? [...columns, '\u200b'] : columns;

  return (
    <section className="border-t border-border pt-5 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        {kind !== undefined && employeeId !== undefined && employeeId !== '' && (
          <RecordAddButton kind={kind} employeeId={employeeId} />
        )}
      </div>
      <div className="mt-4">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No records yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {tableColumns.map((column, columnIndex) => (
                    <TableHead
                      key={columnIndex}
                      className={columnIndex === tableColumns.length - 1 ? 'w-14' : undefined}
                    >
                      {column.trim() === '' ? <span className="sr-only">Actions</span> : column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={row.id ?? index}>
                    {row.cells.map((cell, cellIndex) => (
                      <TableCell
                        key={cellIndex}
                        className={cn(
                          'text-sm',
                          cellIndex === 0 && 'font-medium',
                          cellIndex === row.cells.length - 1 && 'text-right',
                        )}
                      >
                        {cell === '' ? '—' : cell}
                      </TableCell>
                    ))}
                    {kind !== undefined &&
                      employeeId !== undefined &&
                      row.id !== undefined &&
                      row.draft !== undefined && (
                        <TableCell className="w-14">
                          <div className="flex items-center justify-end gap-0.5">
                            <RecordRowActions
                              kind={kind}
                              employeeId={employeeId}
                              id={row.id}
                              draft={row.draft}
                            />
                          </div>
                        </TableCell>
                      )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </section>
  );
}
