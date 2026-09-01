import React from 'react';
import { CheckCircle2 } from 'lucide-react';

type SuccessScreenProps = {
  title: string;
  message: React.ReactNode;
  countdown: number;
};

/**
 * Reusable success + countdown redirect screen.
 * Replaces the duplicated success view in NewExpense, NewPayment, and ExpenseDetails.
 */
export function SuccessScreen({ title, message, countdown }: SuccessScreenProps) {
  return (
    <div className="max-w-xl mx-auto py-20 text-center animate-in zoom-in-95 duration-500">
      <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 className="w-10 h-10" />
      </div>
      <h1 className="text-3xl font-light text-white tracking-tight mb-4">{title}</h1>
      <p className="text-zinc-400 text-lg mb-8">{message}</p>
      <p className="text-zinc-500 text-sm">
        Redirecting in {countdown} second{countdown !== 1 ? 's' : ''}...
      </p>
    </div>
  );
}
