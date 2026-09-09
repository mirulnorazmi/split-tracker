import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExpenses, usePayments, useUsers } from '@/lib/hooks/useData';
import { api } from '@/lib/api';
import { Check, CreditCard, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export default function Approvals() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'expenses' | 'payments'>('expenses');
  const { expenses: pendingExpenses, refetch: refetchExpenses, isLoading: expensesLoading } = useExpenses({ status: 'Pending' });
  const { payments: pendingPayments, refetch: refetchPayments, isLoading: paymentsLoading } = usePayments({ status: 'Pending' });
  const { users } = useUsers();
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  useEffect(() => {
    setPage(1);
  }, [activeTab]);
  
  const currentList = activeTab === 'expenses' ? pendingExpenses : pendingPayments;
  const totalPages = Math.ceil(currentList.length / ITEMS_PER_PAGE);
  const paginatedExpenses = pendingExpenses.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const paginatedPayments = pendingPayments.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleApproveExpense = async (id: string) => {
    setActionLoadingId(id);
    setErrorMsg(null);
    try {
      await api.updateExpenseStatus(id, 'Confirmed');
      await refetchExpenses();
    } catch (err: any) {
      console.error('Failed to approve expense:', err);
      setErrorMsg(err?.message || 'Failed to approve expense.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApprovePayment = async (id: string) => {
    setActionLoadingId(id);
    setErrorMsg(null);
    try {
      await api.updatePaymentStatus(id, 'Confirmed');
      await refetchPayments();
    } catch (err: any) {
      console.error('Failed to approve payment:', err);
      setErrorMsg(err?.message || 'Failed to confirm payment.');
    } finally {
      setActionLoadingId(null);
    }
  };

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
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="mb-6 sm:mb-8 lg:mb-10">
        <div className="text-xs sm:text-sm text-zinc-500 font-medium uppercase tracking-wider mb-1">Admin</div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-tight">Approvals</h1>
        <p className="text-zinc-400 mt-2 text-sm sm:text-base">Manage pending shared expenses and payment submissions.</p>
      </header>

      {errorMsg && (
        <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-2xl flex items-center justify-between text-sm text-red-300">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-zinc-400 hover:text-white text-xs cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('expenses')}
          className={cn('px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-colors relative cursor-pointer', activeTab === 'expenses' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300')}
        >
          Expense Approvals
          {pendingExpenses && pendingExpenses.length > 0 && (
            <span className="ml-2 bg-accent text-accent-text text-xs px-2 py-0.5 rounded-full font-bold">{pendingExpenses.length}</span>
          )}
          {activeTab === 'expenses' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={cn('px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-colors relative cursor-pointer', activeTab === 'payments' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300')}
        >
          Payment Approvals
          {pendingPayments && pendingPayments.length > 0 && (
            <span className="ml-2 bg-accent text-accent-text text-xs px-2 py-0.5 rounded-full font-bold">{pendingPayments.length}</span>
          )}
          {activeTab === 'payments' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
        </button>
      </div>

      <div className="bg-surface-alt border border-zinc-800 rounded-3xl p-4 sm:p-6">
        {activeTab === 'expenses' ? (
          <div className="space-y-4">
            {expensesLoading ? (
              <div className="text-center py-12 text-zinc-500">Loading pending expenses...</div>
            ) : pendingExpenses.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">No pending expenses to approve.</div>
            ) : (
              paginatedExpenses.map((expense) => {
                const creator = users.find((u) => u.id === expense.creatorId);
                const numParticipants = expense.participants?.length || 0;
                const isActing = actionLoadingId === expense.id;

                return (
                  <div
                    key={expense.id}
                    onClick={() => navigate(`/expenses/${expense.id}`)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl border border-zinc-800 bg-zinc-950/50 hover:border-zinc-700 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0 mt-1">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
                          <h3 className="text-white font-medium text-base sm:text-lg group-hover:text-accent transition-colors">{expense.title}</h3>
                          <span className="px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">PENDING</span>
                        </div>
                        <div className="text-xs sm:text-sm text-zinc-400">
                          Requested by <span className="text-zinc-300">{creator?.name || 'Unknown'}</span> • {formatDate(expense.date)}
                        </div>
                        <div className="text-xs sm:text-sm text-zinc-500 mt-1">{numParticipants} Participants</div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:items-end gap-3 sm:gap-4 ml-14 sm:ml-0">
                      <div className="text-xl sm:text-2xl font-semibold text-white">RM {Number(expense.totalAmount).toFixed(2)}</div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button
                          disabled={isActing}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApproveExpense(expense.id);
                          }}
                          className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg bg-accent text-accent-text text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-1 sm:gap-2 disabled:opacity-50 cursor-pointer"
                        >
                          <Check className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> {isActing ? 'Approving...' : 'Approve'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {paymentsLoading ? (
              <div className="text-center py-12 text-zinc-500">Loading pending payments...</div>
            ) : pendingPayments.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">No pending payments to approve.</div>
            ) : (
              paginatedPayments.map((payment) => {
                const payer = users.find((u) => u.id === payment.payerId);
                const payee = users.find((u) => u.id === payment.payeeId);
                const isActing = actionLoadingId === payment.id;

                return (
                  <div
                    key={payment.id}
                    onClick={() => navigate(`/payments/${payment.id}`)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl border border-zinc-800 bg-zinc-950/50 hover:border-zinc-700 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0 mt-1">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
                          <h3 className="text-white font-medium text-base sm:text-lg group-hover:text-accent transition-colors">Payment to {payment.payeeName || payee?.name || 'Unknown'}</h3>
                          <span className="px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">PENDING</span>
                        </div>
                        <div className="text-xs sm:text-sm text-zinc-400">
                          Paid by <span className="text-zinc-300">{payment.payerName || payer?.name || 'Unknown'}</span> • {formatDate(payment.date)}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:items-end gap-3 sm:gap-4 ml-14 sm:ml-0">
                      <div className="text-xl sm:text-2xl font-semibold text-white">RM {Number(payment.amount).toFixed(2)}</div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button
                          disabled={isActing}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprovePayment(payment.id);
                          }}
                          className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg bg-accent text-accent-text text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-1 sm:gap-2 disabled:opacity-50 cursor-pointer"
                        >
                          <Check className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> {isActing ? 'Confirming...' : 'Confirm Payment'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
        
        {/* Pagination Controls */}
        {totalPages >= 1 && (
          <div className="flex items-center justify-between p-4 border-t border-zinc-800/50">
            <div className="text-xs sm:text-sm text-zinc-500">
              Showing <span className="text-zinc-300 font-medium">{(page - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
              <span className="text-zinc-300 font-medium">{Math.min(page * ITEMS_PER_PAGE, currentList.length)}</span> of{' '}
              <span className="text-zinc-300 font-medium">{currentList.length}</span> results
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 sm:p-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-sm font-medium text-zinc-300 px-2 sm:px-4">
                Page {page} of {totalPages}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 sm:p-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
