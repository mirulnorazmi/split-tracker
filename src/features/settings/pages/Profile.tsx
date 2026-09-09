import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Upload } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { api } from '@/lib/api';

export default function Profile() {
  const { user, refreshUser, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!name || !email) return;
    setIsSaving(true);
    setUploadMsg(null);
    try {
      const res = await api.updateProfile({ name, email });
      setUploadMsg(res.message || 'Profile updated successfully.');
      if (!res.pendingVerification) {
        updateUser({ name, email });
      }
      await refreshUser();
    } catch (err: any) {
      setUploadMsg(err?.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const res = await api.uploadAvatar(file);
      if (res.avatar) {
        updateUser({ avatar: res.avatar });
      }
      await refreshUser();
      setUploadMsg('Profile picture updated successfully.');
    } catch (err: any) {
      setUploadMsg(err?.message || 'Failed to upload image.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="mb-6 sm:mb-8 lg:mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs sm:text-sm text-zinc-500 font-medium uppercase tracking-wider mb-1">Account</div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-tight">Profile</h1>
          <p className="text-zinc-400 mt-2 text-sm sm:text-base">Manage your account information and profile picture.</p>
        </div>
        <Link
          to="/settings"
          className="px-5 sm:px-6 py-2.5 sm:py-3 bg-surface-alt border border-zinc-700 text-zinc-300 rounded-full text-sm font-medium hover:bg-zinc-800 transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Settings
        </Link>
      </header>

      {uploadMsg && (
        <div className="p-4 bg-zinc-900 border border-zinc-700 rounded-2xl flex items-center justify-between text-sm text-zinc-300">
          <span>{uploadMsg}</span>
          <button onClick={() => setUploadMsg(null)} className="text-zinc-500 hover:text-white text-xs cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8 space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-2xl sm:text-3xl font-bold text-white shrink-0 overflow-hidden">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : null}
            {!user?.avatar && (user?.initials || '?')}
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Profile Picture</div>
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">{user?.name}</h3>
            <p className="text-xs sm:text-sm text-zinc-400 mb-4 max-w-sm">
              Upload an avatar image to customize your profile.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              accept="image/*"
              className="hidden"
            />
            <button
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="px-5 sm:px-6 py-2 bg-accent text-accent-text font-bold rounded-full text-sm hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Change picture'}
            </button>
          </div>
        </div>

        <div className="pt-6 sm:pt-8 border-t border-zinc-800 space-y-5 sm:space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-950/50 border border-zinc-700/50 hover:border-zinc-600 focus:border-accent focus:ring-1 focus:ring-accent rounded-xl px-4 py-3 text-white transition-colors"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Email</label>
              <input 
                type="text" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-950/50 border border-zinc-700/50 hover:border-zinc-600 focus:border-accent focus:ring-1 focus:ring-accent rounded-xl px-4 py-3 text-white transition-colors" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Role</label>
              <input type="text" defaultValue={user?.role || 'Standard User'} disabled className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-xl px-4 py-3 text-zinc-500 cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Member since</label>
              <input type="text" defaultValue={formatDate(user?.created_at)} disabled className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-xl px-4 py-3 text-zinc-500 cursor-not-allowed" />
            </div>
          </div>
          
          <div className="pt-4 flex items-center justify-end">
            <button
              onClick={handleSaveProfile}
              disabled={isSaving || (name === user?.name && email === user?.email)}
              className="px-6 py-2.5 bg-accent text-accent-text font-bold rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      <Link
        to="/settings"
        className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all rounded-2xl p-5 sm:p-6 text-left flex justify-between items-center group cursor-pointer block"
      >
        <div>
          <h3 className="font-medium text-zinc-200 mb-1">Account settings</h3>
          <p className="text-sm text-zinc-500">Change your password and manage account security.</p>
        </div>
        <div className="px-3 py-1.5 rounded-lg border border-zinc-800 text-xs font-medium text-zinc-400 flex items-center gap-2 group-hover:text-white group-hover:bg-zinc-800 transition-colors">
          Open settings <ArrowRight className="w-3 h-3" />
        </div>
      </Link>
    </div>
  );
}
