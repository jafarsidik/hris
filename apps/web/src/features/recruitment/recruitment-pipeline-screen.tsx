'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

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

/**
 * Recruitment pipeline: open requisitions and the candidate applications
 * moving through the hiring stages.
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

  return (
    <PageBody>
      <PageHeader
        title="Recruitment"
        description="Open requisitions and the candidate pipeline from application to hire."
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Applied</CardDescription>
            <CardTitle className="text-2xl">{stageCounts.applied}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Screening</CardDescription>
            <CardTitle className="text-2xl">{stageCounts.screening}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Interview</CardDescription>
            <CardTitle className="text-2xl">{stageCounts.interview}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Hired</CardDescription>
            <CardTitle className="text-2xl">{stageCounts.hired}</CardTitle>
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

      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
          <CardDescription>{applications.length} application(s) in the pipeline</CardDescription>
        </CardHeader>
        <CardContent>
          {' '}
          {applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No applications in the pipeline.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Requisition</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-center">Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell>
                      <div className="font-medium">{application.candidateName}</div>
                      <div className="text-xs text-muted-foreground">
                        {application.candidateEmail}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{application.requisitionTitle}</div>
                      <div className="text-xs text-muted-foreground">
                        {application.requisitionCode}
                      </div>
                    </TableCell>
                    <TableCell>{stageBadge(application.stage)}</TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {application.rating ?? '—'}
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
