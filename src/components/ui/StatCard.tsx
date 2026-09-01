import React from 'react';
import { cn } from '@/lib/utils/cn';

type StatCardProps = {
  label: string;
  value: string;
  subtext?: string;
  badge?: React.ReactNode;
  className?: string;
};

/**
 * Reusable metric/stat card.
 * Replaces the repeated pattern in Payments.tsx and ExpenseDetails.tsx.
 */
export function StatCard({ label, value, subtext, badge, className }: StatCardProps) {
  return (
    <div className={cn('bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between', className)}>
      <div className="flex justify-between items-start mb-4">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{label}</span>
        {badge}
      </div>
      <div>
        <div className="text-4xl font-light text-white mb-1">{value}</div>
        {subtext && <div className="text-xs text-zinc-500">{subtext}</div>}
      </div>
    </div>
  );
}
