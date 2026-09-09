export type User = {
  id: string;
  name: string;
  email?: string;
  avatar: string;
  initials: string;
  status?: 'Pending' | 'Active';
  role?: 'Admin' | 'Standard User';
};

export type Category = {
  id: string;
  name: string;
  icon: string;
  color: string; // e.g., 'bg-blue-500/10 text-blue-500'
};

export type Folder = {
  id: string;
  name: string;
  description?: string;
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
};

export type Expense = {
  id: string;
  title: string;
  date: string;
  categoryId: string;
  totalAmount: number;
  participants: string[]; // Array of User IDs
  creatorId: string;
  status: 'Pending' | 'Confirmed';
  folderId?: string | null;
  folderName?: string;
  folderColor?: string;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  splits?: Record<string, number>; // Maps user ID to specific split amount
};

export type Payment = {
  id: string;
  date: string;
  confirmedDate?: string;
  confirmedById?: string;
  confirmedByName?: string;
  amount: number;
  payerId: string;
  payerName?: string;
  payeeId?: string;
  payeeName?: string;
  expenseIds?: string[];
  isPartial?: boolean;
  status: 'Pending' | 'Confirmed';
  expensesApplied?: { expenseId: string; amountApplied: number }[];
  recurringItemsApplied?: { cycleItemId: string; amountApplied: number; title?: string; periodKey?: string }[];
  receiptUrl?: string;
};

