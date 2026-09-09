import { Expense, Payment, User } from '@/lib/api';
import {
  getUserShare,
  getUserPaidAmount,
  getUserRemainingShare,
} from './expense';

export interface ParticipantFolderBalance {
  userId: string;
  name: string;
  avatar?: string | null;
  initials: string;
  email?: string;
  totalShare: number;
  totalPaid: number;
  remainingOwed: number;
  status: 'SETTLED' | 'PENDING';
  isHost: boolean;
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
 * Calculates complete financial aggregation and participant balance metrics for a folder.
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
  const totalExpenses = expenses.reduce(
    (sum, e) => sum + Number(e.totalAmount || 0),
    0
  );

  // 2. Collect unique participant IDs across folder expenses
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

  // 3. Per-participant balances
  const participantBalances: ParticipantFolderBalance[] = participantIds.map((userId) => {
    const userMeta = allUsers.find((u) => u.id === userId);
    let totalShare = 0;
    let totalPaid = 0;
    let remainingOwed = 0;

    expenses.forEach((e) => {
      const share = getUserShare(e, userId);
      totalShare += share;

      if (e.creatorId === userId) {
        // User is the host who paid for this expense upfront!
        // Their share was already covered out of pocket at time of purchase.
        totalPaid += share;
      } else {
        const paid = getUserPaidAmount(e, userId, allPayments);
        totalPaid += paid;
        const remaining = getUserRemainingShare(e, userId, allPayments);
        remainingOwed += remaining;
      }
    });

    const isHost = expenses.some((e) => e.creatorId === userId);
    remainingOwed = Math.max(0, Number(remainingOwed.toFixed(2)));
    const isSettled = remainingOwed <= 0.01;

    return {
      userId,
      name: userMeta?.name || 'Unknown User',
      avatar: userMeta?.avatar || null,
      initials: userMeta?.initials || (userMeta?.name ? userMeta.name.slice(0, 2).toUpperCase() : '??'),
      email: userMeta?.email,
      totalShare: Number(totalShare.toFixed(2)),
      totalPaid: Number(totalPaid.toFixed(2)),
      remainingOwed,
      status: isSettled ? 'SETTLED' : 'PENDING',
      isHost,
    };
  });

  // Sort: unsettled first, then by highest remaining balance
  participantBalances.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'PENDING' ? -1 : 1;
    return b.remainingOwed - a.remainingOwed;
  });

  // 4. Total group outstanding (true remaining debt owed by other members)
  const totalOutstanding = Math.max(
    0,
    Number(participantBalances.reduce((sum, p) => sum + p.remainingOwed, 0).toFixed(2))
  );

  // 5. Total collected / settled so far (Total Expenses - Total Outstanding)
  const totalCollected = Math.max(0, Number((totalExpenses - totalOutstanding).toFixed(2)));

  const collectionPercentage =
    totalExpenses > 0
      ? Math.min(100, Math.round((totalCollected / totalExpenses) * 100))
      : 0;

  // 5. Current user net balance
  let youAreOwed = 0;
  let youOwe = 0;

  expenses.forEach((e) => {
    if (e.creatorId === currentUserId) {
      // Current user is the host: others owe current user
      if (Array.isArray(e.participants)) {
        e.participants.forEach((p: any) => {
          const partId = typeof p === 'string' ? p : p?.userId;
          if (partId && partId !== currentUserId) {
            youAreOwed += getUserRemainingShare(e, partId, allPayments);
          }
        });
      }
    } else {
      // Someone else is the host: current user owes them
      youOwe += getUserRemainingShare(e, currentUserId, allPayments);
    }
  });

  const netBalance = Number((youAreOwed - youOwe).toFixed(2));

  return {
    totalExpenses: Number(totalExpenses.toFixed(2)),
    totalCollected: Number(totalCollected.toFixed(2)),
    totalOutstanding,
    collectionPercentage,
    youAreOwed: Number(youAreOwed.toFixed(2)),
    youOwe: Number(youOwe.toFixed(2)),
    netBalance,
    participantBalances,
  };
}
