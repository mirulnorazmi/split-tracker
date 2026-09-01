import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// ─── Feature Page Imports ────────────────────────────────────────────────────
import Dashboard from '@/features/dashboard/pages/Dashboard';
import Expenses from '@/features/expenses/pages/Expenses';
import ExpenseDetails from '@/features/expenses/pages/ExpenseDetails';
import NewExpense from '@/features/expenses/pages/NewExpense';
import Payments from '@/features/payments/pages/Payments';
import PaymentDetails from '@/features/payments/pages/PaymentDetails';
import NewPayment from '@/features/payments/pages/NewPayment';
import Approvals from '@/features/approvals/pages/Approvals';
import UserManagement from '@/features/users/pages/UserManagement';
import Settings from '@/features/settings/pages/Settings';
import Profile from '@/features/settings/pages/Profile';

/**
 * AppRoutes defines all URL routes in the application.
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Workspace routes */}
      <Route path="/dashboard" element={<Dashboard />} />

      <Route path="/expenses" element={<Expenses />} />
      <Route path="/expenses/new" element={<NewExpense />} />
      <Route path="/expenses/:id" element={<ExpenseDetails />} />

      <Route path="/payments" element={<Payments />} />
      <Route path="/payments/new" element={<NewPayment />} />
      <Route path="/payments/:id" element={<PaymentDetails />} />

      {/* Management routes */}
      <Route path="/approvals" element={<Approvals />} />
      <Route path="/users" element={<UserManagement />} />

      {/* Account routes */}
      <Route path="/profile" element={<Profile />} />
      <Route path="/settings" element={<Settings />} />

      {/* 404 / Catch-all fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
