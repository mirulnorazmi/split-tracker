import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, X, Clock, Eye, Download, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { usePayments, useExpenses, useUsers } from '@/lib/hooks/useData';
import { api, getReceiptUrl } from '@/lib/api';
import { BackButton, ReceiptLightbox } from '@/components';

type PaymentDetailsProps = {
  paymentId?: string;
  onBack?: () => void;
};

export default function PaymentDetails({ paymentId: propPaymentId, onBack }: PaymentDetailsProps) {
  const { id: paramId } = useParams<{ id: string }>();
  const paymentId = propPaymentId || paramId || '';

  const { user: currentUser } = useAuth();
  const { payments, refetch, isLoading } = usePayments();
  const { expenses } = useExpenses();
  const { users } = useUsers();
  const [actionLoading, setActionLoading] = useState(false);
  const [isReceiptLightboxOpen, setIsReceiptLightboxOpen] = useState(false);

  const payment = payments.find((p) => p.id === paymentId);

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

  const handleConfirmPayment = async () => {
    if (!payment) return;
    setActionLoading(true);
    try {
      await api.updatePaymentStatus(payment.id, 'Confirmed');
      await refetch();
    } catch (err) {
      console.error('Failed to confirm payment:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!payment) return;
    setActionLoading(true);
    try {
      await api.updatePaymentStatus(payment.id, 'Rejected');
      await refetch();
    } catch (err) {
      console.error('Failed to reject payment:', err);
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20 text-zinc-500">
        Loading payment details...
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        <BackButton fallbackPath="/payments" label="Back to Payments" onClick={onBack} />
        <div className="text-zinc-400">Payment not found.</div>
      </div>
    );
  }

  const payee = users.find((u) => u.id === payment.payeeId);
  const payeeName = payment.payeeName || payee?.name || 'Unknown';
  const payer = users.find((u) => u.id === payment.payerId);
  const payerName = payment.payerName || payer?.name || (payment.payerId === currentUser?.id ? (currentUser?.name || 'You') : 'Participant');
  const appliedExpenseIds = payment.expensesApplied
    ? payment.expensesApplied.map((ea: any) => ea.expenseId)
    : [];
  const paymentExpenses = expenses.filter((e) => appliedExpenseIds.includes(e.id));
  const isConfirmed = payment.status === 'Confirmed';
  const isRejected = payment.status === 'Rejected';

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-20">
      <BackButton fallbackPath="/payments" label="Back to Payments" onClick={onBack} />

      <header className="mb-6 sm:mb-8 lg:mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
            isConfirmed
              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
              : isRejected
              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
              : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
          }`}>
            {isConfirmed ? <Check className="w-3.5 h-3.5" /> : isRejected ? <X className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
            {payment.status}
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-tight">Payment to {payeeName}</h1>
        <div className="text-zinc-400 mt-3 text-sm flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
          <div>Submitted on <span className="text-zinc-300 font-medium">{formatDate(payment.date)}</span></div>
          {payment.confirmedDate && (
            <>
              <div className="w-1 h-1 bg-zinc-700 rounded-full hidden sm:block" />
              <div>
                Confirmed on <span className="text-zinc-300 font-medium">{formatDate(payment.confirmedDate)}</span>
                {payment.confirmedByName && (
                  <> by <span className="text-zinc-200 font-medium">{payment.confirmedByName}</span></>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      <div className="bg-surface-alt border border-zinc-800 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
        <div>
          <div className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-1">Total Amount</div>
          <div className="text-zinc-400 text-sm">Paid by <span className="text-zinc-300 font-medium">{payerName}</span></div>
        </div>
        <div className="text-4xl sm:text-5xl font-light text-white">RM {Number(payment.amount).toFixed(2)}</div>
      </div>

      {/* Payment Receipt Card */}
      <div className="bg-surface-alt border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Payment Receipt</h3>
            {payment.receiptUrl && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                VERIFIED PROOF
              </span>
            )}
          </div>
          {payment.receiptUrl && (
            <span className="text-xs text-zinc-500">Stored in MinIO object storage</span>
          )}
        </div>

        {payment.receiptUrl ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/50">
            <div className="flex items-center gap-4 min-w-0">
              <div
                onClick={() => setIsReceiptLightboxOpen(true)}
                className="relative w-20 h-20 rounded-xl border border-zinc-700/80 bg-zinc-900 overflow-hidden shrink-0 cursor-pointer group shadow-md"
              >
                <img
                  src={getReceiptUrl(payment.receiptUrl)}
                  alt="Payment receipt proof"
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Eye className="w-5 h-5 text-white" />
                </div>
              </div>

              <div className="min-w-0">
                <div className="font-medium text-white text-sm sm:text-base mb-0.5">
                  Transfer Slip / Screenshot
                </div>
                <div className="text-xs text-zinc-400 mb-2">
                  Attached during payment submission
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsReceiptLightboxOpen(true)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent/80 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" /> View Full Receipt
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={() => setIsReceiptLightboxOpen(true)}
                className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" /> Inspect
              </button>
              <a
                href={getReceiptUrl(payment.receiptUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center border border-zinc-800/60 rounded-2xl bg-zinc-950/30 text-zinc-500 text-xs sm:text-sm">
            No receipt screenshot attached for this payment.
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white mb-4">Sessions paid for</h3>
        {paymentExpenses.length === 0 && (!payment.recurringItemsApplied || payment.recurringItemsApplied.length === 0) ? (
          <div className="p-8 text-center border border-zinc-800/50 rounded-2xl bg-zinc-900/50 text-zinc-500">
            No specific sessions attached to this payment.
          </div>
        ) : (
          <>
            {paymentExpenses.map((expense) => {
              const applied = payment.expensesApplied?.find((ea: any) => ea.expenseId === expense.id);
              const appliedAmount = applied ? applied.amountApplied : expense.totalAmount;
              return (
                <div key={expense.id} className="p-4 sm:p-5 rounded-2xl border border-zinc-800/50 bg-zinc-900/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
                  <div>
                    <div className="font-medium text-zinc-200 mb-1 flex items-center gap-2 text-sm sm:text-base">
                      {expense.title}
                      {expense.categoryName && (
                        <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-zinc-500 bg-zinc-800 px-1.5 sm:px-2 py-0.5 rounded-full">
                          {expense.categoryName}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500">{formatDate(expense.date)}</div>
                  </div>
                  <div className="text-right self-end sm:self-auto">
                    <div className="font-semibold text-white text-base sm:text-lg mb-1">RM {Number(appliedAmount).toFixed(2)}</div>
                    <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Applied</div>
                  </div>
                </div>
              );
            })}
            
            {payment.recurringItemsApplied?.map((item: any) => (
              <div key={item.cycleItemId} className="p-4 sm:p-5 rounded-2xl border border-zinc-800/50 bg-zinc-900/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
                <div>
                  <div className="font-medium text-zinc-200 mb-1 flex items-center gap-2 text-sm sm:text-base">
                    {item.title}
                    <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-accent bg-accent/10 px-1.5 sm:px-2 py-0.5 rounded-full">
                      Subscription
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {item.periodKey ? `Recurring cycle for ${new Date(item.periodKey + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}` : 'Recurring cycle payment'}
                  </div>
                </div>
                <div className="text-right self-end sm:self-auto">
                  <div className="font-semibold text-white text-base sm:text-lg mb-1">RM {Number(item.amountApplied).toFixed(2)}</div>
                  <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Applied</div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {payment.status === 'Pending' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <h3 className="text-white font-medium text-lg">Pending Confirmation</h3>
            </div>
            <p className="text-zinc-400 text-sm">
              {currentUser?.id === payment.payeeId
                ? 'This payment needs your confirmation as the expense host before it is officially recorded.'
                : `Waiting for the expense host (${payeeName}) to confirm this payment.`}
            </p>
          </div>
          {currentUser?.id === payment.payeeId && (
            <div className="flex w-full sm:w-auto gap-3">
              <button
                disabled={actionLoading}
                onClick={handleRejectPayment}
                className="flex-1 sm:flex-none px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 font-bold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
              >
                <X className="w-4 sm:w-5 h-4 sm:h-5" /> {actionLoading ? 'Rejecting...' : 'Reject Payment'}
              </button>
              <button
                disabled={actionLoading}
                onClick={handleConfirmPayment}
                className="flex-1 sm:flex-none px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-accent text-accent-text font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm disabled:opacity-50 shadow-lg shadow-accent/10 cursor-pointer"
              >
                <Check className="w-4 sm:w-5 h-4 sm:h-5" /> {actionLoading ? 'Confirming...' : 'Confirm Payment'}
              </button>
            </div>
          )}
        </div>
      )}

      {payment.status === 'Rejected' && (
        <div className="bg-red-950/30 border border-red-800/50 rounded-3xl p-5 sm:p-6 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
            <X className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-red-300 font-medium text-base">Payment Rejected</h3>
            <p className="text-zinc-400 text-sm mt-0.5">
              This payment submission was rejected by the expense host{payment.confirmedByName ? ` (${payment.confirmedByName})` : ''}. The amount was not deducted from outstanding balances.
            </p>
          </div>
        </div>
      )}

      <ReceiptLightbox
        isOpen={isReceiptLightboxOpen}
        onClose={() => setIsReceiptLightboxOpen(false)}
        receiptUrl={payment.receiptUrl}
        title={`Receipt for Payment to ${payeeName}`}
        payerName={payerName}
        amount={Number(payment.amount)}
      />
    </div>
  );
}
