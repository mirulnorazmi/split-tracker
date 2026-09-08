import { Expense, Payment } from '@/lib/api';

/**
 * Calculates a user's original assigned total share of an expense.
 * Uses a custom split / amountOwed if defined, otherwise divides equally.
 */
export function getUserShare(expense: any, userId: string): number {
  if (!expense) return 0;
  if (expense.splits && expense.splits[userId] !== undefined) {
    return Number(expense.splits[userId]);
  }
  if (Array.isArray(expense.participants)) {
    const found = expense.participants.find(
      (p: any) => (typeof p === 'object' ? p?.userId === userId : p === userId)
    );
    if (found) {
      if (typeof found === 'object' && typeof found.amountOwed === 'number') {
        return Number(found.amountOwed);
      }
      return expense.participants.length > 0
        ? Number(expense.totalAmount) / expense.participants.length
        : 0;
    }
    // User is not a participant in this expense
    return 0;
  }
  return 0;
}

/**
 * Calculates the total amount paid by a user for a specific expense.
 * Sums all Confirmed (and Pending) payments made by this user applied to this expense.
 */
export function getUserPaidAmount(expense: any, userId: string, allPayments: any[]): number {
  if (!expense || !userId || !allPayments || !Array.isArray(allPayments)) return 0;
  return allPayments
    .filter((p) => p.payerId === userId && (p.status === 'Confirmed' || p.status === 'Pending'))
    .reduce((sum, p) => {
      if (p.expensesApplied && Array.isArray(p.expensesApplied)) {
        const match = p.expensesApplied.find((ea: any) => ea.expenseId === expense.id);
        return sum + (match ? Number(match.amountApplied || 0) : 0);
      }
      if (p.expenseIds && Array.isArray(p.expenseIds) && p.expenseIds.includes(expense.id)) {
        return sum + Number(p.amount || 0);
      }
      return sum;
    }, 0);
}

/**
 * Calculates the remaining unpaid balance that a user owes for an expense.
 * If the user is the expense creator, remaining is 0.
 */
export function getUserRemainingShare(expense: any, userId: string, allPayments: any[]): number {
  if (!expense || !userId) return 0;
  if (expense.creatorId === userId) return 0;
  const totalShare = getUserShare(expense, userId);
  const paid = getUserPaidAmount(expense, userId, allPayments);
  const remaining = totalShare - paid;
  return remaining > 0.009 ? remaining : 0;
}

/**
 * Determines whether a given user has fully paid their share of an expense.
 * The creator of the expense is considered to have already paid.
 */
export function hasUserFullyPaid(
  expense: any,
  userId: string,
  allPayments: any[]
): boolean {
  if (!expense || !userId) return true;
  if (expense.creatorId === userId) return true;
  return getUserRemainingShare(expense, userId, allPayments) <= 0.009;
}

/**
 * Determines whether all participants of an expense have fully paid.
 */
export function isExpenseClosed(expense: any, allPayments: any[]): boolean {
  if (!expense) return true;
  const pIds: string[] = (expense.participants || []).map((p: any) =>
    typeof p === 'string' ? p : p.userId
  );
  return pIds.every((pId) => hasUserFullyPaid(expense, pId, allPayments));
}
