import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/AuthContext';
import { useExpenses, usePayments, useUsers } from '@/lib/hooks/useData';
import { api, getReceiptUrl } from '@/lib/api';
import { Check, X, CreditCard, FileText, ChevronLeft, ChevronRight, Eye, Image as ImageIcon, History } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ReceiptLightbox } from '@/components';

export default function Approvals() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'Admin';

  const [activeTab, setActiveTab] = useState<'expenses' | 'payments' | 'history'>(() =>
    isAdmin ? 'expenses' : 'payments'
  );
  const [historyFilter, setHistoryFilter] = useState<'all' | 'expenses' | 'payments'>('all');

  // Enforce tab visibility: non-admins cannot access expense approvals tab
  useEffect(() => {
    if (!isAdmin && activeTab === 'expenses') {
      setActiveTab('payments');
    }
  }, [isAdmin, activeTab]);

  // Expenses pending approval (Admin only)
  const {
    expenses: pendingExpenses,
    refetch: refetchExpenses,
    isLoading: expensesLoading,
  } = useExpenses(isAdmin ? { status: 'Pending' } : undefined);

  // Payments pending approval where the current user is the host/payee
  const {
    payments: pendingPayments,
    refetch: refetchPayments,
    isLoading: paymentsLoading,
  } = usePayments({ status: 'Pending', payeeId: currentUser?.id });

  // History data (Confirmed or Rejected)
  const {
    expenses: historyExpenses,
    isLoading: historyExpensesLoading,
  } = useExpenses(isAdmin && activeTab === 'history' ? { status: 'Confirmed,Rejected' } : undefined);

  const {
    payments: historyPayments,
    isLoading: historyPaymentsLoading,
  } = usePayments(
    activeTab === 'history'
      ? { status: 'Confirmed,Rejected', ...(isAdmin ? {} : { payeeId: currentUser?.id }) }
      : undefined
  );

  const { users } = useUsers();
  const { expenses: allExpenses } = useExpenses();

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<any | null>(null);

  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setPage(1);
  }, [activeTab, historyFilter]);

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

  const handleRejectExpense = async (id: string) => {
    setActionLoadingId(id);
    setErrorMsg(null);
    try {
      await api.updateExpenseStatus(id, 'Rejected');
      await refetchExpenses();
    } catch (err: any) {
      console.error('Failed to reject expense:', err);
      setErrorMsg(err?.message || 'Failed to reject expense.');
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

  const handleRejectPayment = async (id: string) => {
    setActionLoadingId(id);
    setErrorMsg(null);
    try {
      await api.updatePaymentStatus(id, 'Rejected');
      await refetchPayments();
    } catch (err: any) {
      console.error('Failed to reject payment:', err);
      setErrorMsg(err?.message || 'Failed to reject payment.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Compile history items
  const historyItems = useMemo(() => {
    const expenseList = (isAdmin ? historyExpenses : []).map((expense) => {
      const creator = users.find((u) => u.id === expense.creatorId);
      return {
        id: expense.id,
        type: 'expense' as const,
        title: expense.title,
        status: expense.status,
        creatorName: creator?.name || 'Unknown',
        date: expense.approvedAt || expense.date,
        amount: Number(expense.totalAmount),
        approvedByName: expense.approvedByName,
        approvedAt: expense.approvedAt,
        raw: expense,
      };
    });

    const paymentList = historyPayments.map((payment) => {
      const payer = users.find((u) => u.id === payment.payerId);
      const appliedExpenseIds = payment.expensesApplied
        ? payment.expensesApplied.map((ea: any) => ea.expenseId)
        : [];
      const paymentExpenses = allExpenses.filter((e) => appliedExpenseIds.includes(e.id));
      let sessionTitle = 'Expense Payment';
      if (paymentExpenses.length > 0) {
        sessionTitle = paymentExpenses[0].title;
      } else if (payment.recurringItemsApplied && payment.recurringItemsApplied.length > 0) {
        sessionTitle = payment.recurringItemsApplied[0].title;
      }

      return {
        id: payment.id,
        type: 'payment' as const,
        title: `${sessionTitle} - from ${payment.payerName || payer?.name || 'Unknown'}`,
        payerName: payment.payerName || payer?.name || 'Unknown',
        status: payment.status,
        date: payment.confirmedDate || payment.date,
        amount: Number(payment.amount),
        receiptUrl: payment.receiptUrl,
        confirmedByName: payment.confirmedByName,
        confirmedDate: payment.confirmedDate,
        raw: payment,
      };
    });

    const combined = [...expenseList, ...paymentList].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    if (historyFilter === 'expenses') return expenseList;
    if (historyFilter === 'payments') return paymentList;
    return combined;
  }, [isAdmin, historyExpenses, historyPayments, users, allExpenses, historyFilter]);

  const currentList =
    activeTab === 'expenses'
      ? pendingExpenses
      : activeTab === 'payments'
      ? pendingPayments
      : historyItems;

  const totalPages = Math.max(1, Math.ceil(currentList.length / ITEMS_PER_PAGE));
  const paginatedList = currentList.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="mb-6 sm:mb-8 lg:mb-10">
        <div className="text-xs sm:text-sm text-zinc-500 font-medium uppercase tracking-wider mb-1">
          {isAdmin ? 'Admin' : 'Management'}
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-tight">Approvals</h1>
        <p className="text-zinc-400 mt-2 text-sm sm:text-base">
          {isAdmin
            ? 'Manage pending shared expenses, payment submissions, and track approval history.'
            : 'Review incoming payment approvals and track previous approved items.'}
        </p>
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
        {isAdmin && (
          <button
            onClick={() => setActiveTab('expenses')}
            className={cn(
              'px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-colors relative cursor-pointer',
              activeTab === 'expenses' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            Expense Approvals
            {pendingExpenses && pendingExpenses.length > 0 && (
              <span className="ml-2 bg-accent text-accent-text text-xs px-2 py-0.5 rounded-full font-bold">
                {pendingExpenses.length}
              </span>
            )}
            {activeTab === 'expenses' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
          </button>
        )}
        <button
          onClick={() => setActiveTab('payments')}
          className={cn(
            'px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-colors relative cursor-pointer',
            activeTab === 'payments' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          Payment Approvals
          {pendingPayments && pendingPayments.length > 0 && (
            <span className="ml-2 bg-accent text-accent-text text-xs px-2 py-0.5 rounded-full font-bold">
              {pendingPayments.length}
            </span>
          )}
          {activeTab === 'payments' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            'px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-colors relative cursor-pointer',
            activeTab === 'history' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          Approval History
          {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
        </button>
      </div>

      <div className="bg-surface-alt border border-zinc-800 rounded-3xl p-4 sm:p-6">
        {/* Sub-filter inside History tab for Admins */}
        {activeTab === 'history' && isAdmin && (
          <div className="flex items-center gap-2 mb-6 bg-zinc-950 p-1 rounded-xl border border-zinc-800 w-fit">
            <button
              onClick={() => setHistoryFilter('all')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer',
                historyFilter === 'all' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              All History
            </button>
            <button
              onClick={() => setHistoryFilter('expenses')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer',
                historyFilter === 'expenses' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              Expenses
            </button>
            <button
              onClick={() => setHistoryFilter('payments')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer',
                historyFilter === 'payments' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              Payments
            </button>
          </div>
        )}

        {/* Tab 1: Expense Approvals (Admin Only) */}
        {activeTab === 'expenses' && (
          <div className="space-y-4">
            {expensesLoading ? (
              <div className="text-center py-12 text-zinc-500">Loading pending expenses...</div>
            ) : pendingExpenses.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">No pending expenses to approve.</div>
            ) : (
              paginatedList.map((expense: any) => {
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
                          <h3 className="text-white font-medium text-base sm:text-lg group-hover:text-accent transition-colors">
                            {expense.title}
                          </h3>
                          <span className="px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            PENDING
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm text-zinc-400">
                          Requested by <span className="text-zinc-300">{creator?.name || 'Unknown'}</span> • Event: {formatDate(expense.date)}
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
                            handleRejectExpense(expense.id);
                          }}
                          className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs sm:text-sm font-bold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1 sm:gap-2 disabled:opacity-50 cursor-pointer"
                        >
                          <X className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> {isActing ? 'Rejecting...' : 'Reject'}
                        </button>
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
        )}

        {/* Tab 2: Payment Approvals (User is Host) */}
        {activeTab === 'payments' && (
          <div className="space-y-4">
            {paymentsLoading ? (
              <div className="text-center py-12 text-zinc-500">Loading pending payments...</div>
            ) : pendingPayments.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                No pending payment approvals for expenses or subscriptions you host.
              </div>
            ) : (
              paginatedList.map((payment: any) => {
                const payer = users.find((u) => u.id === payment.payerId);
                const isActing = actionLoadingId === payment.id;
                const appliedExpenseIds = payment.expensesApplied
                  ? payment.expensesApplied.map((ea: any) => ea.expenseId)
                  : [];
                const paymentExpenses = allExpenses.filter((e) => appliedExpenseIds.includes(e.id));
                let sessionTitle = 'Expense Payment';
                if (paymentExpenses.length > 0) {
                  sessionTitle = paymentExpenses[0].title;
                } else if (payment.recurringItemsApplied && payment.recurringItemsApplied.length > 0) {
                  sessionTitle = payment.recurringItemsApplied[0].title;
                }

                return (
                  <div
                    key={payment.id}
                    onClick={() => navigate(`/payments/${payment.id}`)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl border border-zinc-800 bg-zinc-950/50 hover:border-zinc-700 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      {payment.receiptUrl ? (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReceiptPayment(payment);
                          }}
                          title="Click to preview receipt"
                          className="relative w-12 h-12 rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden shrink-0 cursor-pointer group/thumb shadow-sm"
                        >
                          <img
                            src={getReceiptUrl(payment.receiptUrl)}
                            alt="Receipt"
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-200 group-hover/thumb:scale-110"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                            <Eye className="w-3.5 h-3.5 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0 mt-1">
                          <CreditCard className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
                          <h3 className="text-white font-medium text-base sm:text-lg group-hover:text-accent transition-colors">
                            {sessionTitle} - from {payment.payerName || payer?.name || 'Unknown'}
                          </h3>
                          <span className="px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            PENDING
                          </span>
                          {payment.receiptUrl && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedReceiptPayment(payment);
                              }}
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                            >
                              <ImageIcon className="w-3 h-3" /> Receipt Attached
                            </button>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm text-zinc-400">
                          Paid by <span className="text-zinc-300">{payment.payerName || payer?.name || 'Unknown'}</span> • {formatDate(payment.date)}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:items-end gap-3 sm:gap-4 ml-14 sm:ml-0">
                      <div className="text-xl sm:text-2xl font-semibold text-white">RM {Number(payment.amount).toFixed(2)}</div>
                      <div className="flex gap-2 w-full sm:w-auto items-center">
                        {payment.receiptUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReceiptPayment(payment);
                            }}
                            className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Receipt
                          </button>
                        )}
                        <button
                          disabled={isActing}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRejectPayment(payment.id);
                          }}
                          className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs sm:text-sm font-bold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1 sm:gap-2 disabled:opacity-50 cursor-pointer"
                        >
                          <X className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> {isActing ? 'Rejecting...' : 'Reject'}
                        </button>
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

        {/* Tab 3: Approval History */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {(historyExpensesLoading || historyPaymentsLoading) ? (
              <div className="text-center py-12 text-zinc-500">Loading approval history...</div>
            ) : historyItems.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 flex flex-col items-center justify-center gap-2">
                <History className="w-8 h-8 text-zinc-600" />
                <div className="text-zinc-400 font-medium">No approval history yet.</div>
                <div className="text-xs text-zinc-600">Previously reviewed items will appear here.</div>
              </div>
            ) : (
              paginatedList.map((item: any) => {
                const isRejected = item.status === 'Rejected';
                return (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => navigate(item.type === 'expense' ? `/expenses/${item.id}` : `/payments/${item.id}`)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl border border-zinc-800 bg-zinc-950/50 hover:border-zinc-700 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    {item.type === 'payment' && item.receiptUrl ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReceiptPayment(item.raw);
                        }}
                        title="Click to preview receipt"
                        className="relative w-12 h-12 rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden shrink-0 cursor-pointer group/thumb shadow-sm"
                      >
                        <img
                          src={getReceiptUrl(item.receiptUrl)}
                          alt="Receipt"
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-200 group-hover/thumb:scale-110"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0 mt-1">
                        {item.type === 'expense' ? <FileText className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
                        <h3 className="text-white font-medium text-base sm:text-lg group-hover:text-accent transition-colors">
                          {item.title}
                        </h3>
                        <span
                          className={cn(
                            'px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold',
                            isRejected
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          )}
                        >
                          {isRejected ? 'REJECTED' : 'APPROVED'}
                        </span>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                          {item.type === 'expense' ? 'Expense' : 'Payment'}
                        </span>
                      </div>
                      <div className="text-xs sm:text-sm text-zinc-400">
                        {item.type === 'expense'
                          ? `Requested by ${item.creatorName} • ${isRejected ? 'Rejected' : 'Approved'} ${formatDate(item.date)}${item.approvedByName ? ` by ${item.approvedByName}` : ''}`
                          : `Paid by ${item.payerName} • ${isRejected ? 'Rejected' : 'Confirmed'} ${formatDate(item.date)}${item.confirmedByName ? ` by ${item.confirmedByName}` : ''}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:items-end gap-3 sm:gap-4 ml-14 sm:ml-0">
                    <div className="text-xl sm:text-2xl font-semibold text-white">RM {item.amount.toFixed(2)}</div>
                    {item.type === 'payment' && item.receiptUrl && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReceiptPayment(item.raw);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Receipt
                      </button>
                    )}
                  </div>
                </div>
              );
            })
            )}
          </div>
        )}

        {/* Pagination Controls */}
        {currentList.length > 0 && (
          <div className="flex items-center justify-between p-4 mt-4 border-t border-zinc-800/50">
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

      <ReceiptLightbox
        isOpen={!!selectedReceiptPayment}
        onClose={() => setSelectedReceiptPayment(null)}
        receiptUrl={selectedReceiptPayment?.receiptUrl}
        title={`Payment Receipt - RM ${Number(selectedReceiptPayment?.amount || 0).toFixed(2)}`}
        payerName={selectedReceiptPayment?.payerName}
        amount={Number(selectedReceiptPayment?.amount || 0)}
      />
    </div>
  );
}
