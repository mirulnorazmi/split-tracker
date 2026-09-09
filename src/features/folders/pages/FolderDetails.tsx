import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Folder as FolderIcon,
  Plus,
  Edit2,
  Trash2,
  CreditCard,
  Receipt,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ExternalLink,
  MinusCircle,
  Paperclip,
  Share2,
  Search,
  ArrowUpDown,
  X,
  Loader2,
  ChevronDown,
  Calendar,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { api, FolderDetail, Expense, Payment } from '@/lib/api';
import { useAuth } from '@/app/AuthContext';
import { useUsers, usePayments } from '@/lib/hooks/useData';
import { calculateFolderMetrics } from '@/lib/utils/folderMetrics';
import { BackButton } from '@/components';
import { formatDate } from '@/lib/utils/formatDate';
import { FolderModal } from '../components/FolderModal';
import { AttachExpensesModal } from '../components/AttachExpensesModal';

export default function FolderDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { users } = useUsers();
  const { payments: allPayments } = usePayments();

  const [folder, setFolder] = useState<FolderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFolderDetails = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getFolder(id);
      setFolder(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load folder details');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchFolderDetails();
  }, [fetchFolderDetails]);

  const handleDetachExpense = async (e: React.MouseEvent, expenseId: string, expenseTitle: string) => {
    e.stopPropagation();
    if (!folder || !id) return;
    if (!window.confirm(`Remove "${expenseTitle}" from this folder? The expense will remain safe as a standalone record.`)) {
      return;
    }
    try {
      await api.removeExpenseFromFolder(id, expenseId);
      fetchFolderDetails();
    } catch (err: any) {
      alert(err?.message || 'Failed to remove expense from folder');
    }
  };

  const handleDeleteFolder = async () => {
    if (!folder || !id) return;
    if (!window.confirm(`Delete "${folder.name}"? All expenses inside will be preserved as standalone expenses.`)) {
      return;
    }
    try {
      await api.deleteFolder(id);
      navigate('/folders');
    } catch (err: any) {
      alert(err?.message || 'Failed to delete folder');
    }
  };

  // ── Participant Ledger Infinite Scroll & Filter State ──────────────────────
  const [participantSearch, setParticipantSearch] = useState('');
  const [participantSort, setParticipantSort] = useState<'highest' | 'lowest' | 'default'>('highest');
  const [visibleParticipantCount, setVisibleParticipantCount] = useState(10);
  const participantSentinelRef = React.useRef<HTMLDivElement>(null);

  // ── Folder Expenses Infinite Scroll & Filter State ─────────────────────────
  const [expenseSearch, setExpenseSearch] = useState('');
  const [visibleExpenseCount, setVisibleExpenseCount] = useState(5);
  const expenseSentinelRef = React.useRef<HTMLDivElement>(null);

  // Calculate high-fidelity metrics safely
  const currentUserId = currentUser?.id || '';
  const metrics = React.useMemo(() => {
    if (!folder) {
      return {
        totalExpenses: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        collectionPercentage: 0,
        userPaid: 0,
        userOwed: 0,
        netBalance: 0,
        participantBalances: [],
      };
    }
    return calculateFolderMetrics(folder.expenses || [], allPayments || [], currentUserId, users);
  }, [folder, allPayments, currentUserId, users]);

  // Reset counts when search/sort changes
  useEffect(() => {
    setVisibleParticipantCount(10);
  }, [participantSearch, participantSort]);

  useEffect(() => {
    setVisibleExpenseCount(5);
  }, [expenseSearch]);

  // Filter & sort participant balances
  const filteredParticipants = React.useMemo(() => {
    let list = [...metrics.participantBalances];

    if (participantSearch.trim()) {
      const q = participantSearch.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.status && p.status.toLowerCase().includes(q))
      );
    }

    if (participantSort === 'highest') {
      list.sort((a, b) => b.remainingOwed - a.remainingOwed);
    } else if (participantSort === 'lowest') {
      list.sort((a, b) => a.remainingOwed - b.remainingOwed);
    }

    return list;
  }, [metrics.participantBalances, participantSearch, participantSort]);

  const visibleParticipants = filteredParticipants.slice(0, visibleParticipantCount);

  // Filter expenses
  const filteredExpenses = React.useMemo(() => {
    const list = folder?.expenses || [];
    if (!expenseSearch.trim()) return list;

    const q = expenseSearch.toLowerCase();
    return list.filter((exp) => {
      const titleMatch = exp.title?.toLowerCase().includes(q);
      const catMatch = exp.categoryName?.toLowerCase().includes(q);
      const notesMatch = (exp as any).notes?.toLowerCase()?.includes(q);
      const statusMatch = exp.status?.toLowerCase().includes(q);
      const amountMatch = String(exp.totalAmount).includes(q);
      const hostMatch =
        exp.creatorName?.toLowerCase().includes(q) ||
        users.find((u) => u.id === exp.creatorId)?.name?.toLowerCase().includes(q);
      return titleMatch || catMatch || notesMatch || statusMatch || amountMatch || hostMatch;
    });
  }, [folder?.expenses, expenseSearch, users]);

  const visibleExpenses = filteredExpenses.slice(0, visibleExpenseCount);

  // Infinite scroll observer for participants
  useEffect(() => {
    const el = participantSentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleParticipantCount((prev) => {
            if (prev < filteredParticipants.length) {
              return Math.min(prev + 10, filteredParticipants.length);
            }
            return prev;
          });
        }
      },
      { threshold: 0.1, rootMargin: '120px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [filteredParticipants.length, visibleParticipantCount]);

  // Infinite scroll observer for expenses
  useEffect(() => {
    const el = expenseSentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleExpenseCount((prev) => {
            if (prev < filteredExpenses.length) {
              return Math.min(prev + 5, filteredExpenses.length);
            }
            return prev;
          });
        }
      },
      { threshold: 0.1, rootMargin: '120px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [filteredExpenses.length, visibleExpenseCount]);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto py-24 text-center text-zinc-500 animate-pulse">
        Loading folder details & analytics...
      </div>
    );
  }

  if (error || !folder) {
    return (
      <div className="max-w-3xl mx-auto py-16 space-y-4">
        <BackButton fallbackPath="/folders" label="Back to Folders" />
        <div className="p-8 text-center bg-zinc-900 border border-zinc-800 rounded-3xl text-zinc-400">
          <AlertCircle className="w-10 h-10 mx-auto text-amber-500 mb-3" />
          <h2 className="text-lg font-medium text-white mb-1">Folder Not Found</h2>
          <p className="text-xs text-zinc-500 mb-6">{error || 'This folder may have been removed or is unavailable.'}</p>
          <Link
            to="/folders"
            className="px-5 py-2.5 rounded-full bg-accent text-accent-text text-xs font-bold"
          >
            Go to Folders
          </Link>
        </div>
      </div>
    );
  }

  const folderColor = folder.color || '#C9FF55';
  const isCreatorOrAdmin = currentUser?.role === 'Admin' || folder.createdBy === currentUserId;

  // ── Donut Chart Data ─────────────────────────────────────────────────────────
  const donutData = [
    { name: 'Collected', value: metrics.totalCollected, color: '#C9FF55' },
    { name: 'Outstanding', value: metrics.totalOutstanding, color: '#ef4444' },
  ];

  // ── Horizontal Bar Chart Data (Debt Breakdown per Participant) ───────────────
  const barChartData = metrics.participantBalances.map((p) => {
    const parts = p.name.trim().split(/\s+/);
    const displayName = parts.length > 1 ? `${parts[0]} ${parts[1].charAt(0)}.` : parts[0];
    return {
      name: displayName,
      fullName: p.name,
      Paid: p.totalPaid,
      Remaining: p.remainingOwed,
      totalShare: p.totalShare,
    };
  });

  const barChartHeight = Math.max(220, barChartData.length * 38);

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-24">
      {/* Back button */}
      <BackButton fallbackPath="/folders" label="Back to Folders" />

      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center border shrink-0 shadow-lg"
            style={{
              backgroundColor: `${folderColor}15`,
              borderColor: `${folderColor}40`,
              color: folderColor,
            }}
          >
            <FolderIcon className="w-7 h-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                {folder.category || 'General'}
              </span>
              <span className="text-xs text-zinc-400">
                Created by{' '}
                <strong className="text-zinc-200 font-medium">
                  {folder.createdBy === currentUserId
                    ? 'You'
                    : (folder.creatorName || users.find((u) => u.id === folder.createdBy)?.name || 'Host')}
                </strong>
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-xs text-zinc-500">
                {formatDate(folder.createdAt)}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-tight">
              {folder.name}
            </h1>
            {folder.description && (
              <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
                {folder.description}
              </p>
            )}
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
          {/* Add Expense Options (Creator/Admin only) */}
          {isCreatorOrAdmin && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsAttachModalOpen(true)}
                className="px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                title="Attach existing expenses"
              >
                <Paperclip className="w-3.5 h-3.5 text-zinc-400" />
                Attach Existing
              </button>

              <Link
                to={`/expenses/new?folderId=${folder.id}`}
                className="bg-accent text-accent-text font-bold text-xs px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-lg shadow-accent/10"
              >
                <Plus className="w-3.5 h-3.5" />
                New Expense
              </Link>
            </div>
          )}

          {/* Settle Up Navigation */}
          <Link
            to="/payments/new"
            className="px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5 text-xs font-semibold"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Settle Up
          </Link>

          {/* Edit / Delete for creator */}
          {isCreatorOrAdmin && (
            <div className="flex items-center gap-1 border-l border-zinc-800 pl-2 ml-1">
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Edit Folder Details"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleDeleteFolder}
                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                title="Delete Folder"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Expenses */}
        <div className="bg-surface-alt border border-zinc-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 flex flex-col justify-between">
          <span className="text-[10px] sm:text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Total Incurred
          </span>
          <div>
            <div className="text-xl sm:text-2xl lg:text-3xl font-light text-white tracking-tight">
              RM {metrics.totalExpenses.toFixed(2)}
            </div>
            <span className="text-[10px] sm:text-xs text-zinc-500 mt-0.5 sm:mt-1 inline-block leading-tight">
              {folder.expenses?.length || 0} total transaction(s)
            </span>
          </div>
        </div>

        {/* Card 2: Total Collected */}
        <div className="bg-surface-alt border border-zinc-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
              Total Collected
            </span>
            <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {metrics.collectionPercentage}%
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl lg:text-3xl font-light text-emerald-400 tracking-tight">
              RM {metrics.totalCollected.toFixed(2)}
            </div>
            <span className="text-[10px] sm:text-xs text-zinc-500 mt-0.5 sm:mt-1 inline-block leading-tight">
              Confirmed settlements
            </span>
          </div>
        </div>

        {/* Card 3: Total Outstanding */}
        <div className="bg-surface-alt border border-zinc-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
              Total Outstanding
            </span>
            <span
              className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1"
              title={`${metrics.participantBalances.filter((p) => p.status === 'PENDING').length} unsettled`}
            >
              <span>{metrics.participantBalances.filter((p) => p.status === 'PENDING').length}</span>
              <User className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl lg:text-3xl font-light text-amber-400 tracking-tight">
              RM {metrics.totalOutstanding.toFixed(2)}
            </div>
            <span className="text-[10px] sm:text-xs text-zinc-500 mt-0.5 sm:mt-1 inline-block leading-tight">
              Remaining group debt
            </span>
          </div>
        </div>

        {/* Card 4: Your Balance */}
        <div className="bg-surface-alt border border-zinc-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 flex flex-col justify-between">
          <span className="text-[10px] sm:text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Your Balance
          </span>
          <div>
            <div
              className={`text-xl sm:text-2xl lg:text-3xl font-light tracking-tight ${
                metrics.netBalance > 0
                  ? 'text-emerald-400'
                  : metrics.netBalance < 0
                  ? 'text-red-400'
                  : 'text-zinc-400'
              }`}
            >
              {metrics.netBalance > 0
                ? `+RM ${metrics.netBalance.toFixed(2)}`
                : metrics.netBalance < 0
                ? `-RM ${Math.abs(metrics.netBalance).toFixed(2)}`
                : 'RM 0.00'}
            </div>
            <span className="text-[10px] sm:text-xs text-zinc-500 mt-0.5 sm:mt-1 inline-block leading-tight">
              {metrics.netBalance > 0
                ? 'You are owed money'
                : metrics.netBalance < 0
                ? 'You owe money in this group'
                : 'All your shares are settled'}
            </span>
          </div>
        </div>
      </div>

      {/* Analytics Dashboard Charts (Side by Side) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 1: Donut Collection Progress (5 cols) */}
        <div className="lg:col-span-5 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-white">Collection Progress</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Settlement ratio of collected vs remaining group funds
            </p>
          </div>

          <div className="relative w-full h-[220px] flex items-center justify-center">
            {metrics.totalExpenses > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={68}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => [`RM ${Number(val).toFixed(2)}`, undefined]}
                      contentStyle={{
                        backgroundColor: '#09090b',
                        borderColor: '#27272a',
                        borderRadius: '12px',
                        color: '#fff',
                      }}
                      itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 500 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Hollow Total */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
                    Total Group
                  </span>
                  <span className="text-lg font-light text-white mt-0.5">
                    RM {metrics.totalExpenses.toFixed(2)}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-center text-zinc-500 text-xs">
                No expenses in folder yet
              </div>
            )}
          </div>

          {/* Breakdown legend */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-zinc-800/80 mt-2">
            <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-accent" />
                <span className="text-xs text-zinc-400">Collected</span>
              </div>
              <p className="text-sm font-semibold text-white">
                RM {metrics.totalCollected.toFixed(2)}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-xs text-zinc-400">Outstanding</span>
              </div>
              <p className="text-sm font-semibold text-white">
                RM {metrics.totalOutstanding.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Chart 2: Participant Debt Breakdown Horizontal Bar (7 cols) */}
        <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-white">Participant Debt Breakdown</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Paid vs outstanding amount per participant across all folder transactions
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Pinned Legend */}
              <div className="flex items-center gap-3 text-[11px] font-medium bg-zinc-950/60 border border-zinc-800/80 px-2.5 py-1 rounded-xl shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm bg-[#C9FF55]" />
                  <span className="text-zinc-300">Paid</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm bg-[#ef4444]" />
                  <span className="text-zinc-300">Remaining</span>
                </div>
              </div>
              <span className="text-xs text-zinc-500 font-mono shrink-0">
                {metrics.participantBalances.length} participants
              </span>
            </div>
          </div>

          {/* Scrollable Viewport for 1 to 35+ participants */}
          <div className="w-full max-h-[290px] overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar">
            <div style={{ height: `${barChartHeight}px`, minHeight: '220px' }}>
              {barChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={barChartData}
                    margin={{ top: 5, right: 15, left: 5, bottom: 5 }}
                  >
                    <XAxis
                      type="number"
                      stroke="#52525b"
                      fontSize={11}
                      tickFormatter={(val) => `RM ${val}`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="#a1a1aa"
                      fontSize={11}
                      width={85}
                      interval={0}
                      tick={{ fill: '#d4d4d8', fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(val: number, name: string) => [
                        `RM ${Number(val).toFixed(2)}`,
                        name,
                      ]}
                      contentStyle={{
                        backgroundColor: '#09090b',
                        borderColor: '#27272a',
                        borderRadius: '12px',
                        color: '#fff',
                      }}
                      itemStyle={{ color: '#fff', fontSize: '12px' }}
                    />
                    <Bar barSize={14} dataKey="Paid" name="Paid" fill="#C9FF55" stackId="debt" radius={[0, 0, 0, 0]} />
                    <Bar barSize={14} dataKey="Remaining" name="Remaining" fill="#ef4444" stackId="debt" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                  No participant data yet
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800/80 mt-2 flex items-center justify-between text-[11px] text-zinc-500">
            <span>
              {barChartData.length > 7 ? '↕ Scroll inside chart to see all participants' : 'Stacked bars represent share distribution'}
            </span>
            <span>Cumulative share</span>
          </div>
        </div>
      </div>

      {/* Participant Balance Ledger */}
      <div className="bg-surface-alt border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium text-white tracking-tight">
              Participant Balance Ledger
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Individual balances, shares, and settlement status for this folder
            </p>
          </div>
          <span className="text-xs text-zinc-500 font-mono">
            {filteredParticipants.length} member{filteredParticipants.length === 1 ? '' : 's'}
            {participantSearch && ` (of ${metrics.participantBalances.length})`}
          </span>
        </div>

        {/* Filter & Sort Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search participant by name or status..."
              value={participantSearch}
              onChange={(e) => setParticipantSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-accent transition-colors"
            />
            {participantSearch && (
              <button
                type="button"
                onClick={() => setParticipantSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" /> Sort:
            </span>
            <div className="relative">
              <select
                value={participantSort}
                onChange={(e) => setParticipantSort(e.target.value as any)}
                className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2 pr-7 appearance-none focus:outline-none focus:border-accent cursor-pointer hover:border-zinc-700 transition-colors"
              >
                <option value="highest">Highest Remaining</option>
                <option value="lowest">Lowest Remaining</option>
                <option value="default">Default Order</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="space-y-2.5 pt-2">
          {filteredParticipants.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs">
              {participantSearch
                ? `No participants found matching "${participantSearch}".`
                : 'No participants registered in this folder yet.'}
            </div>
          ) : (
            visibleParticipants.map((participant) => {
              const isCurrentUser = participant.userId === currentUserId;
              const isSettled = Math.abs(participant.netBalance) <= 0.01;
              const isCreditor = participant.netBalance > 0.01;
              const isDebtor = participant.netBalance < -0.01;

              return (
                <div
                  key={participant.userId}
                  className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 text-sm font-bold shrink-0 overflow-hidden">
                      {participant.avatar ? (
                        <img
                          src={participant.avatar}
                          alt={participant.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        participant.initials
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">
                          {participant.name}
                        </span>
                        {isCurrentUser && (
                          <span className="text-[10px] bg-accent/15 text-accent font-bold px-2 py-0.2 rounded-full">
                            YOU
                          </span>
                        )}
                        {participant.isHost && (
                          <span className="text-[10px] bg-zinc-800 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <User className="w-2.5 h-2.5 text-accent" />
                            HOST {participant.hostedExpenseCount > 1 ? `(${participant.hostedExpenseCount})` : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">
                        {participant.paidUpfront > 0 ? (
                          <>
                            Paid <strong className="text-zinc-300 font-normal">RM {participant.paidUpfront.toFixed(2)}</strong> upfront • Share <strong className="text-zinc-300 font-normal">RM {participant.fairShare.toFixed(2)}</strong>
                            {participant.reimbursementsReceived > 0 && (
                              <span> • Collected <strong className="text-emerald-400 font-normal">RM {participant.reimbursementsReceived.toFixed(2)}</strong></span>
                            )}
                            {participant.reimbursementsSent > 0 && (
                              <span> • Reimbursed <strong className="text-zinc-300 font-normal">RM {participant.reimbursementsSent.toFixed(2)}</strong></span>
                            )}
                          </>
                        ) : (
                          <>
                            Fair Share: <strong className="text-zinc-300 font-normal">RM {participant.fairShare.toFixed(2)}</strong>
                            {participant.reimbursementsSent > 0 ? (
                              <span> • Reimbursed: <strong className="text-zinc-300 font-normal">RM {participant.reimbursementsSent.toFixed(2)}</strong></span>
                            ) : (
                              <span> • No payments yet</span>
                            )}
                          </>
                        )}
                      </p>
                      {participant.debtsOwedToOthers && participant.debtsOwedToOthers.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {participant.debtsOwedToOthers.map((d) => (
                            <span key={d.expenseId} className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400">
                              Owes <span className="text-zinc-300 font-medium">{d.toUserName}</span>: RM {d.amount.toFixed(2)} ({d.expenseTitle})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/60">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold block">
                        Net Balance
                      </span>
                      <span
                        className={`text-sm font-semibold ${
                          isCreditor
                            ? 'text-emerald-400'
                            : isDebtor
                            ? 'text-amber-400'
                            : 'text-zinc-400'
                        }`}
                      >
                        {isCreditor
                          ? `+RM ${participant.netBalance.toFixed(2)}`
                          : isDebtor
                          ? `-RM ${Math.abs(participant.netBalance).toFixed(2)}`
                          : 'RM 0.00'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                          isCreditor
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : isDebtor
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50'
                        }`}
                      >
                        {isCreditor ? 'Gets back' : isDebtor ? 'Owes' : 'Settled'}
                      </span>

                      {isCurrentUser && isDebtor && (
                        <Link
                          to="/payments/new"
                          className="text-xs font-semibold text-accent hover:underline px-2 py-1"
                        >
                          Settle
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Infinite loading trigger / sentinel for participants (Max 10 per batch) */}
          {visibleParticipantCount < filteredParticipants.length && (
            <div ref={participantSentinelRef} className="pt-3 text-center">
              <button
                type="button"
                onClick={() => setVisibleParticipantCount((prev) => Math.min(prev + 10, filteredParticipants.length))}
                className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-2"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                Load More Participants ({filteredParticipants.length - visibleParticipantCount} remaining)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Nested Expenses List */}
      <div className="bg-surface-alt border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium text-white tracking-tight">
              Folder Expenses ({filteredExpenses.length})
              {expenseSearch && (
                <span className="text-xs font-normal text-zinc-500 ml-1.5">
                  (filtered from {folder.expenses?.length || 0})
                </span>
              )}
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              All shared expenditures and receipts assigned to this folder
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAttachModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Paperclip className="w-3.5 h-3.5" /> Attach
            </button>
            <Link
              to={`/expenses/new?folderId=${folder.id}`}
              className="px-3.5 py-1.5 rounded-xl bg-accent text-accent-text text-xs font-bold transition-opacity hover:opacity-90 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Expense
            </Link>
          </div>
        </div>

        {/* Filter / Search Bar for Expenses */}
        {folder.expenses && folder.expenses.length > 0 && (
          <div className="pt-1">
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search expenses by title, category, host..."
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-accent transition-colors"
              />
              {expenseSearch && (
                <button
                  type="button"
                  onClick={() => setExpenseSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3 pt-2">
          {(!folder.expenses || folder.expenses.length === 0) ? (
            <div className="py-12 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-2xl p-6">
              <Receipt className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
              <p className="text-sm text-zinc-400 font-medium">No expenses in this folder yet</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto mb-4">
                Add your expenses or attach existing transactions from any host to begin tracking collective debts.
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setIsAttachModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer hover:text-white"
                >
                  Attach Existing
                </button>
                <Link
                  to={`/expenses/new?folderId=${folder.id}`}
                  className="px-4 py-2 rounded-xl bg-accent text-accent-text text-xs font-bold"
                >
                  Create Expense
                </Link>
              </div>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs">
              No expenses found matching "{expenseSearch}".
            </div>
          ) : (
            visibleExpenses.map((expense) => {
              const numParticipants = (expense.participants || []).length;
              const expenseHostName = expense.creatorName || users.find((u) => u.id === expense.creatorId)?.name || 'Host';
              const canDetach = isCreatorOrAdmin || expense.creatorId === currentUserId;

              return (
                <div
                  key={expense.id}
                  onClick={() => navigate(`/expenses/${expense.id}`)}
                  className="w-full text-left p-4 sm:p-5 rounded-2xl border border-zinc-800/60 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-950 transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group shadow-sm"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-xs font-bold border shrink-0"
                      style={{
                        backgroundColor: `${folderColor}15`,
                        borderColor: `${folderColor}30`,
                        color: folderColor,
                      }}
                    >
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm sm:text-base font-medium text-white group-hover:text-accent transition-colors truncate">
                          {expense.title}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            expense.status === 'Confirmed'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {expense.status}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500 flex flex-wrap items-center gap-1.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-zinc-400" />
                          <span>Event: <strong className="text-zinc-300 font-normal">{formatDate(expense.date)}</strong></span>
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 text-zinc-300 bg-zinc-900 border border-zinc-800/80 px-1.5 py-0.5 rounded-md">
                          <User className="w-3 h-3 text-accent" />
                          <span>Host: <strong className="font-medium text-white">{expenseHostName}</strong></span>
                        </span>
                        <span>•</span>
                        <span>{expense.categoryName || 'General'}</span>
                        <span>•</span>
                        <span>{numParticipants} participant(s)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/60">
                    <div className="text-left sm:text-right">
                      <span className="text-base sm:text-lg font-semibold text-white">
                        RM {Number(expense.totalAmount).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {canDetach && (
                        <button
                          onClick={(e) => handleDetachExpense(e, expense.id, expense.title)}
                          title="Remove from folder (retains as standalone expense)"
                          className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                        >
                          <MinusCircle className="w-4 h-4" />
                        </button>
                      )}
                      <span className="p-1.5 text-zinc-500 group-hover:text-white transition-colors">
                        <ExternalLink className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Infinite loading trigger / sentinel for expenses (Max 5 per batch) */}
          {visibleExpenseCount < filteredExpenses.length && (
            <div ref={expenseSentinelRef} className="pt-3 text-center">
              <button
                type="button"
                onClick={() => setVisibleExpenseCount((prev) => Math.min(prev + 5, filteredExpenses.length))}
                className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-2"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                Load More Expenses ({filteredExpenses.length - visibleExpenseCount} remaining)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Folder Modal */}
      <FolderModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        folderToEdit={folder}
        onSuccess={() => fetchFolderDetails()}
      />

      {/* Attach Expenses Modal */}
      <AttachExpensesModal
        isOpen={isAttachModalOpen}
        folderId={folder.id}
        folderName={folder.name}
        onClose={() => setIsAttachModalOpen(false)}
        onSuccess={() => fetchFolderDetails()}
      />
    </div>
  );
}
