import { render, screen } from '@testing-library/react';
import type { ResourceSummary } from '@hris/shared-types';
import { describe, expect, it } from 'vitest';

import { ResourceFieldsTable } from './resource-fields-table';

function resource(overrides: Partial<ResourceSummary> = {}): ResourceSummary {
  return {
    id: 'resource-1',
    applicationId: 'app-1',
    moduleId: null,
    moduleKey: 'M00_AUTHENTICATION',
    key: 'user',
    name: 'User',
    description: null,
    resourceType: 'ENTITY',
    supportsCrud: true,
    isActive: true,
    fields: [
      {
        id: 'field-1',
        key: 'email',
        label: 'Email',
        dataType: 'STRING',
        required: true,
        isSensitive: false,
        sortOrder: 0,
      },
      {
        id: 'field-2',
        key: 'recoveryCode',
        label: 'Recovery code',
        dataType: 'STRING',
        required: false,
        isSensitive: true,
        sortOrder: 1,
      },
    ],
    actions: [],
    ...overrides,
  };
}

describe('ResourceFieldsTable', () => {
  it('renders every registered field with its metadata', () => {
    render(<ResourceFieldsTable resource={resource()} />);

    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();
    expect(screen.getByText('Recovery code')).toBeInTheDocument();
    expect(screen.getAllByText('STRING')).toHaveLength(2);
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByText('Optional')).toBeInTheDocument();
    expect(screen.getByText('Sensitive')).toBeInTheDocument();
  });

  it('is honest when a resource registers no fields', () => {
    render(<ResourceFieldsTable resource={resource({ fields: [] })} />);

    expect(screen.getByText(/no fields are registered/i)).toBeInTheDocument();
  });
});
