import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Plus, Search, X, Trash2, Folder as FolderIcon, Calendar, Loader2 } from 'lucide-react';
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
  
  const [visibleCount, setVisibleCount] = useState(5);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
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

  const baseExpenses = (
    listTab === 'all'
      ? expenses.filter((exp) => isParticipant(exp, currentUserId) || exp.creatorId === currentUserId)
      : expenses.filter((exp) => exp.creatorId === currentUserId)
  ).filter((exp) => isAdmin || exp.creatorId === currentUserId || exp.status === 'Confirmed');

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
    setVisibleCount(5);
  }, [listTab, searchQuery, statusFilter, startDate, endDate]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollContainerRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 5, filteredExpenses.length));
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
  }, [filteredExpenses.length]);

  const hasActiveFilters = Boolean(searchQuery || statusFilter !== 'all' || startDate || endDate);
  const visibleExpenses = filteredExpenses.slice(0, visibleCount);

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
              className="w-full h-10 bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 text-sm text-white focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600"
            />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 w-full lg:w-auto overflow-x-auto no-scrollbar pb-0.5 sm:pb-0">
            {/* Date From */}
            <label className="h-10 flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 shrink-0 cursor-pointer focus-within:border-zinc-600 transition-colors">
              <span className="text-[11px] text-zinc-500 font-semibold uppercase shrink-0">From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer [color-scheme:dark]"
              />
            </label>

            {/* Date To */}
            <label className="h-10 flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 shrink-0 cursor-pointer focus-within:border-zinc-600 transition-colors">
              <span className="text-[11px] text-zinc-500 font-semibold uppercase shrink-0">To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer [color-scheme:dark]"
              />
            </label>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'open' | 'closed')}
              className="h-10 bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 sm:px-3 text-xs sm:text-sm text-white focus:outline-none focus:border-zinc-600 transition-colors cursor-pointer shrink-0"
            >
              <option value="all">All Status</option>
              <option value="open">Open (Pending)</option>
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
                className="h-10 px-2.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors flex items-center gap-1 cursor-pointer shrink-0 border border-zinc-800/60"
                title="Reset all filters"
              >
                <X className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          className="max-h-[580px] overflow-y-auto space-y-3 pr-1.5 custom-scrollbar"
        >
          {expensesLoading ? (
            <div className="text-center py-12 text-zinc-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
              <span>Loading expenses...</span>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-10 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
              No sessions found matching your filters.
            </div>
          ) : (
            visibleExpenses.map((expense) => {
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
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-zinc-400" />
                          <span>Event: <strong className="text-zinc-300 font-normal">{formatDate(expense.date)}</strong></span>
                        </span>
                        <span>•</span>
                        <span>{numParticipants} people</span>
                        {expense.approvedByName && (
                          <>
                            <span>•</span>
                            <span className="text-zinc-400">
                              {expense.status === 'Rejected' ? 'Rejected' : 'Approved'} by {expense.approvedByName}
                            </span>
                          </>
                        )}
                        {expense.status === 'Pending' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Pending
                          </span>
                        )}
                        {expense.status === 'Rejected' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                            Rejected
                          </span>
                        )}
                        {expense.folderName && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center gap-1">
                            <FolderIcon className="w-2.5 h-2.5 text-accent" />
                            {expense.folderName}
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
                    {(isAdmin || isCreator) && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteExpense(e, expense.id, expense.title)}
                        title="Delete expense"
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

          {/* Infinite Scroll Sentinel / Trigger */}
          {visibleCount < filteredExpenses.length && (
            <div ref={sentinelRef} className="pt-3 pb-2 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => Math.min(prev + 5, filteredExpenses.length))}
                className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-2 shadow-sm"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                Load More Expenses ({filteredExpenses.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </div>
        
        {/* Footer Summary */}
        {filteredExpenses.length > 0 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-800/60 text-xs text-zinc-500">
            <div>
              Showing <span className="text-zinc-300 font-medium">{Math.min(visibleCount, filteredExpenses.length)}</span> of{' '}
              <span className="text-zinc-300 font-medium">{filteredExpenses.length}</span> expenses
            </div>
            {visibleCount >= filteredExpenses.length ? (
              <span className="text-zinc-500 font-medium">All expenses loaded</span>
            ) : (
              <span className="text-zinc-500 hidden sm:inline">Scroll inside table for more</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
