import React from 'react';
import { cn } from '@/lib/utils/cn';

type BadgeVariant = 'pending' | 'confirmed' | 'partial' | 'admin' | 'active' | 'default';

const variantClasses: Record<BadgeVariant, string> = {
  pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  confirmed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  partial: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  admin: 'bg-accent/10 text-accent border-accent/20',
  active: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  default: 'bg-zinc-800 text-zinc-400 border-zinc-700',
};

type BadgeProps = {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
};

/**
 * Reusable status badge component.
 * Replaces all inline status pill patterns scattered across pages.
 */
export function Badge({ variant = 'default', children, className, dot = false }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border',
        variantClasses[variant],
        className
      )}
    >
      {dot && (
        <span className={cn(
          'w-1.5 h-1.5 rounded-full',
          (variant === 'pending' || variant === 'partial') && 'bg-amber-500',
          (variant === 'confirmed' || variant === 'active') && 'bg-emerald-500',
          variant === 'admin' && 'bg-accent',
          variant === 'default' && 'bg-zinc-400'
        )} />
      )}
      {children}
    </span>
  );
}
