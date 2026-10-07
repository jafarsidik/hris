import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from './empty-state';
import { PageSkeleton } from './page-skeleton';

/**
 * These components exist to communicate a state, so the tests assert on what a screen
 * reader or a sighted user can actually take from them — not on class names.
 */

describe('EmptyState', () => {
  it('states the condition', () => {
    render(<EmptyState title="No employees match these filters" />);

    expect(screen.getByText('No employees match these filters')).toBeInTheDocument();
  });

  it('includes the description when given one', () => {
    render(<EmptyState title="Nothing here" description="Adjust or clear the filters." />);

    expect(screen.getByText('Adjust or clear the filters.')).toBeInTheDocument();
  });

  it('omits the description paragraph when there is none', () => {
    const { container } = render(<EmptyState title="Nothing here" />);

    expect(container.querySelectorAll('p')).toHaveLength(1);
  });

  it('renders an action when given one', () => {
    render(
      <EmptyState title="Nothing here" action={<button type="button">Clear filters</button>} />,
    );

    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('hides the decorative icon from assistive technology', () => {
    // The heading already carries the meaning. An unlabelled graphic announced before it
    // is noise, and "img" with no name is worse than silence.
    const { container } = render(<EmptyState title="Nothing here" />);
    const icon = container.querySelector('svg');

    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('PageSkeleton', () => {
  it('announces that content is loading', () => {
    render(<PageSkeleton />);

    // A skeleton with no announcement reads as a blank, broken region rather than as
    // work in progress.
    expect(screen.getByText('Loading content')).toBeInTheDocument();
  });

  it('marks the region as busy', () => {
    const { container } = render(<PageSkeleton />);

    expect(container.firstChild).toHaveAttribute('aria-busy', 'true');
  });

  // Counted by data-slot rather than by class name. A class-based count silently changes
  // meaning whenever a style is adjusted, and would have reported "0 rows" here for a
  // skeleton that renders them correctly.
  const countSkeletons = (container: HTMLElement) =>
    container.querySelectorAll('[data-slot="skeleton"]').length;

  it('renders the requested number of placeholder rows', () => {
    const { container } = render(<PageSkeleton rows={4} showHeader={false} />);

    expect(countSkeletons(container)).toBe(4);
  });

  it('renders two extra placeholders for the heading by default', () => {
    const withHeader = render(<PageSkeleton rows={2} />).container;
    const withoutHeader = render(<PageSkeleton rows={2} showHeader={false} />).container;

    expect(countSkeletons(withHeader)).toBe(countSkeletons(withoutHeader) + 2);
  });

  it('renders nothing extra when the heading is suppressed', () => {
    const { container } = render(<PageSkeleton rows={3} showHeader={false} />);

    expect(countSkeletons(container)).toBe(3);
  });

  it('hides the loading label from the visual layout', () => {
    render(<PageSkeleton rows={1} />);

    // sr-only, so it reaches a screen reader without appearing on screen.
    expect(screen.getByText('Loading content')).toHaveClass('sr-only');
  });
});
