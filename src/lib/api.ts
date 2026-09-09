/**
 * SplitTrack API Client
 *
 * Thin fetch-based wrapper around the Fastify REST API.
 * Handles JWT token injection, JSON parsing, and error normalisation.
 */

const isViteDev = typeof window !== 'undefined' && window.location.port === '3000';
const API_BASE = import.meta.env.VITE_API_URL || (isViteDev ? 'http://localhost:3001' : '');

class ApiError extends Error {
  status: number;
  body: any;

  constructor(status: number, body: any) {
    super(body?.message || body?.error || `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function getToken(): string | null {
  return localStorage.getItem('splittrack_token');
}

export function setToken(token: string): void {
  localStorage.setItem('splittrack_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('splittrack_token');
}

async function request<T = any>(
  method: string,
  path: string,
  body?: any,
  options?: { isFormData?: boolean }
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  headers['Accept'] = 'application/json';

  let reqBody: BodyInit | undefined;

  if (body) {
    if (options?.isFormData) {
      reqBody = body as FormData;
    } else {
      headers['Content-Type'] = 'application/json';
      reqBody = JSON.stringify(body);
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: reqBody,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    throw new ApiError(res.status, data);
  }

  if (method !== 'GET' && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('splittrack:data-changed'));
  }

  return data as T;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  status: string;
  role: string;
  initials: string;
  avatar?: string | null;
  created_at?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  message?: string;
}

export interface RegisterResponse {
  user: User;
  token?: string;
  message?: string;
}

export interface CreateRecurringBody {
  title: string;
  totalAmount: number;
  categoryId: string;
  startDate?: string;
  billingCycle?: 'monthly' | 'yearly';
  billingDay?: number;
  splitType?: 'equal' | 'custom';
  participants: {
    userId: string;
    amount?: number;
    joinedDate?: string;
    discontinuedDate?: string | null;
    paidUntil?: string | null;
  }[];
}

export const api = {
  // Auth
  register: (data: { name: string; email: string; password: string }) =>
    request<RegisterResponse>('POST', '/auth/register', data),

  login: (data: { email: string; password: string }) =>
    request<LoginResponse>('POST', '/auth/login', data),

  logout: () =>
    request<{ message: string }>('POST', '/auth/logout').catch(() => ({ message: 'Logged out' })),

  getMe: () => request<User>('GET', '/me'),

  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    request<{ message: string }>('POST', '/auth/change-password', data),

  // Users (admin)
  listUsers: (params?: { status?: string; role?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.role) qs.set('role', params.role);
    const query = qs.toString();
    return request<User[]>('GET', `/users${query ? `?${query}` : ''}`);
  },

  approveUser: (id: string) => request<{ id: string; status: string; message: string }>('PATCH', `/users/${id}/approve`),

  updateUserRole: (id: string, role: string) =>
    request<{ id: string; role: string; message: string }>('PATCH', `/users/${id}/role`, { role }),

  resetUserPassword: (id: string) =>
    request<{ message: string }>('POST', `/users/${id}/password-reset`),

  resetPassword: (token: string, newPassword: string) =>
    request<{ message: string }>('POST', '/auth/reset-password', { token, newPassword }),

  updateProfile: (data: { name?: string; email?: string }) =>
    request<{ message: string; pendingVerification?: boolean }>('PUT', '/users/profile', data),

  verifyEmail: (token: string) =>
    request<{ message: string }>('POST', '/users/verify-email', { token }),

  request: request,

  // Categories
  listCategories: () => request<Category[]>('GET', '/categories'),

  // Expenses
  createExpense: (data: {
    title: string;
    totalAmount: number;
    categoryId: string;
    folderId?: string | null;
    date?: string;
    participants: { userId: string; amountOwed: number }[];
  }) => request<Expense>('POST', '/expenses', data),

  listExpenses: (params?: { status?: string; creatorId?: string; folderId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.creatorId) qs.set('creatorId', params.creatorId);
    if (params?.folderId) qs.set('folderId', params.folderId);
    const query = qs.toString();
    return request<Expense[]>('GET', `/expenses${query ? `?${query}` : ''}`);
  },

  getExpense: (id: string) => request<Expense>('GET', `/expenses/${id}`),

  updateExpense: (
    id: string,
    data: {
      title?: string;
      totalAmount?: number;
      categoryId?: string;
      folderId?: string | null;
      date?: string;
      participants?: { userId: string; amountOwed: number }[];
    }
  ) => request<Expense>('PUT', `/expenses/${id}`, data),

  updateExpenseStatus: (id: string, status: string) =>
    request<{ id: string; status: string; approvedById?: string; approvedByName?: string; approvedAt?: string; message: string }>('PATCH', `/expenses/${id}/status`, { status }),

  deleteExpense: (id: string) =>
    request<{ message: string; id: string; title?: string }>('DELETE', `/expenses/${id}`),

  // Folders / Groups
  listFolders: () => request<Folder[]>('GET', '/folders'),

  getFolder: (id: string) => request<FolderDetail>('GET', `/folders/${id}`),

  createFolder: (data: { name: string; description?: string; category?: string; color?: string }) =>
    request<Folder>('POST', '/folders', data),

  updateFolder: (id: string, data: Partial<{ name: string; description?: string; category?: string; color?: string }>) =>
    request<Folder>('PUT', `/folders/${id}`, data),

  deleteFolder: (id: string) =>
    request<{ message: string; id: string }>('DELETE', `/folders/${id}`),

  addExpensesToFolder: (folderId: string, expenseIds: string[]) =>
    request<{ message: string }>('POST', `/folders/${folderId}/expenses`, { expenseIds }),

  removeExpenseFromFolder: (folderId: string, expenseId: string) =>
    request<{ message: string }>('DELETE', `/folders/${folderId}/expenses/${expenseId}`),

  // Payments
  createPayment: (data: {
    amount: number;
    payeeId: string;
    receiptUrl: string;
    expensesApplied?: { expenseId: string; amountApplied: number }[];
    recurringItemsApplied?: { cycleItemId: string; amountApplied: number }[];
  }) => request<Payment>('POST', '/payments', data),

  getPayment: (id: string) => request<Payment>('GET', `/payments/${id}`),

  listPayments: (params?: { status?: string; payerId?: string; payeeId?: string; expenseId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.payerId) qs.set('payerId', params.payerId);
    if (params?.payeeId) qs.set('payeeId', params.payeeId);
    if (params?.expenseId) qs.set('expenseId', params.expenseId);
    const query = qs.toString();
    return request<Payment[]>('GET', `/payments${query ? `?${query}` : ''}`);
  },

  updatePaymentStatus: (id: string, status: string) =>
    request<{ id: string; status: string; confirmedDate: string; confirmedById?: string; confirmedByName?: string; message: string }>('PATCH', `/payments/${id}/status`, { status }),

  uploadPaymentReceipt: (file: File) => {
    const formData = new FormData();
    formData.append('receipt', file);
    return request<{ receiptUrl: string; objectName?: string; message: string }>('POST', '/payments/receipt', formData, { isFormData: true });
  },

  // Dashboard
  getDashboardStats: () =>
    request<{ totalOwed: number; confirmedPayments: number; pendingPayments: number; currentBalance: number }>('GET', '/dashboard/stats'),

  getDashboardRecent: () =>
    request<{ recentExpenses: any[]; recentPayments: any[] }>('GET', '/dashboard/recent'),

  getAdminPendingCounts: () =>
    request<{ pendingApprovals: number; pendingUsers: number }>('GET', '/admin/pending-counts'),

  // Recurring Expenses / Subscriptions
  listRecurring: () => request<RecurringExpense[]>('GET', '/recurring'),
  getRecurring: (id: string) => request<RecurringExpense>('GET', `/recurring/${id}`),
  createRecurring: (data: CreateRecurringBody) => request<RecurringExpense>('POST', '/recurring', data),
  getRecurringCycles: (id: string, year?: number) =>
    request<{ year: number; cycles: RecurringCycle[] }>('GET', `/recurring/${id}/cycles${year ? `?year=${year}` : ''}`),
  removeRecurringParticipant: (id: string, userId: string) =>
    request<{ message: string }>('DELETE', `/recurring/${id}/participants/${userId}`),
  discontinueRecurringParticipant: (id: string, userId: string, data?: { discontinuedDate?: string }) =>
    request<{ message: string }>('POST', `/recurring/${id}/participants/${userId}/discontinue`, data),
  addRecurringParticipant: (id: string, data: { userId: string; amount?: number; joinedDate?: string }) =>
    request<{ message: string }>('POST', `/recurring/${id}/participants`, data),
  updateCycleItemStatus: (itemId: string, status: 'Paid' | 'Unpaid' | 'Waived' | 'Pending') =>
    request<{ id: string; status: string; paidAt?: string; cycleStatus: string; message: string }>('PATCH', `/recurring/cycle-items/${itemId}/status`, { status }),
  updateRecurring: (id: string, data: Partial<CreateRecurringBody>) =>
    request<{ message: string }>('PUT', `/recurring/${id}`, data),

  deleteRecurring: (id: string) =>
    request<{ message: string; id: string; title?: string }>('DELETE', `/recurring/${id}`),

  // Avatar
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return request<{ avatar: string; message: string }>('POST', '/users/avatar', formData, { isFormData: true });
  },
};

export function getReceiptUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return url;
  }
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface ExpenseParticipant {
  userId: string;
  amountOwed: number;
}

export interface Expense {
  id: string;
  title: string;
  totalAmount: number;
  date: string;
  createdAt?: string;
  updatedAt?: string;
  status: string;
  categoryId: string;
  creatorId: string;
  creatorName?: string;
  folderId?: string | null;
  folderName?: string;
  folderColor?: string;
  approvedById?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  participants: ExpenseParticipant[];
}

export interface FolderParticipantSummary {
  userId: string;
  name: string;
  avatar?: string | null;
  initials: string;
  email: string;
  totalShare: number;
  totalPaid: number;
  remainingOwed: number;
  paidUpfront?: number;
  fairShare?: number;
  reimbursementsSent?: number;
  reimbursementsReceived?: number;
  remainingToCollect?: number;
  netBalance?: number;
  status: 'SETTLED' | 'PENDING' | 'OWED' | 'OWES';
  isHost: boolean;
  hostedExpenseCount?: number;
}

export interface Folder {
  id: string;
  name: string;
  description?: string | null;
  category?: string;
  color?: string;
  createdBy: string;
  creatorName?: string;
  createdAt: string;
  updatedAt: string;
  expenseCount?: number;
  totalExpenses?: number;
  totalCollected?: number;
  totalOutstanding?: number;
  participantsPreview?: { id: string; name: string; avatar?: string; initials: string }[];
}

export interface FolderDetail extends Folder {
  expenses: Expense[];
  participantSummary: FolderParticipantSummary[];
}

export interface Payment {
  id: string;
  date: string;
  confirmedDate?: string | null;
  confirmedById?: string | null;
  confirmedByName?: string | null;
  amount: number;
  payerId: string;
  payeeId: string;
  status: string;
  payerName?: string;
  payeeName?: string;
  expensesApplied: { expenseId: string; amountApplied: number }[];
}

export interface RecurringParticipant {
  id: string;
  userId: string;
  amount: number;
  joinedDate: string;
  discontinuedDate?: string | null;
  isActive: boolean;
  name: string;
  email: string;
  avatar?: string | null;
  initials: string;
  totalUnpaid?: number;
  unpaidMonthsCount?: number;
}

export interface RecurringCycleItem {
  itemId: string;
  userId: string;
  name: string;
  avatar?: string | null;
  initials: string;
  amountDue: number;
  status: 'Unpaid' | 'Pending' | 'Paid' | 'Waived';
  paidAt?: string | null;
}

export interface RecurringCycle {
  month: number;
  monthName: string;
  periodKey: string;
  isFuture: boolean;
  cycleId: string | null;
  totalDue: number;
  totalCollected: number;
  paidCount: number;
  totalCount: number;
  level: number; // 0: not generated/future, 1: unpaid, 2: partial, 3: fully paid
  status: string;
  items: RecurringCycleItem[];
}

export interface RecurringUserSummary {
  isHost: boolean;
  isParticipant: boolean;
  currentMonthlyShare: number;
  totalUnpaid: number;
  unpaidCyclesCount: number;
  unpaidCycles: {
    itemId: string;
    periodKey: string;
    month: number;
    year: number;
    monthName: string;
    amountDue: number;
    dueDate?: string;
  }[];
  totalPaid: number;
  totalUncollected?: number;
  uncollectedParticipants?: {
    userId: string;
    name: string;
    avatar?: string | null;
    initials: string;
    totalUnpaid: number;
    unpaidMonthsCount: number;
  }[];
}

export interface RecurringExpense {
  id: string;
  title: string;
  totalAmount: number;
  billingCycle: 'monthly' | 'yearly';
  billingDay: number;
  splitType: 'equal' | 'custom';
  status: 'active' | 'paused' | 'cancelled';
  startDate: string;
  createdAt: string;
  categoryId: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  creatorId: string;
  creatorName?: string;
  activeParticipantsCount?: number;
  yourShare?: number;
  yourTotalUnpaid?: number;
  yourUnpaidMonthsCount?: number;
  yourTotalPending?: number;
  yourPendingMonthsCount?: number;
  isParticipant?: boolean;
  currentEqualShare?: number;
  participants?: RecurringParticipant[];
  userSummary?: RecurringUserSummary;
}

export { ApiError };