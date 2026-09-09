import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Repeat, Calendar, Info, History, UserCheck, UserX, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useCategories, useUsers } from '@/lib/hooks/useData';
import { api } from '@/lib/api';
import { ParticipantPicker, BackButton } from '@/components';
import { formatCurrency } from '@/lib/utils/currency';
import { AvatarBadge } from '@/components/ui/AvatarBadge';
import { cn } from '@/lib/utils/cn';

const MONTH_OPTIONS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
const currentMonthLabel = MONTH_OPTIONS.find((m) => m.value === currentMonth)?.label || 'Current Month';

// Years from 2020 up to next year
const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => currentYear + 1 - i);

interface ParticipantTimeline {
  joinedMonth: string;
  joinedYear: number;
  isDiscontinued: boolean;
  discontinuedMonth: string;
  discontinuedYear: number;
  paidUntilOption: 'none' | 'current' | 'custom';
  paidUntilMonth: string;
  paidUntilYear: number;
}

export default function NewSubscription() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { categories } = useCategories();
  const { users } = useUsers();

  const [title, setTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [billingDay, setBillingDay] = useState('1');
  const [splitMethod, setSplitMethod] = useState<'equal' | 'custom'>('equal');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  // Subscription start date
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [startYear, setStartYear] = useState(currentYear);

  // Per-participant timeline & paid-until history
  const [timelines, setTimelines] = useState<Record<string, ParticipantTimeline>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);

  // Set default category once loaded
  useEffect(() => {
    if (!selectedCategory && categories.length > 0) {
      const preferred = categories.find((c) =>
        c.name.toLowerCase().includes('subscription') ||
        c.name.toLowerCase().includes('entertainment') ||
        c.name.toLowerCase().includes('utilities')
      );
      setSelectedCategory(preferred ? preferred.id : categories[0].id);
    }
  }, [categories, selectedCategory]);

  // Ensure current user is in participants list by default
  useEffect(() => {
    if (currentUser && !selectedParticipants.includes(currentUser.id)) {
      setSelectedParticipants((prev) => [currentUser.id, ...prev.filter((id) => id !== currentUser.id)]);
    }
  }, [currentUser]);

  // Initialize timeline for newly selected participants
  useEffect(() => {
    setTimelines((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const userId of selectedParticipants) {
        if (!next[userId]) {
          next[userId] = {
            joinedMonth: startMonth,
            joinedYear: startYear,
            isDiscontinued: false,
            discontinuedMonth: currentMonth,
            discontinuedYear: currentYear,
            paidUntilOption: 'current',
            paidUntilMonth: currentMonth,
            paidUntilYear: currentYear,
          };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedParticipants, startMonth, startYear]);

  const numAmount = parseFloat(amount.replace(/,/g, '')) || 0;
  const participantCount = selectedParticipants.length;
  const equalSplitAmount = participantCount > 0 ? Number((numAmount / participantCount).toFixed(2)) : 0;

  const handleAmountChange = (val: string) => {
    const cleaned = val.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setAmount(cleaned);
  };

  const handleBillingDayChange = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (digits === '') {
      setBillingDay('');
      return;
    }
    const num = parseInt(digits, 10);
    if (num > 31) {
      setBillingDay('31');
    } else {
      setBillingDay(String(num));
    }
  };

  const handleBillingDayBlur = () => {
    if (!billingDay || parseInt(billingDay, 10) < 1) {
      setBillingDay('1');
    }
  };

  const toggleParticipant = (userId: string) => {
    // Creator cannot be removed
    if (userId === currentUser?.id) return;

    setSelectedParticipants((prev) => {
      if (prev.includes(userId)) {
        const next = prev.filter((id) => id !== userId);
        const nextCustom = { ...customAmounts };
        delete nextCustom[userId];
        setCustomAmounts(nextCustom);
        return next;
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleCustomAmountChange = (userId: string, val: string) => {
    const cleaned = val.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setCustomAmounts((prev) => ({ ...prev, [userId]: cleaned }));
  };

  const updateTimeline = (userId: string, patch: Partial<ParticipantTimeline>) => {
    setTimelines((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {
          joinedMonth: startMonth,
          joinedYear: startYear,
          isDiscontinued: false,
          discontinuedMonth: currentMonth,
          discontinuedYear: currentYear,
          paidUntilOption: 'current',
          paidUntilMonth: currentMonth,
          paidUntilYear: currentYear,
        }),
        ...patch,
      },
    }));
  };

  const dayNumber = parseInt(billingDay, 10) || 1;
  const canSubmit =
    title.trim().length > 0 &&
    numAmount > 0 &&
    selectedParticipants.length > 0 &&
    dayNumber >= 1 &&
    dayNumber <= 31;

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsReviewing(true);
  };

  const handleConfirm = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const subscriptionStartDate = `${startYear}-${startMonth}-01`;

      const participantsPayload = selectedParticipants.map((userId) => {
        const share =
          splitMethod === 'equal'
            ? equalSplitAmount
            : parseFloat(customAmounts[userId] || '0') || 0;

        const isHost = userId === currentUser?.id;
        const timeline = timelines[userId];

        if (isHost || !timeline) {
          return {
            userId,
            amount: share,
            joinedDate: subscriptionStartDate,
            discontinuedDate: null,
            paidUntil: null,
          };
        }

        const joinedDate = `${timeline.joinedYear}-${timeline.joinedMonth}-01`;
        let discontinuedDate: string | null = null;
        if (timeline.isDiscontinued) {
          const mNum = parseInt(timeline.discontinuedMonth, 10);
          const lastDay = new Date(Date.UTC(timeline.discontinuedYear, mNum, 0)).getUTCDate();
          discontinuedDate = `${timeline.discontinuedYear}-${timeline.discontinuedMonth}-${String(lastDay).padStart(2, '0')}T23:59:59.000Z`;
        }

        let paidUntil: string | null = null;
        if (timeline.paidUntilOption === 'current') {
          paidUntil = timeline.isDiscontinued
            ? `${timeline.discontinuedYear}-${timeline.discontinuedMonth}`
            : `${currentYear}-${currentMonth}`;
        } else if (timeline.paidUntilOption === 'custom') {
          paidUntil = `${timeline.paidUntilYear}-${timeline.paidUntilMonth}`;
        } else {
          paidUntil = null;
        }

        return {
          userId,
          amount: share,
          joinedDate,
          discontinuedDate,
          paidUntil,
        };
      });

      const newRec = await api.createRecurring({
        title: title.trim(),
        totalAmount: numAmount,
        categoryId: selectedCategory,
        startDate: subscriptionStartDate,
        billingCycle: 'monthly',
        billingDay: dayNumber,
        splitType: splitMethod,
        participants: participantsPayload,
      });

      window.dispatchEvent(new Event('splittrack:data-changed'));
      navigate(`/subscriptions/${newRec.id}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to create subscription. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Other members excluding current user
  const otherParticipants = selectedParticipants.filter((id) => id !== currentUser?.id);

  if (isReviewing) {
    const selectedCatObj = categories.find(c => c.id === selectedCategory);
    return (
      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 animate-in slide-in-from-right-8 duration-500 pb-20">
        <header className="mb-6 sm:mb-8 lg:mb-10 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-light text-white tracking-tight">Review Subscription</h1>
            <p className="text-zinc-400 mt-2 text-sm sm:text-base">Please review your plan details before creating it.</p>
          </div>
          <button onClick={() => setIsReviewing(false)} className="text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Edit
          </button>
        </header>

        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-5 sm:p-8 space-y-8">
          <div>
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">Plan Summary</h2>
            <dl className="space-y-3">
              <div className="flex justify-between border-b border-zinc-800/50 pb-3">
                <dt className="text-zinc-400 text-sm">Title</dt>
                <dd className="text-white font-medium text-sm">{title}</dd>
              </div>
              <div className="flex justify-between border-b border-zinc-800/50 pb-3">
                <dt className="text-zinc-400 text-sm">Category</dt>
                <dd className="text-white font-medium text-sm">{selectedCatObj?.name}</dd>
              </div>
              <div className="flex justify-between border-b border-zinc-800/50 pb-3">
                <dt className="text-zinc-400 text-sm">Amount</dt>
                <dd className="text-white font-medium text-sm text-right">
                  RM {numAmount.toFixed(2)}
                  <div className="text-xs text-zinc-500 font-normal">Renews on the {dayNumber}{[1, 21, 31].includes(dayNumber) ? 'st' : [2, 22].includes(dayNumber) ? 'nd' : [3, 23].includes(dayNumber) ? 'rd' : 'th'} every month</div>
                </dd>
              </div>
              <div className="flex justify-between pb-1">
                <dt className="text-zinc-400 text-sm">Start Date</dt>
                <dd className="text-white font-medium text-sm">{MONTH_OPTIONS.find(m => m.value === startMonth)?.label} {startYear}</dd>
              </div>
            </dl>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">Participants</h2>
            <div className="space-y-3">
              {selectedParticipants.map(userId => {
                const u = users.find(user => user.id === userId);
                const isHost = userId === currentUser?.id;
                const timeline = timelines[userId] || {
                  joinedMonth: startMonth,
                  joinedYear: parseInt(startYear, 10),
                  isDiscontinued: false,
                  paidUntilOption: 'none'
                };
                const share = splitMethod === 'equal' ? equalSplitAmount : parseFloat(customAmounts[userId] || '0') || 0;

                return (
                  <div key={userId} className="flex justify-between items-center bg-zinc-950 border border-zinc-800/50 p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                      <AvatarBadge initials={u?.initials} avatar={u?.avatar} name={u?.name} size="sm" />
                      <div>
                        <div className="text-white font-medium text-sm">
                          {u?.name || userId} {isHost && <span className="text-zinc-500 font-normal ml-1">(Host)</span>}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          Joined {MONTH_OPTIONS.find(m => m.value === (isHost ? startMonth : String(timeline.joinedMonth).padStart(2, '0')))?.label} {isHost ? startYear : timeline.joinedYear}
                          {timeline.isDiscontinued && !isHost && ` • Left ${MONTH_OPTIONS.find(m => m.value === String(timeline.discontinuedMonth).padStart(2, '0'))?.label} ${timeline.discontinuedYear}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-medium text-sm">RM {share.toFixed(2)}</div>
                      <div className="text-[10px] text-zinc-500">per cycle</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}
        
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setIsReviewing(false)}
            className="px-6 py-3.5 bg-zinc-800 text-white font-bold rounded-xl hover:bg-zinc-700 transition-colors text-sm cursor-pointer"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex-1 px-8 py-3.5 bg-accent text-accent-text font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 text-sm cursor-pointer"
          >
            {isSubmitting ? 'Creating...' : 'Confirm & Create'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="mb-6 sm:mb-8 lg:mb-10 flex items-center gap-4">
        <BackButton fallbackPath="/subscriptions" />
        <div>
          <div className="text-xs sm:text-sm text-zinc-500 font-medium uppercase tracking-wider mb-1">
            Subscriptions &amp; Recurring
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight flex items-center gap-2.5">
            <Repeat className="w-5 h-5 text-accent" /> New Shared Plan
          </h1>
        </div>
      </header>

      <p className="text-zinc-400 text-sm sm:text-base">
        Set up recurring shared expenses like Spotify Family, Netflix, or shared utility bills. You can specify when the plan started and insert historical payment data directly from your notes.
      </p>

      <form onSubmit={handleReview} className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-5 sm:p-8 space-y-8">
        {/* Basic Information */}
        <div>
          <h2 className="text-sm font-medium text-white mb-4">Plan Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                Plan Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Spotify Family Plan, Netflix 4K"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-zinc-500 transition-colors placeholder:text-zinc-600 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-zinc-500 transition-colors text-sm cursor-pointer"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Cost and Billing Day */}
        <div className="pt-6 border-t border-zinc-800/50">
          <h2 className="text-sm font-medium text-white mb-4">Billing Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                Total Amount (RM)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.00"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-zinc-500 transition-colors placeholder:text-zinc-600 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5 flex items-center justify-between">
                <span>Billing Day of Month</span>
                <span className="text-xs text-zinc-500 font-normal">Day 1 - 31</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={billingDay}
                  onChange={(e) => handleBillingDayChange(e.target.value)}
                  onBlur={handleBillingDayBlur}
                  placeholder="1"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-zinc-500 transition-colors text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  required
                />
                <Calendar className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Start Date */}
        <div className="pt-6 border-t border-zinc-800/50">
          <div className="mb-4">
            <h2 className="text-sm font-medium text-white">Subscription Start Date</h2>
            <p className="text-xs text-zinc-400 mt-1">
              Historical cycles and heatmaps will be generated from this start period.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Start Month</label>
              <select
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-500 cursor-pointer"
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Start Year</label>
              <select
                value={startYear}
                onChange={(e) => setStartYear(parseInt(e.target.value, 10))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-500 cursor-pointer"
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Participant Selection */}
        <div>
          <div className="mb-2">
            <h3 className="text-sm font-medium text-zinc-300">Plan Participants</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Select members sharing this plan. As host ({currentUser?.name}), your share is waived automatically.
            </p>
          </div>

          <ParticipantPicker
            users={users}
            selectedParticipants={selectedParticipants}
            onToggleParticipant={toggleParticipant}
            splitMethod={splitMethod}
            onChangeSplitMethod={setSplitMethod}
            customAmounts={customAmounts}
            onChangeCustomAmount={handleCustomAmountChange}
            equalSplitAmount={equalSplitAmount}
            numAmount={numAmount}
            lockedParticipantId={currentUser?.id}
          />
        </div>

        {/* Member Timelines & Manual Notes Setup */}
        {otherParticipants.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-medium text-zinc-200">
                Participant History &amp; Payment Records
              </h3>
            </div>
            <p className="text-xs text-zinc-500">
              Configure each member’s join date, unsubscribe date, and payment status directly from your notes.
            </p>

            <div className="space-y-3">
              {otherParticipants.map((userId) => {
                const u = users.find((item) => item.id === userId);
                const timeline = timelines[userId] || {
                  joinedMonth: startMonth,
                  joinedYear: startYear,
                  isDiscontinued: false,
                  discontinuedMonth: currentMonth,
                  discontinuedYear: currentYear,
                  paidUntilOption: 'current',
                  paidUntilMonth: currentMonth,
                  paidUntilYear: currentYear,
                };

                return (
                  <div
                    key={userId}
                    className="p-4 sm:p-5 rounded-2xl border border-zinc-800 bg-zinc-950/70 space-y-4 shadow-sm"
                  >
                    {/* Header: User Info */}
                    <div className="flex items-center gap-3">
                      <AvatarBadge
                        initials={u?.initials}
                        avatar={u?.avatar}
                        name={u?.name}
                        size="md"
                      />
                      <div>
                        <div className="text-base font-semibold text-white">{u?.name || userId}</div>
                        <div className="text-xs text-zinc-400">{u?.email}</div>
                      </div>
                    </div>

                    {/* Step 1: Membership Status (Explicit Segmented Control) */}
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                        1. Membership Status
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateTimeline(userId, { isDiscontinued: false })
                          }
                          className={cn(
                            'py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer',
                            !timeline.isDiscontinued
                              ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-500/10'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                          )}
                        >
                          <UserCheck className="w-4 h-4 text-emerald-400" />
                          Currently Active
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateTimeline(userId, { isDiscontinued: true })
                          }
                          className={cn(
                            'py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer',
                            timeline.isDiscontinued
                              ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/10'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                          )}
                        >
                          <UserX className="w-4 h-4 text-amber-400" />
                          Discontinued / Left Plan
                        </button>
                      </div>
                    </div>

                    {/* Step 1b: Discontinuation Date (Visible when discontinued) */}
                    {timeline.isDiscontinued && (
                      <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2.5">
                        <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
                          <UserX className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>When did {u?.name} discontinue / leave?</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] text-zinc-400 mb-1 font-medium">Left in Month</label>
                            <select
                              value={timeline.discontinuedMonth}
                              onChange={(e) =>
                                updateTimeline(userId, { discontinuedMonth: e.target.value })
                              }
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                            >
                              {MONTH_OPTIONS.map((m) => (
                                <option key={m.value} value={m.value}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] text-zinc-400 mb-1 font-medium">Left in Year</label>
                            <select
                              value={timeline.discontinuedYear}
                              onChange={(e) =>
                                updateTimeline(userId, {
                                  discontinuedYear: parseInt(e.target.value, 10),
                                })
                              }
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                            >
                              {YEAR_OPTIONS.map((y) => (
                                <option key={y} value={y}>
                                  {y}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <p className="text-[11px] text-amber-200/80 leading-relaxed">
                          {u?.name} will participate in billing from their join date up to{' '}
                          <span className="font-semibold text-white">
                            {MONTH_OPTIONS.find((m) => m.value === timeline.discontinuedMonth)?.label} {timeline.discontinuedYear}
                          </span>.
                          From the subsequent month onward, {u?.name} is completely excluded and remaining members split the full plan cost.
                        </p>
                      </div>
                    )}

                    {/* Step 2: Joined Date */}
                    <div className="pt-2 border-t border-zinc-800/60">
                      <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                        2. Joined Plan Date
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1 font-medium">Join Month</label>
                          <select
                            value={timeline.joinedMonth}
                            onChange={(e) =>
                              updateTimeline(userId, { joinedMonth: e.target.value })
                            }
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-600 cursor-pointer"
                          >
                            {MONTH_OPTIONS.map((m) => (
                              <option key={m.value} value={m.value}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1 font-medium">Join Year</label>
                          <select
                            value={timeline.joinedYear}
                            onChange={(e) =>
                              updateTimeline(userId, {
                                joinedYear: parseInt(e.target.value, 10),
                              })
                            }
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-600 cursor-pointer"
                          >
                            {YEAR_OPTIONS.map((y) => (
                              <option key={y} value={y}>
                                {y}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Payment History Status */}
                    <div className="pt-2 border-t border-zinc-800/60">
                      <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                        3. Payment History (from your notes)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() => updateTimeline(userId, { paidUntilOption: 'none' })}
                          className={cn(
                            'py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all text-center cursor-pointer',
                            timeline.paidUntilOption === 'none'
                              ? 'bg-red-500/15 border-red-500/50 text-red-300 shadow-sm shadow-red-500/10'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                          )}
                        >
                          ✕ Haven't paid yet
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTimeline(userId, { paidUntilOption: 'current' })}
                          className={cn(
                            'py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all text-center cursor-pointer',
                            timeline.paidUntilOption === 'current'
                              ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-500/10'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                          )}
                        >
                          ✓ Paid all active months
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTimeline(userId, { paidUntilOption: 'custom' })}
                          className={cn(
                            'py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all text-center cursor-pointer',
                            timeline.paidUntilOption === 'custom'
                              ? 'bg-zinc-800 border-zinc-700 text-white shadow-sm'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                          )}
                        >
                          📅 Paid until specific date...
                        </button>
                      </div>

                      {timeline.paidUntilOption === 'custom' && (
                        <div className="grid grid-cols-2 gap-2.5 mt-2.5 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                          <div>
                            <label className="block text-[10px] text-zinc-400 mb-1">Paid up to Month</label>
                            <select
                              value={timeline.paidUntilMonth}
                              onChange={(e) =>
                                updateTimeline(userId, { paidUntilMonth: e.target.value })
                              }
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-600 cursor-pointer"
                            >
                              {MONTH_OPTIONS.map((m) => (
                                <option key={m.value} value={m.value}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-zinc-400 mb-1">Paid up to Year</label>
                            <select
                              value={timeline.paidUntilYear}
                              onChange={(e) =>
                                updateTimeline(userId, {
                                  paidUntilYear: parseInt(e.target.value, 10),
                                })
                              }
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-600 cursor-pointer"
                            >
                              {YEAR_OPTIONS.map((y) => (
                                <option key={y} value={y}>
                                  {y}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Step 4: Live Scenario Summary Pill */}
                    <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-start gap-2.5 text-xs">
                      <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <div className="space-y-1 text-zinc-400">
                        <div>
                          <span className="text-zinc-200 font-semibold">{u?.name}:</span> Joined in{' '}
                          <span className="text-white font-medium">
                            {MONTH_OPTIONS.find((m) => m.value === timeline.joinedMonth)?.label} {timeline.joinedYear}
                          </span>
                          {timeline.isDiscontinued ? (
                            <>
                              {' '}• Discontinued in{' '}
                              <span className="text-amber-300 font-medium">
                                {MONTH_OPTIONS.find((m) => m.value === timeline.discontinuedMonth)?.label} {timeline.discontinuedYear}
                              </span>{' '}
                              (excluded from future billing)
                            </>
                          ) : (
                            <>
                              {' '}• <span className="text-emerald-400 font-medium">Currently active</span>
                            </>
                          )}
                        </div>
                        <div>
                          Payment records:{' '}
                          {timeline.paidUntilOption === 'none' ? (
                            <span className="text-red-400 font-semibold">
                              Has NOT paid (all participating months will be marked Unpaid / open dues)
                            </span>
                          ) : timeline.paidUntilOption === 'current' ? (
                            <span className="text-emerald-400 font-semibold">
                              Paid all months up to{' '}
                              {timeline.isDiscontinued
                                ? `${MONTH_OPTIONS.find((m) => m.value === timeline.discontinuedMonth)?.label} ${timeline.discontinuedYear}`
                                : `${currentMonthLabel} ${currentYear}`}
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-semibold">
                              Paid up to{' '}
                              {MONTH_OPTIONS.find((m) => m.value === timeline.paidUntilMonth)?.label}{' '}
                              {timeline.paidUntilYear} (subsequent participating months Unpaid)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Summary Box */}
        <div className="pt-6 border-t border-zinc-800/50">
          <h2 className="text-sm font-medium text-white mb-4">Plan Summary</h2>
          <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-5">
            <dl className="space-y-4 text-sm">
              <div className="flex justify-between items-center">
                <dt className="text-zinc-500">Host (Creator)</dt>
                <dd className="text-white font-medium">{currentUser?.name} (You)</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-zinc-500">Subscription Started</dt>
                <dd className="text-white font-medium">
                  {MONTH_OPTIONS.find((m) => m.value === startMonth)?.label} {startYear}
                </dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-zinc-500">Billing Schedule</dt>
                <dd className="text-white font-medium">Monthly on day {dayNumber}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-zinc-500">Total Monthly Cost</dt>
                <dd className="text-white font-medium">{formatCurrency(numAmount)} / month</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-zinc-500">Total Participants</dt>
                <dd className="text-white font-medium">{selectedParticipants.length} people</dd>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-zinc-800/50 mt-4">
                <dt className="text-zinc-400 font-medium">Monthly share per active member</dt>
                <dd className="text-white font-semibold">
                  {formatCurrency(equalSplitAmount)} / person
                </dd>
              </div>
            </dl>

            <div className="flex items-start gap-2 pt-4 mt-4 text-xs text-zinc-500 border-t border-zinc-800/50">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-zinc-400" />
              <span>
                Historical cycles from {MONTH_OPTIONS.find((m) => m.value === startMonth)?.label} {startYear} will be generated with payment heatmaps. If a member unsubscribed, subsequent cycles will automatically recalculate shares for the remaining members.
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-4 pt-2">
          <button
            type="button"
            onClick={() => navigate('/subscriptions')}
            className="flex-1 py-3 rounded-full border border-zinc-700 bg-surface-alt text-zinc-300 font-medium hover:bg-zinc-800 transition-colors cursor-pointer text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="flex-1 py-3 rounded-full bg-accent text-accent-text font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm flex items-center justify-center gap-2"
          >
            {isSubmitting ? 'Creating Plan...' : 'Continue to Review'}
          </button>
        </div>
      </form>
    </div>
  );
}
