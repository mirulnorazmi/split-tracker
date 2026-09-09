import React, { useState, useEffect } from 'react';
import { useUsers } from '@/lib/hooks/useData';
import { api } from '@/lib/api';
import { Search, MoreVertical, Key, Shield, User, Check, ChevronLeft, ChevronRight } from 'lucide-react';

export default function UserManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const { users, refetch, isLoading } = useUsers();
  const [actingId, setActingId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleApprove = async (id: string) => {
    setActingId(id);
    try {
      const res = await api.approveUser(id);
      setFeedbackMessage(res.message || 'User approved.');
      refetch();
    } catch (err: any) {
      setFeedbackMessage(err?.message || 'Failed to approve user.');
    } finally {
      setActingId(null);
    }
  };

  const handleRoleChange = async (id: string, role: string) => {
    setActingId(id);
    try {
      const res = await api.updateUserRole(id, role);
      setFeedbackMessage(res.message || 'Role updated.');
      refetch();
    } catch (err: any) {
      setFeedbackMessage(err?.message || 'Failed to update role.');
    } finally {
      setActingId(null);
    }
  };

  const handleResetPassword = async (id: string) => {
    setActingId(id);
    try {
      const res = await api.resetUserPassword(id);
      setFeedbackMessage(res.message || 'Password reset requested.');
    } catch (err: any) {
      setFeedbackMessage(err?.message || 'Failed to reset password.');
    } finally {
      setActingId(null);
    }
  };


  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs sm:text-sm text-zinc-500 font-medium uppercase tracking-wider mb-1">Admin</div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-tight">User Management</h1>
          <p className="text-zinc-400 mt-2 text-sm sm:text-base">Manage user access, roles, and registrations.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-zinc-700 transition-colors"
          />
        </div>
      </header>

      {feedbackMessage && (
        <div className="p-4 bg-zinc-900 border border-zinc-700 rounded-2xl flex items-center justify-between text-sm text-zinc-300">
          <span>{feedbackMessage}</span>
          <button onClick={() => setFeedbackMessage(null)} className="text-zinc-500 hover:text-white text-xs">
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-surface-alt border border-zinc-800 rounded-3xl overflow-hidden">
        {/* Desktop table view */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">User</th>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                    No users found matching "{searchQuery}"
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-900/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-sm text-white overflow-hidden shrink-0">
                          {user.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" /> : user.initials}
                        </div>
                        <div className="font-medium text-white">{user.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-400 text-sm">{user.email || 'N/A'}</td>
                    <td className="px-6 py-4">
                      {user.status === 'Pending' ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pending
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {user.role === 'Admin' ? <Shield className="w-4 h-4 text-accent" /> : <User className="w-4 h-4 text-zinc-500" />}
                        <select
                          disabled={actingId === user.id}
                          className="bg-transparent border-none text-sm text-zinc-300 focus:ring-0 focus:outline-none cursor-pointer hover:text-white disabled:opacity-50"
                          value={user.role || 'Standard User'}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        >
                          <option value="Standard User" className="bg-zinc-900 text-white">Standard User</option>
                          <option value="Admin" className="bg-zinc-900 text-white">Admin</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {user.status === 'Pending' && (
                          <button
                            disabled={actingId === user.id}
                            onClick={() => handleApprove(user.id)}
                            title="Approve Registration"
                            className="p-2 rounded-lg bg-accent/10 text-accent hover:bg-accent hover:text-accent-text transition-colors disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          disabled={actingId === user.id}
                          onClick={() => handleResetPassword(user.id)}
                          title="Reset Password"
                          className="p-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card layout */}
        <div className="lg:hidden divide-y divide-zinc-800/50">
          {isLoading ? (
            <div className="px-4 py-12 text-center text-zinc-500">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="px-4 py-12 text-center text-zinc-500">
              No users found matching "{searchQuery}"
            </div>
          ) : (
            paginatedUsers.map((user) => (
              <div key={user.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-sm text-white overflow-hidden shrink-0">
                      {user.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" /> : user.initials}
                    </div>
                    <div>
                      <div className="font-medium text-white">{user.name}</div>
                      <div className="text-xs text-zinc-400">{user.email || 'N/A'}</div>
                    </div>
                  </div>
                  {user.status === 'Pending' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 inline-flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-amber-500" /> Pending
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 inline-flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-emerald-500" /> Active
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {user.role === 'Admin' ? <Shield className="w-4 h-4 text-accent" /> : <User className="w-4 h-4 text-zinc-500" />}
                    <select
                      disabled={actingId === user.id}
                      className="bg-transparent border-none text-sm text-zinc-300 focus:ring-0 focus:outline-none cursor-pointer hover:text-white disabled:opacity-50"
                      value={user.role || 'Standard User'}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    >
                      <option value="Standard User" className="bg-zinc-900 text-white">Standard User</option>
                      <option value="Admin" className="bg-zinc-900 text-white">Admin</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    {user.status === 'Pending' && (
                      <button
                        disabled={actingId === user.id}
                        onClick={() => handleApprove(user.id)}
                        title="Approve Registration"
                        className="p-2 rounded-lg bg-accent/10 text-accent hover:bg-accent hover:text-accent-text transition-colors disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      disabled={actingId === user.id}
                      onClick={() => handleResetPassword(user.id)}
                      title="Reset Password"
                      className="p-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Pagination Controls */}
        {!isLoading && totalPages >= 1 && (
          <div className="flex items-center justify-between p-4 border-t border-zinc-800/50">
            <div className="text-xs sm:text-sm text-zinc-500">
              Showing <span className="text-zinc-300 font-medium">{(page - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
              <span className="text-zinc-300 font-medium">{Math.min(page * ITEMS_PER_PAGE, filteredUsers.length)}</span> of{' '}
              <span className="text-zinc-300 font-medium">{filteredUsers.length}</span> results
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-sm font-medium text-zinc-300 px-4">
                Page {page} of {totalPages}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
