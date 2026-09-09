import { Expense, Payment, User } from '@/lib/api';
import {
  getUserShare,
  getUserPaidAmount,
  getUserRemainingShare,
} from './expense';

export interface PairwiseDebt {
  toUserId: string;
  toUserName: string;
  amount: number;
  expenseId: string;
  expenseTitle: string;
}

export interface ParticipantFolderBalance {
  userId: string;
  name: string;
  avatar?: string | null;
  initials: string;
  email?: string;
  totalShare: number;
  totalPaid: number;
  paidUpfront: number;
  fairShare: number;
  reimbursementsSent: number;
  reimbursementsReceived: number;
  remainingOwed: number;
  remainingToCollect: number;
  netBalance: number;
  status: 'SETTLED' | 'PENDING' | 'OWED' | 'OWES';
  isHost: boolean;
  hostedExpenseCount: number;
  debtsOwedToOthers?: PairwiseDebt[];
}

export interface FolderFinancialMetrics {
  totalExpenses: number;
  totalCollected: number;
  totalOutstanding: number;
  collectionPercentage: number;
  youAreOwed: number;
  youOwe: number;
  netBalance: number;
  participantBalances: ParticipantFolderBalance[];
}

/**
 * Calculates complete enterprise-grade financial aggregation and multi-host participant balance metrics for a folder.
 */
export function calculateFolderMetrics(
  expenses: Expense[],
  allPayments: Payment[],
  currentUserId: string,
  allUsers: User[] = []
): FolderFinancialMetrics {
  if (!expenses || expenses.length === 0) {
    return {
      totalExpenses: 0,
      totalCollected: 0,
      totalOutstanding: 0,
      collectionPercentage: 0,
      youAreOwed: 0,
      youOwe: 0,
      netBalance: 0,
      participantBalances: [],
    };
  }

  // 1. Total expenses (gross sum)
  const totalExpenses = Number(
    expenses.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0).toFixed(2)
  );

  const folderExpenseIds = new Set(expenses.map((e) => e.id));

  // 2. Collect unique participant IDs across folder expenses (both hosts and participants)
  const participantIdSet = new Set<string>();
  expenses.forEach((e) => {
    if (e.creatorId) participantIdSet.add(e.creatorId);
    if (Array.isArray(e.participants)) {
      e.participants.forEach((p: any) => {
        const id = typeof p === 'string' ? p : p?.userId;
        if (id) participantIdSet.add(id);
      });
    }
  });

  const participantIds = Array.from(participantIdSet);

  const confirmedPayments = (allPayments || []).filter((p) => p.status === 'Confirmed');

  // 3. Per-participant double-entry multi-host balances
  const participantBalances: ParticipantFolderBalance[] = participantIds.map((userId) => {
    const userMeta = allUsers.find((u) => u.id === userId);
    const hostedExpenses = expenses.filter((e) => e.creatorId === userId);
    const paidUpfront = Number(
      hostedExpenses.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0).toFixed(2)
    );

    // Calculate user's fair consumption share across all folder expenses
    let fairShare = 0;
    expenses.forEach((e) => {
      fairShare += getUserShare(e, userId);
    });
    fairShare = Number(fairShare.toFixed(2));

    // Calculate payments sent and received for expenses in this folder
    let reimbursementsSent = 0;
    let reimbursementsReceived = 0;

    confirmedPayments.forEach((p) => {
      if (p.payerId === userId) {
        (p.expensesApplied || []).forEach((ea: any) => {
          if (folderExpenseIds.has(ea.expenseId)) {
            reimbursementsSent += Number(ea.amountApplied || 0);
          }
        });
      }
      if (p.payeeId === userId) {
        (p.expensesApplied || []).forEach((ea: any) => {
          if (folderExpenseIds.has(ea.expenseId)) {
            reimbursementsReceived += Number(ea.amountApplied || 0);
          }
        });
      }
    });

    reimbursementsSent = Number(reimbursementsSent.toFixed(2));
    reimbursementsReceived = Number(reimbursementsReceived.toFixed(2));

    // Double-entry net balance: Total Out of Pocket (Paid Upfront + Reimbursements Sent) - Total Consumed (Fair Share + Reimbursements Received)
    const netBalance = Number(
      ((paidUpfront + reimbursementsSent) - (fairShare + reimbursementsReceived)).toFixed(2)
    );

    // Detailed debts owed to other hosts
    const debtsOwedToOthers: PairwiseDebt[] = [];
    let remainingOwed = 0;

    expenses.forEach((e) => {
      if (e.creatorId !== userId) {
        const remaining = getUserRemainingShare(e, userId, allPayments);
        if (remaining > 0.01) {
          remainingOwed += remaining;
          const hostMeta = allUsers.find((u) => u.id === e.creatorId);
          debtsOwedToOthers.push({
            toUserId: e.creatorId,
            toUserName: hostMeta?.name || 'Host',
            amount: Number(remaining.toFixed(2)),
            expenseId: e.id,
            expenseTitle: e.title,
          });
        }
      }
    });
    remainingOwed = Number(remainingOwed.toFixed(2));

    // Debts owed by other participants to this host
    let remainingToCollect = 0;
    hostedExpenses.forEach((e) => {
      (e.participants || []).forEach((p: any) => {
        const partId = typeof p === 'string' ? p : p.userId;
        if (partId && partId !== userId) {
          remainingToCollect += getUserRemainingShare(e, partId, allPayments);
        }
      });
    });
    remainingToCollect = Number(remainingToCollect.toFixed(2));

    const isHost = hostedExpenses.length > 0;
    const isSettled = Math.abs(netBalance) <= 0.01;
    const status: 'SETTLED' | 'PENDING' | 'OWED' | 'OWES' = isSettled
      ? 'SETTLED'
      : netBalance > 0
      ? 'OWED'
      : 'OWES';

    return {
      userId,
      name: userMeta?.name || 'Unknown User',
      avatar: userMeta?.avatar || null,
      initials: userMeta?.initials || (userMeta?.name ? userMeta.name.slice(0, 2).toUpperCase() : '??'),
      email: userMeta?.email,
      totalShare: fairShare,
      totalPaid: Number((paidUpfront + reimbursementsSent).toFixed(2)),
      paidUpfront,
      fairShare,
      reimbursementsSent,
      reimbursementsReceived,
      remainingOwed,
      remainingToCollect,
      netBalance,
      status,
      isHost,
      hostedExpenseCount: hostedExpenses.length,
      debtsOwedToOthers,
    };
  });

  // Sort: Net creditors/hosts first (highest positive balance), then settled, then debtors by most owed
  participantBalances.sort((a, b) => {
    return b.netBalance - a.netBalance;
  });

  // 4. Total group outstanding (sum of all remaining unpaid shares owed to hosts)
  const totalOutstanding = Math.max(
    0,
    Number(participantBalances.reduce((sum, p) => sum + p.remainingOwed, 0).toFixed(2))
  );

  // 5. Total collected / settled so far
  const totalCollected = Math.max(0, Number((totalExpenses - totalOutstanding).toFixed(2)));

  const collectionPercentage =
    totalExpenses > 0
      ? Math.min(100, Math.round((totalCollected / totalExpenses) * 100))
      : 0;

  // 6. Current user balances
  const currentUserRecord = participantBalances.find((p) => p.userId === currentUserId);
  const youAreOwed = currentUserRecord ? currentUserRecord.remainingToCollect : 0;
  const youOwe = currentUserRecord ? currentUserRecord.remainingOwed : 0;
  const netBalance = currentUserRecord ? currentUserRecord.netBalance : 0;

  return {
    totalExpenses,
    totalCollected,
    totalOutstanding,
    collectionPercentage,
    youAreOwed,
    youOwe,
    netBalance,
    participantBalances,
  };
}
