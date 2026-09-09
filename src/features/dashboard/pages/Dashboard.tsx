import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuth } from '@/app/AuthContext';
import { useDashboardData, useCategories } from '@/lib/hooks/useData';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { stats, recentExpenses, recentPayments, isLoading } = useDashboardData();
  const { categories } = useCategories();
  const [actionsExpanded, setActionsExpanded] = useState(false);

  const [expensesLimit, setExpensesLimit] = useState(3);
  const [paymentsLimit, setPaymentsLimit] = useState(3);
  const [expensesReachedEnd, setExpensesReachedEnd] = useState(false);
  const [paymentsReachedEnd, setPaymentsReachedEnd] = useState(false);

  const expensesThrottleRef = useRef(false);
  const paymentsThrottleRef = useRef(false);

  const loadMoreExpenses = () => {
    if (expensesThrottleRef.current) return;
    expensesThrottleRef.current = true;
    setTimeout(() => {
      expensesThrottleRef.current = false;
    }, 200);

    if (expensesLimit < recentExpenses.length) {
      setExpensesLimit((prev) => Math.min(prev + 3, recentExpenses.length));
    } else if (recentExpenses.length > 0) {
      setExpensesReachedEnd(true);
    }
  };

  const handleExpensesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight <= 25) {
      loadMoreExpenses();
    }
  };

  const handleExpensesWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY > 0) {
      const target = e.currentTarget;
      if (target.scrollHeight - target.scrollTop - target.clientHeight <= 25) {
        loadMoreExpenses();
      }
    }
  };

  const loadMorePayments = () => {
    if (paymentsThrottleRef.current) return;
    paymentsThrottleRef.current = true;
    setTimeout(() => {
      paymentsThrottleRef.current = false;
    }, 200);

    if (paymentsLimit < recentPayments.length) {
      setPaymentsLimit((prev) => Math.min(prev + 3, recentPayments.length));
    } else if (recentPayments.length > 0) {
      setPaymentsReachedEnd(true);
    }
  };

  const handlePaymentsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight <= 25) {
      loadMorePayments();
    }
  };

  const handlePaymentsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY > 0) {
      const target = e.currentTarget;
      if (target.scrollHeight - target.scrollTop - target.clientHeight <= 25) {
        loadMorePayments();
      }
    }
  };

  const visibleExpenses = recentExpenses.slice(0, expensesLimit);
  const visiblePayments = recentPayments.slice(0, paymentsLimit);

  const totalOwed = stats?.totalOwed ?? 0;
  const confirmedPayments = stats?.confirmedPayments ?? 0;
  const pendingPayments = stats?.pendingPayments ?? 0;
  const currentBalance = stats?.currentBalance ?? 0;

  // Unpaid balance excluding what is already pending confirmation
  const unpaidBalance = Math.max(0, currentBalance - pendingPayments);

  const chartData = [
    { name: 'Confirmed Payments', value: confirmedPayments, color: '#C9FF55' },
    { name: 'Pending Payments', value: pendingPayments, color: '#f59e0b' },
    { name: 'Current Balance Due', value: unpaidBalance, color: '#ef4444' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      <header className="mb-6 sm:mb-8 lg:mb-10">
        <div className="flex items-center gap-3 sm:gap-4 mb-2">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-lg sm:text-xl font-bold text-white overflow-hidden shrink-0">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              user?.initials || '?'
            )}
          </div>
          <div>
            <div className="text-xs sm:text-sm text-zinc-500 font-medium uppercase tracking-wider mb-1">Overview</div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-tight">Welcome back, {user?.name || 'User'}.</h1>
          </div>
        </div>
        <p className="text-zinc-400 mt-2 sm:mt-4 text-sm sm:text-base">Keep track of your shared expenses, balances, and payments across all categories.</p>
      </header>

      {/* Top Section: Analytics & Quick Actions */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Analytics Chart */}
        <div data-tour="dashboard-balance" className="w-full lg:w-3/4 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 md:p-6 flex flex-col">
          <div className="mb-4 sm:mb-6">
            <h2 className="text-base font-semibold text-white">Balance Overview</h2>
            <p className="text-sm text-zinc-400 mt-1">Track your total shared expenses and payment statuses.</p>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4 sm:gap-6 w-full">
            <div className="w-full md:w-1/2 h-[180px] sm:h-[200px] md:h-[220px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`RM ${value.toFixed(2)}`, undefined]}
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}
                    labelStyle={{ display: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Centered Total */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Total Due</span>
                <span className="text-2xl font-light text-white mt-1">RM {currentBalance.toFixed(2)}</span>
              </div>
            </div>

            {/* Legend / Metrics */}
            <div className="w-full md:w-1/2 space-y-3">
              {chartData.map((item, index) => (
                <div key={index} className="bg-zinc-950/50 border border-zinc-800/50 px-4 py-3.5 rounded-xl flex items-center justify-between group hover:border-zinc-700 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium text-zinc-300">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-white">RM {item.value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="w-full lg:w-1/4 flex flex-col gap-3">
          {/* Mobile Toggle Button */}
          <button 
            onClick={() => setActionsExpanded(!actionsExpanded)}
            className="lg:hidden w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between text-zinc-200 hover:bg-surface-alt transition-colors"
          >
            <span className="font-semibold text-sm">Quick Actions</span>
            {actionsExpanded ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
          </button>
          
          {/* Action Links */}
          <div className={`${actionsExpanded ? 'flex' : 'hidden'} lg:flex flex-col gap-3 lg:h-full`}>
            <Link to="/expenses/new" className="flex-1 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-surface-alt transition-all rounded-2xl p-4 text-left group flex flex-col justify-center">
              <div>
                <h3 className="font-medium text-zinc-200 mb-1 text-sm">Record an expense</h3>
                <p className="text-xs text-zinc-500 mb-3">Add a new shared expense.</p>
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 group-hover:text-accent transition-colors">
                Open <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
            <Link to="/payments" className="flex-1 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-surface-alt transition-all rounded-2xl p-4 text-left group flex flex-col justify-center">
              <div>
                <h3 className="font-medium text-zinc-200 mb-1 text-sm">Submit payment</h3>
                <p className="text-xs text-zinc-500 mb-3">Record a payment.</p>
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 group-hover:text-accent transition-colors">
                Open <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
            <Link to="/profile" className="flex-1 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-surface-alt transition-all rounded-2xl p-4 text-left group flex flex-col justify-center">
              <div>
                <h3 className="font-medium text-zinc-200 mb-1 text-sm">View profile</h3>
                <p className="text-xs text-zinc-500 mb-3">Manage account info.</p>
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 group-hover:text-accent transition-colors">
                Open <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Expenses */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 sm:mb-5">
              <div>
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-0.5">Activity</div>
                <h2 className="text-base font-semibold text-white">Your recent expenses</h2>
              </div>
              <Link to="/expenses" className="text-sm text-zinc-400 hover:text-accent transition-colors">View all</Link>
            </div>

            {recentExpenses.length === 0 ? (
              <div className="h-[218px] rounded-xl border border-zinc-800/50 bg-zinc-950/50 flex justify-center items-center text-sm text-zinc-500">
                No expenses yet.
              </div>
            ) : (
              <div
                onScroll={handleExpensesScroll}
                onWheel={handleExpensesWheel}
                className="space-y-2 overflow-y-auto max-h-[224px] pr-1.5 custom-scrollbar"
              >
                {visibleExpenses.map((expense: any) => {
                  const share = expense.yourShare || expense.totalAmount / (expense.participantCount || 1);
                  return (
                    <button
                      key={expense.id}
                      onClick={() => navigate(`/expenses/${expense.id}`)}
                      className="w-full text-left p-3 sm:p-3.5 rounded-xl border border-zinc-800/50 bg-zinc-950/50 flex justify-between items-center group hover:border-zinc-700 hover:bg-surface-alt transition-colors cursor-pointer"
                    >
                      <div>
                        <div className="font-medium text-zinc-200 mb-1 flex items-center gap-2 text-sm sm:text-base">{expense.title}</div>
                        <div className="text-xs text-zinc-500">Created on {new Date(expense.date).toLocaleDateString()} • {expense.participantCount || '?'} participants</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-zinc-200 mb-1 text-sm sm:text-base">RM {Number(share).toFixed(2)}</div>
                        <div className="text-xs text-zinc-500">Your share</div>
                      </div>
                    </button>
                  );
                })}

                {expensesLimit < recentExpenses.length ? (
                  <div className="py-2 text-center text-[11px] text-zinc-500 flex items-center justify-center gap-1.5 select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" />
                    <span>Scroll to load 3 more (+{recentExpenses.length - expensesLimit} remaining)</span>
                  </div>
                ) : (expensesReachedEnd || recentExpenses.length <= 3) ? (
                  <div className="py-2.5 text-center text-xs text-zinc-500 font-medium border-t border-zinc-800/40 select-none animate-in fade-in duration-200">
                    That's all, no more data of any expenses
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 sm:mb-5">
              <div>
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-0.5">Payments</div>
                <h2 className="text-base font-semibold text-white">Recent payments</h2>
              </div>
              <Link to="/payments" className="text-sm text-zinc-400 hover:text-accent transition-colors">View all</Link>
            </div>

            {recentPayments.length === 0 ? (
              <div className="h-[218px] rounded-xl border border-zinc-800/50 bg-zinc-950/50 flex justify-center items-center text-sm text-zinc-500">
                No payments submitted yet.
              </div>
            ) : (
              <div
                onScroll={handlePaymentsScroll}
                onWheel={handlePaymentsWheel}
                className="space-y-2 overflow-y-auto max-h-[224px] pr-1.5 custom-scrollbar"
              >
                {visiblePayments.map((payment: any) => (
                  <div key={payment.id} className="p-3 sm:p-3.5 rounded-xl border border-zinc-800/50 bg-zinc-950/50 flex justify-between items-center group hover:border-zinc-700 transition-colors">
                    <div>
                      <div className="font-medium text-zinc-200 mb-1 flex items-center gap-2 text-sm sm:text-base">Payment to {payment.payeeName}</div>
                      <div className="text-[11px] text-zinc-500">{new Date(payment.date).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-zinc-200 mb-1 text-sm sm:text-base">RM {Number(payment.amount).toFixed(2)}</div>
                      <div className={`text-[11px] uppercase tracking-wider font-semibold ${payment.status === 'Confirmed' ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {payment.status}
                      </div>
                    </div>
                  </div>
                ))}

                {paymentsLimit < recentPayments.length ? (
                  <div className="py-2 text-center text-[11px] text-zinc-500 flex items-center justify-center gap-1.5 select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" />
                    <span>Scroll to load 3 more (+{recentPayments.length - paymentsLimit} remaining)</span>
                  </div>
                ) : (paymentsReachedEnd || recentPayments.length <= 3) ? (
                  <div className="py-2.5 text-center text-xs text-zinc-500 font-medium border-t border-zinc-800/40 select-none animate-in fade-in duration-200">
                    That's all, no more data of any payments
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 sm:p-4 flex gap-3 sm:gap-4 items-start">
        <div className="w-8 h-8 rounded-full bg-zinc-800/80 flex items-center justify-center shrink-0">
          <Info className="w-4 h-4 text-zinc-400" />
        </div>
        <div>
          <h4 className="text-sm font-medium text-zinc-200 mb-0.5">Balance calculation</h4>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Your balance is calculated by the backend from your shared amounts owed minus confirmed payments. Pending payments do not reduce the balance until an administrator confirms them.
          </p>
        </div>
      </div>
    </div>
  );
}
