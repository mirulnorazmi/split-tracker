import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import {
  X,
  User,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Receipt,
  ArrowRight,
  CreditCard,
  Calendar,
} from 'lucide-react';
import { ParticipantFolderBalance } from '@/lib/utils/folderMetrics';
import { formatDate } from '@/lib/utils/formatDate';

interface ParticipantBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  participant: ParticipantFolderBalance | null;
  folderName?: string;
  currentUserId: string;
}

export function ParticipantBreakdownModal({
  isOpen,
  onClose,
  participant,
  folderName,
  currentUserId,
}: ParticipantBreakdownModalProps) {
  const navigate = useNavigate();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !participant) return null;

  const isCurrentUser = participant.userId === currentUserId;
  const isSettled = Math.abs(participant.netBalance) <= 0.01;
  const isCreditor = participant.netBalance > 0.01;
  const isDebtor = participant.netBalance < -0.01;

  const debtsOwed = participant.debtsOwedToOthers || [];
  const debtsToCollect = participant.debtsOwedByOthers || [];

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-2xl z-10 max-h-[90vh] flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white text-base font-bold shrink-0 overflow-hidden shadow-inner">
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
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white truncate">
                  {participant.name}
                </h3>
                {isCurrentUser && (
                  <span className="text-[10px] bg-accent/15 text-accent font-bold px-2 py-0.5 rounded-full border border-accent/30">
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
              <p className="text-xs text-zinc-400 truncate mt-0.5">
                {participant.email || (folderName ? `Participant in ${folderName}` : 'Participant')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800/80 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto space-y-6 py-4 pr-1">
          {/* Executive KPI Summary */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Financial Position
              </span>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  isCreditor
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : isDebtor
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/80'
                }`}
              >
                {isCreditor ? 'Gets back RM ' + participant.netBalance.toFixed(2) : isDebtor ? 'Owes RM ' + Math.abs(participant.netBalance).toFixed(2) : 'Fully Settled'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800">
                <span className="text-[11px] text-zinc-500 block">Paid Upfront</span>
                <span className="text-sm sm:text-base font-bold text-white mt-0.5 block">
                  RM {participant.paidUpfront.toFixed(2)}
                </span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">As expense host</span>
              </div>

              <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800">
                <span className="text-[11px] text-zinc-500 block">Fair Share</span>
                <span className="text-sm sm:text-base font-bold text-white mt-0.5 block">
                  RM {participant.fairShare.toFixed(2)}
                </span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Consumption split</span>
              </div>

              <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800">
                <span className="text-[11px] text-zinc-500 block">Reimbursed</span>
                <span className="text-sm sm:text-base font-bold text-zinc-300 mt-0.5 block">
                  {participant.reimbursementsSent > 0
                    ? `RM ${participant.reimbursementsSent.toFixed(2)}`
                    : participant.reimbursementsReceived > 0
                    ? `+RM ${participant.reimbursementsReceived.toFixed(2)}`
                    : 'RM 0.00'}
                </span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">
                  {participant.reimbursementsSent > 0
                    ? 'Sent to hosts'
                    : participant.reimbursementsReceived > 0
                    ? 'Collected'
                    : 'No payments'}
                </span>
              </div>

              <div
                className={`p-3 rounded-2xl border ${
                  isCreditor
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : isDebtor
                    ? 'bg-amber-500/5 border-amber-500/20'
                    : 'bg-zinc-950/60 border-zinc-800'
                }`}
              >
                <span className="text-[11px] text-zinc-500 block">Net Balance</span>
                <span
                  className={`text-sm sm:text-base font-bold mt-0.5 block ${
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
                <span className="text-[10px] text-zinc-500 block mt-0.5">
                  {isCreditor ? 'To collect' : isDebtor ? 'To settle' : 'Clear'}
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Itemized Section: Debts Owed to Hosts */}
          {debtsOwed.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Unpaid Shares Owed to Hosts ({debtsOwed.length})
                </h4>
                <span className="text-xs font-bold text-amber-400">
                  Total: RM {participant.remainingOwed.toFixed(2)}
                </span>
              </div>

              <div className="space-y-2">
                {debtsOwed.map((debt, index) => (
                  <div
                    key={`${debt.expenseId}-${index}`}
                    className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700/90 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            navigate(`/expenses/${debt.expenseId}`);
                          }}
                          className="text-xs sm:text-sm font-medium text-white hover:text-accent transition-colors truncate text-left flex items-center gap-1.5 cursor-pointer"
                        >
                          <span className="truncate">{debt.expenseTitle}</span>
                          <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-accent shrink-0" />
                        </button>
                        <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                          <span>
                            Host: <strong className="text-white font-medium">{debt.toUserName}</strong>
                          </span>
                          {debt.expenseDate && (
                            <>
                              <span>•</span>
                              <span className="text-zinc-500">{formatDate(debt.expenseDate)}</span>
                            </>
                          )}
                          {debt.categoryName && (
                            <>
                              <span>•</span>
                              <span className="text-zinc-500">{debt.categoryName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800">
                      <div className="text-left sm:text-right">
                        <span className="text-xs sm:text-sm font-bold text-amber-400 block">
                          RM {debt.amount.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-zinc-500 block">
                          {debt.shareAmount ? `Share: RM ${debt.shareAmount.toFixed(2)}` : 'Amount due'}
                        </span>
                      </div>

                      {isCurrentUser && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            navigate(
                              `/payments/new?payeeId=${debt.toUserId}&amount=${debt.amount}&expenseId=${debt.expenseId}`
                            );
                          }}
                          className="px-2.5 py-1 rounded-lg bg-accent/15 border border-accent/30 text-accent hover:bg-accent hover:text-accent-text text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <span>Settle</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Itemized Section: Debts Owed by Others to this Host */}
          {debtsToCollect.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" />
                  Pending Claims from Members ({debtsToCollect.length})
                </h4>
                <span className="text-xs font-bold text-emerald-400">
                  Total: RM {participant.remainingToCollect.toFixed(2)}
                </span>
              </div>

              <div className="space-y-2">
                {debtsToCollect.map((claim, index) => (
                  <div
                    key={`${claim.expenseId}-${index}`}
                    className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700/90 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-medium text-white flex items-center gap-1.5 truncate">
                          <span className="text-white font-medium">{claim.fromUserName}</span>
                          <span className="text-zinc-500 text-[11px]">owes for</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            navigate(`/expenses/${claim.expenseId}`);
                          }}
                          className="text-[11px] text-zinc-400 hover:text-accent transition-colors truncate text-left flex items-center gap-1 mt-0.5 cursor-pointer"
                        >
                          <span className="truncate">{claim.expenseTitle}</span>
                          <ExternalLink className="w-2.5 h-2.5 text-zinc-500 shrink-0" />
                        </button>
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800">
                      <span className="text-xs sm:text-sm font-bold text-emerald-400 block">
                        RM {claim.amount.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-zinc-500 block">To be collected</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settled Empty State */}
          {debtsOwed.length === 0 && debtsToCollect.length === 0 && (
            <div className="p-6 text-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-white">All Balances Settled</p>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                There are no active unpaid obligations or pending collections for {participant.name} in this folder.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-zinc-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Close
          </button>

          {isCurrentUser && isDebtor && (
            <Link
              to="/payments/new"
              onClick={onClose}
              className="bg-accent text-accent-text font-bold text-xs px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer shadow-lg shadow-accent/15"
            >
              <span>Settle All Debts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}

