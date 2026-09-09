import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Plus, Search, X, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useExpenses, usePayments, useCategories, useUsers } from '@/lib/hooks/useData';
import { isExpenseClosed, getUserShare, getUserPaidAmount, getUserPendingAmount, getUserRemainingShare } from '@/lib/utils/expense';
import { api } from '@/lib/api';

function getTitleInitials(title: string): string {
  if (!title) return 'EX';
  const clean = title.trim().replace(/[^\w\s]/gi, '');
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return title.slice(0, 2).toUpperCase() || 'EX';
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

export default function Expenses() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { expenses, isLoading: expensesLoading, refetch: refetchExpenses } = useExpenses();
  const { payments } = usePayments();
  const { categories } = useCategories();
  const { users } = useUsers();

  const [listTab, setListTab] = useState<'all' | 'created'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const currentUserId = currentUser?.id || '';
  const isAdmin = currentUser?.role === 'Admin';

  const handleDeleteExpense = async (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${title}"? All associated participant records will be permanently removed.`)) {
      return;
    }
    try {
      await api.deleteExpense(id);
      window.dispatchEvent(new Event('splittrack:data-changed'));
      refetchExpenses();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete expense');
    }
  };

  const isParticipant = (exp: any, uid: string) => {
    if (!exp.participants || !Array.isArray(exp.participants)) return false;
    return exp.participants.some((p: any) => (typeof p === 'string' ? p === uid : p.userId === uid));
  };

  const baseExpenses =
    listTab === 'all'
      ? expenses.filter((exp) => isParticipant(exp, currentUserId) || exp.creatorId === currentUserId)
      : expenses.filter((exp) => exp.creatorId === currentUserId);

  const filteredExpenses = baseExpenses.filter((expense) => {
    if (searchQuery && !expense.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    const closed = isExpenseClosed(expense, payments);
    if (statusFilter === 'open' && closed) return false;
    if (statusFilter === 'closed' && !closed) return false;

    // Date range filtering
    if (startDate || endDate) {
      const expDate = new Date(expense.date).toISOString().slice(0, 10);
      if (startDate && expDate < startDate) return false;
      if (endDate && expDate > endDate) return false;
    }

    return true;
  });

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

  useEffect(() => {
    setPage(1);
  }, [listTab, searchQuery, statusFilter, startDate, endDate]);

  const hasActiveFilters = Boolean(searchQuery || statusFilter !== 'all' || startDate || endDate);
  
  const totalPages = Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE);
  const paginatedExpenses = filteredExpenses.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      <header className="mb-6 sm:mb-8 lg:mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs sm:text-sm text-zinc-500 font-medium uppercase tracking-wider mb-1">Workspace</div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-tight">Shared Expenses</h1>
          <p className="text-zinc-400 mt-2 text-sm sm:text-base">Review all shared expenses and the amount you owe for each one.</p>
        </div>
        <Link
          to="/expenses/new"
          className="bg-accent text-accent-text px-5 sm:px-6 py-2.5 sm:py-3 rounded-full font-bold text-sm flex items-center gap-2 hover:opacity-90 transition-opacity self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          New expense
        </Link>
      </header>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6">
        <div className="flex bg-zinc-950 border border-zinc-800 rounded-lg p-1 w-fit mb-4 sm:mb-6">
          <button
            onClick={() => setListTab('all')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${listTab === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            All Sessions
          </button>
          <button
            onClick={() => setListTab('created')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${listTab === 'created' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Created by Me
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="relative w-full lg:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Date From */}
            <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5">
              <span className="text-[11px] text-zinc-500 font-medium uppercase">From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs text-zinc-200 focus:outline-none"
              />
            </div>

            {/* Date To */}
            <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5">
              <span className="text-[11px] text-zinc-500 font-medium uppercase">To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs text-zinc-200 focus:outline-none"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'open' | 'closed')}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-zinc-600 transition-colors cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="open">Open (Pending payments)</option>
              <option value="closed">Closed (All paid)</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setStartDate('');
                  setEndDate('');
                }}
                className="px-2.5 py-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                title="Reset all filters"
              >
                <X className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {expensesLoading ? (
            <div className="text-center py-10 text-zinc-500">Loading expenses...</div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-10 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
              No sessions found matching your filters.
            </div>
          ) : (
            paginatedExpenses.map((expense) => {
              const category = categories.find((c) => c.id === expense.categoryId);
              const numParticipants = expense.participants?.length || 1;
              const totalShare = getUserShare(expense, currentUserId);
              const remaining = getUserRemainingShare(expense, currentUserId, payments);
              const paid = getUserPaidAmount(expense, currentUserId, payments);
              const pending = getUserPendingAmount(expense, currentUserId, payments);
              const isCreator = expense.creatorId === currentUserId;
              const isSettled = !isCreator && remaining <= 0;
              const isPending = !isCreator && !isSettled && pending > 0;
              const expenseUsers = users.filter((u) => isParticipant(expense, u.id));

              return (
                <button
                  key={expense.id}
                  onClick={() => navigate(`/expenses/${expense.id}`)}
                  className="w-full text-left p-4 sm:p-5 rounded-xl border border-zinc-800/50 bg-zinc-950/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 group hover:border-zinc-700 hover:bg-surface-alt transition-colors cursor-pointer"
                >
                  <div className="flex gap-3 sm:gap-4 items-center">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl border flex items-center justify-center shrink-0 ${category ? category.color : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                      <span className="font-bold text-xs sm:text-sm tracking-tight">{getTitleInitials(expense.title)}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-zinc-200 mb-1 flex items-center gap-2 text-base sm:text-lg">
                        {expense.title}
                        {isSettled && (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
                            Settled
                          </span>
                        )}
                        {isPending && (
                          <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold">
                            Pending
                          </span>
                        )}
                        {isCreator && (
                          <span className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded-full font-semibold">
                            Host
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] sm:text-xs text-zinc-500 mb-1 sm:mb-2 flex flex-wrap items-center gap-1.5">
                        <span>Created on {formatDate(expense.date)}</span>
                        <span>•</span>
                        <span>{numParticipants} people</span>
                        {expense.approvedByName && (
                          <>
                            <span>•</span>
                            <span className="text-zinc-400">Approved by {expense.approvedByName}</span>
                          </>
                        )}
                        {expense.status === 'Pending' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Pending
                          </span>
                        )}
                      </div>
                      <div className="flex -space-x-2">
                        {expenseUsers.slice(0, 5).map((u) => (
                          <div
                            key={u.id}
                            className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-950 flex items-center justify-center text-[10px] font-bold text-white z-10 overflow-hidden shrink-0"
                            title={u.name}
                          >
                            {u.avatar ? (
                              <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                            ) : (
                              u.initials
                            )}
                          </div>
                        ))}
                        {expenseUsers.length > 5 && (
                          <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-950 flex items-center justify-center text-[10px] font-bold text-white z-0">
                            +{expenseUsers.length - 5}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-auto">
                    <div className="text-right">
                      <div className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider mb-0.5 sm:mb-1 font-semibold">Total</div>
                      <div className="text-xs sm:text-sm font-medium text-zinc-400">RM {Number(expense.totalAmount).toFixed(2)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider mb-0.5 sm:mb-1 font-semibold">
                        {isCreator ? 'Your Share' : isSettled ? 'Settled' : 'Remaining'}
                      </div>
                      <div className={`text-sm sm:text-base font-semibold ${isSettled ? 'text-emerald-400' : 'text-white'}`}>
                        RM {isCreator ? totalShare.toFixed(2) : remaining.toFixed(2)}
                      </div>
                      {paid > 0 && !isCreator && !isSettled && (
                        <div className="text-[10px] text-zinc-500">
                          (RM {paid.toFixed(2)} paid)
                        </div>
                      )}
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteExpense(e, expense.id, expense.title)}
                        title="Delete expense (Admin only)"
                        className="p-1.5 sm:p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:bg-zinc-800 transition-colors">
                      <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
        
        {/* Pagination Controls */}
        {totalPages >= 1 && (
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-zinc-800/50">
            <div className="text-xs sm:text-sm text-zinc-500">
              Showing <span className="text-zinc-300 font-medium">{(page - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
              <span className="text-zinc-300 font-medium">{Math.min(page * ITEMS_PER_PAGE, filteredExpenses.length)}</span> of{' '}
              <span className="text-zinc-300 font-medium">{filteredExpenses.length}</span> results
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 sm:p-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-sm font-medium text-zinc-300 px-2 sm:px-4">
                Page {page} of {totalPages}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 sm:p-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
