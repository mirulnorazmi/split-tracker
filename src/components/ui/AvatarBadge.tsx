import React from 'react';
import { cn } from '@/lib/utils/cn';

type AvatarBadgeProps = {
  initials: string;
  avatar?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
};

const sizeClasses = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-12 h-12 text-lg',
};

/**
 * User avatar / initials circle.
 * Renders an avatar image if provided, otherwise falls back to initials.
 */
export function AvatarBadge({ initials, avatar, name, size = 'md', className }: AvatarBadgeProps) {
  return (
    <div
      className={cn(
        'rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-white overflow-hidden shrink-0',
        sizeClasses[size],
        className
      )}
      title={name}
    >
      {avatar ? (
        <img src={avatar} alt={name ?? initials} className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}
