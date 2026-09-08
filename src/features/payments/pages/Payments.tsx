import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useDashboardData, usePayments, useExpenses, useUsers } from '@/lib/hooks/useData';
import { formatCurrency } from '@/lib/utils/currency';

export default function Payments() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { stats } = useDashboardData();
  const { payments, isLoading } = usePayments({ payerId: currentUser?.id });
  const { expenses } = useExpenses();
  const { users } = useUsers();

  const totalOwed = stats?.totalOwed ?? 0;
  const confirmedPayments = stats?.confirmedPayments ?? 0;
  const pendingPayments = stats?.pendingPayments ?? 0;
  const currentBalance = stats?.currentBalance ?? 0;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      <header className="mb-6 sm:mb-8 lg:mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs sm:text-sm text-zinc-500 font-medium uppercase tracking-wider mb-1">Account</div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-tight">Payments</h1>
          <p className="text-zinc-400 mt-2 text-sm sm:text-base">Record payments for specific expenses and monitor their confirmation status.</p>
        </div>
        <Link
          to="/payments/new"
          className="px-5 sm:px-6 py-2.5 sm:py-3 bg-accent text-accent-text font-bold rounded-full hover:opacity-90 transition-opacity whitespace-nowrap text-sm self-start sm:self-auto"
        >
          Submit Payment
        </Link>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3 sm:mb-4">
            <span className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Current Balance</span>
            {currentBalance > 0 && <span className="text-[8px] sm:text-[10px] uppercase font-bold tracking-wider bg-amber-500/10 text-amber-500 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">Due</span>}
          </div>
          <div>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-light text-white mb-1">{formatCurrency(currentBalance)}</div>
            <div className="text-[10px] sm:text-xs text-zinc-500">Still owed</div>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
          <div className="mb-3 sm:mb-4"><span className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Owed</span></div>
          <div>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-light text-white mb-1">{formatCurrency(totalOwed)}</div>
            <div className="text-[10px] sm:text-xs text-zinc-500">From shared expenses</div>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
          <div className="mb-3 sm:mb-4"><span className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Confirmed</span></div>
          <div>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-light text-white mb-1">{formatCurrency(confirmedPayments)}</div>
            <div className="text-[10px] sm:text-xs text-zinc-500">Payments confirmed</div>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
          <div className="mb-3 sm:mb-4"><span className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Pending</span></div>
          <div>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-light text-white mb-1">{formatCurrency(pendingPayments)}</div>
            <div className="text-[10px] sm:text-xs text-zinc-500">Awaiting confirmation</div>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">History</div>
          <div className="text-xs text-zinc-500">{payments.length} records</div>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-zinc-500">Loading payments...</div>
          ) : payments.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="text-zinc-400 font-medium mb-1">No payments yet.</div>
              <div className="text-sm text-zinc-600">Your submitted payments will appear here.</div>
            </div>
          ) : (
            payments.map((payment) => {
              const payee = users.find((u) => u.id === payment.payeeId);
              const payeeName = payment.payeeName || payee?.name || 'Unknown';
              const appliedExpenseIds = payment.expensesApplied
                ? payment.expensesApplied.map((ea: any) => ea.expenseId)
                : [];
              const paymentExpenses = expenses.filter((e) => appliedExpenseIds.includes(e.id));
              const sessionName =
                paymentExpenses.length > 1
                  ? `${paymentExpenses.length} sessions`
                  : paymentExpenses[0]?.title || 'Expense payment';

              return (
                <button
                  key={payment.id}
                  onClick={() => navigate(`/payments/${payment.id}`)}
                  className="w-full text-left p-4 sm:p-5 rounded-xl border border-zinc-800/50 bg-zinc-950/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 group hover:border-zinc-700 hover:bg-surface-alt transition-colors cursor-pointer"
                >
                  <div>
                    <div className="font-medium text-zinc-200 mb-1 flex flex-wrap items-center gap-2 text-sm sm:text-base">
                      <span>{sessionName}</span>
                      <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-zinc-500 bg-zinc-800 px-1.5 sm:px-2 py-0.5 rounded-full">
                        To {payeeName}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 flex flex-wrap items-center gap-1.5">
                      <span>Paid on {formatDate(payment.date)}</span>
                      {payment.confirmedByName && (
                        <>
                          <span>•</span>
                          <span className="text-zinc-400">Confirmed by {payment.confirmedByName}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right self-end sm:self-auto">
                    <div className="font-semibold text-white text-base sm:text-lg mb-1">{formatCurrency(payment.amount)}</div>
                    <div className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full inline-block uppercase font-bold tracking-wider ${payment.status === 'Confirmed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                      {payment.status}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 sm:p-5 flex gap-3 sm:gap-4 items-start">
        <div className="w-8 h-8 rounded-full bg-zinc-800/80 flex items-center justify-center shrink-0 mt-0.5">
          <Info className="w-4 h-4 text-zinc-400" />
        </div>
        <div>
          <h4 className="text-sm font-medium text-zinc-200 mb-1">Payment confirmation</h4>
          <p className="text-xs text-zinc-500 leading-relaxed">
            New payments start as pending. Only an administrator can confirm or reject them. Confirmed payments are then included in your balance calculation.
          </p>
        </div>
      </div>
    </div>
  );
}
