import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calendar,
  Users,
  Check,
  X,
  UserMinus,
  UserPlus,
  ArrowLeft,
  DollarSign,
  AlertCircle,
  Repeat,
  Clock,
  Trash2,
  Edit2,
  Share2,
  MessageSquare,
  Download,
  Copy,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { api, RecurringExpense, RecurringCycle } from '@/lib/api';
import { useAuth } from '@/app/AuthContext';
import { useUsers, useCategories } from '@/lib/hooks/useData';
import { ContributionHeatmap } from '@/components/ui/ContributionHeatmap';
import { formatCurrency } from '@/lib/utils/currency';
import { cn } from '@/lib/utils/cn';

type UnpaidCycleType = NonNullable<RecurringExpense['userSummary']>['unpaidCycles'][0];

function groupUnpaidCycles(cycles: UnpaidCycleType[]) {
  if (!cycles || cycles.length === 0) return [];
  const sorted = [...cycles].sort((a, b) => a.periodKey.localeCompare(b.periodKey));
  
  const groups = [];
  let currentGroup = {
    startMonth: sorted[0],
    endMonth: sorted[0],
    count: 1,
    amountDue: sorted[0].amountDue,
    totalAmount: sorted[0].amountDue,
    cycles: [sorted[0]]
  };
  
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    
    const isConsecutiveStrict = (prev.month === 12 && curr.month === 1 && curr.year === prev.year + 1) || (curr.month === prev.month + 1 && curr.year === prev.year);
    
    if (isConsecutiveStrict && curr.amountDue === currentGroup.amountDue) {
      currentGroup.endMonth = curr;
      currentGroup.count += 1;
      currentGroup.totalAmount += curr.amountDue;
      currentGroup.cycles.push(curr);
    } else {
      groups.push(currentGroup);
      currentGroup = {
        startMonth: curr,
        endMonth: curr,
        count: 1,
        amountDue: curr.amountDue,
        totalAmount: curr.amountDue,
        cycles: [curr]
      };
    }
  }
  groups.push(currentGroup);
  return groups;
}

export default function SubscriptionDetails() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user: currentUser } = useAuth();
  const { users: allUsers } = useUsers();

  const [subscription, setSubscription] = useState<RecurringExpense | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [cycles, setCycles] = useState<RecurringCycle[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // Share Dues & Analytics Modal
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [activeShareTab, setActiveShareTab] = useState<'whatsapp' | 'card'>('whatsapp');
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);

  const { categories } = useCategories();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editBillingDay, setEditBillingDay] = useState('');
  const [editSplitType, setEditSplitType] = useState('equal');
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberMode, setAddMemberMode] = useState<'registered' | 'placeholder'>('registered');
  const [placeholderFriendName, setPlaceholderFriendName] = useState('');
  const [selectedNewUserId, setSelectedNewUserId] = useState<string>('');
  const [newMemberMonth, setNewMemberMonth] = useState<number>(new Date().getMonth() + 1);
  const [newMemberYear, setNewMemberYear] = useState<number>(new Date().getFullYear());
  const [discontinueTarget, setDiscontinueTarget] = useState<{ userId: string; name: string } | null>(null);
  const [discontinueMonth, setDiscontinueMonth] = useState<number>(new Date().getMonth() + 1);
  const [discontinueYear, setDiscontinueYear] = useState<number>(new Date().getFullYear());

  // Deep-link ?month=YYYY-MM handler
  useEffect(() => {
    const monthParam = searchParams.get('month');
    if (monthParam) {
      if (monthParam.includes('-')) {
        const [y, m] = monthParam.split('-').map(Number);
        if (y && m) {
          setSelectedYear(y);
          setSelectedMonth(m);
        }
      } else {
        const m = parseInt(monthParam, 10);
        if (m >= 1 && m <= 12) {
          setSelectedMonth(m);
        }
      }
    }
  }, [searchParams]);

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const currentYear = new Date().getFullYear();
  const startYear = subscription?.startDate
    ? new Date(subscription.startDate).getFullYear()
    : currentYear;
  const minYear = Math.min(startYear, currentYear - 3);
  const availableYears: number[] = [];
  for (let y = currentYear; y >= minYear; y--) {
    availableYears.push(y);
  }

  const fetchDetails = async () => {
    try {
      const sub = await api.getRecurring(id);
      setSubscription(sub);
      const cyclesData = await api.getRecurringCycles(id, selectedYear);
      setCycles(cyclesData.cycles);
      setAccessDenied(false);
    } catch (err: any) {
      console.error('Failed to load subscription details:', err);
      if (err?.status === 403) {
        setAccessDenied(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
    const handleRefresh = () => { fetchDetails(); };
    window.addEventListener('splittrack:data-changed', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    return () => {
      window.removeEventListener('splittrack:data-changed', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
  }, [id, selectedYear]);

  const activeParticipants = subscription?.participants?.filter((p) => p.isActive) || [];
  const discontinuedParticipants = subscription?.participants?.filter((p) => !p.isActive) || [];
  const isHost = subscription?.creatorId === currentUser?.id;
  const isAdmin = currentUser?.role === 'Admin';

  const handleDeleteSubscription = async () => {
    if (!subscription) return;
    if (!window.confirm(`Are you sure you want to delete "${subscription.title}"? All associated historical payment cycles and participant records will be permanently removed.`)) {
      return;
    }
    setActionLoading(true);
    try {
      await api.deleteRecurring(id);
      window.dispatchEvent(new Event('splittrack:data-changed'));
      navigate('/subscriptions');
    } catch (err: any) {
      alert(err?.message || 'Failed to delete subscription');
      setActionLoading(false);
    }
  };

  const selectedCycle = cycles.find((c) => c.month === selectedMonth);
  const totalCollectedYear = cycles.reduce((sum, c) => sum + Number(c.totalCollected), 0);
  const totalDueYear = cycles.reduce((sum, c) => sum + Number(c.totalDue), 0);

  const handleToggleStatus = async (itemId: string, currentStatus: string) => {
    if (!isHost && currentUser?.role !== 'Admin') return;
    const nextStatus = currentStatus === 'Paid' ? 'Unpaid' : 'Paid';
    setActionLoading(true);
    try {
      await api.updateCycleItemStatus(itemId, nextStatus);
      await fetchDetails();
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const openDiscontinueModal = (userId: string, userName: string) => {
    setDiscontinueTarget({ userId, name: userName });
    setDiscontinueMonth(new Date().getMonth() + 1);
    setDiscontinueYear(new Date().getFullYear());
  };

  const handleConfirmDiscontinue = async () => {
    if (!discontinueTarget) return;
    setActionLoading(true);
    try {
      const endOfMonth = new Date(Date.UTC(discontinueYear, discontinueMonth, 0, 23, 59, 59, 999)).toISOString();
      await api.discontinueRecurringParticipant(id, discontinueTarget.userId, {
        discontinuedDate: endOfMonth,
      });
      setDiscontinueTarget(null);
      await fetchDetails();
    } catch (err: any) {
      alert(err?.message || 'Failed to discontinue participant');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveParticipant = async () => {
    if (!discontinueTarget) return;
    if (!confirm(`Are you sure you want to COMPLETELY remove ${discontinueTarget.name}? This will delete all their history in this subscription.`)) return;
    
    setActionLoading(true);
    try {
      await api.removeRecurringParticipant(id, discontinueTarget.userId);
      setDiscontinueTarget(null);
      await fetchDetails();
    } catch (err: any) {
      alert(err?.message || 'Failed to remove participant');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddMember = async () => {
    setActionLoading(true);
    try {
      const joinedDate = `${newMemberYear}-${String(newMemberMonth).padStart(2, '0')}-01`;
      let targetUserId = selectedNewUserId;

      if (addMemberMode === 'placeholder') {
        if (!placeholderFriendName.trim()) {
          alert('Please enter a name for the unregistered friend');
          setActionLoading(false);
          return;
        }
        const ph = await api.createPlaceholderUser(placeholderFriendName.trim());
        targetUserId = ph.id;
        window.dispatchEvent(new Event('splittrack:data-changed'));
      }

      if (!targetUserId) {
        alert('Please choose or enter a participant');
        setActionLoading(false);
        return;
      }

      await api.addRecurringParticipant(id, { userId: targetUserId, joinedDate });
      window.dispatchEvent(new Event('splittrack:data-changed'));
      setAddMemberOpen(false);
      setSelectedNewUserId('');
      setPlaceholderFriendName('');
      setAddMemberMode('registered');
      await fetchDetails();
    } catch (err: any) {
      console.error('Failed to add member:', err);
      alert(err?.message || 'Failed to add member');
    } finally {
      setActionLoading(false);
    }
  };

  const getWhatsAppMessage = () => {
    if (!subscription) return '';
    const monthName = MONTH_NAMES[selectedMonth - 1] || `Month ${selectedMonth}`;
    const deepLink = `${window.location.origin}/subscriptions/${id}?month=${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    const items = selectedCycle?.items || [];
    const totalDue = selectedCycle?.totalDue || subscription.totalAmount;
    const totalCollected = selectedCycle?.totalCollected || 0;
    const totalOutstanding = Math.max(0, totalDue - totalCollected);

    const breakdownLines = items.map((it) => {
      if (it.status === 'Paid') return `  ✅ ${it.name}: ${formatCurrency(it.amountDue)} (Paid)`;
      if (it.status === 'Waived') return `  👑 ${it.name} (Host): Waived`;
      if (it.isPlaceholder) return `  ⏳ ${it.name} (Unregistered): ${formatCurrency(it.amountDue)} (Due)`;
      return `  ⏳ ${it.name}: ${formatCurrency(it.amountDue)} (Due)`;
    }).join('\n');

    return `🎵 *${subscription.title} — ${monthName} ${selectedYear} Payment Due*
📅 Billing Day: ${subscription.billingDay}th of each month
💰 Monthly Plan: ${formatCurrency(subscription.totalAmount)}

*Member Payment Status:*
${breakdownLines}

📊 *Monthly Total:* ${formatCurrency(totalCollected)} collected / ${formatCurrency(totalOutstanding)} outstanding

🔗 *Check details & submit receipt:*
${deepLink}

Thank you! 🙏`;
  };

  const generateCardCanvas = () => {
    if (!subscription) return null;
    const canvas = document.createElement('canvas');
    const dpr = 2;
    const width = 600;
    const items = selectedCycle?.items || [];
    const height = 380 + Math.max(1, items.length) * 44;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(dpr, dpr);

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle border
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    // Accent line
    const accentGrad = ctx.createLinearGradient(0, 0, width, 0);
    accentGrad.addColorStop(0, '#38bdf8');
    accentGrad.addColorStop(0.5, '#10b981');
    accentGrad.addColorStop(1, '#c084fc');
    ctx.fillStyle = accentGrad;
    ctx.fillRect(0, 0, width, 6);

    // Category / Tagline
    ctx.font = '600 11px sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('SPLITTRACK • MONTHLY SUBSCRIPTION LEDGER', 36, 42);

    // Title
    ctx.font = '700 24px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(subscription.title, 36, 76);

    // Month Badge
    const monthName = MONTH_NAMES[selectedMonth - 1] || `Month ${selectedMonth}`;
    const periodText = `${monthName} ${selectedYear}`;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(width - 160, 48, 124, 32);
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(width - 160, 48, 124, 32);
    ctx.font = '600 12px sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.fillText(periodText, width - 98, 69);
    ctx.textAlign = 'left';

    // Stats Box
    ctx.fillStyle = '#111827';
    ctx.fillRect(36, 102, width - 72, 70);
    ctx.strokeStyle = '#1f2937';
    ctx.strokeRect(36, 102, width - 72, 70);

    // Stat 1: Total bill
    ctx.font = '500 11px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('TOTAL PLAN', 52, 126);
    ctx.font = '700 16px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(formatCurrency(subscription.totalAmount), 52, 152);

    // Stat 2: Collected
    const totalCollected = selectedCycle?.totalCollected || 0;
    ctx.font = '500 11px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('COLLECTED', 220, 126);
    ctx.font = '700 16px sans-serif';
    ctx.fillStyle = '#10b981';
    ctx.fillText(formatCurrency(totalCollected), 220, 152);

    // Stat 3: Outstanding
    const totalDue = selectedCycle?.totalDue || subscription.totalAmount;
    const totalOutstanding = Math.max(0, totalDue - totalCollected);
    ctx.font = '500 11px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('OUTSTANDING', 380, 126);
    ctx.font = '700 16px sans-serif';
    ctx.fillStyle = totalOutstanding > 0 ? '#f87171' : '#10b981';
    ctx.fillText(formatCurrency(totalOutstanding), 380, 152);

    // Breakdown header
    ctx.font = '700 12px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('MEMBER PAYMENT BREAKDOWN', 36, 206);

    // Member rows
    let yPos = 224;
    items.forEach((item) => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(36, yPos, width - 72, 34);

      // Initials Avatar
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(54, yPos + 17, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '600 10px sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(item.initials || item.name.slice(0, 2).toUpperCase(), 54, yPos + 21);
      ctx.textAlign = 'left';

      // Name
      ctx.font = '600 13px sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(item.name, 74, yPos + 22);
      if (item.isPlaceholder) {
        ctx.font = '600 9px sans-serif';
        ctx.fillStyle = '#f59e0b';
        const nw = ctx.measureText(item.name).width;
        ctx.fillText('[Placeholder]', 80 + nw, yPos + 21);
      }

      // Amount
      ctx.font = '600 13px sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'right';
      ctx.fillText(formatCurrency(item.amountDue), width - 140, yPos + 22);

      // Status pill
      const isPaid = item.status === 'Paid' || item.status === 'Waived';
      ctx.fillStyle = isPaid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
      ctx.fillRect(width - 124, yPos + 7, 72, 20);

      ctx.font = '700 10px sans-serif';
      ctx.fillStyle = isPaid ? '#34d399' : '#f87171';
      ctx.textAlign = 'center';
      ctx.fillText(item.status === 'Waived' ? 'Waived' : isPaid ? 'Paid' : 'Unpaid', width - 88, yPos + 21);
      ctx.textAlign = 'left';

      yPos += 40;
    });

    // Footer
    ctx.strokeStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(36, yPos + 10);
    ctx.lineTo(width - 36, yPos + 10);
    ctx.stroke();

    ctx.font = '500 11px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Payable to host • Track payments live on SplitTrack', 36, yPos + 30);

    return canvas;
  };

  const handleDownloadCard = () => {
    const canvas = generateCardCanvas();
    if (!canvas || !subscription) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${subscription.title.replace(/\s+/g, '-').toLowerCase()}-${selectedYear}-${String(selectedMonth).padStart(2, '0')}.png`;
    a.click();
  };

  const handleCopyCard = async () => {
    const canvas = generateCardCanvas();
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 2500);
      } catch (e) {
        handleDownloadCard();
      }
    });
  };

  const handleCopyWhatsAppText = async () => {
    const text = getWhatsAppMessage();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  const handleOpenEdit = () => {
    if (!subscription) return;
    setEditTitle(subscription.title);
    setEditAmount(subscription.totalAmount.toString());
    setEditCategory(subscription.categoryId);
    setEditBillingDay(subscription.billingDay.toString());
    setEditSplitType(subscription.splitType);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editTitle || !editAmount || !editCategory || !editBillingDay) return;
    setActionLoading(true);
    try {
      await api.updateRecurring(id, {
        title: editTitle,
        totalAmount: parseFloat(editAmount),
        categoryId: editCategory,
        billingDay: parseInt(editBillingDay, 10),
        splitType: editSplitType as any,
      });
      setIsEditing(false);
      await fetchDetails();
    } catch (err) {
      console.error('Failed to update subscription:', err);
    } finally {
      setActionLoading(false);
    }
  };

  if (accessDenied) {
    return (
      <div className="max-w-xl mx-auto py-24 text-center space-y-5 animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto shadow-xl shadow-red-500/5">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">Private Subscription</h2>
          <p className="text-zinc-400 text-sm max-w-md mx-auto">
            This subscription is private. Only verified members of this subscription group can view monthly dues and payment history.
          </p>
        </div>
        <button
          onClick={() => navigate('/subscriptions')}
          className="px-6 py-2.5 rounded-xl bg-zinc-800 text-white hover:bg-zinc-700 text-sm font-semibold transition-colors inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Subscriptions</span>
        </button>
      </div>
    );
  }

  if (isLoading || !subscription) {
    return (
      <div className="max-w-5xl mx-auto py-20 text-center text-zinc-500">
        Loading subscription details...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Back button */}
      <div>
        <button
          onClick={() => navigate('/subscriptions')}
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Subscriptions
        </button>
      </div>

      {/* Plan Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              {subscription.categoryName || 'Subscription'}
            </span>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
              ACTIVE
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-tight flex items-center gap-3">
            {subscription.title}
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Created by <span className="text-zinc-200 font-medium">{subscription.creatorName}</span> • Billed on the {subscription.billingDay}th of every month
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-zinc-500 font-medium">Total Monthly Bill</div>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(subscription.totalAmount)}
                <span className="text-xs font-normal text-zinc-400"> /mo</span>
              </div>
            </div>
          </div>

          {(isHost || isAdmin) && (
            <button
              onClick={() => setShareModalOpen(true)}
              title="Share monthly dues & analytics via WhatsApp or Visual Card"
              className="p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all cursor-pointer flex items-center gap-2 text-sm font-semibold shadow-lg shadow-emerald-500/10"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share Dues &amp; Analytics</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={handleDeleteSubscription}
              disabled={actionLoading}
              title="Delete plan (Admin only)"
              className="p-3.5 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer flex items-center gap-2 text-sm font-semibold disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Delete Plan</span>
            </button>
          )}
          {(currentUser?.role === 'Admin' || currentUser?.id === subscription.creatorId) && (
            <button
              onClick={handleOpenEdit}
              disabled={actionLoading}
              title="Edit plan"
              className="p-3.5 rounded-2xl border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors cursor-pointer flex items-center gap-2 text-sm font-semibold disabled:opacity-50"
            >
              <Edit2 className="w-4 h-4" />
              <span className="hidden sm:inline">Edit Plan</span>
            </button>
          )}
        </div>
      </header>

      {/* Personalized Dues & Share Summary Card */}
      {subscription.userSummary && (
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 sm:p-8">
          {/* For non-host participant with unpaid dues */}
          {!subscription.userSummary.isHost && subscription.userSummary.isParticipant && subscription.userSummary.totalUnpaid > 0 && (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400" /> Your Payment Status
                  </span>
                  <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium px-2 py-0.5 rounded-full">
                    {subscription.userSummary.unpaidCyclesCount} Month{subscription.userSummary.unpaidCyclesCount === 1 ? '' : 's'} Due
                  </span>
                </div>
                <p className="text-sm text-zinc-400 max-w-xl">
                  You have pending shares for the following billing cycles:
                </p>
                <div className="grid gap-2 pt-1">
                  {groupUnpaidCycles(subscription.userSummary.unpaidCycles).map((g, idx) => (
                    <div key={idx} className="flex justify-between items-center px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800">
                      <div>
                        <div className="text-sm font-medium text-white">
                          {g.count > 1 
                            ? `${g.startMonth.monthName} ${g.startMonth.year} – ${g.endMonth.monthName} ${g.endMonth.year}` 
                            : `${g.startMonth.monthName} ${g.startMonth.year}`}
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {g.count} month{g.count > 1 ? 's' : ''} at {formatCurrency(g.amountDue)} / mo
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-white">{formatCurrency(g.totalAmount)}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-sm text-zinc-500 pt-2">
                  Payable to host: <strong className="text-zinc-300">{subscription.creatorName}</strong> • Ongoing share: <strong className="text-zinc-300">{formatCurrency(subscription.userSummary.currentMonthlyShare)}/month</strong>
                </div>
              </div>

              <div className="flex flex-col items-start md:items-end justify-center shrink-0 gap-4 border-t md:border-t-0 pt-4 md:pt-0 border-zinc-800/50">
                <div className="text-left md:text-right">
                  <div className="text-sm text-zinc-500 font-medium mb-1">Total Balance Due</div>
                  <div className="text-3xl sm:text-4xl font-semibold text-red-400">{formatCurrency(subscription.userSummary.totalUnpaid)}</div>
                </div>
                <button
                  onClick={() => navigate(`/payments/new?subscriptionId=${subscription.id}`)}
                  className="w-full sm:w-auto px-6 py-2.5 bg-white text-zinc-950 text-sm font-medium rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
                >
                  <DollarSign className="w-4 h-4" /> Submit Payment
                </button>
              </div>
            </div>
          )}

          {/* For non-host participant who is fully settled */}
          {!subscription.userSummary.isHost && subscription.userSummary.isParticipant && subscription.userSummary.totalUnpaid === 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" /> Your Payment Status
                  </span>
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium px-2 py-0.5 rounded-full">
                    All Settled
                  </span>
                </div>
                <p className="text-sm text-zinc-400">
                  You have no outstanding dues for {subscription.title}. Your regular share is <strong className="text-zinc-200">{formatCurrency(subscription.userSummary.currentMonthlyShare)}/month</strong>, billed on the {subscription.billingDay}th of each month.
                </p>
              </div>

              <div className="text-right shrink-0">
                <div className="text-sm text-zinc-500 font-medium mb-1">Total Owed</div>
                <div className="text-2xl sm:text-3xl font-semibold text-emerald-400">RM 0.00</div>
              </div>
            </div>
          )}

          {/* For host */}
          {subscription.userSummary.isHost && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-zinc-400" /> Host Overview
                  </span>
                  <span className="bg-zinc-800 text-zinc-300 text-xs font-medium px-2 py-0.5 rounded-full">
                    Upfront Payer
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-medium text-white">
                  {subscription.userSummary.totalUncollected && subscription.userSummary.totalUncollected > 0
                    ? `${formatCurrency(subscription.userSummary.totalUncollected)} pending collection from participants`
                    : 'All participant shares are fully collected!'}
                </h2>
                {subscription.userSummary.uncollectedParticipants && subscription.userSummary.uncollectedParticipants.length > 0 ? (
                  <div className="flex flex-wrap gap-3 mt-4">
                    {subscription.userSummary.uncollectedParticipants.map((p) => (
                      <div key={p.userId} className="flex items-center gap-3 bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3 pr-4 shadow-sm hover:border-zinc-700 transition-colors">
                        <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700/50 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0">
                           {p.name.slice(0,2).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                           <span className="text-sm font-medium text-white leading-tight mb-1">{p.name}</span>
                           <span className="text-xs text-red-400 font-semibold tracking-wide">
                             {formatCurrency(p.totalUnpaid)} <span className="text-zinc-500 font-normal lowercase tracking-normal">({p.unpaidMonthsCount} mo{p.unpaidMonthsCount === 1 ? '' : 's'})</span>
                           </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400 mt-2">
                    You cover the upfront bill. All active members are currently up to date on their shares.
                  </p>
                )}
              </div>

              <div className="text-left sm:text-right shrink-0 border-t sm:border-t-0 border-zinc-800/50 pt-4 sm:pt-0">
                <div className="text-sm text-zinc-500 font-medium mb-1">Uncollected Group Dues</div>
                <div className="text-2xl sm:text-3xl font-semibold text-white">
                  {formatCurrency(subscription.userSummary.totalUncollected || 0)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GitHub Contribution Heatmap Card */}
      <ContributionHeatmap
        selectedYear={selectedYear}
        availableYears={availableYears}
        onSelectYear={(yr) => setSelectedYear(yr)}
        cycles={cycles}
        selectedMonth={selectedMonth}
        onSelectMonth={(m) => {
          setSelectedMonth(m);
          setTimeout(() => {
            const el = document.getElementById('month-breakdown');
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }, 50);
        }}
        totalCollectedYear={totalCollectedYear}
        totalDueYear={totalDueYear}
        participants={subscription?.participants || []}
        creatorId={subscription?.creatorId}
      />

      {/* Month Breakdown & Participant Payments */}
      <div id="month-breakdown" className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 scroll-mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-zinc-800/50 gap-4 mb-6">
          <div>
            <h3 className="text-lg font-medium text-white flex items-center gap-3">
              <span>{selectedCycle?.monthName} {selectedYear} Payments</span>
              {selectedCycle && (
                <span className={cn(
                  'text-xs font-medium px-2.5 py-0.5 rounded-full border',
                  selectedCycle.level === 3
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : selectedCycle.level === 2
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                )}>
                  {selectedCycle.level === 3 ? 'Fully Settled' : selectedCycle.level === 2 ? 'Partially Paid' : 'Due / Unpaid'}
                </span>
              )}
            </h3>
            <p className="text-sm text-zinc-400 mt-1">
              Collected: <span className="text-white font-medium">{formatCurrency(selectedCycle?.totalCollected || 0)}</span> of {formatCurrency(selectedCycle?.totalDue || 0)}
            </p>
          </div>

          <div className="text-sm text-zinc-500 bg-zinc-950/50 border border-zinc-800/50 px-3 py-1.5 rounded-lg">
            {isHost ? 'Host controls enabled — click any status button to toggle payment' : 'Contact host if payment status needs adjustment'}
          </div>
        </div>

        {/* Cycle Items List */}
        <div className="space-y-2">
          {!selectedCycle || selectedCycle.items.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-sm">
              No participants recorded for this billing cycle.
            </div>
          ) : (
            selectedCycle.items.map((item) => {
              const isHostMember = item.userId === subscription.creatorId;
              const isPaid = item.status === 'Paid' || item.status === 'Waived';

              return (
                <div
                  key={item.userId}
                  className="p-4 rounded-xl hover:bg-zinc-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs text-zinc-300 overflow-hidden shrink-0">
                      {item.avatar ? (
                        <img src={item.avatar} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        item.initials
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-white text-sm flex items-center gap-2">
                        <span>{item.name}</span>
                        {isHostMember && (
                          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-medium">
                            Host
                          </span>
                        )}
                        {item.isPlaceholder && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
                            Placeholder
                          </span>
                        )}
                        {item.userId === currentUser?.id && (
                          <span className="text-[10px] text-zinc-500 font-normal">(You)</span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {isPaid
                          ? isHostMember
                            ? 'Waived — host covers the upfront bill'
                            : `Paid ${item.paidAt ? `on ${new Date(item.paidAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}`
                          : item.status === 'Pending'
                            ? 'Payment pending approval'
                            : 'Payment due'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-4 pl-14 sm:pl-0">
                    <div className="text-right">
                      <div className="text-sm font-medium text-white">
                        {formatCurrency(item.amountDue)}
                      </div>
                      <div className="text-[10px] text-zinc-500">Share due</div>
                    </div>

                    {/* Status Badge / Toggle Button */}
                    {isHostMember ? (
                      <span className="px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 inline-flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" /> Waived
                      </span>
                    ) : isHost || currentUser?.role === 'Admin' ? (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleToggleStatus(item.itemId, item.status)}
                        className={cn(
                          'px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors flex items-center gap-2 cursor-pointer',
                          isPaid
                            ? 'bg-zinc-800/50 text-zinc-300 border-zinc-700/50 hover:bg-zinc-800 hover:border-zinc-600'
                            : 'bg-white text-zinc-950 border-transparent hover:bg-zinc-200'
                        )}
                      >
                        {isPaid ? <Check className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        {isPaid ? 'Paid' : item.status === 'Pending' ? 'Approve Payment' : 'Mark Paid'}
                      </button>
                    ) : (
                      <span className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5',
                        isPaid
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : item.status === 'Pending'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                      )}>
                        {isPaid ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        {item.status}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Participant Roster Management */}
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6 pb-5 border-b border-zinc-800/50">
          <div>
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-zinc-400" />
              <span>Subscription Members</span>
            </h3>
            <p className="text-sm text-zinc-400 mt-1">
              {activeParticipants.length} active member{activeParticipants.length === 1 ? '' : 's'} • {formatCurrency(activeParticipants.length > 0 ? (subscription.totalAmount / activeParticipants.length) : 0)}/month each
            </p>
          </div>

          {isHost && (
            <button
              onClick={() => setAddMemberOpen(true)}
              className="px-4 py-2 bg-white text-zinc-950 text-sm font-medium rounded-lg hover:bg-zinc-200 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">Add Member</span>
            </button>
          )}
        </div>

        {/* Active Members Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {activeParticipants.map((p) => {
            const isCreatorMember = p.userId === subscription.creatorId;
            const equalShare = activeParticipants.length > 0 ? (subscription.totalAmount / activeParticipants.length) : 0;
            const memberMonthlyShare = subscription.splitType === 'custom' && p.amount > 0 ? p.amount : equalShare;
            const hasUnpaid = Number(p.totalUnpaid || 0) > 0;

            return (
              <div
                key={p.id}
                className="p-4 rounded-xl border border-zinc-800/50 bg-zinc-950/30 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs text-zinc-300 overflow-hidden shrink-0">
                    {p.avatar ? (
                      <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      p.initials
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate flex items-center gap-2">
                      <span>{p.name}</span>
                      {isCreatorMember && (
                        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-medium">
                          Host
                        </span>
                      )}
                      {p.isPlaceholder && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
                          Placeholder
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-sm font-medium text-white">
                        {formatCurrency(memberMonthlyShare)}<span className="text-zinc-500 font-normal">/mo</span>
                      </span>
                      {isCreatorMember ? (
                        <span className="text-[10px] text-zinc-500 font-medium bg-zinc-800/50 px-2 py-0.5 rounded-full border border-zinc-700/50">
                          Upfront Payer
                        </span>
                      ) : hasUnpaid ? (
                        <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 font-medium">
                          {formatCurrency(p.totalUnpaid!)} unpaid ({p.unpaidMonthsCount}mo)
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
                          Paid up ✓
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {isHost && !isCreatorMember && (
                  <button
                    type="button"
                    title="Discontinue participant (recalculates remaining shares)"
                    onClick={() => openDiscontinueModal(p.userId, p.name)}
                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Discontinued Members Section (if any) */}
        {discontinuedParticipants.length > 0 && (
          <div className="pt-6 border-t border-zinc-800/50 mt-6">
            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">
              Discontinued Members ({discontinuedParticipants.length})
            </h4>
            <div className="space-y-2">
              {discontinuedParticipants.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 rounded-xl border border-zinc-800/30 bg-zinc-950/20 flex items-center justify-between text-sm text-zinc-500"
                >
                  <div className="flex items-center gap-2">
                    <span className="line-through text-zinc-400">{p.name}</span>
                    <span>• Left {p.discontinuedDate ? new Date(p.discontinuedDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : ''}</span>
                  </div>
                  {isHost && (
                    <button
                      onClick={async () => {
                        await api.addRecurringParticipant(id, { userId: p.userId });
                        await fetchDetails();
                      }}
                      className="text-sm text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    >
                      Re-add
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Discontinue Member Modal */}
      {discontinueTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-md w-full space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <UserMinus className="w-5 h-5 text-red-400" />
                <span>Discontinue {discontinueTarget.name}</span>
              </h3>
              <button
                onClick={() => setDiscontinueTarget(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Set the final month <span className="text-white font-medium">{discontinueTarget.name}</span> participated in this plan.
            </p>

            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Last Participated Month & Year
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={discontinueMonth}
                  onChange={(e) => setDiscontinueMonth(Number(e.target.value))}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs cursor-pointer focus:outline-none focus:border-red-500/50"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>

                <select
                  value={discontinueYear}
                  onChange={(e) => setDiscontinueYear(Number(e.target.value))}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs cursor-pointer focus:outline-none focus:border-red-500/50"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-[11px] text-zinc-400 bg-red-500/5 border border-red-500/20 rounded-xl p-2.5 space-y-1">
                <p>
                  • Active in billing cycles up to: <strong className="text-white">{MONTH_NAMES[discontinueMonth - 1]} {discontinueYear}</strong>.
                </p>
                <p>
                  • Excluded starting: <strong className="text-red-400">{MONTH_NAMES[discontinueMonth % 12]} {discontinueMonth === 12 ? discontinueYear + 1 : discontinueYear}</strong>.
                </p>
                <p className="text-zinc-500 text-[10px]">
                  All remaining active members will automatically recalculate and share the full monthly bill starting next month.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDiscontinueTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800 text-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmDiscontinue}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm cursor-pointer disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'Discontinuing...' : 'Confirm Discontinue'}
              </button>
            </div>
            
            <div className="pt-4 mt-2 border-t border-zinc-800/50">
              <p className="text-[10px] text-zinc-500 mb-2">Added by mistake? You can delete this participant and all their history entirely.</p>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleRemoveParticipant}
                className="w-full py-2.5 rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-sm cursor-pointer disabled:opacity-50 transition-colors"
              >
                Remove Completely
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {/* Edit Subscription Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-md w-full space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-white">Edit Subscription</h3>
              <button onClick={() => setIsEditing(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-zinc-500 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Total Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-zinc-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-zinc-500 text-sm cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Billing Day</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={editBillingDay}
                    onChange={(e) => setEditBillingDay(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-zinc-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Split Method</label>
                  <select
                    value={editSplitType}
                    onChange={(e) => setEditSplitType(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-zinc-500 text-sm cursor-pointer"
                  >
                    <option value="equal">Equal Split</option>
                    <option value="custom">Custom Amounts</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleSaveEdit}
                disabled={actionLoading || !editTitle || !editAmount || !editCategory || !editBillingDay}
                className="w-full py-2.5 rounded-xl bg-accent text-accent-text font-bold hover:opacity-90 text-sm disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
      {addMemberOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-white">Add Member to {subscription.title}</h3>
              <button
                type="button"
                onClick={() => setAddMemberOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              Adding a member will automatically recalculate the monthly equal share among all active members.
            </p>

            {/* Mode selection: Registered vs Placeholder */}
            <div className="flex bg-zinc-950 border border-zinc-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setAddMemberMode('registered')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  addMemberMode === 'registered' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Registered Member
              </button>
              <button
                type="button"
                onClick={() => setAddMemberMode('placeholder')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 ${
                  addMemberMode === 'placeholder' ? 'bg-sky-500 text-black' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Unregistered Friend
              </button>
            </div>

            {addMemberMode === 'registered' ? (
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Select User
                </label>
                <select
                  value={selectedNewUserId}
                  onChange={(e) => setSelectedNewUserId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none text-sm cursor-pointer"
                >
                  <option value="">-- Choose member --</option>
                  {allUsers
                    .filter((u) => !activeParticipants.some((p) => p.userId === u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.email ? `(${u.email})` : ''} {u.isPlaceholder ? '[Placeholder]' : ''}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Friend's Name (Placeholder)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Farhan, Bob, Roommate..."
                  value={placeholderFriendName}
                  onChange={(e) => setPlaceholderFriendName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      if (placeholderFriendName.trim() && !actionLoading) {
                        handleAddMember();
                      }
                    }
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-sky-500 text-sm"
                />
                <p className="text-[11px] text-amber-400/90 mt-1.5">
                  This person will be tagged as a placeholder payer. When they register with an account later, the admin can approve and link them directly to this spot.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Joined Month
                </label>
                <select
                  value={newMemberMonth}
                  onChange={(e) => setNewMemberMonth(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none text-sm cursor-pointer"
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i} value={i + 1}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Joined Year
                </label>
                <input
                  type="number"
                  value={newMemberYear}
                  onChange={(e) => setNewMemberYear(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAddMemberOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800 text-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || (addMemberMode === 'registered' ? !selectedNewUserId : !placeholderFriendName.trim())}
                onClick={handleAddMember}
                className="flex-1 py-2.5 rounded-xl bg-accent text-accent-text font-bold hover:opacity-90 text-sm disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? 'Adding...' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Dues & Analytics Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-emerald-400" />
                    Share Dues &amp; Analytics
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">
                    {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  1-Click copyable reminder message or visual card with direct link for {subscription.title}.
                </p>
              </div>
              <button
                onClick={() => setShareModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab selector */}
            <div className="flex bg-zinc-950 border border-zinc-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveShareTab('whatsapp')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                  activeShareTab === 'whatsapp' ? 'bg-emerald-500 text-black shadow-md' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                WhatsApp / Text Template
              </button>
              <button
                type="button"
                onClick={() => setActiveShareTab('card')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                  activeShareTab === 'card' ? 'bg-sky-500 text-black shadow-md' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Visual Card Image
              </button>
            </div>

            {activeShareTab === 'whatsapp' ? (
              <div className="space-y-4">
                <div className="relative">
                  <pre className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-xs font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed select-all">
                    {getWhatsAppMessage()}
                  </pre>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCopyWhatsAppText}
                    className="w-full sm:flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-emerald-500 text-black hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    {copiedText ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-black" />
                        <span>Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Message for WhatsApp</span>
                      </>
                    )}
                  </button>

                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(getWhatsAppMessage())}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto py-3 px-5 rounded-xl font-semibold text-xs border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open WhatsApp</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Visual Card Mock Preview */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400">SplitTrack Subscription</div>
                      <div className="text-lg font-bold text-white">{subscription.title}</div>
                    </div>
                    <div className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-sky-300">
                      {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-center">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Plan</div>
                      <div className="text-sm font-bold text-white mt-0.5">{formatCurrency(subscription.totalAmount)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Collected</div>
                      <div className="text-sm font-bold text-emerald-400 mt-0.5">
                        {formatCurrency(selectedCycle?.totalCollected || 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Due</div>
                      <div className="text-sm font-bold text-red-400 mt-0.5">
                        {formatCurrency(Math.max(0, (selectedCycle?.totalDue || subscription.totalAmount) - (selectedCycle?.totalCollected || 0)))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {(selectedCycle?.items || []).map((it) => (
                      <div key={it.userId} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/40 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{it.name}</span>
                          {it.isPlaceholder && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Placeholder
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-300 font-mono font-medium">{formatCurrency(it.amountDue)}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            it.status === 'Paid' || it.status === 'Waived'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}>
                            {it.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span>Direct month deep-link included in export</span>
                    <span className="text-sky-400 font-mono">Billed on {subscription.billingDay}th</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={handleDownloadCard}
                    className="py-2.5 px-3 rounded-xl font-bold text-xs bg-sky-500 text-black hover:bg-sky-400 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-sky-500/20 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyCard}
                    className="py-2.5 px-3 rounded-xl font-bold text-xs border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedImage ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Image</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const link = `${window.location.origin}/subscriptions/${id}?month=${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
                      navigator.clipboard.writeText(link);
                      alert('Direct link to this month copied to clipboard!');
                    }}
                    className="py-2.5 px-3 rounded-xl font-semibold text-xs border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
