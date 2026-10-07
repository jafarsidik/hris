import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { installLocalStorageStub } from '@/test/local-storage-stub';

import { CommandPalette } from './command-palette';

type Person = {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly department: string;
};

const searchPeople = vi.hoisted(() => vi.fn(async (_: string): Promise<readonly Person[]> => []));
const push = vi.hoisted(() => vi.fn());

vi.mock('@/app/employees/actions', () => ({ searchPeople }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, prefetch: vi.fn() }),
}));

/**
 * The palette is a client component; the server action it calls is mocked (its real
 * filtering is covered in the actions spec). Recent searches read and write
 * localStorage, so each test starts from an empty inbox to stay order-independent.
 */
beforeEach(() => {
  installLocalStorageStub();
  window.localStorage.clear();
  searchPeople.mockResolvedValue([]);
  push.mockClear();
});

const openPalette = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Search the workspace' }));
};

const sectionHeading = (name: string) =>
  screen.getByText(name, { selector: 'p' }).parentElement as HTMLElement;

describe('CommandPalette', () => {
  it('opens on the trigger and shows the empty-query sections', () => {
    render(<CommandPalette />);
    openPalette();

    expect(screen.getByRole('combobox', { name: 'Search' })).toBeVisible();
    expect(screen.getByText('Quick actions')).toBeInTheDocument();
    expect(screen.getByText('Pages')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Browse directory/ })).toBeInTheDocument();
  });

  it('filters pages and quick actions as the query narrows', () => {
    render(<CommandPalette />);
    openPalette();

    fireEvent.change(screen.getByRole('combobox', { name: 'Search' }), {
      target: { value: 'employee directory' },
    });

    expect(screen.getByRole('button', { name: /Employee Directory/ })).toBeInTheDocument();
    expect(
      within(sectionHeading('Pages')).queryByRole('button', { name: /Add employee/ }),
    ).not.toBeInTheDocument();
  });

  it('shows matching people from the directory search', async () => {
    searchPeople.mockResolvedValue([
      {
        id: 'emp-0001',
        fullName: 'Amara Adeyemi',
        email: 'amara.adeyemi@example.com',
        department: 'Engineering',
      },
    ]);

    render(<CommandPalette />);
    openPalette();

    fireEvent.change(screen.getByRole('combobox', { name: 'Search' }), {
      target: { value: 'amara' },
    });

    await waitFor(() => {
      expect(searchPeople).toHaveBeenCalledWith('amara');
    });

    const person = await waitFor(() => screen.getByRole('button', { name: /Amara Adeyemi/ }));

    expect(person).toBeInTheDocument();
    expect(screen.getByText('People')).toBeInTheDocument();
  });

  it('navigates with Enter and remembers the recent search', () => {
    render(<CommandPalette />);
    openPalette();

    const box = screen.getByRole('combobox', { name: 'Search' });
    fireEvent.change(box, { target: { value: 'add' } });

    // First result of the Quick actions section is "Add employee" because the label
    // contains the needle; Enter runs the highlighted entry.
    fireEvent.keyDown(box, { key: 'Enter' });

    expect(push).toHaveBeenCalledTimes(1);

    const stored = window.localStorage.getItem('hris:recent-searches');
    expect(stored).not.toBeNull();
    expect(stored).toContain('add');
  });

  it('is reachable and dismissible by keyboard', () => {
    render(<CommandPalette />);
    openPalette();

    const box = screen.getByRole('combobox', { name: 'Search' });
    fireEvent.keyDown(box, { key: 'Escape' });

    expect(screen.queryByRole('combobox', { name: 'Search' })).not.toBeInTheDocument();
  });
});
