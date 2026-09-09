import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutGrid, FileText, CreditCard, Repeat, User, Settings, CheckSquare, Users, X, LogOut, HelpCircle, Folder } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/app/AuthContext';
import { useAdminPendingCounts } from '@/lib/hooks/useData';
import { APP_NAME } from '@/lib/constants';

type SidebarProps = {
  onClose?: () => void;
  isLocked?: boolean;
};

export default function Sidebar({ onClose, isLocked }: SidebarProps) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'Admin';

  const { pendingApprovals, pendingUsers } = useAdminPendingCounts();
  const pendingApprovalsCount = isAdmin ? pendingApprovals : 0;
  const pendingUsersCount = isAdmin ? pendingUsers : 0;

  const workspaceLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid, tourId: 'sidebar-dashboard' },
    { to: '/expenses', label: 'Expenses', icon: FileText, tourId: 'sidebar-expenses' },
    { to: '/folders', label: 'Folders', icon: Folder, tourId: 'sidebar-folders' },
    { to: '/subscriptions', label: 'Subscriptions', icon: Repeat, tourId: 'sidebar-subscriptions' },
    { to: '/payments', label: 'Payments', icon: CreditCard, tourId: 'sidebar-payments' },
  ];

  const accountLinks = [
    { to: '/profile', label: 'Profile', icon: User, tourId: 'sidebar-profile' },
    { to: '/settings', label: 'Settings', icon: Settings, tourId: 'sidebar-settings' },
  ];

  const managementLinks = [
    {
      to: '/approvals',
      label: 'Approvals',
      icon: CheckSquare,
      badgeCount: pendingApprovalsCount,
      badgeColor: 'red' as const,
      tourId: 'sidebar-approvals',
    },
    {
      to: '/users',
      label: 'User Management',
      icon: Users,
      badgeCount: pendingUsersCount,
      badgeColor: 'amber' as const,
      tourId: 'sidebar-users',
    },
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="w-64 border-r border-zinc-800 bg-zinc-900 flex flex-col h-screen overflow-y-auto select-none">
      <div className="p-6 flex items-center gap-3">
        <img
          src="/logo.webp"
          alt={APP_NAME}
          className="w-8 h-8 rounded-xl object-cover shadow-md shadow-accent/20 border border-zinc-800 shrink-0"
        />
        <span className="font-semibold text-white tracking-tight">{APP_NAME}</span>
        {onClose && !isLocked && (
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
              data-tour={link.tourId}
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
                  data-tour={link.tourId}
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
              data-tour={link.tourId}
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
          <button
            type="button"
            data-tour="sidebar-guide"
            onClick={() => {
              if (onClose) onClose();
              window.dispatchEvent(new CustomEvent('splittrack:open-onboarding'));
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/40 border border-transparent transition-colors duration-150 cursor-pointer text-left"
          >
            <HelpCircle className="w-4 h-4 text-[#C9FF55]" />
            <span>App Guide</span>
          </button>
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
