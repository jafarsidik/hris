'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Section } from '@/components/layout/section';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormErrorSummary } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import type { SystemSettingReadModel } from '@hris/shared-types';

import { useSession } from '@/features/auth/session-context';
import { getIam } from '@/features/iam';
import type { SettingUpdateInput } from '@/features/iam/iam-types';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { ApiRequestError } from '@/lib/api/http-client';
import { Check, CheckCircle2 } from 'lucide-react';

function SettingControl({
  setting,
  draft,
  onChange,
}: {
  setting: SystemSettingReadModel;
  draft: string;
  onChange: (value: string) => void;
}) {
  if (setting.valueType === 'BOOLEAN') {
    const checked = draft === 'true';
    return (
      <div className="flex items-center gap-2">
        <Switch checked={checked} onCheckedChange={(next) => onChange(next ? 'true' : 'false')} />
        <span className="text-sm">{checked ? 'Enabled' : 'Disabled'}</span>
      </div>
    );
  }
  return (
    <Input
      aria-label={setting.key}
      type={setting.valueType === 'NUMBER' ? 'number' : 'text'}
      value={draft}
      placeholder={
        setting.isSensitive && draft === '' ? '(leave blank to keep the stored value)' : undefined
      }
      onChange={(event) => onChange(event.currentTarget.value)}
      readOnly={!setting.isEditable}
    />
  );
}

export function SettingsScreen({
  group,
  title = 'System Parameters',
  description = 'Company-wide HR configuration for this workspace.',
}: {
  /** Restricts the view to a single settings group, for a focused policy page. */
  group?: string;
  title?: string;
  description?: string;
} = {}) {
  const router = useRouter();
  const { state } = useSession();
  const repository = getIam();
  const list = useIamLoad(() => repository.listSettings(group), [group]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  useEffect(() => {
    if (list.data !== null) {
      setDraft(Object.fromEntries(list.data.map((setting) => [setting.key, setting.value ?? ''])));
    }
  }, [list.data]);

  const byGroup = new Map<string, SystemSettingReadModel[]>();
  for (const setting of list.data ?? []) {
    const current = byGroup.get(setting.group) ?? [];
    current.push(setting);
    byGroup.set(setting.group, current);
  }

  function dirtyItems(): readonly SettingUpdateInput[] {
    const items: SettingUpdateInput[] = [];
    for (const setting of list.data ?? []) {
      const next = draft[setting.key] ?? '';
      const original = setting.value ?? '';
      if (setting.isEditable && next !== original) {
        items.push({ key: setting.key, value: next });
      }
    }
    return items;
  }

  async function save() {
    setPending(true);
    setError(undefined);
    setSaved(false);
    try {
      const changed = dirtyItems();
      await repository.updateSettings(changed);
      setSaved(true);
      list.reload();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Settings could not be saved.');
    } finally {
      setPending(false);
    }
  }

  const editableChanges = dirtyItems().length;

  return (
    <PageBody>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button
            variant="default"
            disabled={pending || editableChanges === 0}
            onClick={() => void save()}
          >
            {saved && <Check aria-hidden="true" className="size-4" />}
            {pending
              ? 'Saving…'
              : `Save changes${editableChanges > 0 ? ` (${editableChanges})` : ''}`}
          </Button>
        }
      />
      {error !== undefined && <FormErrorSummary>{error}</FormErrorSummary>}
      {saved && (
        <Alert variant="success">
          <CheckCircle2 aria-hidden="true" />
          <AlertTitle>Settings saved</AlertTitle>
          <AlertDescription>Your changes are now in effect for this company.</AlertDescription>
        </Alert>
      )}
      {list.loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : list.error !== undefined ? (
        <p role="alert" className="text-sm text-destructive">
          {list.error}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {Array.from(byGroup.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([groupName, settings]) => (
              <Section
                key={groupName}
                title={groupName.charAt(0).toUpperCase() + groupName.slice(1)}
                bodyClassName="p-0"
              >
                <div className="flex flex-col">
                  {settings.map((setting, index) => (
                    <div
                      key={setting.key}
                      className={`grid items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_280px] sm:px-5 ${
                        index > 0 ? 'border-t border-border' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-medium">{setting.key}</div>
                        {setting.description !== null && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {setting.description}
                          </p>
                        )}
                        {!setting.isEditable && (
                          <p className="mt-0.5 text-xs text-muted-foreground">System-managed.</p>
                        )}
                      </div>
                      <SettingControl
                        setting={setting}
                        draft={draft[setting.key] ?? ''}
                        onChange={(value) =>
                          setDraft((current) => ({ ...current, [setting.key]: value }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </Section>
            ))}
        </div>
      )}
    </PageBody>
  );
}
