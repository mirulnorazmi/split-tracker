import React from 'react';
import { Info } from 'lucide-react';

type InfoBannerProps = {
  title: string;
  description: string;
  icon?: React.ReactNode;
};

/**
 * Reusable informational banner with an icon, title, and description.
 * Replaces the repeated info note pattern in Dashboard, Payments, and Expenses.
 */
export function InfoBanner({ title, description, icon }: InfoBannerProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex gap-4 items-start">
      <div className="w-8 h-8 rounded-full bg-zinc-800/80 flex items-center justify-center shrink-0 mt-0.5">
        {icon ?? <Info className="w-4 h-4 text-zinc-400" />}
      </div>
      <div>
        <h4 className="text-sm font-medium text-zinc-200 mb-0.5">{title}</h4>
        <p className="text-[11px] text-zinc-500 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
