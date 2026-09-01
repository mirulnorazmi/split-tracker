import { useState, useEffect } from 'react';

/**
 * Tailwind v4 default breakpoints (in px).
 * Matches the theme screens: sm=640, md=768, lg=1024, xl=1280, 2xl=1536.
 */
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Returns true when the viewport width is >= the given breakpoint.
 *
 * @example
 * const isDesktop = useBreakpoint('lg');  // true when >= 1024px
 * const isTablet = useBreakpoint('md');   // true when >= 768px
 */
export function useBreakpoint(breakpoint: Breakpoint): boolean {
  const query = `(min-width: ${BREAKPOINTS[breakpoint]}px)`;

  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * Returns true when the viewport width is below the given breakpoint.
 *
 * @example
 * const isMobile = useBelowBreakpoint('md');  // true when < 768px
 */
export function useBelowBreakpoint(breakpoint: Breakpoint): boolean {
  const query = `(max-width: ${BREAKPOINTS[breakpoint] - 1}px)`;

  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}