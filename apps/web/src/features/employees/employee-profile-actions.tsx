'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { EmployeeFormDialog } from '@/features/employees/employee-form-dialog';
import { exportEmployeesToCsv } from '@/features/employees/employee-export';
import type { Employee } from '@/features/employees/employee-types';
import { Download, Mail, PencilLine } from 'lucide-react';

/**
 * The actions on an employee profile.
 *
 * Editing reuses the directory's form dialog; a saved change lands in the same mock
 * store, and the page is refreshed so the body re-reads the record the same way any
 * other visit would.
 */
export function EmployeeProfileActions({ employee }: { employee: Employee }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(false);

  const exportRecord = () => {
    exportEmployeesToCsv([employee]);
    toast({
      title: 'Exported to CSV',
      description: `${employee.fullName}'s record was downloaded.`,
    });
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
        <PencilLine aria-hidden="true" className="size-3.5" />
        Edit
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        render={<a href={`mailto:${employee.email}`} aria-label="Email this employee" />}
      >
        <Mail aria-hidden="true" className="size-3.5" />
        Email
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => exportRecord()}>
        <Download aria-hidden="true" className="size-3.5" />
        Export
      </Button>

      <EmployeeFormDialog
        open={editing}
        onOpenChange={setEditing}
        employee={employee}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
