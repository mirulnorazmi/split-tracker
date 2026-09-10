import { useState, useEffect, useCallback } from 'react';
import { api, Expense, Category, Payment, User } from '@/lib/api';
import { useAuth } from '@/app/AuthContext';

// ── Fast In-Memory SWR Cache for Instant Page Transitions ─────────────────────
const memoryCache = new Map<string, any>();
let categoriesPromise: Promise<Category[]> | null = null;
let prefetchPromise: Promise<void> | null = null;

export function clearMemoryCache() {
  const cats = memoryCache.get('categories');
  memoryCache.clear();
  if (cats) memoryCache.set('categories', cats);
  prefetchPromise = null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('splittrack:data-changed', () => {
    clearMemoryCache();
  });
}

/**
 * Prefetches key data upfront from App.tsx to bypass sequential module waterfalls.
 */
export async function prefetchAppData() {
  if (prefetchPromise) return prefetchPromise;
  prefetchPromise = (async () => {
    try {
      const [stats, recent, payments, expenses, categories] = await Promise.allSettled([
        api.getDashboardStats(),
        api.getDashboardRecent(),
        api.listPayments(),
        api.listExpenses(),
        api.listCategories(),
      ]);

      if (stats.status === 'fulfilled') memoryCache.set('dashboard:stats', stats.value);
      if (recent.status === 'fulfilled') memoryCache.set('dashboard:recent', recent.value);
      if (payments.status === 'fulfilled') memoryCache.set('payments:{}', payments.value);
      if (expenses.status === 'fulfilled') memoryCache.set('expenses:{}', expenses.value);
      if (categories.status === 'fulfilled') memoryCache.set('categories', categories.value);
    } catch {
      // Silently continue
    }
  })();
  return prefetchPromise;
}

/**
 * Triggers a global data refresh across the entire application:
 * 1. Purges memory cache.
 * 2. Pre-fetches fresh core statistics, payments, expenses, and categories.
 * 3. Dispatches 'splittrack:data-changed' to trigger active hook revalidations.
 * 4. Ensures a pleasant minimum animation dwell time (600ms).
 */
export async function refreshGlobalData(): Promise<void> {
  const startTime = Date.now();
  clearMemoryCache();

  try {
    await prefetchAppData();
  } finally {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('splittrack:data-changed'));
    }
    const elapsed = Date.now() - startTime;
    if (elapsed < 600) {
      await new Promise((resolve) => setTimeout(resolve, 600 - elapsed));
    }
  }
}

/**
 * Hook for fetching dashboard stats and recent activity.
 */
export function useDashboardData() {
  const { user } = useAuth();
  const cachedStats = memoryCache.get('dashboard:stats') || null;
  const cachedRecent = memoryCache.get('dashboard:recent') || null;

  const [stats, setStats] = useState<{ totalOwed: number; confirmedPayments: number; pendingPayments: number; currentBalance: number } | null>(cachedStats);
  const [recentExpenses, setRecentExpenses] = useState<any[]>(cachedRecent?.recentExpenses || []);
  const [recentPayments, setRecentPayments] = useState<any[]>(cachedRecent?.recentPayments || []);
  const [isLoading, setIsLoading] = useState(!cachedStats);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [s, r] = await Promise.all([
        api.getDashboardStats(),
        api.getDashboardRecent(),
      ]);
      memoryCache.set('dashboard:stats', s);
      memoryCache.set('dashboard:recent', r);
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
    const handleRefresh = () => { fetchData(); };
    window.addEventListener('splittrack:data-changed', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    return () => {
      window.removeEventListener('splittrack:data-changed', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
  }, [fetchData]);

  return { stats, recentExpenses, recentPayments, isLoading, refetch: fetchData };
}

/**
 * Hook for fetching expenses list.
 */
export function useExpenses(params?: { status?: string; creatorId?: string }) {
  const { user } = useAuth();
  const cacheKey = `expenses:${JSON.stringify(params || {})}`;
  const [expenses, setExpenses] = useState<Expense[]>(() => memoryCache.get(cacheKey) || []);
  const [isLoading, setIsLoading] = useState(() => !memoryCache.has(cacheKey));

  const fetchExpenses = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.listExpenses(params);
      memoryCache.set(cacheKey, data);
      setExpenses(data);
    } catch {
      if (!memoryCache.has(cacheKey)) setExpenses([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, cacheKey]);

  useEffect(() => {
    fetchExpenses();
    const handleRefresh = () => { fetchExpenses(); };
    window.addEventListener('splittrack:data-changed', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    return () => {
      window.removeEventListener('splittrack:data-changed', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
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
 * Hook for fetching categories with automatic session caching & request deduplication.
 */
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(() => memoryCache.get('categories') || []);
  const [isLoading, setIsLoading] = useState(() => !memoryCache.has('categories'));

  const fetchCategories = useCallback(async (force = false) => {
    if (!force && memoryCache.has('categories')) {
      setCategories(memoryCache.get('categories')!);
      setIsLoading(false);
      return;
    }

    if (!categoriesPromise) {
      categoriesPromise = api.listCategories().finally(() => {
        categoriesPromise = null;
      });
    }

    try {
      const data = await categoriesPromise;
      memoryCache.set('categories', data);
      setCategories(data);
    } catch {
      if (!memoryCache.has('categories')) setCategories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return { categories, isLoading, refetch: () => fetchCategories(true) };
}

/**
 * Hook for fetching payments.
 */
export function usePayments(params?: { status?: string; payerId?: string; payeeId?: string; expenseId?: string }) {
  const { user } = useAuth();
  const cacheKey = `payments:${JSON.stringify(params || {})}`;
  const [payments, setPayments] = useState<Payment[]>(() => memoryCache.get(cacheKey) || []);
  const [isLoading, setIsLoading] = useState(() => !memoryCache.has(cacheKey));

  const fetchPayments = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.listPayments(params);
      memoryCache.set(cacheKey, data);
      setPayments(data);
    } catch {
      if (!memoryCache.has(cacheKey)) setPayments([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, cacheKey]);

  useEffect(() => {
    fetchPayments();
    const handleRefresh = () => { fetchPayments(); };
    window.addEventListener('splittrack:data-changed', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    return () => {
      window.removeEventListener('splittrack:data-changed', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
  }, [fetchPayments]);

  return { payments, isLoading, refetch: fetchPayments };
}

/**
 * Hook for fetching users.
 */
export function useUsers(params?: { status?: string; role?: string }) {
  const { user } = useAuth();
  const cacheKey = `users:${JSON.stringify(params || {})}`;
  const [users, setUsers] = useState<User[]>(() => memoryCache.get(cacheKey) || []);
  const [isLoading, setIsLoading] = useState(() => !memoryCache.has(cacheKey));

  const fetchUsers = useCallback(async () => {
    if (!user) { setUsers([]); setIsLoading(false); return; }
    try {
      const data = await api.listUsers(params);
      memoryCache.set(cacheKey, data);
      setUsers(data);
    } catch {
      if (!memoryCache.has(cacheKey)) setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, cacheKey]);

  useEffect(() => {
    fetchUsers();
    const handleRefresh = () => { fetchUsers(); };
    window.addEventListener('splittrack:data-changed', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    return () => {
      window.removeEventListener('splittrack:data-changed', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
  }, [fetchUsers]);

  return { users, isLoading, refetch: fetchUsers };
}

/**
 * Lightweight hook for fetching pending counts for badge display.
 */
export function useAdminPendingCounts() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<{ pendingApprovals: number; pendingUsers: number }>({
    pendingApprovals: 0,
    pendingUsers: 0,
  });

  const fetchCounts = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.getAdminPendingCounts();
      setCounts(data);
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchCounts();
    const interval = setInterval(fetchCounts, 15000);
    const handleRefresh = () => { fetchCounts(); };
    window.addEventListener('splittrack:data-changed', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('splittrack:data-changed', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
  }, [user, fetchCounts]);

  return { ...counts, refetch: fetchCounts };
}