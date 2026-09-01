/**
 * Utility for conditionally joining Tailwind class names.
 * Filters out falsy values and joins remaining classes with a space.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
