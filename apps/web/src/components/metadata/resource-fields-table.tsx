'use client';

import type { ResourceSummary } from '@hris/shared-types';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * Metadata-driven field surface.
 *
 * Renders a registered resource's fields straight from its `ResourceDefinition`
 * (`ResourceSummary.fields`), so a resource can gain a field without a web change.
 * This is the read half of the administration console's generic CRUD surface; the
 * write half (form + mutations) is added with the generic data layer.
 */
export function ResourceFieldsTable({ resource }: { resource: ResourceSummary }) {
  if (resource.fields.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No fields are registered for this resource yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Field</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Requirement</TableHead>
          <TableHead>Visibility</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {resource.fields.map((field) => (
          <TableRow key={field.id}>
            <TableCell>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{field.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{field.key}</span>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{field.dataType}</Badge>
            </TableCell>
            <TableCell>
              {field.required ? (
                'Required'
              ) : (
                <span className="text-muted-foreground">Optional</span>
              )}
            </TableCell>
            <TableCell>
              {field.isSensitive ? (
                <Badge variant="secondary">Sensitive</Badge>
              ) : (
                <span className="text-muted-foreground">Standard</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
