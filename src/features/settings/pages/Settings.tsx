import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldCheck, AlertCircle, CheckCircle2, Loader2, LogOut, Smartphone } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/AuthContext';
import { triggerPWAInstall } from '@/components/ui/PWAInstallPrompt';

export default function Settings() {
  const { logout } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standaloneMode);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirmation do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await api.changePassword({ oldPassword, newPassword });
      setSuccessMsg(res.message || 'Password updated successfully');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update password. Please verify your current password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="mb-6 sm:mb-8 lg:mb-10 flex items-center justify-between">
        <div>
          <div className="text-xs sm:text-sm text-zinc-500 font-medium uppercase tracking-wider mb-1">Account</div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-tight">Settings</h1>
          <p className="text-zinc-400 mt-2 text-sm sm:text-base">Manage your account security and preferences.</p>
        </div>
      </header>

      {errorMsg && (
        <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-2xl flex items-center gap-3 text-sm text-red-300">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl flex items-center gap-3 text-sm text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl shadow-black/30">
        <div className="p-5 sm:p-8 border-b border-zinc-800 flex items-center gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 shrink-0">
            <KeyRound className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-white">Change Password</h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">Ensure your account is using a long, secure password.</p>
          </div>
        </div>

        <form onSubmit={handleResetPassword} className="p-5 sm:p-8 space-y-5 sm:space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Current Password</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                  required
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-500">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Password must be at least 8 characters.
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 sm:px-8 py-3 bg-accent text-accent-text font-bold rounded-full hover:opacity-90 active:scale-[0.99] transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{loading ? 'Updating...' : 'Update password'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* PWA / App Installation Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl shadow-black/30">
        <div className="p-5 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[#C9FF55] shrink-0">
              <Smartphone className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-white">App Installation</h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                {isStandalone
                  ? 'SplitTrack is running in standalone app mode on this device.'
                  : 'Install SplitTrack on your home screen for quick offline access and full-screen experience.'}
              </p>
            </div>
          </div>
          {isStandalone ? (
            <div className="px-4 py-2 bg-emerald-950/40 border border-emerald-800/60 text-emerald-400 font-medium rounded-full text-xs sm:text-sm shrink-0 flex items-center gap-1.5 self-start sm:self-auto">
              <CheckCircle2 className="w-4 h-4" />
              <span>Installed</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={triggerPWAInstall}
              className="px-5 py-2.5 bg-[#C9FF55] hover:bg-[#b8f043] active:scale-[0.98] text-black font-semibold rounded-full transition-all text-xs sm:text-sm shrink-0 cursor-pointer self-start sm:self-auto flex items-center gap-2"
            >
              <Smartphone className="w-4 h-4" />
              <span>Install App</span>
            </button>
          )}
        </div>
      </div>

      {/* Logout Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl shadow-black/30">
        <div className="p-5 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-red-950/40 border border-red-800/60 flex items-center justify-center text-red-400 shrink-0">
              <LogOut className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-white">Log Out</h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Sign out of your account on this device.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 active:scale-[0.98] text-red-400 border border-red-500/30 hover:border-red-500/50 font-medium rounded-full transition-all text-xs sm:text-sm shrink-0 cursor-pointer self-start sm:self-auto flex items-center gap-2 disabled:opacity-50"
          >
            {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            <span>{loggingOut ? 'Logging out...' : 'Log out'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
