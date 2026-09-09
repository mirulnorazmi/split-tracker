import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// ─── Feature Page Imports (Code-Split / Lazy Loaded) ──────────────────────────
const Dashboard = React.lazy(() => import('@/features/dashboard/pages/Dashboard'));
const Expenses = React.lazy(() => import('@/features/expenses/pages/Expenses'));
const ExpenseDetails = React.lazy(() => import('@/features/expenses/pages/ExpenseDetails'));
const NewExpense = React.lazy(() => import('@/features/expenses/pages/NewExpense'));
const Payments = React.lazy(() => import('@/features/payments/pages/Payments'));
const PaymentDetails = React.lazy(() => import('@/features/payments/pages/PaymentDetails'));
const NewPayment = React.lazy(() => import('@/features/payments/pages/NewPayment'));
const Approvals = React.lazy(() => import('@/features/approvals/pages/Approvals'));
const UserManagement = React.lazy(() => import('@/features/users/pages/UserManagement'));
const Settings = React.lazy(() => import('@/features/settings/pages/Settings'));
const Profile = React.lazy(() => import('@/features/settings/pages/Profile'));
const VerifyEmail = React.lazy(() => import('@/features/settings/pages/VerifyEmail'));
const ResetPassword = React.lazy(() => import('@/features/auth/pages/ResetPassword'));

const Subscriptions = React.lazy(() => import('@/features/recurring/pages/Subscriptions'));
const NewSubscription = React.lazy(() => import('@/features/recurring/pages/NewSubscription'));
const SubscriptionDetails = React.lazy(() => import('@/features/recurring/pages/SubscriptionDetails'));

/**
 * AppRoutes defines all URL routes in the application.
 */
export function AppRoutes() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 min-h-[60vh] flex items-center justify-center w-full">
          <svg
            className="w-6 h-6 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            role="status"
            aria-label="Loading view"
          >
            <circle
              cx="12"
              cy="12"
              r="9.5"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="2.5"
            />
            <circle
              cx="12"
              cy="12"
              r="9.5"
              stroke="#C9FF55"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="16 44"
            />
          </svg>
        </div>
      }
    >
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Workspace routes */}
      <Route path="/dashboard" element={<Dashboard />} />

      <Route path="/expenses" element={<Expenses />} />
      <Route path="/expenses/new" element={<NewExpense />} />
      <Route path="/expenses/:id" element={<ExpenseDetails />} />

      <Route path="/subscriptions" element={<Subscriptions />} />
      <Route path="/subscriptions/new" element={<NewSubscription />} />
      <Route path="/subscriptions/:id" element={<SubscriptionDetails />} />

      <Route path="/payments" element={<Payments />} />
      <Route path="/payments/new" element={<NewPayment />} />
      <Route path="/payments/:id" element={<PaymentDetails />} />

      {/* Management routes */}
      <Route path="/approvals" element={<Approvals />} />
      <Route path="/users" element={<UserManagement />} />

      {/* Account routes */}
      <Route path="/profile" element={<Profile />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/settings" element={<Settings />} />

      {/* 404 / Catch-all fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </Suspense>
  );
}
