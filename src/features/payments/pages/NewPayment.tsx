import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, UploadCloud, Eye, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useUsers } from '@/lib/hooks/useData';
import { api, RecurringExpense } from '@/lib/api';
import { getUserShare, getUserPaidAmount, getUserRemainingShare } from '@/lib/utils/expense';
import { usePaymentForm } from '@/features/payments/hooks/usePaymentForm';
import { SuccessScreen, BackButton, ReceiptLightbox } from '@/components';

type Step = 'select' | 'confirm' | 'success';

export default function NewPayment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const subscriptionId = searchParams.get('subscriptionId');
  const { user: currentUser } = useAuth();
  const { users } = useUsers();
  const [step, setStep] = useState<Step>('select');
  const [countdown, setCountdown] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Receipt attachment states
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [uploadedReceiptUrl, setUploadedReceiptUrl] = useState<string | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [receiptUploadError, setReceiptUploadError] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subscription, setSubscription] = useState<RecurringExpense | null>(null);
  const [loadingSub, setLoadingSub] = useState(false);
  const [selectedCycles, setSelectedCycles] = useState<string[]>([]);

  const [unpaidSubscriptions, setUnpaidSubscriptions] = useState<RecurringExpense[]>([]);
  const [loadingSubList, setLoadingSubList] = useState(false);

  const {
    userExpenses,
    payments,
    selectedExpenses,
    toggleExpense,
    selectedHostId,
    displayAmount,
    parsedAmount,
    isPartial,
    handleInputChange,
    isLoading,
  } = usePaymentForm();

  const currentUserId = currentUser?.id || '';
  const host = users.find((u) => u.id === (subscription ? subscription.creatorId : selectedHostId));
  const hostName = host?.name || 'Host';

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
    if (subscriptionId) {
      setLoadingSub(true);
      api.getRecurring(subscriptionId)
        .then((res) => {
          setSubscription(res);
          if (res.userSummary?.totalUnpaid && res.userSummary.totalUnpaid > 0) {
            setStep('confirm');
            const now = new Date();
            const currentPeriodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const defaultSelected = res.userSummary.unpaidCycles
              .filter((c: any) => c.periodKey <= currentPeriodKey)
              .map((c: any) => c.itemId);
            setSelectedCycles(defaultSelected.length > 0 ? defaultSelected : [res.userSummary.unpaidCycles[0].itemId]);
          }
        })
        .finally(() => setLoadingSub(false));
    } else {
      setLoadingSubList(true);
      api.listRecurring()
        .then((res) => {
          setUnpaidSubscriptions(res.filter((s) => s.creatorId !== currentUserId && Number(s.yourTotalUnpaid || 0) > 0));
        })
        .catch(console.error)
        .finally(() => setLoadingSubList(false));
    }
  }, [subscriptionId]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'success') {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            navigate('/payments');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, navigate]);

  const handleFileSelect = async (file: File) => {
    setReceiptUploadError(null);

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
    if (!validTypes.includes(file.type) && !file.type.startsWith('image/')) {
      setReceiptUploadError('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setReceiptUploadError('Receipt image must be smaller than 10MB.');
      return;
    }

    setReceiptFile(file);
    const localUrl = URL.createObjectURL(file);
    setReceiptPreviewUrl(localUrl);

    // Upload to MinIO immediately
    setIsUploadingReceipt(true);
    try {
      const res = await api.uploadPaymentReceipt(file);
      setUploadedReceiptUrl(res.receiptUrl);
    } catch (err: any) {
      console.error('Failed to upload receipt:', err);
      setReceiptUploadError(err?.message || 'Failed to upload receipt. Please try again.');
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const handleRemoveReceipt = () => {
    if (receiptPreviewUrl) {
      URL.revokeObjectURL(receiptPreviewUrl);
    }
    setReceiptFile(null);
    setReceiptPreviewUrl(null);
    setUploadedReceiptUrl(null);
    setReceiptUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmPayment = async () => {
    if (!uploadedReceiptUrl) {
      setSubmitError('Please attach a receipt screenshot before submitting.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      if (subscription) {
        if (!subscription.userSummary?.totalUnpaid) return;
        
        if (selectedCycles.length === 0) {
          setSubmitError('Please select at least one cycle to pay.');
          setIsSubmitting(false);
          return;
        }

        const recurringItemsApplied = subscription.userSummary.unpaidCycles
          .filter((c: any) => selectedCycles.includes(c.itemId))
          .map((c: any) => ({
            cycleItemId: c.itemId,
            amountApplied: c.amountDue,
          }));

        const totalAmount = recurringItemsApplied.reduce((sum: number, item: any) => sum + item.amountApplied, 0);

        await api.createPayment({
          amount: totalAmount,
          payeeId: subscription.creatorId,
          receiptUrl: uploadedReceiptUrl,
          expensesApplied: [],
          recurringItemsApplied,
        });
      } else {
        if (!selectedHostId) return;
        const expensesApplied = selectedExpenses.map((expenseId) => {
          const expense = userExpenses.find((e) => e.id === expenseId);
          const remainingShare = expense ? getUserRemainingShare(expense, currentUserId, payments) : 0;
          const amountApplied = selectedExpenses.length === 1 ? parsedAmount : remainingShare;
          return {
            expenseId,
            amountApplied,
          };
        });

        await api.createPayment({
          amount: parsedAmount,
          payeeId: selectedHostId,
          receiptUrl: uploadedReceiptUrl,
          expensesApplied,
        });
      }

      setStep('success');
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to submit payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingSub) {
    return (
      <div className="max-w-3xl mx-auto p-8 mt-20 text-center text-zinc-500 animate-pulse">
        Loading payment details...
      </div>
    );
  }

  if (step === 'success') {
    return (
      <SuccessScreen
        title="Payment Submitted"
        message="The payment record has been submitted and is pending approval."
        countdown={countdown}
      />
    );
  }

  if (step === 'confirm') {
    const selectedSessionList = userExpenses.filter((e) => selectedExpenses.includes(e.id));
    const isSub = !!subscription;
    const finalAmount = isSub 
      ? (subscription.userSummary?.unpaidCycles.filter((c: any) => selectedCycles.includes(c.itemId)).reduce((sum: number, c: any) => sum + c.amountDue, 0) || 0) 
      : parsedAmount;

    return (
      <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-right-8 duration-500 pb-20">
        <button onClick={() => {
          if (isSub) navigate(-1);
          else setStep('select');
        }} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> {isSub ? 'Back' : 'Back to Selection'}
        </button>
        <header className="mb-10">
          <h1 className="text-4xl font-light text-white tracking-tight">Confirm Payment</h1>
          <p className="text-zinc-400 mt-2">Please review your payment details before confirming.</p>
        </header>
        <div className="bg-surface-alt border border-zinc-800 rounded-3xl p-8 space-y-8">
          <div>
            <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">Payment to {hostName}</h3>
            <div className="space-y-3">
              {isSub ? (
                subscription.userSummary?.unpaidCycles.map((c: any) => {
                  const isSelected = selectedCycles.includes(c.itemId);
                  return (
                    <div 
                      key={c.itemId} 
                      className={`flex justify-between items-center py-3 px-4 border rounded-xl cursor-pointer transition-colors ${isSelected ? 'border-accent bg-accent/5' : 'border-zinc-800/50 bg-zinc-900/50 hover:border-zinc-700'}`}
                      onClick={() => {
                        setSelectedCycles(prev => prev.includes(c.itemId) ? prev.filter(id => id !== c.itemId) : [...prev, c.itemId]);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-accent border-accent text-zinc-950' : 'border-zinc-700'}`}>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <div className="text-white font-medium text-sm sm:text-base">{subscription.title}</div>
                          <div className="text-xs text-zinc-500">
                            {c.monthName} {c.year} Cycle
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-zinc-200 font-semibold text-sm sm:text-base">RM {c.amountDue.toFixed(2)}</div>
                        <div className="text-[10px] text-zinc-500">Remaining owed</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                selectedSessionList.map((expense) => {
                  const totalShare = getUserShare(expense, currentUserId);
                  const paidAmount = getUserPaidAmount(expense, currentUserId, payments);
                  const remainingShare = getUserRemainingShare(expense, currentUserId, payments);

                  return (
                    <div key={expense.id} className="flex justify-between items-center py-2 border-b border-zinc-800/50 last:border-0">
                      <div>
                        <div className="text-white font-medium">{expense.title}</div>
                        <div className="text-xs text-zinc-500">
                          {formatDate(expense.date)}
                          {paidAmount > 0 && (
                            <span className="text-zinc-400 ml-2">
                              (RM {paidAmount.toFixed(2)} paid of RM {totalShare.toFixed(2)})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-zinc-200 font-semibold">RM {remainingShare.toFixed(2)}</div>
                        <div className="text-[10px] text-zinc-500">Remaining owed</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Receipt Attachment Section (Required) */}
          <div className="pt-6 border-t border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Payment Receipt</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                  REQUIRED
                </span>
              </div>
              <span className="text-xs text-zinc-500">Attach transfer slip or QR screenshot</span>
            </div>

            {!receiptPreviewUrl ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileSelect(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragOver
                    ? 'border-accent bg-accent/5 scale-[1.01]'
                    : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 hover:bg-zinc-900/40'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                  <UploadCloud className="w-6 h-6 text-zinc-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    Click to upload receipt <span className="text-zinc-500 font-normal sm:inline hidden">or drag and drop</span>
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Supports JPG, PNG, WebP up to 10MB
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative border border-zinc-800 rounded-2xl bg-zinc-950/60 p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    onClick={() => setIsPreviewOpen(true)}
                    className="relative w-16 h-16 rounded-xl border border-zinc-700/80 bg-zinc-900 overflow-hidden shrink-0 cursor-pointer group shadow-sm"
                  >
                    <img
                      src={receiptPreviewUrl}
                      alt="Receipt preview"
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">
                        {receiptFile?.name || 'Receipt Image'}
                      </p>
                      {isUploadingReceipt ? (
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                          Uploading...
                        </span>
                      ) : uploadedReceiptUrl ? (
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                          <Check className="w-3 h-3" /> Ready
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {receiptFile ? `${(receiptFile.size / (1024 * 1024)).toFixed(2)} MB` : ''} • Click preview to inspect
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsPreviewOpen(true)}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-xl transition-colors cursor-pointer"
                    title="Preview receipt"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveReceipt}
                    className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                    title="Remove receipt"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {receiptUploadError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{receiptUploadError}</span>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-zinc-800">
            <div className="flex justify-between items-end">
              <div>
                <div className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-1">Total Payment</div>
                {!isSub && isPartial && <div className="text-amber-500 text-xs font-medium uppercase tracking-wider mt-1">Partial Payment</div>}
              </div>
              <div className="text-4xl font-light text-white">RM {finalAmount.toFixed(2)}</div>
            </div>
          </div>
          {submitError && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {submitError}
            </div>
          )}
          <button
            disabled={isSubmitting || isUploadingReceipt || !uploadedReceiptUrl}
            onClick={handleConfirmPayment}
            className="w-full py-4 bg-accent text-accent-text font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting
              ? 'Submitting...'
              : isUploadingReceipt
              ? 'Uploading Receipt...'
              : !uploadedReceiptUrl
              ? 'Attach Receipt to Continue'
              : 'Confirm & Submit'}
          </button>
        </div>

        <ReceiptLightbox
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          receiptUrl={receiptPreviewUrl || uploadedReceiptUrl}
          title="Payment Receipt Preview"
          amount={finalAmount}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-20">
      <BackButton fallbackPath="/payments" label="Back to Payments" />
      <header className="mb-6 sm:mb-8 lg:mb-10">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-tight">Record Payment</h1>
        <p className="text-zinc-400 mt-2 text-sm sm:text-base">Select the expenses you want to pay for. You can only bulk pay expenses hosted by the same person.</p>
      </header>

      <div className="space-y-3 sm:space-y-4">
        {isLoading || loadingSubList ? (
          <div className="p-8 text-center text-zinc-500">Loading expenses...</div>
        ) : (
          <>
            {unpaidSubscriptions.map((sub) => {
              const host = users.find((u) => u.id === sub.creatorId);
              return (
                <button
                  key={sub.id}
                  onClick={() => navigate(`/payments/new?subscriptionId=${sub.id}`)}
                  className="w-full text-left p-4 sm:p-5 rounded-2xl border border-zinc-800/50 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900 transition-all duration-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 cursor-pointer"
                >
                  <div className="flex items-center gap-4 sm:gap-5">
                    <div className="w-6 h-6 rounded-md border border-zinc-700 bg-zinc-800 flex items-center justify-center shrink-0">
                      <span className="text-[10px] uppercase font-bold text-zinc-400">SUB</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm sm:text-base text-white">
                          {sub.title}
                        </span>
                      </div>
                      <div className="text-xs sm:text-sm text-zinc-500">
                        Recurring Subscription &bull; Hosted by {host?.name || 'Host'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right self-end sm:self-auto">
                    <div className="text-sm font-semibold text-white">
                      RM {Number(sub.yourTotalUnpaid || 0).toFixed(2)}
                    </div>
                    <div className="text-[9px] sm:text-[10px] uppercase tracking-wider font-semibold mt-0.5 text-zinc-500">
                      {Number(sub.yourUnpaidMonthsCount || 0)} Cycles Due
                    </div>
                  </div>
                </button>
              );
            })}
            
            {userExpenses.map((expense) => {
              const host = users.find((u) => u.id === expense.creatorId);
              const totalShare = getUserShare(expense, currentUserId);
              const paidAmount = getUserPaidAmount(expense, currentUserId, payments);
              const remainingShare = getUserRemainingShare(expense, currentUserId, payments, true);
              const isSelected = selectedExpenses.includes(expense.id);
              const isDisabled = selectedHostId !== null && selectedHostId !== expense.creatorId;

              return (
                <button
                  key={expense.id}
                  onClick={() => toggleExpense(expense.id)}
                  disabled={isDisabled}
                  className={`w-full text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 group cursor-pointer ${
                    isDisabled
                      ? 'border-zinc-800/20 bg-zinc-950 opacity-50 cursor-not-allowed'
                      : isSelected
                        ? 'border-accent bg-accent/5'
                        : 'border-zinc-800/50 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-center gap-4 sm:gap-5">
                    <div
                      className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                        isDisabled
                          ? 'border-zinc-800 bg-zinc-900'
                          : isSelected
                            ? 'bg-accent border-accent text-zinc-950'
                            : 'border-zinc-700 group-hover:border-zinc-600'
                      }`}
                    >
                      {isSelected && <Check className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-medium text-sm sm:text-base ${isDisabled ? 'text-zinc-500' : 'text-white'}`}>
                          {expense.title}
                        </span>
                      </div>
                      <div className={`text-xs sm:text-sm ${isDisabled ? 'text-zinc-600' : 'text-zinc-500'}`}>
                        {formatDate(expense.date)} &bull; Hosted by {host?.name || expense.creatorName || 'Host'}
                        {paidAmount > 0 && (
                          <span className="text-zinc-400 ml-2">
                            (RM {paidAmount.toFixed(2)} paid of RM {totalShare.toFixed(2)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right self-end sm:self-auto">
                    <div className={`text-sm font-semibold ${isDisabled ? 'text-zinc-500' : 'text-white'}`}>
                      RM {remainingShare.toFixed(2)}
                    </div>
                    <div className={`text-[9px] sm:text-[10px] uppercase tracking-wider font-semibold mt-0.5 ${isDisabled ? 'text-zinc-600' : 'text-zinc-500'}`}>
                      Remaining to pay
                    </div>
                  </div>
                </button>
              );
            })}
          </>
        )}
        {!(isLoading || loadingSubList) && userExpenses.length === 0 && unpaidSubscriptions.length === 0 && (
          <div className="p-8 text-center border border-zinc-800/50 rounded-2xl bg-zinc-900/50 text-zinc-500">
            You don't have any pending expenses or subscriptions to pay. All your shares are settled!
          </div>
        )}
      </div>

      <div className="bg-surface-alt border border-zinc-700 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
        <div>
          <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-1">Total Payment</div>
          <div className="text-zinc-500 text-xs sm:text-sm">
            {selectedExpenses.length} expense(s) selected
            {isPartial && <span className="ml-2 text-amber-500 font-medium">(Partial payment)</span>}
            {selectedExpenses.length > 1 && (
              <span className="ml-2 text-zinc-500 text-xs block sm:inline mt-1 sm:mt-0">
                (Amount locked for bulk payment)
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <div className="relative flex items-center">
            <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
              <span className="text-zinc-500 font-medium text-sm">RM</span>
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={displayAmount}
              onChange={handleInputChange}
              disabled={selectedExpenses.length !== 1}
              placeholder="0.00"
              className="w-36 sm:w-48 bg-zinc-950 border border-zinc-800 rounded-xl pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 text-xl sm:text-2xl font-light text-white focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-700 disabled:opacity-50"
            />
          </div>
          <button
            disabled={selectedExpenses.length === 0 || parsedAmount <= 0 || isSubmitting}
            onClick={() => setStep('confirm')}
            className="px-5 sm:px-6 py-3 sm:py-4 bg-accent text-accent-text font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm cursor-pointer"
          >
            Submit Payment
          </button>
        </div>
      </div>
    </div>
  );
}
