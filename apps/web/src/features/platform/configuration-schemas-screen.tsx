'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { ConfigurationSchemaSummary } from '@hris/shared-types';

import { Trash2 } from 'lucide-react';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { configurationSchemasApi } from '@/features/platform/registry-extensions-api';
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

export function ConfigurationSchemasScreen() {
  const router = useRouter();
  const { state } = useSession();
  const schemas = useIamLoad(() => configurationSchemasApi.list(), []);
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

  const [resourceKey, setResourceKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schemaJson, setSchemaJson] = useState('{}');
  const [isActive, setIsActive] = useState(true);

  const resetForm = () => {
    setResourceKey('');
    setName('');
    setDescription('');
    setSchemaJson('{}');
    setIsActive(true);
  };

  const submit = useCallback(async () => {
    setError(undefined);
    setNotice(undefined);
    let schema: Record<string, unknown> = {};
    try {
      schema = JSON.parse(schemaJson) as Record<string, unknown>;
    } catch {
      setError('Schema is not valid JSON.');
      return;
    }
    setBusy(true);
    try {
      await configurationSchemasApi.create({
        resourceKey,
        name,
        description: description.trim() === '' ? null : description,
        schemaJson: schema,
        isActive,
      });
      setNotice('Configuration schema created.');
      resetForm();
      setShowForm(false);
      schemas.reload();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }, [resourceKey, name, description, schemaJson, isActive, schemas]);

  const remove = useCallback(
    async (id: string, n: string) => {
      if (!window.confirm(`Delete “${n}"?`)) {
        return;
      }
      setError(undefined);
      setBusy(true);
      try {
        await configurationSchemasApi.remove(id);
        setNotice(`Deleted “${n}".`);
        schemas.reload();
      } catch (cause) {
        setError(messageOf(cause));
      } finally {
        setBusy(false);
      }
    },
    [schemas],
  );

  const toggle = useCallback(
    async (schema: ConfigurationSchemaSummary) => {
      setError(undefined);
      try {
        await configurationSchemasApi.toggle(schema.id, !schema.isActive);
        schemas.reload();
      } catch (cause) {
        setError(messageOf(cause));
      }
    },
    [schemas],
  );

  const rows = schemas.data ?? [];

  return (
    <PageBody>
      <PageHeader
        title="Configuration Schemas"
        description="Validated configuration shapes per registered resource."
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
                <CardTitle>New schema</CardTitle>
                <CardDescription>Declare the configuration shape for a resource.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
                {showForm ? 'Hide' : 'New schema'}
              </Button>
            </div>
          </CardHeader>
          {showForm && (
            <CardContent className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="schema-resource">Resource key</Label>
                  <Input
                    id="schema-resource"
                    value={resourceKey}
                    onChange={(e) => setResourceKey(e.target.value)}
                    placeholder="e.g. payroll"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="schema-name">Name</Label>
                  <Input id="schema-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="schema-description">Description</Label>
                <Input
                  id="schema-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="schema-json">Schema (JSON)</Label>
                <Textarea
                  id="schema-json"
                  value={schemaJson}
                  onChange={(e) => setSchemaJson(e.target.value)}
                  rows={5}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex items-end gap-3">
                <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void submit()}
                  disabled={busy || resourceKey.trim() === '' || name.trim() === ''}
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
          <CardTitle>Schemas</CardTitle>
          <CardDescription>
            {schemas.loading ? 'Loading…' : `${rows.length} schema${rows.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {schemas.error !== undefined && (
            <Alert variant="destructive">
              <AlertDescription>{schemas.error}</AlertDescription>
            </Alert>
          )}
          {schemas.loading && rows.length === 0 ? (
            <Skeleton className="h-40 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No schemas yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resource</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((schema: ConfigurationSchemaSummary) => (
                  <TableRow key={schema.id}>
                    <TableCell className="font-mono text-sm">{schema.resourceKey}</TableCell>
                    <TableCell className="font-medium">{schema.name}</TableCell>
                    <TableCell>
                      <Badge variant={schema.isActive ? 'success' : 'secondary'}>
                        {schema.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => void toggle(schema)}>
                            {schema.isActive ? 'Disable' : 'Enable'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void remove(schema.id, schema.name)}
                          >
                            <Trash2 className="mr-1 size-4" aria-hidden />
                            Delete
                          </Button>
                        </div>
                      )}
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
