import { useState, useEffect, useCallback } from 'react';
import { api, Expense, Category, Payment, User } from '@/lib/api';
import { useAuth } from '@/app/AuthContext';

/**
 * Hook for fetching dashboard stats and recent activity.
 */
export function useDashboardData() {
  const { user } = useAuth();
  const [stats, setStats] = useState<{ totalOwed: number; confirmedPayments: number; pendingPayments: number; currentBalance: number } | null>(null);
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [s, r] = await Promise.all([
        api.getDashboardStats(),
        api.getDashboardRecent(),
      ]);
      setStats(s);
      setRecentExpenses(r.recentExpenses);
      setRecentPayments(r.recentPayments);
    } catch {
      // Silently fail — empty state will be shown
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { stats, recentExpenses, recentPayments, isLoading, refetch: fetchData };
}

/**
 * Hook for fetching expenses list.
 */
export function useExpenses(params?: { status?: string; creatorId?: string }) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchExpenses = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.listExpenses(params);
      setExpenses(data);
    } catch {
      setExpenses([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, params?.status, params?.creatorId]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  return { expenses, isLoading, refetch: fetchExpenses };
}

/**
 * Hook for fetching a single expense.
 */
export function useExpense(id: string | null) {
  const [expense, setExpense] = useState<Expense | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchExpense = useCallback(async () => {
    if (!id) {
      setExpense(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await api.getExpense(id);
      setExpense(data);
    } catch {
      setExpense(null);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchExpense();
  }, [fetchExpense]);

  return { expense, isLoading, setExpense, refetch: fetchExpense };
}

/**
 * Hook for fetching categories.
 */
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await api.listCategories();
      setCategories(data);
    } catch {
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return { categories, isLoading, refetch: fetchCategories };
}

/**
 * Hook for fetching payments.
 */
export function usePayments(params?: { status?: string; payerId?: string; payeeId?: string; expenseId?: string }) {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPayments = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.listPayments(params);
      setPayments(data);
    } catch {
      setPayments([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, params?.status, params?.payerId, params?.payeeId, params?.expenseId]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  return { payments, isLoading, refetch: fetchPayments };
}

/**
 * Hook for fetching users.
 */
export function useUsers(params?: { status?: string; role?: string }) {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    if (!user) { setUsers([]); setIsLoading(false); return; }
    try {
      const data = await api.listUsers(params);
      setUsers(data);
    } catch {
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, params?.status, params?.role]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return { users, isLoading, refetch: fetchUsers };
}