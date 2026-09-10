import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Info, Loader2 } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useDashboardData, usePayments, useExpenses, useUsers } from '@/lib/hooks/useData';
import { formatCurrency } from '@/lib/utils/currency';

export default function Payments() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { stats } = useDashboardData();
  const [activeTab, setActiveTab] = useState<'sent' | 'received'>('sent');
  const { payments: sentPayments, isLoading: sentLoading } = usePayments({ payerId: currentUser?.id });
  const { payments: receivedPayments, isLoading: receivedLoading } = usePayments({ payeeId: currentUser?.id });
  const { expenses } = useExpenses();
  const { users } = useUsers();

  const [visibleCount, setVisibleCount] = useState(5);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const currentPayments = activeTab === 'sent' ? sentPayments : receivedPayments;
  const isLoading = activeTab === 'sent' ? sentLoading : receivedLoading;
  const pendingReceivedCount = receivedPayments.filter((p) => p.status === 'Pending').length;

  useEffect(() => {
    setVisibleCount(5);
  }, [activeTab]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollContainerRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 5, currentPayments.length));
        }
      },
      {
        root: container,
        rootMargin: '120px',
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [currentPayments.length]);

  const visiblePayments = currentPayments.slice(0, visibleCount);

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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-800 w-fit">
            <button
              onClick={() => setActiveTab('sent')}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'sent'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Sent ({sentPayments.length})
            </button>
            <button
              onClick={() => setActiveTab('received')}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'received'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Received ({receivedPayments.length})</span>
              {pendingReceivedCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full">
                  {pendingReceivedCount} pending
                </span>
              )}
            </button>
          </div>
          <div className="text-xs text-zinc-500">{currentPayments.length} records</div>
        </div>

        <div
          ref={scrollContainerRef}
          className="max-h-[540px] overflow-y-auto space-y-3 pr-1.5 custom-scrollbar"
        >
          {isLoading ? (
            <div className="py-12 text-center text-zinc-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
              <span>Loading payments...</span>
            </div>
          ) : currentPayments.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="text-zinc-400 font-medium mb-1">
                {activeTab === 'sent' ? 'No sent payments yet.' : 'No received payments yet.'}
              </div>
              <div className="text-sm text-zinc-600">
                {activeTab === 'sent'
                  ? 'Your submitted payments will appear here.'
                  : 'Payments submitted to you by expense participants will appear here for confirmation.'}
              </div>
            </div>
          ) : (
            visiblePayments.map((payment) => {
              const payee = users.find((u) => u.id === payment.payeeId);
              const payeeName = payment.payeeName || payee?.name || 'Unknown';
              const payer = users.find((u) => u.id === payment.payerId);
              const payerName = payment.payerName || payer?.name || 'Unknown';

              const appliedExpenseIds = payment.expensesApplied
                ? payment.expensesApplied.map((ea: any) => ea.expenseId)
                : [];
              const paymentExpenses = expenses.filter((e) => appliedExpenseIds.includes(e.id));
              
              let sessionName = 'Expense payment';
              if (paymentExpenses.length > 1) {
                sessionName = `${paymentExpenses.length} sessions`;
              } else if (paymentExpenses.length === 1) {
                sessionName = paymentExpenses[0].title;
              } else if (payment.recurringItemsApplied && payment.recurringItemsApplied.length > 0) {
                const item = payment.recurringItemsApplied[0];
                const count = payment.recurringItemsApplied.length;
                if (count === 1 && item.periodKey) {
                  const d = new Date(item.periodKey + '-01');
                  sessionName = `${item.title} (${d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })})`;
                } else {
                  sessionName = count > 1 ? `${item.title} (${count} cycles)` : item.title;
                }
              }

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
                        {activeTab === 'sent' ? `To ${payeeName}` : `From ${payerName}`}
                      </span>
                      {activeTab === 'received' && payment.status === 'Pending' && (
                        <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-accent bg-accent/10 border border-accent/20 px-1.5 sm:px-2 py-0.5 rounded-full">
                          Action Required
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 flex flex-wrap items-center gap-1.5">
                      <span>{activeTab === 'sent' ? 'Paid on' : 'Received on'} {formatDate(payment.date)}</span>
                      {payment.confirmedByName && (
                        <>
                          <span>•</span>
                          <span className="text-zinc-400">
                            {payment.status === 'Rejected' ? 'Rejected' : 'Confirmed'} by {payment.confirmedByName}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right self-end sm:self-auto">
                    <div className="font-semibold text-white text-base sm:text-lg mb-1">{formatCurrency(payment.amount)}</div>
                    <div
                      className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full inline-block uppercase font-bold tracking-wider ${
                        payment.status === 'Confirmed'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : payment.status === 'Rejected'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-amber-500/10 text-amber-500'
                      }`}
                    >
                      {payment.status}
                    </div>
                  </div>
                </button>
              );
            })
          )}

          {/* Infinite Scroll Sentinel / Trigger */}
          {visibleCount < currentPayments.length && (
            <div ref={sentinelRef} className="pt-3 pb-2 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => Math.min(prev + 5, currentPayments.length))}
                className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-2 shadow-sm"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                Load More Payments ({currentPayments.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </div>

        {/* Footer Summary */}
        {currentPayments.length > 0 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-800/60 text-xs text-zinc-500">
            <div>
              Showing <span className="text-zinc-300 font-medium">{Math.min(visibleCount, currentPayments.length)}</span> of{' '}
              <span className="text-zinc-300 font-medium">{currentPayments.length}</span> records
            </div>
            {visibleCount >= currentPayments.length ? (
              <span className="text-zinc-500 font-medium">All records loaded</span>
            ) : (
              <span className="text-zinc-500 hidden sm:inline">Scroll inside table for more</span>
            )}
          </div>
        )}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 sm:p-5 flex gap-3 sm:gap-4 items-start">
        <div className="w-8 h-8 rounded-full bg-zinc-800/80 flex items-center justify-center shrink-0 mt-0.5">
          <Info className="w-4 h-4 text-zinc-400" />
        </div>
        <div>
          <h4 className="text-sm font-medium text-zinc-200 mb-1">Payment Confirmation</h4>
          <p className="text-xs text-zinc-500 leading-relaxed">
            New payments start as pending. Only the host of the expense (the person who paid upfront) can review and confirm them. Confirmed payments are then officially settled into balances.
          </p>
        </div>
      </div>
    </div>
  );
}
