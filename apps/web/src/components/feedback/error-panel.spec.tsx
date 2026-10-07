import { API_ERROR_CODES } from '@hris/shared-types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '@/lib/api/http-client';

import { ErrorPanel } from './error-panel';

const errorWith = (code: string, correlationId?: string) =>
  new ApiRequestError({
    code: code as ConstructorParameters<typeof ApiRequestError>[0]['code'],
    message: 'backend message that must never be rendered',
    status: 500,
    ...(correlationId === undefined ? {} : { correlationId }),
  });

describe('ErrorPanel', () => {
  it('announces itself as an alert', () => {
    // A failed data fetch that appears silently is a state the reader may not notice.
    render(<ErrorPanel error={errorWith('INTERNAL_ERROR')} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('never renders the backend message', () => {
    for (const code of API_ERROR_CODES) {
      const { unmount } = render(<ErrorPanel error={errorWith(code)} />);

      expect(screen.queryByText(/backend message/i), code).not.toBeInTheDocument();
      unmount();
    }
  });

  it.each([
    ['NOT_FOUND', 'Not found'],
    ['FORBIDDEN', 'You do not have permission to do that'],
    ['RATE_LIMITED', 'Too many requests'],
    ['SERVICE_UNAVAILABLE', 'The service is unavailable'],
  ])('states %s in words', (code, expected) => {
    render(<ErrorPanel error={errorWith(code)} />);

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('cites the correlation id for a support request', () => {
    render(<ErrorPanel error={errorWith('INTERNAL_ERROR', 'req-abc-123')} />);

    expect(screen.getByText('req-abc-123')).toBeInTheDocument();
  });

  it('omits the reference line when there is no correlation id', () => {
    render(<ErrorPanel error={errorWith('INTERNAL_ERROR')} />);

    expect(screen.queryByText(/^Reference:/)).not.toBeInTheDocument();
  });

  it('offers a retry for a failure worth retrying', () => {
    render(<ErrorPanel error={errorWith('SERVICE_UNAVAILABLE')} onRetry={vi.fn()} />);

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('omits the retry button when the error cannot be retried', () => {
    // A "Try again" on a denied permission trains people to click it with no expectation
    // it will work.
    render(<ErrorPanel error={errorWith('FORBIDDEN')} onRetry={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('omits the retry button when no handler was given', () => {
    render(<ErrorPanel error={errorWith('SERVICE_UNAVAILABLE')} />);

    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('calls the handler when the retry button is pressed', async () => {
    const onRetry = vi.fn();
    render(<ErrorPanel error={errorWith('SERVICE_UNAVAILABLE')} onRetry={onRetry} />);

    screen.getByRole('button', { name: /try again/i }).click();

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('handles a value that is not an ApiRequestError', () => {
    render(<ErrorPanel error={new Error('kaboom')} onRetry={vi.fn()} />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('handles a thrown null', () => {
    render(<ErrorPanel error={null} />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders extra children alongside the description', () => {
    render(
      <ErrorPanel error={errorWith('INTERNAL_ERROR')}>
        <p>Additional context</p>
      </ErrorPanel>,
    );

    expect(screen.getByText('Additional context')).toBeInTheDocument();
  });

  it('prints exactly one reference for a route error carrying a digest', () => {
    // This is the real `error.tsx` shape: Next redacts the message and exposes `digest`,
    // so the value is not an ApiRequestError and has no `correlationId`. The digest
    // arrives as a child instead. Two references for one failure would send someone to
    // the log twice and suggest two separate problems.
    const routeError = Object.assign(new Error('digest-redacted'), { digest: 'next-abc-123' });

    render(
      <ErrorPanel error={routeError}>
        <p>
          Reference: <span className="font-mono">{routeError.digest}</span>
        </p>
      </ErrorPanel>,
    );

    expect(screen.getAllByText(/^Reference:/)).toHaveLength(1);
    expect(screen.getByText('next-abc-123')).toBeInTheDocument();
  });

  it('does not invent a reference for a plain error', () => {
    render(
      <ErrorPanel error={new Error('boom')}>
        <p>Unrelated child</p>
      </ErrorPanel>,
    );

    expect(screen.queryByText(/^Reference:/)).not.toBeInTheDocument();
  });
});
