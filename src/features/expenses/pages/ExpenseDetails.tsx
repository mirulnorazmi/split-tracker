import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit2, Check, X, CreditCard, Calendar, User, ChevronRight, Clock, Trash2, Folder as FolderIcon } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useExpense, useCategories, useUsers, usePayments } from '@/lib/hooks/useData';
import { api, Folder } from '@/lib/api';
import { getUserShare, getUserPaidAmount, getUserPendingAmount, getUserRemainingShare } from '@/lib/utils/expense';
import { cn } from '@/lib/utils/cn';
import { useExpenseForm } from '@/features/expenses/hooks/useExpenseForm';
import { ParticipantPicker, SuccessScreen, BackButton } from '@/components';

type ExpenseDetailsProps = {
  expenseId?: string;
  onBack?: () => void;
};

export default function ExpenseDetails({ expenseId: propExpenseId, onBack }: ExpenseDetailsProps) {
  const { id: paramId } = useParams<{ id: string }>();
  const expenseId = propExpenseId || paramId || '';
  const navigate = useNavigate();

  const { user: currentUser } = useAuth();
  const { expense, isLoading, refetch } = useExpense(expenseId);
  const { categories } = useCategories();
  const { users } = useUsers();
  const { payments: allExpensePayments, isLoading: paymentsLoading } = usePayments({ expenseId });

  const [step, setStep] = useState<'view' | 'edit' | 'confirm' | 'success'>('view');
  const [countdown, setCountdown] = useState(5);
  const [actionLoading, setActionLoading] = useState(false);

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [folders, setFolders] = useState<Folder[]>([]);

  useEffect(() => {
    api.listFolders().then((data) => {
      setFolders(data);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (expense) {
      setSelectedFolderId(expense.folderId || '');
    }
  }, [expense]);

  // Filters for payment history
  const [payerFilter, setPayerFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');

  const initialParticipants = Array.isArray(expense?.participants)
    ? expense.participants.map((p: any) => (typeof p === 'string' ? p : p.userId))
    : [];

  const initialCustomAmounts = Array.isArray(expense?.participants)
    ? Object.fromEntries(
        expense.participants.map((p: any) => [
          typeof p === 'string' ? p : p.userId,
          typeof p === 'object' && p.amountOwed !== undefined ? String(p.amountOwed) : '',
        ])
      )
    : {};

  const form = useExpenseForm({
    initialTitle: expense?.title,
    initialAmount: expense ? Number(expense.totalAmount).toFixed(2) : '',
    initialCategoryId: expense?.categoryId,
    initialParticipants,
    initialCustomAmounts,
    lockedParticipantId: expense?.creatorId,
  });

  const handleStartEdit = () => {
    if (expense) {
      const pIds = Array.isArray(expense.participants)
        ? expense.participants.map((p: any) => (typeof p === 'string' ? p : p.userId))
        : [];
      const cAmounts = Array.isArray(expense.participants)
        ? Object.fromEntries(
            expense.participants.map((p: any) => [
              typeof p === 'string' ? p : p.userId,
              typeof p === 'object' && p.amountOwed !== undefined ? String(p.amountOwed) : '',
            ])
          )
        : {};

      form.resetForm({
        initialTitle: expense.title,
        initialAmount: Number(expense.totalAmount).toFixed(2),
        initialCategoryId: expense.categoryId,
        initialDate: expense.date,
        initialParticipants: pIds,
        initialCustomAmounts: cAmounts,
        lockedParticipantId: expense.creatorId,
      });
    }
    setStep('edit');
  };

  const handleSaveChanges = async () => {
    if (!expense) return;
    setSaveLoading(true);
    setSaveError(null);
    try {
      const participants = form.selectedParticipants.map((userId) => {
        const amountOwed =
          form.splitMethod === 'equal'
            ? form.equalSplitAmount
            : parseFloat(form.customAmounts[userId]?.replace(/,/g, '') || '0') || 0;
        return { userId, amountOwed };
      });

      await api.updateExpense(expense.id, {
        title: form.title,
        totalAmount: form.numAmount,
        categoryId: form.selectedCategory,
        folderId: selectedFolderId || null,
        date: form.date ? new Date(form.date).toISOString() : undefined,
        participants,
      });

      await refetch();
      setStep('success');
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save changes.');
    } finally {
      setSaveLoading(false);
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'success') {
      if (countdown <= 0) {
        setStep('view');
        setCountdown(5);
      } else {
        timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
      }
    }
    return () => clearTimeout(timer);
  }, [step, countdown]);

  const handleApprove = async () => {
    if (!expense) return;
    setActionLoading(true);
    try {
      await api.updateExpenseStatus(expense.id, 'Confirmed');
      await refetch();
    } catch (err) {
      console.error('Failed to approve expense:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!expense) return;
    setActionLoading(true);
    try {
      await api.updateExpenseStatus(expense.id, 'Rejected');
      await refetch();
    } catch (err: any) {
      console.error('Failed to reject expense:', err);
      alert(err?.message || 'Failed to reject expense');
    } finally {
      setActionLoading(false);
    }
  };

  const isAdmin = currentUser?.role === 'Admin';

  const handleDeleteExpense = async () => {
    if (!expense) return;
    if (!window.confirm(`Are you sure you want to delete "${expense.title}"? All associated participant records will be permanently removed.`)) {
      return;
    }
    setActionLoading(true);
    try {
      await api.deleteExpense(expense.id);
      window.dispatchEvent(new Event('splittrack:data-changed'));
      if (onBack) onBack();
      else navigate('/expenses');
    } catch (err: any) {
      alert(err?.message || 'Failed to delete expense');
      setActionLoading(false);
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

  // Filter payments
  const filteredPayments = useMemo(() => {
    return allExpensePayments.filter((p) => {
      // Filter by payer
      if (payerFilter !== 'all' && p.payerId !== payerFilter) {
        return false;
      }
      // Filter by date
      if (dateFilter) {
        const paymentDateIso = new Date(p.date).toISOString().slice(0, 10);
        if (paymentDateIso !== dateFilter) {
          return false;
        }
      }
      return true;
    });
  }, [allExpensePayments, payerFilter, dateFilter]);

  // Total paid amount for this expense
  const totalSettledAmount = useMemo(() => {
    return allExpensePayments
      .filter((p) => p.status === 'Confirmed')
      .reduce((sum, p) => {
        const applied = p.expensesApplied?.find((ea: any) => ea.expenseId === expenseId);
        return sum + (applied ? Number(applied.amountApplied) : Number(p.amount));
      }, 0);
  }, [allExpensePayments, expenseId]);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500 py-20 text-center text-zinc-500">
        Loading expense details...
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        <BackButton fallbackPath="/expenses" label="Back to Expenses" onClick={onBack} />
        <div className="text-zinc-400">Expense not found.</div>
      </div>
    );
  }

  const category = categories.find((c) => c.id === expense.categoryId);
  const isHost = expense.creatorId === currentUser?.id;
  const currentUserId = currentUser?.id || '';

  if (step === 'success') {
    return (
      <SuccessScreen
        title="Updates Saved"
        message={
          <>
            The details for <span className="font-semibold text-white">{form.title}</span> have been successfully updated.
          </>
        }
        countdown={countdown}
      />
    );
  }

  if (step === 'confirm') {
    const selectedCategoryData = categories.find((c) => c.id === form.selectedCategory);
    return (
      <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-right-8 duration-500 pb-20">
        <button onClick={() => setStep('edit')} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back to Editing
        </button>
        <header className="mb-10">
          <h1 className="text-4xl font-light text-white tracking-tight">Confirm Changes</h1>
          <p className="text-zinc-400 mt-2">Please review your updated expense details before saving.</p>
        </header>
        <div className="bg-surface-alt border border-zinc-800 rounded-3xl p-8 space-y-8">
          <div>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-1">Updated Details</h3>
                <div className="text-2xl font-medium text-white">{form.title}</div>
                <div className="text-sm text-zinc-400 mt-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Date of Event: <strong className="text-zinc-200 font-medium">{formatDate(form.date)}</strong></span>
                </div>
              </div>
              {selectedCategoryData && (
                <div className={cn('px-3 py-1.5 rounded-full flex items-center gap-2 text-sm font-medium border', selectedCategoryData.color, 'bg-zinc-900/50')}>
                  {selectedCategoryData.icon} {selectedCategoryData.name}
                </div>
              )}
            </div>
            <div className="space-y-3 pt-6 border-t border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">
                Participant Split ({form.splitMethod === 'equal' ? 'Equal' : 'Custom'})
              </h3>
              {form.selectedParticipants.map((userId) => {
                const user = users.find((u) => u.id === userId);
                const shareAmount =
                  form.splitMethod === 'equal'
                    ? form.equalSplitAmount
                    : parseFloat(form.customAmounts[userId]?.replace(/,/g, '') || '0') || 0;
                return (
                  <div key={userId} className="flex justify-between items-center py-2 border-b border-zinc-800/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs text-white overflow-hidden shrink-0">
                        {user?.avatar ? (
                          <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          user?.initials || '?'
                        )}
                      </div>
                      <div className="text-white font-medium">
                        {user?.name || userId} {userId === currentUserId && '(You)'}
                      </div>
                    </div>
                    <div className="text-right text-zinc-300">RM {shareAmount.toFixed(2)}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="pt-6 border-t border-zinc-800">
            <div className="flex justify-between items-end">
              <div className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-1">Total Amount</div>
              <div className="text-4xl font-light text-white">RM {form.numAmount.toFixed(2)}</div>
            </div>
          </div>
          {saveError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {saveError}
            </div>
          )}
          <button
            disabled={saveLoading}
            onClick={handleSaveChanges}
            className="w-full py-4 bg-accent text-accent-text font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {saveLoading ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'edit') {
    return (
      <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-right-8 duration-500 pb-20">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setStep('view')} className="w-10 h-10 rounded-full border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="text-sm text-zinc-500 font-medium uppercase tracking-wider mb-1">Edit Expense</div>
              <h1 className="text-2xl font-semibold text-white tracking-tight">{form.title}</h1>
            </div>
          </div>
        </header>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => form.setTitle(e.target.value)}
                placeholder="e.g. Friday Drinks"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Category</label>
              <select
                value={form.selectedCategory}
                onChange={(e) => form.setSelectedCategory(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-zinc-600 transition-colors text-sm appearance-none"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Total Amount (RM)</label>
              <input
                type="text"
                inputMode="numeric"
                value={form.amount}
                onChange={(e) => form.handleAmountChange(e.target.value)}
                placeholder="0.00"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                Date of Event
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => form.setDate(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-zinc-600 transition-colors text-sm [color-scheme:dark] cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2 flex items-center gap-1.5">
              <FolderIcon className="w-3.5 h-3.5 text-accent" />
              Folder / Group (Optional)
            </label>
            <select
              value={selectedFolderId}
              onChange={(e) => setSelectedFolderId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-zinc-600 transition-colors text-sm appearance-none cursor-pointer"
            >
              <option value="">None (Standalone Expense)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name} ({f.category || 'General'})</option>
              ))}
            </select>
          </div>

          <ParticipantPicker
            users={users}
            selectedParticipants={form.selectedParticipants}
            onToggleParticipant={form.toggleParticipant}
            splitMethod={form.splitMethod}
            onChangeSplitMethod={form.setSplitMethod}
            customAmounts={form.customAmounts}
            onChangeCustomAmount={form.handleCustomAmountChange}
            equalSplitAmount={form.equalSplitAmount}
            numAmount={form.numAmount}
            lockedParticipantId={expense.creatorId}
          />

          <div className="flex gap-4 pt-4 border-t border-zinc-800">
            <button onClick={() => setStep('view')} className="flex-1 py-3 rounded-full border border-zinc-700 bg-surface-alt text-zinc-300 font-medium hover:bg-zinc-800 transition-colors cursor-pointer">
              Cancel
            </button>
            <button
              disabled={!form.canSubmit}
              onClick={() => setStep('confirm')}
              className="flex-1 py-3 rounded-full bg-accent text-accent-text font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Review Changes
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- View Mode ---
  const participantIds: string[] = Array.isArray(expense.participants)
    ? expense.participants.map((p: any) => (typeof p === 'string' ? p : p.userId))
    : [];
  const expenseUsers = users.filter((u) => participantIds.includes(u.id));

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <BackButton fallbackPath="/expenses" label="Expenses" onClick={onBack} />
        <div className="flex items-center gap-2">
          {isHost && (
            <button
              onClick={handleStartEdit}
              className="flex items-center gap-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-white px-3 sm:px-4 py-2 rounded-full transition-colors font-medium cursor-pointer"
            >
              <Edit2 className="w-4 h-4" /> Edit details
            </button>
          )}
          {(isAdmin || isHost) && (
            <button
              onClick={handleDeleteExpense}
              disabled={actionLoading}
              className="flex items-center gap-2 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-3 sm:px-4 py-2 rounded-full transition-colors font-medium cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
        </div>
      </div>

      <header className="mb-6 sm:mb-8 lg:mb-10">
        <div className="flex items-center gap-3 mb-1.5 flex-wrap">
          <div className="text-xs sm:text-sm text-zinc-500 font-medium uppercase tracking-wider">
            {category ? category.name : 'Shared expense'}
          </div>
          {expense.status === 'Pending' ? (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
              PENDING
            </span>
          ) : expense.status === 'Rejected' ? (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
              <X className="w-3 h-3" /> REJECTED
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <Check className="w-3 h-3" /> CONFIRMED
            </span>
          )}
          {expense.folderId && (
            <Link
              to={`/folders/${expense.folderId}`}
              className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FolderIcon className="w-3 h-3 text-accent" />
              {expense.folderName || 'Folder'}
            </Link>
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-tight">{expense.title}</h1>
        <p className="text-zinc-400 mt-2 text-sm sm:text-base flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1.5 text-zinc-300">
            <Calendar className="w-4 h-4 text-zinc-400" />
            Date of event: <strong className="text-white font-medium">{formatDate(expense.date)}</strong>
          </span>
          {expense.createdAt && (
            <>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-500 text-xs sm:text-sm">
                Recorded on {formatDate(expense.createdAt)}
              </span>
            </>
          )}
          {expense.approvedByName && (
            <>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-400">
                {expense.status === 'Rejected' ? 'Rejected' : 'Approved'} by <span className="text-zinc-200 font-medium">{expense.approvedByName}</span>
                {expense.approvedAt ? ` on ${formatDate(expense.approvedAt)}` : ''}
              </span>
            </>
          )}
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Category', value: category?.name || 'Unknown' },
          { label: 'Date of Event', value: formatDate(expense.date) },
          { label: 'Participants', value: String(participantIds.length) },
          { label: 'Total Amount', value: `RM ${Number(expense.totalAmount).toFixed(2)}` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
            <div className="mb-3 sm:mb-4">
              <span className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider">{label}</span>
            </div>
            <div className="text-lg sm:text-xl lg:text-2xl font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>

      {/* Your Share Card */}
      {(() => {
        const isParticipant = participantIds.includes(currentUserId);
        const userTotalShare = getUserShare(expense, currentUserId);
        const userPaid = getUserPaidAmount(expense, currentUserId, allExpensePayments);
        const userPending = getUserPendingAmount(expense, currentUserId, allExpensePayments);
        const userRemaining = getUserRemainingShare(expense, currentUserId, allExpensePayments);
        // Host's share is auto-waived if they participated, otherwise normal settlement
        const isSettled = (isHost && isParticipant) || (!isHost && isParticipant && userRemaining <= 0);
        const isPendingPayment = !isHost && isParticipant && !isSettled && userPending > 0;

        return (
          <div className={`border rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 ${isHost && isParticipant ? 'bg-emerald-950/20 border-emerald-800/40' : isPendingPayment ? 'bg-amber-950/20 border-amber-800/40' : 'bg-surface-alt border-zinc-700'}`}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Your Share</div>
                {isHost && isParticipant && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    PAID
                  </span>
                )}
                {!isHost && isParticipant && isSettled && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    SETTLED
                  </span>
                )}
                {isPendingPayment && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    PENDING APPROVAL
                  </span>
                )}
                {isHost && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                    HOST
                  </span>
                )}
                {!isParticipant && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-500 border border-zinc-700">
                    NON-PARTICIPANT
                  </span>
                )}
              </div>
              <div className="text-zinc-500 text-xs sm:text-sm">
                {isHost
                  ? isParticipant
                    ? 'You created and paid for this expense — your share is waived'
                    : 'You created and paid for this expense on behalf of the participants'
                  : !isParticipant
                  ? 'You are not a participant in this expense'
                  : isSettled
                  ? `You have fully paid your share (RM ${userPaid.toFixed(2)})`
                  : isPendingPayment
                  ? `Payment of RM ${userPending.toFixed(2)} is submitted and awaiting confirmation`
                  : userPaid > 0
                  ? `Total share: RM ${userTotalShare.toFixed(2)} • Paid so far: RM ${userPaid.toFixed(2)}`
                  : 'Your calculated amount for this expense'}
              </div>
            </div>
            <div className="text-right self-end sm:self-auto">
              <div className={`text-3xl sm:text-4xl font-semibold ${isHost && isParticipant ? 'text-emerald-400' : isPendingPayment ? 'text-amber-400' : 'text-white'}`}>
                RM {userTotalShare.toFixed(2)}
              </div>
              <div className={`text-[10px] sm:text-xs uppercase tracking-wider font-semibold mt-0.5 ${isHost && isParticipant ? 'text-emerald-500/70' : isPendingPayment ? 'text-amber-500/70' : 'text-zinc-500'}`}>
                {isHost
                  ? isParticipant
                    ? 'Paid by host'
                    : 'Paid for others'
                  : !isParticipant
                  ? 'No share'
                  : isSettled
                  ? 'Fully settled'
                  : isPendingPayment
                  ? 'Pending confirmation'
                  : 'Remaining to pay'}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Participants Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6">
        <div className="mb-4 sm:mb-6">
          <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-1">Participants</div>
          <h2 className="text-xl sm:text-2xl font-semibold text-white">Who participated</h2>
          <p className="text-zinc-500 text-sm mt-1">Each participant's share and payment status.</p>
        </div>
        <div className="space-y-3">
          {expenseUsers.map((u) => {
            const uTotal = getUserShare(expense, u.id);
            const uPaid = getUserPaidAmount(expense, u.id, allExpensePayments);
            const uPending = getUserPendingAmount(expense, u.id, allExpensePayments);
            const uRemaining = getUserRemainingShare(expense, u.id, allExpensePayments);
            const uIsHost = expense.creatorId === u.id;
            // Host's share is auto-waived (they paid the full bill upfront)
            const uIsSettled = uIsHost || uRemaining <= 0;
            const uIsPending = !uIsHost && !uIsSettled && uPending > 0;

            return (
              <div key={u.id} className="p-3 sm:p-4 rounded-2xl border border-zinc-800/50 bg-zinc-950/50 flex items-center justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs sm:text-sm text-white overflow-hidden">
                    {u.avatar ? <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" /> : u.initials}
                  </div>
                  <div>
                    <div className="font-medium text-white text-sm sm:text-base flex items-center gap-2">
                      {u.name} {u.id === currentUserId && '(You)'}
                      {uIsHost && (
                        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-semibold">
                          Host
                        </span>
                      )}
                      {uIsSettled && (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" /> Paid
                        </span>
                      )}
                      {uIsPending && (
                        <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> Pending
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500">
                      Total share: RM {uTotal.toFixed(2)}
                      {uPaid > 0 && !uIsHost && (
                        <span className="text-zinc-400 ml-1.5">• Paid: RM {uPaid.toFixed(2)}</span>
                      )}
                      {uPending > 0 && !uIsHost && (
                        <span className="text-amber-400/80 ml-1.5">• Pending: RM {uPending.toFixed(2)}</span>
                      )}
                      {uIsHost && (
                        <span className="text-emerald-500/70 ml-1.5">• Waived — paid by host</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-semibold text-sm sm:text-base ${uIsHost ? 'text-emerald-400' : uIsPending ? 'text-amber-400' : 'text-zinc-200'}`}>
                    RM {uIsHost ? uTotal.toFixed(2) : uRemaining.toFixed(2)}
                  </div>
                  <div className={`text-[10px] uppercase tracking-wider font-semibold ${uIsHost ? 'text-emerald-500/70' : uIsPending ? 'text-amber-500/70' : 'text-zinc-500'}`}>
                    {uIsHost ? 'Paid' : uIsSettled ? 'Settled' : uIsPending ? 'Pending' : 'Remaining'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment History Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Payments</span>
              <span className="bg-zinc-800 text-zinc-400 text-xs px-2 py-0.5 rounded-full font-medium">
                {allExpensePayments.length}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-white">Payment History</h2>
            <p className="text-zinc-500 text-sm mt-1">
              Settled RM {totalSettledAmount.toFixed(2)} of RM {Number(expense.totalAmount).toFixed(2)}
            </p>
          </div>

          {/* Quick settlement action if user owes and expense is confirmed */}
          {expense.status === 'Confirmed' && !isHost && participantIds.includes(currentUserId) && (
            <button
              onClick={() => navigate('/payments/new')}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs sm:text-sm font-medium text-white transition-colors flex items-center gap-2 self-start sm:self-auto cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-accent" />
              Make Payment
            </button>
          )}
        </div>

        {/* Filter Controls Bar */}
        <div className="p-3.5 bg-zinc-950/60 border border-zinc-800/80 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <User className="w-4 h-4 text-zinc-500 shrink-0" />
            <select
              value={payerFilter}
              onChange={(e) => setPayerFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs sm:text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-zinc-600 transition-colors w-full sm:w-auto flex-1 cursor-pointer"
            >
              <option value="all">All Payers</option>
              {expenseUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.id === currentUserId ? '(You)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 flex-1">
            <Calendar className="w-4 h-4 text-zinc-500 shrink-0" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs sm:text-sm rounded-xl px-3 py-1.5 focus:outline-none focus:border-zinc-600 transition-colors w-full sm:w-auto flex-1"
            />
          </div>

          {(payerFilter !== 'all' || dateFilter) && (
            <button
              onClick={() => {
                setPayerFilter('all');
                setDateFilter('');
              }}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors flex items-center justify-center gap-1.5 self-end sm:self-center cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          )}
        </div>

        {/* Payments Table / List */}
        {paymentsLoading ? (
          <div className="text-center py-10 text-zinc-500 text-sm">Loading payment history...</div>
        ) : filteredPayments.length === 0 ? (
          <div className="text-center py-12 border border-zinc-800/40 rounded-2xl bg-zinc-950/30 text-zinc-500 space-y-2">
            <CreditCard className="w-8 h-8 mx-auto text-zinc-600 mb-2 opacity-60" />
            <p className="text-sm font-medium text-zinc-400">No payment records found</p>
            <p className="text-xs text-zinc-500">
              {allExpensePayments.length > 0
                ? 'No payments match the selected filters.'
                : 'No payments have been applied to this expense yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredPayments.map((payment) => {
              const payer = users.find((u) => u.id === payment.payerId);
              const applied = payment.expensesApplied?.find((ea: any) => ea.expenseId === expenseId);
              const appliedAmount = applied ? Number(applied.amountApplied) : Number(payment.amount);
              const isConfirmed = payment.status === 'Confirmed';

              return (
                <div
                  key={payment.id}
                  onClick={() => navigate(`/payments/${payment.id}`)}
                  className="p-4 rounded-2xl border border-zinc-800/70 bg-zinc-950/60 hover:bg-zinc-800/40 hover:border-zinc-700 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs text-white shrink-0 overflow-hidden">
                      {payer?.avatar ? (
                        <img src={payer.avatar} alt={payer.name} className="w-full h-full object-cover" />
                      ) : (
                        payer?.initials || '?'
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm sm:text-base group-hover:text-accent transition-colors">
                          {payment.payerName || payer?.name || 'Unknown'}
                        </span>
                        {payment.payerId === currentUserId && (
                          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-medium">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-zinc-500" />
                          {formatDate(payment.date)}
                        </span>
                        <span>•</span>
                        <span>To {payment.payeeName || 'Recipient'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 ml-13 sm:ml-0">
                    <div className="text-right">
                      <div className="text-base sm:text-lg font-semibold text-white">
                        RM {appliedAmount.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-zinc-500">Applied to expense</div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-1',
                          isConfirmed
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        )}
                      >
                        {isConfirmed ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {payment.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Approval Card (only visible to Admin when still pending) */}
      {expense.status === 'Pending' && currentUser?.role === 'Admin' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <h3 className="text-white font-medium text-lg">Pending Approval</h3>
            </div>
            <p className="text-zinc-400 text-sm">This expense is pending confirmation before being finalized.</p>
          </div>
          <div className="flex w-full sm:w-auto gap-3">
            <button
              disabled={actionLoading}
              onClick={handleReject}
              className="flex-1 sm:flex-none px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 font-bold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
            >
              <X className="w-4 sm:w-5 h-4 sm:h-5" /> {actionLoading ? 'Rejecting...' : 'Reject Expense'}
            </button>
            <button
              disabled={actionLoading}
              onClick={handleApprove}
              className="flex-1 sm:flex-none px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-accent text-accent-text font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm disabled:opacity-50 shadow-lg shadow-accent/10 cursor-pointer"
            >
              <Check className="w-4 sm:w-5 h-4 sm:h-5" /> {actionLoading ? 'Approving...' : 'Approve Expense'}
            </button>
          </div>
        </div>
      )}

      {expense.status === 'Rejected' && (
        <div className="bg-red-950/30 border border-red-800/50 rounded-3xl p-5 sm:p-6 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
            <X className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-red-300 font-medium text-base">Expense Rejected</h3>
            <p className="text-zinc-400 text-sm mt-0.5">
              This expense was rejected by {expense.approvedByName ? expense.approvedByName : 'an administrator'}. It is not included in shared balances.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
