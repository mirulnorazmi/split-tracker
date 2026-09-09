import { useState, useEffect } from 'react';
import { formatCurrencyInput, parseCurrencyString } from '@/lib/utils/currency';

type SplitMethod = 'equal' | 'custom';

type UseExpenseFormOptions = {
  initialTitle?: string;
  initialAmount?: string;
  initialCategoryId?: string;
  initialDate?: string;
  initialParticipants?: string[];
  initialSplitMethod?: SplitMethod;
  initialCustomAmounts?: Record<string, string>;
  lockedParticipantId?: string;
};

const getTodayDateStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Shared form state and handlers for both NewExpense and ExpenseDetails (edit mode).
 * Eliminates the duplicated form logic that existed in both page components.
 */
export function useExpenseForm({
  initialTitle = '',
  initialAmount = '',
  initialCategoryId = '',
  initialDate,
  initialParticipants = [],
  initialSplitMethod = 'equal',
  initialCustomAmounts = {},
  lockedParticipantId,
}: UseExpenseFormOptions = {}) {
  const [title, setTitle] = useState<string>(initialTitle);
  const [amount, setAmount] = useState<string>(initialAmount);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategoryId);
  const [date, setDate] = useState<string>(() => {
    if (initialDate) {
      try {
        return initialDate.split('T')[0];
      } catch {
        return getTodayDateStr();
      }
    }
    return getTodayDateStr();
  });
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(() => {
    const list = [...initialParticipants];
    if (lockedParticipantId && !list.includes(lockedParticipantId)) {
      list.push(lockedParticipantId);
    }
    return list;
  });
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(initialSplitMethod);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(initialCustomAmounts);

  // Sync state when initial props update (e.g. after asynchronous fetch)
  useEffect(() => {
    if (initialTitle) setTitle(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    if (initialDate) {
      try {
        setDate(initialDate.split('T')[0]);
      } catch {
        // Keep current date
      }
    }
  }, [initialDate]);

  useEffect(() => {
    if (initialAmount) setAmount(initialAmount);
  }, [initialAmount]);

  useEffect(() => {
    if (initialCategoryId) setSelectedCategory(initialCategoryId);
  }, [initialCategoryId]);

  useEffect(() => {
    if (initialParticipants && initialParticipants.length > 0) {
      const list = [...initialParticipants];
      if (lockedParticipantId && !list.includes(lockedParticipantId)) {
        list.push(lockedParticipantId);
      }
      setSelectedParticipants(list);
    }
  }, [JSON.stringify(initialParticipants), lockedParticipantId]);

  useEffect(() => {
    if (lockedParticipantId) {
      setSelectedParticipants((prev) => {
        if (!prev.includes(lockedParticipantId)) {
          return [lockedParticipantId, ...prev];
        }
        return prev;
      });
    }
  }, [lockedParticipantId]);

  useEffect(() => {
    if (initialCustomAmounts && Object.keys(initialCustomAmounts).length > 0) {
      setCustomAmounts(initialCustomAmounts);
    }
  }, [JSON.stringify(initialCustomAmounts)]);

  useEffect(() => {
    if (initialSplitMethod) {
      setSplitMethod(initialSplitMethod);
    }
  }, [initialSplitMethod]);

  const resetForm = (data?: UseExpenseFormOptions) => {
    const nextLocked = data?.lockedParticipantId ?? lockedParticipantId;
    let nextParticipants = data?.initialParticipants ?? initialParticipants;
    if (nextLocked && !nextParticipants.includes(nextLocked)) {
      nextParticipants = [nextLocked, ...nextParticipants];
    }
    setTitle(data?.initialTitle ?? initialTitle);
    setAmount(data?.initialAmount ?? initialAmount);
    setSelectedCategory(data?.initialCategoryId ?? initialCategoryId);
    setDate(data?.initialDate ? data.initialDate.split('T')[0] : getTodayDateStr());
    setSelectedParticipants(nextParticipants);
    setSplitMethod(data?.initialSplitMethod ?? initialSplitMethod);
    setCustomAmounts(data?.initialCustomAmounts ?? initialCustomAmounts);
  };

  const numAmount = parseCurrencyString(amount);
  const equalSplitAmount = selectedParticipants.length > 0 ? numAmount / selectedParticipants.length : 0;

  const customTotal = Object.values(customAmounts).reduce<number>(
    (sum, val) => sum + parseCurrencyString(val as string),
    0
  );
  const isCustomValid = Math.abs(customTotal - numAmount) < 0.01;
  const canSubmit =
    !!title && !!amount && selectedParticipants.length > 0 && (splitMethod === 'equal' || isCustomValid);

  const toggleParticipant = (id: string) => {
    // Creator cannot be removed from participants
    if (lockedParticipantId && id === lockedParticipantId) {
      return;
    }
    setSelectedParticipants((prev) => {
      const isSelected = prev.includes(id);
      if (isSelected) {
        setCustomAmounts((curr) => {
          const next = { ...curr };
          delete next[id];
          return next;
        });
        return prev.filter((p) => p !== id);
      }
      return [...prev, id];
    });
  };

  const handleAmountChange = (value: string) => {
    setAmount(formatCurrencyInput(value));
  };

  const handleCustomAmountChange = (userId: string, value: string) => {
    setCustomAmounts((prev) => ({ ...prev, [userId]: value }));
  };

  return {
    title,
    setTitle,
    amount,
    handleAmountChange,
    selectedCategory,
    setSelectedCategory,
    date,
    setDate,
    selectedParticipants,
    toggleParticipant,
    splitMethod,
    setSplitMethod,
    customAmounts,
    handleCustomAmountChange,
    resetForm,
    numAmount,
    equalSplitAmount,
    customTotal,
    isCustomValid,
    canSubmit,
  };
}
