import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Repeat, Plus, Users, Calendar, ArrowRight, CheckCircle2, Trash2, Loader2 } from 'lucide-react';
import { api, RecurringExpense } from '@/lib/api';
import { useAuth } from '@/app/AuthContext';
import { formatCurrency } from '@/lib/utils/currency';

export default function Subscriptions() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [subscriptions, setSubscriptions] = useState<RecurringExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isAdmin = currentUser?.role === 'Admin';
  const [visibleCount, setVisibleCount] = useState(5);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleDelete = async (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${title}"? All associated historical payment cycles and participant records will be permanently removed.`)) {
      return;
    }
    try {
      await api.deleteRecurring(id);
      window.dispatchEvent(new Event('splittrack:data-changed'));
      fetchSubscriptions();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete subscription');
    }
  };

  const fetchSubscriptions = async () => {
    try {
      const data = await api.listRecurring();
      setSubscriptions(data);
    } catch (err) {
      console.error('Failed to load subscriptions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
    const handleRefresh = () => fetchSubscriptions();
    window.addEventListener('splittrack:data-changed', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    return () => {
      window.removeEventListener('splittrack:data-changed', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollContainerRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 5, subscriptions.length));
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
  }, [subscriptions.length]);

  const visibleSubscriptions = subscriptions.slice(0, visibleCount);

  const totalMonthly = subscriptions.reduce((sum, s) => sum + Number(s.totalAmount), 0);
  const totalYourShare = subscriptions.reduce((sum, s) => {
    if (s.creatorId === currentUser?.id) return sum; // host's personal share is waived
    return sum + Number(s.yourShare || 0);
  }, 0);
  const totalUnpaidDues = subscriptions.reduce((sum, s) => {
    if (s.creatorId === currentUser?.id) return sum;
    return sum + Number(s.yourTotalUnpaid || 0);
  }, 0);
  const totalPendingDues = subscriptions.reduce((sum, s) => {
    if (s.creatorId === currentUser?.id) return sum;
    return sum + Number(s.yourTotalPending || 0);
  }, 0);
  const totalOutstandingDues = totalUnpaidDues + totalPendingDues;

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="mb-6 sm:mb-8 lg:mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs sm:text-sm text-zinc-500 font-medium uppercase tracking-wider mb-1">
            Workspace
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-white tracking-tight flex items-center gap-3">
            Subscriptions &amp; Recurring
          </h1>
          <p className="text-zinc-400 mt-2 text-sm sm:text-base">
            Track monthly family plans, shared software, and fixed recurring bills with historical payment heatmaps.
          </p>
        </div>
        <Link
          to="/subscriptions/new"
          className="px-5 py-2.5 bg-white text-zinc-950 font-medium rounded-lg hover:bg-zinc-200 transition-colors whitespace-nowrap text-sm flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> New Subscription
        </Link>
      </header>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-5 flex flex-col justify-between">
          <div className="mb-2">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Active Plans
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-semibold text-white">
            {subscriptions.length}
          </div>
          <div className="text-xs text-zinc-500 mt-1">Shared recurring plans</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-5 flex flex-col justify-between">
          <div className="mb-2">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Total Monthly Volume
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-semibold text-white">
            {formatCurrency(totalMonthly)}
          </div>
          <div className="text-xs text-zinc-500 mt-1">Combined monthly cost</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-5 flex flex-col justify-between">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              {totalOutstandingDues > 0 ? 'Outstanding Dues' : 'Your Monthly Share'}
            </span>
            {totalOutstandingDues > 0 && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                totalUnpaidDues === 0 && totalPendingDues > 0
                  ? 'text-amber-400 border-amber-500/20 bg-amber-500/10'
                  : 'text-red-400 border-red-500/20 bg-red-500/10'
              }`}>
                {totalUnpaidDues === 0 && totalPendingDues > 0 ? 'Pending' : 'Due Now'}
              </span>
            )}
          </div>
          <div className={`text-2xl sm:text-3xl font-semibold ${
            totalOutstandingDues > 0
              ? totalUnpaidDues === 0 && totalPendingDues > 0
                ? 'text-amber-400'
                : 'text-red-400'
              : 'text-white'
          }`}>
            {formatCurrency(totalOutstandingDues > 0 ? totalOutstandingDues : totalYourShare)}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            {totalOutstandingDues > 0
              ? totalUnpaidDues === 0 && totalPendingDues > 0
                ? 'Pending admin approval'
                : `Unpaid across your plans • ${formatCurrency(totalYourShare)}/mo ongoing`
              : 'Ongoing monthly commitment'}
          </div>
        </div>
      </div>

      {/* Subscriptions List */}
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6 border-b border-zinc-800/50 pb-4">
          <div className="text-sm font-medium text-white">
            All Shared Plans
          </div>
          <div className="text-sm text-zinc-400">{subscriptions.length} plans</div>
        </div>

        <div
          ref={scrollContainerRef}
          className="max-h-[540px] overflow-y-auto space-y-2 pr-1.5 custom-scrollbar"
        >
          {isLoading ? (
            <div className="py-12 text-center text-zinc-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
              <span>Loading subscriptions...</span>
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-xl bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center mb-3 text-zinc-400">
                <Repeat className="w-6 h-6" />
              </div>
              <div className="text-zinc-300 font-medium mb-1">No shared subscriptions yet.</div>
              <p className="text-sm text-zinc-500 max-w-md mb-4">
                Set up recurring expenses like Spotify Family, Netflix, or house bills to track monthly payments and view GitHub-style payment heatmaps.
              </p>
              <Link
                to="/subscriptions/new"
                className="px-4 py-2 bg-white text-zinc-950 font-medium rounded-lg text-sm hover:bg-zinc-200 transition-colors"
              >
                Create Subscription Plan
              </Link>
            </div>
          ) : (
            visibleSubscriptions.map((sub) => {
              const isCreator = sub.creatorId === currentUser?.id;
              const hasUnpaid = !isCreator && Number(sub.yourTotalUnpaid || 0) > 0;

              return (
                <button
                  key={sub.id}
                  onClick={() => navigate(`/subscriptions/${sub.id}`)}
                  className="w-full text-left p-4 rounded-xl bg-zinc-950/40 border border-zinc-850/60 hover:bg-zinc-800/50 hover:border-zinc-700/80 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 transition-all cursor-pointer group shadow-sm"
                >
                  <div className="flex gap-4 items-center">
                    <div className="w-10 h-10 rounded-lg bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center shrink-0 text-zinc-400">
                      <Repeat className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium text-white text-base mb-1 flex items-center gap-2">
                        <span>{sub.title}</span>
                        {isCreator && (
                          <span className="text-[10px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full font-medium">
                            Host
                          </span>
                        )}
                        <span className="text-[10px] text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Active
                        </span>
                      </div>
                      <div className="text-sm text-zinc-500 flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          Billed day {sub.billingDay}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1.5">
                          <Users className="w-4 h-4" />
                          {sub.activeParticipantsCount} members
                        </span>
                        {sub.categoryName && (
                          <>
                            <span>•</span>
                            <span>{sub.categoryName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-4 pl-14 sm:pl-0">
                    <div className="text-right flex flex-col items-end">
                      <div className="text-base font-medium text-white">
                        {formatCurrency(sub.totalAmount)}
                        <span className="text-sm text-zinc-500 font-normal"> /mo</span>
                      </div>
                      {isCreator ? (
                        <div className="text-sm text-zinc-400">You are the Host</div>
                      ) : hasUnpaid ? (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-sm text-red-400 font-medium">
                            {formatCurrency(sub.yourTotalUnpaid!)} due
                          </span>
                          <span className="text-xs text-zinc-500">
                            (Regular: {formatCurrency(sub.yourShare || 0)}/mo)
                          </span>
                        </div>
                      ) : Number(sub.yourTotalPending || 0) > 0 ? (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-sm text-amber-400 font-medium">
                            {formatCurrency(sub.yourTotalPending!)} pending
                          </span>
                          <span className="text-xs text-zinc-500">
                            (Awaiting approval)
                          </span>
                        </div>
                      ) : (
                        <div className="text-sm text-zinc-400 mt-0.5">
                          Your share: {formatCurrency(sub.yourShare || 0)}/mo
                        </div>
                      )}
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, sub.id, sub.title)}
                        title="Delete subscription (Admin only)"
                        className="p-2 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors hidden sm:block" />
                  </div>
                </button>
              );
            })
          )}

          {/* Infinite Scroll Sentinel / Trigger */}
          {visibleCount < subscriptions.length && (
            <div ref={sentinelRef} className="pt-3 pb-2 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => Math.min(prev + 5, subscriptions.length))}
                className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-2 shadow-sm"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                Load More Plans ({subscriptions.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </div>

        {/* Footer Summary */}
        {subscriptions.length > 0 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-800/60 text-xs text-zinc-500">
            <div>
              Showing <span className="text-zinc-300 font-medium">{Math.min(visibleCount, subscriptions.length)}</span> of{' '}
              <span className="text-zinc-300 font-medium">{subscriptions.length}</span> plans
            </div>
            {visibleCount >= subscriptions.length ? (
              <span className="text-zinc-500 font-medium">All plans loaded</span>
            ) : (
              <span className="text-zinc-500 hidden sm:inline">Scroll inside table for more</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
