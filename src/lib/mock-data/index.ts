import { User, Category, Expense, Payment } from '@/types';

export const currentUser: User = {
  id: 'u1',
  name: 'burn',
  email: 'burn@example.com',
  avatar: '',
  initials: 'B',
  role: 'Admin',
  status: 'Active',
};

export const users: User[] = [
  currentUser,
  { id: 'u2', name: 'Akagami', email: 'akagami@example.com', avatar: '', initials: 'A', role: 'Standard User', status: 'Active' },
  { id: 'u3', name: 'asrap kacak', email: 'asrap@example.com', avatar: '', initials: 'A', role: 'Standard User', status: 'Active' },
  { id: 'u4', name: 'Hzymhilmn', email: 'hzym@example.com', avatar: '', initials: 'H', role: 'Standard User', status: 'Pending' },
  { id: 'u5', name: 'Moi', email: 'moi@example.com', avatar: '', initials: 'M', role: 'Standard User', status: 'Pending' },
  { id: 'u6', name: 'Shamiem', email: 'shamiem@example.com', avatar: '', initials: 'S', role: 'Standard User', status: 'Active' },
];

export const categories: Category[] = [
  { id: 'cat1', name: 'Drinks', icon: 'Beer', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  { id: 'cat2', name: 'Travel', icon: 'Plane', color: 'bg-sky-500/10 text-sky-500 border-sky-500/20' },
  { id: 'cat3', name: 'Food', icon: 'Utensils', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  { id: 'cat4', name: 'Groceries', icon: 'ShoppingCart', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  { id: 'cat5', name: 'Others', icon: 'Box', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
];

export const expenses: Expense[] = [
  {
    id: 'exp1',
    title: 'Friday Night Drinks',
    date: '30 Aug 2026',
    categoryId: 'cat1',
    totalAmount: 25.00,
    participants: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'],
    creatorId: 'u1',
    status: 'Confirmed',
  },
  {
    id: 'exp2',
    title: 'Bali Trip Flights',
    date: '15 Aug 2026',
    categoryId: 'cat2',
    totalAmount: 1200.00,
    participants: ['u1', 'u2', 'u3'],
    creatorId: 'u2',
    status: 'Confirmed',
  },
  {
    id: 'exp3',
    title: 'Weekend Groceries',
    date: '28 Aug 2026',
    categoryId: 'cat4',
    totalAmount: 85.50,
    participants: ['u1', 'u4'],
    creatorId: 'u4',
    status: 'Pending',
  },
  {
    id: 'exp4',
    title: 'BBQ Merdeka',
    date: '31 Aug 2026',
    categoryId: 'cat3',
    totalAmount: 300.00,
    participants: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'],
    creatorId: 'u1',
    status: 'Confirmed',
  },
];

export const payments: Payment[] = [
  {
    id: 'pay3',
    date: '30 Aug 2026',
    amount: 15.00,
    payerId: 'u2',
    payeeId: 'u1',
    expenseIds: ['exp1'],
    status: 'Pending',
  },
  {
    id: 'pay1',
    date: '20 Aug 2026',
    confirmedDate: '21 Aug 2026',
    amount: 400.00,
    payerId: 'u1',
    payeeId: 'u2',
    expenseIds: ['exp2'],
    status: 'Confirmed',
  },
  {
    id: 'pay2',
    date: '25 Aug 2026',
    confirmedDate: '26 Aug 2026',
    amount: 20.00,
    payerId: 'u1',
    payeeId: 'u4',
    expenseIds: ['exp3'],
    isPartial: true,
    status: 'Confirmed',
  },
];
