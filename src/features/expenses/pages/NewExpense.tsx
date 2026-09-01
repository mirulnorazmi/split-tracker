import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useCategories, useUsers } from '@/lib/hooks/useData';
import { api } from '@/lib/api';
import { useExpenseForm } from '@/features/expenses/hooks/useExpenseForm';
import { ParticipantPicker, SuccessScreen, BackButton } from '@/components';

type Step = 'form' | 'confirm' | 'success';

export default function NewExpense() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { categories } = useCategories();
  const { users } = useUsers();

  const [step, setStep] = useState<Step>('form');
  const [countdown, setCountdown] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useExpenseForm({
    initialCategoryId: categories[0]?.id || '',
    initialParticipants: currentUser ? [currentUser.id] : [],
  });

  // Ensure default category is selected once categories load
  useEffect(() => {
    if (!form.selectedCategory && categories.length > 0) {
      form.setSelectedCategory(categories[0].id);
    }
  }, [categories, form.selectedCategory, form]);

  // Ensure current user is in participants once loaded
  useEffect(() => {
    if (currentUser && form.selectedParticipants.length === 0) {
      form.toggleParticipant(currentUser.id);
    }
  }, [currentUser]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'success') {
      if (countdown <= 0) {
        navigate('/expenses');
      } else {
        timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
      }
    }
    return () => clearTimeout(timer);
  }, [step, countdown, navigate]);

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const participants = form.selectedParticipants.map((userId) => {
        const shareAmount =
          form.splitMethod === 'equal'
            ? form.equalSplitAmount
            : parseFloat(form.customAmounts[userId]?.replace(/,/g, '') || '0') || 0;
        return {
          userId,
          amountOwed: shareAmount,
        };
      });

      await api.createExpense({
        title: form.title,
        totalAmount: form.numAmount,
        categoryId: form.selectedCategory,
        participants,
      });

      setStep('success');
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to submit expense. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'success') {
    return (
      <SuccessScreen
        title="Request Submitted"
        message={
          <>
            Your expense request for <span className="font-semibold text-white">{form.title}</span> has been submitted and is pending admin approval.
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
        <button onClick={() => setStep('form')} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back to Editing
        </button>
        <header className="mb-10">
          <h1 className="text-4xl font-light text-white tracking-tight">Confirm Expense</h1>
          <p className="text-zinc-400 mt-2">Please review your expense details before submitting.</p>
        </header>
        <div className="bg-surface-alt border border-zinc-800 rounded-3xl p-8 space-y-8">
          <div>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-1">Expense Details</h3>
                <div className="text-2xl font-medium text-white">{form.title}</div>
                <div className="text-sm text-zinc-400 mt-1">
                  {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
              {selectedCategoryData && (
                <div className={`px-3 py-1.5 rounded-full flex items-center gap-2 text-sm font-medium border ${selectedCategoryData.color} bg-zinc-900/50`}>
                  {selectedCategoryData.icon} {selectedCategoryData.name}
                </div>
              )}
            </div>
            <div className="space-y-3 pt-6 border-t border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">
                Participant Split ({form.splitMethod === 'equal' ? 'Equal' : 'Custom'})
              </h3>
              {form.selectedParticipants.map((userId) => {
                const pUser = users.find((u) => u.id === userId);
                const shareAmount = form.splitMethod === 'equal'
                  ? form.equalSplitAmount
                  : parseFloat(form.customAmounts[userId]?.replace(/,/g, '') || '0') || 0;
                return (
                  <div key={userId} className="flex justify-between items-center py-2 border-b border-zinc-800/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs text-white overflow-hidden shrink-0">
                        {pUser?.avatar ? (
                          <img src={pUser.avatar} alt={pUser.name} className="w-full h-full object-cover" />
                        ) : (
                          pUser?.initials || '?'
                        )}
                      </div>
                      <div className="text-white font-medium">{pUser?.name || userId} {userId === currentUser?.id && '(You)'}</div>
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
          {submitError && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {submitError}
            </div>
          )}
          <button
            disabled={isSubmitting}
            onClick={handleConfirmSubmit}
            className="w-full py-4 bg-accent text-accent-text font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? 'Submitting...' : 'Confirm Request'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="mb-6 sm:mb-8 lg:mb-10 flex items-center gap-4">
        <BackButton fallbackPath="/expenses" />
        <div>
          <div className="text-xs sm:text-sm text-zinc-500 font-medium uppercase tracking-wider mb-1">Expenses</div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">Record new expense</h1>
        </div>
      </header>

      <p className="text-zinc-400 text-sm sm:text-base">
        Choose a category, enter the amount, and select who participated. An administrator will review your request.
      </p>

      <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex gap-3 sm:gap-4">
        <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h4 className="font-semibold text-indigo-200 mb-1">Admin approval required</h4>
          <p className="text-sm text-indigo-400/80">The details you submit will be reviewed by an administrator before the expense becomes active and balances are updated.</p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6 space-y-6 sm:space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-zinc-600 transition-colors text-sm appearance-none cursor-pointer"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

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
        />

        <div className="pt-6 border-t border-zinc-800">
          <div className="flex justify-between items-center mb-6">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Summary</div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Requester</span>
              <span className="text-zinc-300 font-medium">{currentUser?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Total amount</span>
              <span className="text-zinc-300 font-medium">RM {form.amount || '0.00'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Participants</span>
              <span className="text-zinc-300 font-medium">{form.selectedParticipants.length} people</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-zinc-800/50">
              <span className="text-zinc-500">Status after submission</span>
              <span className="text-[10px] uppercase font-bold tracking-wider bg-amber-500/10 text-amber-500 px-2 py-1 rounded-full">Pending approval</span>
            </div>
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button onClick={() => navigate('/expenses')} className="flex-1 py-3 rounded-full border border-zinc-700 bg-surface-alt text-zinc-300 font-medium hover:bg-zinc-800 transition-colors cursor-pointer">
            Cancel
          </button>
          <button
            disabled={!form.canSubmit}
            onClick={() => setStep('confirm')}
            className="flex-1 py-3 rounded-full bg-accent text-accent-text font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Submit request
          </button>
        </div>
      </div>
    </div>
  );
}
