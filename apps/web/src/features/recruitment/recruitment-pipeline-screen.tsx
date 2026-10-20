'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { HrisDataTable, type DataTableColumn, type DataTableFilter } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useSession } from '@/features/auth/session-context';

import type { JobApplication, JobRequisition } from './recruitment-types';

function stageBadge(stage: string) {
  switch (stage) {
    case 'APPLIED':
      return <Badge variant="outline">Applied</Badge>;
    case 'SCREENING':
      return <Badge variant="secondary">Screening</Badge>;
    case 'INTERVIEW':
      return <Badge variant="warning">Interview</Badge>;
    case 'OFFER':
      return <Badge variant="secondary">Offer</Badge>;
    case 'HIRED':
      return <Badge variant="success">Hired</Badge>;
    case 'REJECTED':
      return <Badge variant="destructive">Rejected</Badge>;
    default:
      return <Badge variant="outline">{stage}</Badge>;
  }
}

function requisitionBadge(status: string) {
  switch (status) {
    case 'DRAFT':
      return <Badge variant="outline">Draft</Badge>;
    case 'OPEN':
      return <Badge variant="success">Open</Badge>;
    case 'FILLED':
      return <Badge variant="secondary">Filled</Badge>;
    case 'CLOSED':
      return <Badge variant="outline">Closed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

const STAGE_OPTIONS = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'] as const;

/**
 * Recruitment pipeline: open requisitions and the candidate applications
 * moving through the hiring stages.
 *
 * The applications list is the primary table and uses the shared data table. Job
 * requisitions are a smaller embedded sub-table in a card and keep their bespoke markup.
 */
export function RecruitmentPipelineScreen({
  requisitions,
  applications,
}: {
  requisitions: readonly JobRequisition[];
  applications: readonly JobApplication[];
}) {
  const router = useRouter();
  const { state } = useSession();

  const stageCounts = {
    applied: applications.filter((a) => a.stage === 'APPLIED').length,
    screening: applications.filter((a) => a.stage === 'SCREENING').length,
    interview: applications.filter((a) => a.stage === 'INTERVIEW').length,
    hired: applications.filter((a) => a.stage === 'HIRED').length,
  };

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const applicationColumns: readonly DataTableColumn<JobApplication>[] = [
    {
      id: 'candidate',
      header: 'Candidate',
      sortValue: (row) => row.candidateName,
      cell: (row) => (
        <div>
          <div className="font-medium">{row.candidateName}</div>
          <div className="text-xs text-muted-foreground">{row.candidateEmail}</div>
        </div>
      ),
    },
    {
      id: 'requisition',
      header: 'Requisition',
      sortValue: (row) => row.requisitionTitle,
      cell: (row) => (
        <div>
          <div className="font-medium">{row.requisitionTitle}</div>
          <div className="text-xs text-muted-foreground">{row.requisitionCode}</div>
        </div>
      ),
    },
    {
      id: 'stage',
      header: 'Stage',
      sortValue: (row) => row.stage,
      cell: (row) => stageBadge(row.stage),
    },
    {
      id: 'rating',
      header: 'Rating',
      sortValue: (row) => row.rating ?? 0,
      align: 'center',
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.rating ?? '—',
    },
  ];

  const stageFilters: readonly DataTableFilter<JobApplication>[] = [
    {
      kind: 'select',
      id: 'stage',
      label: 'Stage',
      placeholder: 'All stages',
      getValue: (row) => row.stage,
      options: STAGE_OPTIONS.map((stage) => ({ value: stage, label: stage })),
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Recruitment"
        description="Open requisitions and the candidate pipeline from application to hire."
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-1.5">
            <CardDescription>Applied</CardDescription>
            <CardTitle className="text-xl tabular-nums">{stageCounts.applied}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1.5">
            <CardDescription>Screening</CardDescription>
            <CardTitle className="text-xl tabular-nums">{stageCounts.screening}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1.5">
            <CardDescription>Interview</CardDescription>
            <CardTitle className="text-xl tabular-nums">{stageCounts.interview}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1.5">
            <CardDescription>Hired</CardDescription>
            <CardTitle className="text-xl tabular-nums">{stageCounts.hired}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Job requisitions</CardTitle>
          <CardDescription>{requisitions.length} requisition(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-center">Headcount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requisitions.map((requisition) => (
                <TableRow key={requisition.id}>
                  <TableCell className="font-mono text-sm">{requisition.code}</TableCell>
                  <TableCell className="font-medium">{requisition.title}</TableCell>
                  <TableCell>{requisition.department ?? '—'}</TableCell>
                  <TableCell className="text-center font-mono text-sm">
                    {requisition.headcount}
                  </TableCell>
                  <TableCell>{requisitionBadge(requisition.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mb-4">
        <h2 className="text-lg font-semibold">Applications</h2>
        <p className="text-sm text-muted-foreground">
          {applications.length} application(s) in the pipeline
        </p>
      </div>
      <HrisDataTable
        rows={applications}
        columns={applicationColumns}
        filters={stageFilters}
        searchable
        searchText={(row) =>
          `${row.candidateName} ${row.candidateEmail} ${row.requisitionTitle} ${row.requisitionCode}`
        }
        searchPlaceholder="Search applications…"
        selectable={false}
        emptyTitle="No applications in the pipeline"
        emptyDescription="Candidate applications moving through the hiring stages appear here."
        noResultsTitle="No applications match this filter"
        noResultsDescription="Try a different search or stage, or clear the filters to see every application."
      />
    </PageBody>
  );
}
