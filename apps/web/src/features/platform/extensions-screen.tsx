'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import type { ExtensionSummary } from '@hris/shared-types';

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
import { extensionsApi } from '@/features/platform/registry-extensions-api';
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

export function ExtensionsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const extensions = useIamLoad(() => extensionsApi.list(), []);
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

  const [extensionKey, setExtensionKey] = useState('');
  const [name, setName] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [description, setDescription] = useState('');
  const [manifestJson, setManifestJson] = useState('{}');
  const [isEnabled, setIsEnabled] = useState(true);

  const resetForm = () => {
    setExtensionKey('');
    setName('');
    setVersion('1.0.0');
    setDescription('');
    setManifestJson('{}');
    setIsEnabled(true);
  };

  const submit = useCallback(async () => {
    setError(undefined);
    setNotice(undefined);
    let manifest: Record<string, unknown> = {};
    try {
      manifest = JSON.parse(manifestJson) as Record<string, unknown>;
    } catch {
      setError('Manifest is not valid JSON.');
      return;
    }
    setBusy(true);
    try {
      await extensionsApi.create({
        extensionKey,
        name,
        description: description.trim() === '' ? null : description,
        version,
        manifest,
        isEnabled,
      });
      setNotice('Extension registered.');
      resetForm();
      setShowForm(false);
      extensions.reload();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }, [extensionKey, name, version, description, manifestJson, isEnabled, extensions]);

  const remove = useCallback(
    async (id: string, n: string) => {
      if (!window.confirm(`Delete “${n}"?`)) {
        return;
      }
      setError(undefined);
      setBusy(true);
      try {
        await extensionsApi.remove(id);
        setNotice(`Deleted “${n}".`);
        extensions.reload();
      } catch (cause) {
        setError(messageOf(cause));
      } finally {
        setBusy(false);
      }
    },
    [extensions],
  );

  const toggle = useCallback(
    async (extension: ExtensionSummary) => {
      setError(undefined);
      try {
        await extensionsApi.toggle(extension.id, !extension.isEnabled);
        extensions.reload();
      } catch (cause) {
        setError(messageOf(cause));
      }
    },
    [extensions],
  );

  const rows = extensions.data ?? [];

  return (
    <PageBody>
      <PageHeader
        title="Extension Registry"
        description="Third-party and customer extensions registered on the platform."
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
                <CardTitle>New extension</CardTitle>
                <CardDescription>Register an extension with its manifest.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
                {showForm ? 'Hide' : 'New extension'}
              </Button>
            </div>
          </CardHeader>
          {showForm && (
            <CardContent className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="extension-key">Extension key</Label>
                  <Input
                    id="extension-key"
                    value={extensionKey}
                    onChange={(e) => setExtensionKey(e.target.value)}
                    placeholder="e.g. hr-payroll-sync"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="extension-name">Name</Label>
                  <Input
                    id="extension-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="extension-version">Version</Label>
                  <Input
                    id="extension-version"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="extension-description">Description</Label>
                <Input
                  id="extension-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="extension-manifest">Manifest (JSON)</Label>
                <Textarea
                  id="extension-manifest"
                  value={manifestJson}
                  onChange={(e) => setManifestJson(e.target.value)}
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
                  disabled={
                    busy ||
                    extensionKey.trim() === '' ||
                    name.trim() === '' ||
                    version.trim() === ''
                  }
                >
                  {busy ? 'Creating…' : 'Register'}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Extensions</CardTitle>
          <CardDescription>
            {extensions.loading
              ? 'Loading…'
              : `${rows.length} extension${rows.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {extensions.error !== undefined && (
            <Alert variant="destructive">
              <AlertDescription>{extensions.error}</AlertDescription>
            </Alert>
          )}
          {extensions.loading && rows.length === 0 ? (
            <Skeleton className="h-40 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No extensions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((extension: ExtensionSummary) => (
                  <TableRow key={extension.id}>
                    <TableCell className="font-mono text-sm">{extension.extensionKey}</TableCell>
                    <TableCell className="font-medium">{extension.name}</TableCell>
                    <TableCell className="font-mono text-sm">{extension.version}</TableCell>
                    <TableCell>
                      <Badge variant={extension.isEnabled ? 'success' : 'secondary'}>
                        {extension.isEnabled ? 'ENABLED' : 'DISABLED'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void toggle(extension)}
                          >
                            {extension.isEnabled ? 'Disable' : 'Enable'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void remove(extension.id, extension.name)}
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
