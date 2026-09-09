import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Folder as FolderIcon,
  Plus,
  Search,
  Users,
  Receipt,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Edit2,
  Trash2,
} from 'lucide-react';
import { api, Folder } from '@/lib/api';
import { useAuth } from '@/app/AuthContext';
import { FolderModal } from '../components/FolderModal';
import { formatDate } from '@/lib/utils/formatDate';

export default function Folders() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState<Folder | null>(null);
  const [activeMenuFolderId, setActiveMenuFolderId] = useState<string | null>(null);

  const fetchFolders = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.listFolders();
      setFolders(data);
    } catch (err) {
      console.error('Failed to fetch folders:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const handleDeleteFolder = async (e: React.MouseEvent, folder: Folder) => {
    e.stopPropagation();
    setActiveMenuFolderId(null);
    if (!window.confirm(`Delete folder "${folder.name}"? Expenses inside will remain safe as standalone items.`)) {
      return;
    }
    try {
      await api.deleteFolder(folder.id);
      setFolders((prev) => prev.filter((f) => f.id !== folder.id));
    } catch (err: any) {
      alert(err?.message || 'Failed to delete folder');
    }
  };

  const handleEditFolder = (e: React.MouseEvent, folder: Folder) => {
    e.stopPropagation();
    setActiveMenuFolderId(null);
    setFolderToEdit(folder);
    setIsCreateModalOpen(true);
  };

  // Metrics
  const totalIncurred = folders.reduce((sum, f) => sum + Number(f.totalExpenses || 0), 0);
  const totalCollected = folders.reduce((sum, f) => sum + Number(f.totalCollected || 0), 0);
  const totalOutstanding = folders.reduce(
    (sum, f) =>
      sum +
      Number(
        f.totalOutstanding !== undefined
          ? f.totalOutstanding
          : Math.max(0, Number(f.totalExpenses || 0) - Number(f.totalCollected || 0))
      ),
    0
  );

  const categories = Array.from(new Set(folders.map((f) => f.category || 'General')));

  const filteredFolders = folders.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      (f.description && f.description.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory =
      categoryFilter === 'all' || (f.category || 'General') === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs sm:text-sm text-zinc-500 font-medium uppercase tracking-wider mb-1">
            Workspace
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-tight">
            Expense Folders & Groups
          </h1>
          <p className="text-zinc-400 mt-2 text-sm sm:text-base">
            Organize trips, household pots, and team expenses with group-level financial analytics.
          </p>
        </div>
        <button
          onClick={() => {
            setFolderToEdit(null);
            setIsCreateModalOpen(true);
          }}
          className="bg-accent text-accent-text px-5 sm:px-6 py-2.5 sm:py-3 rounded-full font-bold text-sm flex items-center gap-2 hover:opacity-90 transition-opacity self-start sm:self-auto cursor-pointer shadow-lg shadow-accent/10"
        >
          <Plus className="w-4 h-4" />
          New Folder
        </button>
      </header>

      {/* Aggregate KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Total Incurred
            </span>
            <p className="text-2xl font-light text-white mt-1">RM {totalIncurred.toFixed(2)}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
              Total Collected
            </span>
            <p className="text-2xl font-light text-emerald-400 mt-1">RM {totalCollected.toFixed(2)}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
              Total Outstanding
            </span>
            <p className="text-2xl font-light text-amber-400 mt-1">RM {totalOutstanding.toFixed(2)}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-3 sm:p-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search folders..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors shrink-0 cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-zinc-800 border-zinc-700 text-white'
                : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors shrink-0 cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-zinc-800 border-zinc-700 text-white'
                  : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Folders Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-zinc-500 animate-pulse">Loading folders...</div>
      ) : filteredFolders.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/30">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 mx-auto mb-4">
            <FolderIcon className="w-7 h-7 text-accent" />
          </div>
          <h3 className="text-lg font-medium text-white mb-1">No expense folders found</h3>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto mb-6">
            Create a folder to group your vacation, project, or household expenses together and track group balances in real time.
          </p>
          <button
            onClick={() => {
              setFolderToEdit(null);
              setIsCreateModalOpen(true);
            }}
            className="bg-accent text-accent-text font-bold text-xs px-5 py-2.5 rounded-full inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-accent/10"
          >
            <Plus className="w-3.5 h-3.5" />
            Create your first folder
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredFolders.map((folder) => {
            const expCount = folder.expenseCount || 0;
            const expTotal = Number(folder.totalExpenses || 0);
            const collTotal = Number(folder.totalCollected || 0);
            const outTotal = Math.max(0, expTotal - collTotal);
            const pct = expTotal > 0 ? Math.min(100, Math.round((collTotal / expTotal) * 100)) : 0;
            const folderColor = folder.color || '#C9FF55';
            const isMenuOpen = activeMenuFolderId === folder.id;
            const isOwnerOrAdmin = currentUser?.role === 'Admin' || folder.createdBy === currentUser?.id;

            return (
              <div
                key={folder.id}
                onClick={() => navigate(`/folders/${folder.id}`)}
                className="group relative bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 rounded-3xl p-5 sm:p-6 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-xl flex flex-col justify-between"
              >
                {/* Top Row: Icon & Tag & Menu */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center border transition-transform group-hover:scale-105"
                      style={{
                        backgroundColor: `${folderColor}15`,
                        borderColor: `${folderColor}40`,
                        color: folderColor,
                      }}
                    >
                      <FolderIcon className="w-6 h-6" />
                    </div>

                    <div className="flex items-center gap-1.5 relative">
                      <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-zinc-800/80 text-zinc-300 border border-zinc-700/60">
                        {folder.category || 'General'}
                      </span>

                      {isOwnerOrAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuFolderId(isMenuOpen ? null : folder.id);
                          }}
                          className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      )}

                      {isOwnerOrAdmin && isMenuOpen && (
                        <div
                          className="absolute right-0 top-8 z-20 w-36 bg-zinc-950 border border-zinc-800 rounded-2xl p-1 shadow-2xl animate-in fade-in zoom-in-95 duration-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => handleEditFolder(e, folder)}
                            className="w-full px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/80 rounded-xl flex items-center gap-2 transition-colors cursor-pointer text-left"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Edit Folder
                          </button>
                          <button
                            onClick={(e) => handleDeleteFolder(e, folder)}
                            className="w-full px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-xl flex items-center gap-2 transition-colors cursor-pointer text-left"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-lg font-medium text-white group-hover:text-accent transition-colors line-clamp-1 mb-1">
                    {folder.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mb-2">
                    <span>Created by</span>
                    <span className="text-zinc-300 font-medium truncate">
                      {folder.createdBy === currentUser?.id ? 'You' : (folder.creatorName || 'Host')}
                    </span>
                  </div>
                  {folder.description && (
                    <p className="text-xs text-zinc-400 line-clamp-2 mb-3">
                      {folder.description}
                    </p>
                  )}
                </div>

                {/* Progress & Financials */}
                <div className="mt-4 pt-4 border-t border-zinc-800/70 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Total Incurred</span>
                    <span className="text-white font-semibold">RM {expTotal.toFixed(2)}</span>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-emerald-400 font-medium">{pct}% Collected</span>
                      <span className="text-zinc-500">RM {outTotal.toFixed(2)} remaining</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: folderColor,
                        }}
                      />
                    </div>
                  </div>

                  {/* Bottom Metas */}
                  <div className="flex items-center justify-between pt-1 text-[11px] text-zinc-500">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Receipt className="w-3.5 h-3.5" /> {expCount} {expCount === 1 ? 'expense' : 'expenses'}
                      </span>
                    </div>

                    <span className="text-accent group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 text-xs font-semibold">
                      View <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <FolderModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setFolderToEdit(null);
        }}
        folderToEdit={folderToEdit}
        onSuccess={() => fetchFolders()}
      />
    </div>
  );
}
