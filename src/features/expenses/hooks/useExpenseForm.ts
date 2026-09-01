import { useState, useEffect } from 'react';
import { formatCurrencyInput, parseCurrencyString } from '@/lib/utils/currency';

type SplitMethod = 'equal' | 'custom';

type UseExpenseFormOptions = {
  initialTitle?: string;
  initialAmount?: string;
  initialCategoryId?: string;
  initialParticipants?: string[];
  initialSplitMethod?: SplitMethod;
  initialCustomAmounts?: Record<string, string>;
};

/**
 * Shared form state and handlers for both NewExpense and ExpenseDetails (edit mode).
 * Eliminates the duplicated form logic that existed in both page components.
 */
export function useExpenseForm({
  initialTitle = '',
  initialAmount = '',
  initialCategoryId = '',
  initialParticipants = [],
  initialSplitMethod = 'equal',
  initialCustomAmounts = {},
}: UseExpenseFormOptions = {}) {
  const [title, setTitle] = useState<string>(initialTitle);
  const [amount, setAmount] = useState<string>(initialAmount);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategoryId);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(initialParticipants);
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(initialSplitMethod);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(initialCustomAmounts);

  // Sync state when initial props update (e.g. after asynchronous fetch)
  useEffect(() => {
    if (initialTitle) setTitle(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    if (initialAmount) setAmount(initialAmount);
  }, [initialAmount]);

  useEffect(() => {
    if (initialCategoryId) setSelectedCategory(initialCategoryId);
  }, [initialCategoryId]);

  useEffect(() => {
    if (initialParticipants && initialParticipants.length > 0) {
      setSelectedParticipants(initialParticipants);
    }
  }, [JSON.stringify(initialParticipants)]);

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
    setTitle(data?.initialTitle ?? initialTitle);
    setAmount(data?.initialAmount ?? initialAmount);
    setSelectedCategory(data?.initialCategoryId ?? initialCategoryId);
    setSelectedParticipants(data?.initialParticipants ?? initialParticipants);
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
