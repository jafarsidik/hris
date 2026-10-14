'use client';

import { useState } from 'react';

import {
  FIELD_DATA_TYPES,
  RESOURCE_TYPES,
  type ApplicationSummary,
  type FieldDataType,
  type ModuleSummary,
  type ResourceSummary,
  type ResourceType,
} from '@hris/shared-types';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiRequestError } from '@/lib/api/http-client';

import { platformApi } from './platform-api';

/** Turns an unknown rejection into a message a form can render inline. */
function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  return 'The change could not be saved.';
}

interface Notice {
  readonly kind: 'error' | 'success';
  readonly message: string;
}

function NoticeAlert({ notice }: { readonly notice: Notice | undefined }) {
  if (!notice) {
    return null;
  }
  return (
    <Alert variant={notice.kind === 'error' ? 'destructive' : undefined}>
      <AlertDescription>{notice.message}</AlertDescription>
    </Alert>
  );
}

interface RegistryAdminProps {
  readonly applications: readonly ApplicationSummary[];
  readonly modules: readonly ModuleSummary[];
  readonly onChanged: () => void;
}

/**
 * Register forms for the metadata registry.
 *
 * These are the write half of the "Application & Metadata" screen: an operator can
 * stand up a new application, module or resource without editing platform source.
 * The API enforces `registry:create`, so the forms simply surface any rejection.
 */
export function RegistryAdmin({ applications, modules, onChanged }: RegistryAdminProps) {
  const [notice, setNotice] = useState<Notice | undefined>();
  const [pending, setPending] = useState(false);

  const [app, setApp] = useState({ key: '', name: '', description: '' });
  const [moduleForm, setModuleForm] = useState({
    applicationKey: '',
    key: '',
    name: '',
    description: '',
  });
  const [resource, setResource] = useState({
    applicationKey: '',
    moduleKey: '',
    key: '',
    name: '',
    resourceType: RESOURCE_TYPES[0] as ResourceType,
    supportsCrud: false,
  });

  const applicationKey = app.key;
  const moduleApplicationKey = moduleForm.applicationKey;
  const resourceApplicationKey = resource.applicationKey;
  const resourceModuleKey = resource.moduleKey;

  const run = async (task: () => Promise<unknown>, success: string): Promise<void> => {
    setNotice(undefined);
    setPending(true);
    try {
      await task();
      setNotice({ kind: 'success', message: success });
      onChanged();
    } catch (error) {
      setNotice({ kind: 'error', message: messageOf(error) });
    } finally {
      setPending(false);
    }
  };

  const moduleOptions = modules.filter(
    (module) => module.applicationId === applicationIdOf(applications, resourceApplicationKey),
  );

  return (
    <div className="flex flex-col gap-4">
      <NoticeAlert notice={notice} />

      <Card>
        <CardHeader>
          <CardTitle>Register application</CardTitle>
          <CardDescription>A deployed application that owns modules and resources.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="app-key">Key</Label>
            <Input
              id="app-key"
              placeholder="project-tracker"
              value={app.key}
              onChange={(event) => setApp({ ...app, key: event.currentTarget.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="app-name">Name</Label>
            <Input
              id="app-name"
              value={app.name}
              onChange={(event) => setApp({ ...app, name: event.currentTarget.value })}
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label htmlFor="app-desc">Description</Label>
            <Input
              id="app-desc"
              value={app.description}
              onChange={(event) => setApp({ ...app, description: event.currentTarget.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              disabled={pending || applicationKey.length < 2 || app.name.length < 2}
              onClick={() =>
                void run(
                  () =>
                    platformApi.createRegistryApplication({
                      key: applicationKey,
                      name: app.name,
                      description: app.description || undefined,
                    }),
                  `Registered application "${applicationKey}".`,
                ).then(() => setApp({ key: '', name: '', description: '' }))
              }
            >
              Register application
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Register module</CardTitle>
          <CardDescription>A functional area within an application.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="module-app">Application</Label>
            <select
              id="module-app"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={moduleForm.applicationKey}
              onChange={(event) =>
                setModuleForm({ ...moduleForm, applicationKey: event.currentTarget.value })
              }
            >
              <option value="">Select an application</option>
              {applications.map((application) => (
                <option key={application.id} value={application.key}>
                  {application.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="module-key">Key</Label>
            <Input
              id="module-key"
              placeholder="M10_PROJECTS"
              value={moduleForm.key}
              onChange={(event) => setModuleForm({ ...moduleForm, key: event.currentTarget.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="module-name">Name</Label>
            <Input
              id="module-name"
              value={moduleForm.name}
              onChange={(event) =>
                setModuleForm({ ...moduleForm, name: event.currentTarget.value })
              }
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="module-desc">Description</Label>
            <Input
              id="module-desc"
              value={moduleForm.description}
              onChange={(event) =>
                setModuleForm({ ...moduleForm, description: event.currentTarget.value })
              }
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              disabled={
                pending ||
                moduleApplicationKey.length === 0 ||
                moduleForm.key.length < 2 ||
                moduleForm.name.length < 2
              }
              onClick={() =>
                void run(
                  () =>
                    platformApi.createRegistryModule({
                      applicationKey: moduleApplicationKey,
                      key: moduleForm.key,
                      name: moduleForm.name,
                      description: moduleForm.description || undefined,
                    }),
                  `Registered module "${moduleForm.key}".`,
                ).then(() =>
                  setModuleForm({ applicationKey: '', key: '', name: '', description: '' }),
                )
              }
            >
              Register module
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Register resource</CardTitle>
          <CardDescription>
            A governed entity, transaction or configuration within a module.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="resource-app">Application</Label>
            <select
              id="resource-app"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={resource.applicationKey}
              onChange={(event) =>
                setResource({
                  ...resource,
                  applicationKey: event.currentTarget.value,
                  moduleKey: '',
                })
              }
            >
              <option value="">Select an application</option>
              {applications.map((application) => (
                <option key={application.id} value={application.key}>
                  {application.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="resource-module">Module (optional)</Label>
            <select
              id="resource-module"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={resource.moduleKey}
              disabled={resourceApplicationKey.length === 0}
              onChange={(event) =>
                setResource({ ...resource, moduleKey: event.currentTarget.value })
              }
            >
              <option value="">No module</option>
              {moduleOptions.map((module) => (
                <option key={module.id} value={module.key}>
                  {module.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="resource-key">Key</Label>
            <Input
              id="resource-key"
              placeholder="project-task"
              value={resource.key}
              onChange={(event) => setResource({ ...resource, key: event.currentTarget.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="resource-name">Name</Label>
            <Input
              id="resource-name"
              value={resource.name}
              onChange={(event) => setResource({ ...resource, name: event.currentTarget.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="resource-type">Type</Label>
            <select
              id="resource-type"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={resource.resourceType}
              onChange={(event) =>
                setResource({
                  ...resource,
                  resourceType: event.currentTarget.value as ResourceType,
                })
              }
            >
              {RESOURCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              id="resource-crud"
              type="checkbox"
              className="size-4"
              checked={resource.supportsCrud}
              onChange={(event) =>
                setResource({ ...resource, supportsCrud: event.currentTarget.checked })
              }
            />
            <Label htmlFor="resource-crud">Enable generic CRUD</Label>
          </div>
          <div className="sm:col-span-2">
            <Button
              disabled={
                pending ||
                resourceApplicationKey.length === 0 ||
                resource.key.length < 2 ||
                resource.name.length < 2
              }
              onClick={() =>
                void run(
                  () =>
                    platformApi.createRegistryResource({
                      applicationKey: resourceApplicationKey,
                      moduleKey: resourceModuleKey || undefined,
                      key: resource.key,
                      name: resource.name,
                      resourceType: resource.resourceType,
                      supportsCrud: resource.supportsCrud,
                    }),
                  `Registered resource "${resource.key}".`,
                ).then(() =>
                  setResource({
                    applicationKey: '',
                    moduleKey: '',
                    key: '',
                    name: '',
                    resourceType: RESOURCE_TYPES[0] as ResourceType,
                    supportsCrud: false,
                  }),
                )
              }
            >
              Register resource
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ResourceMetadataFormsProps {
  readonly resource: ResourceSummary;
  readonly onChanged: () => void;
}

/** Add-field and add-action forms shown inside a registered resource's details. */
export function ResourceMetadataForms({ resource, onChanged }: ResourceMetadataFormsProps) {
  const [notice, setNotice] = useState<Notice | undefined>();
  const [pending, setPending] = useState(false);
  const [field, setField] = useState({
    key: '',
    label: '',
    dataType: FIELD_DATA_TYPES[0] as FieldDataType,
    required: false,
    isSensitive: false,
  });
  const [action, setAction] = useState({ action: '', name: '', description: '' });

  const run = async (task: () => Promise<unknown>, success: string): Promise<void> => {
    setNotice(undefined);
    setPending(true);
    try {
      await task();
      setNotice({ kind: 'success', message: success });
      onChanged();
    } catch (error) {
      setNotice({ kind: 'error', message: messageOf(error) });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-4">
      <NoticeAlert notice={notice} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`field-key-${resource.id}`}>Field key</Label>
          <Input
            id={`field-key-${resource.id}`}
            value={field.key}
            onChange={(event) => setField({ ...field, key: event.currentTarget.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`field-label-${resource.id}`}>Field label</Label>
          <Input
            id={`field-label-${resource.id}`}
            value={field.label}
            onChange={(event) => setField({ ...field, label: event.currentTarget.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`field-type-${resource.id}`}>Data type</Label>
          <select
            id={`field-type-${resource.id}`}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={field.dataType}
            onChange={(event) =>
              setField({ ...field, dataType: event.currentTarget.value as FieldDataType })
            }
          >
            {FIELD_DATA_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <input
              id={`field-required-${resource.id}`}
              type="checkbox"
              className="size-4"
              checked={field.required}
              onChange={(event) => setField({ ...field, required: event.currentTarget.checked })}
            />
            <Label htmlFor={`field-required-${resource.id}`}>Required</Label>
          </span>
          <span className="flex items-center gap-2">
            <input
              id={`field-sensitive-${resource.id}`}
              type="checkbox"
              className="size-4"
              checked={field.isSensitive}
              onChange={(event) => setField({ ...field, isSensitive: event.currentTarget.checked })}
            />
            <Label htmlFor={`field-sensitive-${resource.id}`}>Sensitive</Label>
          </span>
        </div>
        <div className="sm:col-span-2">
          <Button
            variant="outline"
            disabled={pending || field.key.length < 2 || field.label.length === 0}
            onClick={() =>
              void run(
                () =>
                  platformApi.addRegistryResourceField(resource.key, {
                    key: field.key,
                    label: field.label,
                    dataType: field.dataType,
                    required: field.required,
                    isSensitive: field.isSensitive,
                  }),
                `Added field "${field.key}".`,
              ).then(() => setField({ ...field, key: '', label: '' }))
            }
          >
            Add field
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`action-key-${resource.id}`}>Action key</Label>
          <Input
            id={`action-key-${resource.id}`}
            placeholder="approve"
            value={action.action}
            onChange={(event) => setAction({ ...action, action: event.currentTarget.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`action-name-${resource.id}`}>Action name</Label>
          <Input
            id={`action-name-${resource.id}`}
            value={action.name}
            onChange={(event) => setAction({ ...action, name: event.currentTarget.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Button
            variant="outline"
            disabled={pending || action.action.length < 2 || action.name.length === 0}
            onClick={() =>
              void run(
                () =>
                  platformApi.addRegistryResourceAction(resource.key, {
                    action: action.action,
                    name: action.name,
                    description: action.description || undefined,
                  }),
                `Added action "${action.action}".`,
              ).then(() => setAction({ action: '', name: '', description: '' }))
            }
          >
            Add action
          </Button>
        </div>
      </div>
    </div>
  );
}

function applicationIdOf(
  applications: readonly ApplicationSummary[],
  key: string,
): string | undefined {
  return applications.find((application) => application.key === key)?.id;
}
