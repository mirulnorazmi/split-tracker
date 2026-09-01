import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutGrid, FileText, CreditCard, User, Settings, CheckSquare, Users, X, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/app/AuthContext';
import { useExpenses, usePayments, useUsers } from '@/lib/hooks/useData';
import { APP_NAME } from '@/lib/constants';

type SidebarProps = {
  onClose?: () => void;
};

export default function Sidebar({ onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'Admin';

  const { expenses } = useExpenses(isAdmin ? { status: 'Pending' } : undefined);
  const { payments } = usePayments(isAdmin ? { status: 'Pending' } : undefined);
  const { users } = useUsers(isAdmin ? { status: 'Pending' } : undefined);

  const pendingApprovalsCount = isAdmin
    ? (expenses?.filter((e) => e.status === 'Pending').length || 0) +
      (payments?.filter((p) => p.status === 'Pending').length || 0)
    : 0;

  const pendingUsersCount = isAdmin
    ? users?.filter((u) => u.status === 'Pending').length || 0
    : 0;

  const workspaceLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
    { to: '/expenses', label: 'Expenses', icon: FileText },
    { to: '/payments', label: 'Payments', icon: CreditCard },
  ];

  const accountLinks = [
    { to: '/profile', label: 'Profile', icon: User },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const managementLinks = [
    {
      to: '/approvals',
      label: 'Approvals',
      icon: CheckSquare,
      badgeCount: pendingApprovalsCount,
      badgeColor: 'red' as const,
    },
    {
      to: '/users',
      label: 'User Management',
      icon: Users,
      badgeCount: pendingUsersCount,
      badgeColor: 'amber' as const,
    },
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="w-64 border-r border-zinc-800 bg-zinc-900 flex flex-col h-screen overflow-y-auto select-none">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-accent rounded-xl flex items-center justify-center font-bold text-accent-text text-sm shadow-md shadow-accent/20">
          $
        </div>
        <span className="font-semibold text-white tracking-tight">{APP_NAME}</span>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors lg:hidden"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="px-4 py-2">
        <div className="text-[10px] font-bold text-zinc-500 tracking-wider mb-2 px-3 uppercase">Workspace</div>
        <nav className="space-y-1">
          {workspaceLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors duration-150 border',
                  isActive
                    ? 'bg-zinc-800/90 text-white shadow-sm border-zinc-700/50'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40 border-transparent'
                )
              }
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {isAdmin && (
        <div className="px-4 py-4">
          <div className="text-[10px] font-bold text-zinc-500 tracking-wider mb-2 px-3 uppercase">Management</div>
          <nav className="space-y-1">
            {managementLinks.map((link) => {
              const hasBadge = Boolean(link.badgeCount && link.badgeCount > 0);

              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors duration-150 group border',
                      isActive
                        ? 'bg-zinc-800/90 text-white shadow-sm border-zinc-700/50'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40 border-transparent'
                    )
                  }
                >
                  <link.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{link.label}</span>

                  {hasBadge ? (
                    <span className="ml-auto flex items-center gap-1.5 shrink-0">
                      {link.badgeColor === 'red' ? (
                        <>
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                          </span>
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30 rounded-full min-w-[18px] text-center leading-none">
                            {link.badgeCount}
                          </span>
                        </>
                      ) : (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full min-w-[18px] text-center leading-none">
                          {link.badgeCount}
                        </span>
                      )}
                    </span>
                  ) : null}
                </NavLink>
              );
            })}
          </nav>
        </div>
      )}

      <div className="px-4 py-2">
        <div className="text-[10px] font-bold text-zinc-500 tracking-wider mb-2 px-3 uppercase">Account</div>
        <nav className="space-y-1">
          {accountLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors duration-150 border',
                  isActive
                    ? 'bg-zinc-800/90 text-white shadow-sm border-zinc-700/50'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40 border-transparent'
                )
              }
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-4 space-y-2">
        {/* User Card */}
        <div className="flex items-center gap-3 p-3 rounded-2xl border border-zinc-800 bg-zinc-950/60">
          <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-semibold text-white overflow-hidden shrink-0">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              user?.initials || '?'
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium text-white truncate leading-tight">{user?.name || 'User'}</span>
            <span className="text-[11px] text-zinc-400 truncate mt-0.5">{user?.role || 'Standard User'}</span>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800/80 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
