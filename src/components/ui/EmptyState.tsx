import React from 'react';
import { cn } from '@/lib/utils/cn';

type EmptyStateProps = {
  message?: string;
  className?: string;
  /** Use 'dashed' for dashed border (e.g. filter results), 'solid' for normal card */
  border?: 'dashed' | 'solid' | 'none';
};

/**
 * Standardised empty list / no-results component.
 */
export function EmptyState({
  message = 'Nothing here yet.',
  className,
  border = 'solid',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'py-12 flex items-center justify-center text-center text-sm text-zinc-500 rounded-xl',
        border === 'dashed' && 'border border-dashed border-zinc-800',
        border === 'solid' && 'border border-zinc-800/50 bg-zinc-950/50',
        className
      )}
    >
      {message}
    </div>
  );
}
