import React from 'react';
import { cn } from '@/lib/utils/cn';

type SectionCardProps = {
  children: React.ReactNode;
  className?: string;
  /** Use 'surface' for slightly lighter bg (bg-surface-alt), 'default' for bg-zinc-900 */
  variant?: 'default' | 'surface';
  rounded?: 'xl' | '2xl' | '3xl';
  padding?: string;
};

/**
 * Reusable card container.
 * Replaces the repeated `bg-zinc-900 border border-zinc-800 rounded-2xl p-6` pattern.
 */
export function SectionCard({
  children,
  className,
  variant = 'default',
  rounded = '2xl',
  padding = 'p-6',
}: SectionCardProps) {
  return (
    <div
      className={cn(
        'border border-zinc-800',
        `rounded-${rounded}`,
        padding,
        variant === 'surface' ? 'bg-surface-alt' : 'bg-zinc-900',
        className
      )}
    >
      {children}
    </div>
  );
}
