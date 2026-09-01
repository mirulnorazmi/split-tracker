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

export type Expense = {
  id: string;
  title: string;
  date: string;
  categoryId: string;
  totalAmount: number;
  participants: string[]; // Array of User IDs
  creatorId: string;
  status: 'Pending' | 'Confirmed';
  splits?: Record<string, number>; // Maps user ID to specific split amount
};

export type Payment = {
  id: string;
  date: string;
  confirmedDate?: string;
  amount: number;
  payerId: string;
  payeeId?: string;
  expenseIds?: string[];
  isPartial?: boolean;
  status: 'Pending' | 'Confirmed';
};
