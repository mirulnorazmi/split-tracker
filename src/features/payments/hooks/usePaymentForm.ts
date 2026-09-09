import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/AuthContext';
import { useExpenses, usePayments } from '@/lib/hooks/useData';
import { getUserRemainingShare, hasUserFullyPaid, hasUserPendingOrPaid } from '@/lib/utils/expense';

/**
 * Custom hook for the NewPayment page.
 * Manages expense selection, remaining amount calculation, and partial payment detection.
 */
export function usePaymentForm() {
  const { user: currentUser } = useAuth();
  const { expenses, isLoading: expensesLoading } = useExpenses();
  const { payments, isLoading: paymentsLoading } = usePayments();
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);
  const [rawDigits, setRawDigits] = useState<string>('');

  const currentUserId = currentUser?.id || '';

  // Only include expenses where current user owes money (participant, not creator, confirmed, and NOT fully paid or pending)
  const userExpenses = expenses.filter((exp: any) => {
    if (exp.creatorId === currentUserId) return false;
    if (exp.status !== 'Confirmed') return false;
    if (!exp.participants || !Array.isArray(exp.participants)) return false;
    const isPart = exp.participants.some((p: any) =>
      typeof p === 'string' ? p === currentUserId : p.userId === currentUserId
    );
    if (!isPart) return false;

    // Check if user has already fully paid or has a pending payment covering their share
    return !hasUserPendingOrPaid(exp, currentUserId, payments);
  });

  // Calculate the remaining unpaid total for selected expenses (accounting for any pending payments)
  const calculatedTotal = userExpenses
    .filter((exp) => selectedExpenses.includes(exp.id))
    .reduce((acc, exp) => acc + getUserRemainingShare(exp, currentUserId, payments, true), 0);

  useEffect(() => {
    if (selectedExpenses.length > 0) {
      const totalStr = Math.round(calculatedTotal * 100).toString();
      setRawDigits(totalStr);
    } else {
      setRawDigits('');
    }
  }, [selectedExpenses, calculatedTotal]);

  const toggleExpense = (id: string) => {
    setSelectedExpenses((prev) =>
      prev.includes(id) ? prev.filter((eId) => eId !== id) : [...prev, id]
    );
  };

  /** Pad raw digit string into "X.XX" display format */
  const formatDisplayValue = (raw: string): string => {
    if (!raw) return '';
    const padded = raw.padStart(3, '0');
    const integerPart = padded.slice(0, -2);
    const decimalPart = padded.slice(-2);
    const formattedInt = Number(integerPart).toLocaleString('en-US');
    return `${formattedInt}.${decimalPart}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    const cleanDigits = digits.replace(/^0+/, '');
    setRawDigits(cleanDigits);
  };

  const displayAmount = formatDisplayValue(rawDigits);
  const parsedAmount = rawDigits ? parseInt(rawDigits, 10) / 100 : 0;
  const isPartial = selectedExpenses.length > 0 && parsedAmount < calculatedTotal;

  // The host is determined by the first selected expense's creator
  const selectedHostId =
    selectedExpenses.length > 0
      ? (expenses.find((e: any) => e.id === selectedExpenses[0])?.creatorId ??
         userExpenses.find((e) => e.id === selectedExpenses[0])?.creatorId ??
         null)
      : null;

  return {
    userExpenses,
    payments,
    selectedExpenses,
    toggleExpense,
    selectedHostId,
    calculatedTotal,
    displayAmount,
    parsedAmount,
    isPartial,
    handleInputChange,
    rawDigits,
    isLoading: expensesLoading || paymentsLoading,
  };
}
