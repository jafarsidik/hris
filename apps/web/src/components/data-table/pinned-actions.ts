/**
 * The class names a row-actions column needs to stay reachable at every width.
 *
 * The columns of a directory need more width than a 1280–1440px window gives them, so the
 * table container scrolls horizontally. Without pinning, the actions column is the one
 * scrolled out of view — measured on the employees directory before this existed, the
 * kebab's centre sat at x=1431 while the scroll container ended at x=1400, so it was
 * invisible and clicking it did nothing until the reader discovered the horizontal
 * scrollbar. Every list that puts its row menu in the last column has the same problem, so
 * the fix lives here rather than being re-derived per screen.
 *
 * Two details make it work:
 *
 * - The opaque background. A pinned cell sits on top of the columns passing underneath it,
 *   so it needs a background of its own; `bg-card` matches the table's card.
 * - `group-hover` / `group-aria-selected` on the cell, with the row carrying `group`. The
 *   row's own hover and selection tints would otherwise stop at the pinned cell, and a
 *   translucent tint would let the scrolled columns show through. `color-mix` composites
 *   the tint against the card so the result is opaque in both themes.
 */
export const PINNED_ACTIONS_HEADER_CLASS = 'sticky right-0 border-l border-border';

export const PINNED_ACTIONS_CELL_CLASS =
  'sticky right-0 w-10 border-l border-border bg-card text-right group-hover:bg-[color-mix(in_oklab,var(--primary)_4%,var(--card))] group-aria-selected:bg-[color-mix(in_oklab,var(--primary)_8%,var(--card))]';
