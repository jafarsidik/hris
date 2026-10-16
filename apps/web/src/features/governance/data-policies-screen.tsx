'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { dataPoliciesApi } from '@/features/governance/governance-api';
import { ApiRequestError } from '@/lib/api/http-client';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not complete the request.';
}

const CLASSIFICATIONS = ['public', 'internal', 'confidential', 'restricted'] as const;
const MASKING_ACTIONS = ['mask', 'redact', 'hash', 'none'] as const;

export function DataPoliciesScreen() {
  const router = useRouter();
  const { state } = useSession();
  const policies = useIamLoad(() => dataPoliciesApi.list(), []);
  const canManage = useCan('registry.manage');

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [classification, setClassification] = useState('internal');
  const [targetResource, setTargetResource] = useState('');
  const [maskingAction, setMaskingAction] = useState('mask');
  const [isEnabled, setIsEnabled] = useState(true);

  const resetForm = () => {
    setName('');
    setDescription('');
    setClassification('internal');
    setTargetResource('');
    setMaskingAction('mask');
    setIsEnabled(true);
  };

  const submit = useCallback(async () => {
    setError(undefined);
    setNotice(undefined);
    setBusy(true);
    try {
      await dataPoliciesApi.create({
        name,
        description: description.trim() === '' ? null : description,
        classification,
        targetResource,
        maskingAction,
        isEnabled,
      });
      setNotice('Data policy created.');
      resetForm();
      setShowForm(false);
      policies.reload();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }, [name, description, classification, targetResource, maskingAction, isEnabled, policies]);

  const remove = useCallback(
    async (id: string, n: string) => {
      if (!window.confirm(`Delete “${n}”?`)) {
        return;
      }
      setError(undefined);
      setBusy(true);
      try {
        await dataPoliciesApi.remove(id);
        setNotice(`Deleted “${n}”.`);
        policies.reload();
      } catch (cause) {
        setError(messageOf(cause));
      } finally {
        setBusy(false);
      }
    },
    [policies],
  );

  const rows = (policies.data ?? []) as Array<{
    readonly id: string;
    readonly name: string;
    readonly classification: string;
    readonly targetResource: string;
    readonly maskingAction: string;
    readonly isEnabled: boolean;
  }>;

  return (
    <PageBody>
      <PageHeader
        title="Data Policies"
        description="Classification, masking and handling rules for platform data."
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

      {canManage && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>New policy</CardTitle>
                <CardDescription>Classify and protect a platform resource.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
                {showForm ? 'Hide' : 'New policy'}
              </Button>
            </div>
          </CardHeader>
          {showForm && (
            <CardContent className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="policy-name">Name</Label>
                  <Input id="policy-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="policy-classification">Classification</Label>
                  <Select
                    value={classification}
                    onValueChange={(v) => {
                      if (v !== null && v !== undefined) setClassification(v);
                    }}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLASSIFICATIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="policy-target">Target resource</Label>
                  <Input
                    id="policy-target"
                    value={targetResource}
                    onChange={(e) => setTargetResource(e.target.value)}
                    placeholder="e.g. payroll"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="policy-description">Description</Label>
                <Input
                  id="policy-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="policy-masking">Masking action</Label>
                <Select
                  value={maskingAction}
                  onValueChange={(v) => {
                    if (v !== null && v !== undefined) setMaskingAction(v);
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MASKING_ACTIONS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-3">
                <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void submit()}
                  disabled={busy || name.trim() === '' || targetResource.trim() === ''}
                >
                  {busy ? 'Creating…' : 'Create'}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Policies</CardTitle>
          <CardDescription>
            {policies.loading ? 'Loading…' : `${rows.length} policy${rows.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {policies.error !== undefined && (
            <Alert variant="destructive">
              <AlertDescription>{policies.error}</AlertDescription>
            </Alert>
          )}
          {policies.loading && rows.length === 0 ? (
            <Skeleton className="h-40 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No policies yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Classification</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Masking</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(
                  (policy: {
                    id: string;
                    name: string;
                    classification: string;
                    targetResource: string;
                    maskingAction: string;
                    isEnabled: boolean;
                  }) => (
                    <TableRow key={policy.id}>
                      <TableCell className="font-medium">{policy.name}</TableCell>
                      <TableCell className="font-mono text-sm">{policy.classification}</TableCell>
                      <TableCell className="font-mono text-sm">{policy.targetResource}</TableCell>
                      <TableCell className="font-mono text-sm">{policy.maskingAction}</TableCell>
                      <TableCell>
                        <Badge variant={policy.isEnabled ? 'success' : 'secondary'}>
                          {policy.isEnabled ? 'ENABLED' : 'DISABLED'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage && (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void remove(policy.id, policy.name)}
                            >
                              <Trash2 className="mr-1 size-4" aria-hidden />
                              Delete
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageBody>
  );
}
