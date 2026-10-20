'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { HrisDataTable } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { dataPoliciesApi } from '@/features/governance/governance-api';
import {
  DATA_POLICY_BUILT_IN_VIEWS,
  DATA_POLICY_SEARCH_TEXT,
  DATA_POLICY_VIEWS_STORAGE_KEY,
  buildDataPolicyColumns,
  buildDataPolicyFilters,
} from '@/features/governance/data-policies-table-config';
import { ApiRequestError } from '@/lib/api/http-client';
import type { DataPolicySummary } from '@hris/shared-types';

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

  const [deleting, setDeleting] = useState<DataPolicySummary | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();

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

  const confirmDelete = useCallback(async () => {
    if (deleting === null) {
      return;
    }
    setDeletePending(true);
    setDeleteError(undefined);
    try {
      await dataPoliciesApi.remove(deleting.id);
      setNotice(`Deleted "${deleting.name}".`);
      setDeleting(null);
      policies.reload();
    } catch (cause) {
      setDeleteError(messageOf(cause));
    } finally {
      setDeletePending(false);
    }
  }, [deleting, policies]);

  const rows = (policies.data ?? []) as DataPolicySummary[];

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
                    <SelectTrigger className="w-40" aria-label="Classification">
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
                  <SelectTrigger className="w-40" aria-label="Masking action">
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

      <HrisDataTable
        rows={rows}
        columns={buildDataPolicyColumns({ onDelete: (policy) => setDeleting(policy) })}
        filters={buildDataPolicyFilters(rows)}
        searchable
        searchText={DATA_POLICY_SEARCH_TEXT}
        searchPlaceholder="Search by name, classification, resource or masking…"
        selectable={false}
        views={{
          builtIn: DATA_POLICY_BUILT_IN_VIEWS,
          storageKey: DATA_POLICY_VIEWS_STORAGE_KEY,
        }}
        status={policies.loading ? 'loading' : policies.error !== undefined ? 'error' : 'ready'}
        errorCopy={policies.error}
        onRetry={() => policies.reload()}
        emptyTitle="No policies yet"
        emptyDescription="Create a data policy to classify and protect a platform resource."
        noResultsTitle="No policies match this filter"
        noResultsDescription="Try a different search or classification, or clear the filters to see every policy."
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeleteError(undefined);
          }
        }}
        title={`Delete "${deleting?.name ?? ''}"?`}
        description="The policy is removed and its classification, masking and handling rules no longer apply to the target resource. This cannot be undone."
        confirmLabel="Delete policy"
        tone="destructive"
        pending={deletePending}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
      />
    </PageBody>
  );
}
