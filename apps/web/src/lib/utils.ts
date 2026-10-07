import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names, letting later Tailwind utilities win over earlier ones.
 *
 * Plain `clsx` concatenation is not enough: Tailwind emits its rules in a fixed
 * cascade order, so a caller trying to override a component's `p-6` with `p-2`
 * would be ignored regardless of which class appears last in the string.
 * `tailwind-merge` understands which utilities conflict and discards the loser.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
