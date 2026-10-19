import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Data comes from the plain module: the feature barrel is a 'use client'
// module, and imports from a server component would arrive as client
// references instead of the arrays (runtime: "<X>.map is not a function").
import { JOB_FAMILIES, JOB_LEVELS } from '@/features/organization/job-config-data';

export const metadata = { title: 'Jobs' } as const;

/**
 * The job architecture catalogue: families, levels and the bands behind
 * position grades. Read-only until the job endpoint ships.
 */
export default function JobCatalogPage() {
  return (
    <main className="flex flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Job families, job levels and job profiles — the architecture behind position grades and
          progression.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Job Families</h2>
          </CardTitle>
          <CardDescription>{JOB_FAMILIES.length} families across the company</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Family</TableHead>
                <TableHead>Scope</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {JOB_FAMILIES.map((family) => (
                <TableRow key={family.code}>
                  <TableCell className="font-medium tabular-nums">{family.code}</TableCell>
                  <TableCell className="text-sm">{family.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {family.description}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Job Levels</h2>
          </CardTitle>
          <CardDescription>The bands behind the position grade letters</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grade</TableHead>
                <TableHead>Band</TableHead>
                <TableHead>Meaning</TableHead>
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {JOB_LEVELS.map((level) => (
                <TableRow key={level.code}>
                  <TableCell className="font-medium tabular-nums">{level.code}</TableCell>
                  <TableCell className="text-sm">{level.band}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {level.description}
                  </TableCell>
                  <TableCell className="text-sm">{level.active ? 'Active' : 'Retired'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
