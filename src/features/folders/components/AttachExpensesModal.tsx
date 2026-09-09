import React, { useState, useEffect } from 'react';
import { X, Plus, Check, Search, Receipt } from 'lucide-react';
import { api, Expense } from '@/lib/api';
import { useAuth } from '@/app/AuthContext';
import { formatDate } from '@/lib/utils/formatDate';

interface AttachExpensesModalProps {
  isOpen: boolean;
  folderId: string;
  folderName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AttachExpensesModal({
  isOpen,
  folderId,
  folderName,
  onClose,
  onSuccess,
}: AttachExpensesModalProps) {
  const { user: currentUser } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setError(null);
      setSelectedIds([]);
      setSearch('');

      api.listExpenses()
        .then((all) => {
          // Rule: Folder owner can only attach their own expenses
          const available = all.filter(
            (e) =>
              e.folderId !== folderId &&
              (currentUser?.role === 'Admin' || e.creatorId === currentUser?.id)
          );
          setExpenses(available);
        })
        .catch((err) => {
          setError(err?.message || 'Failed to load expenses');
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, folderId, currentUser]);

  if (!isOpen) return null;

  const filtered = expenses.filter((e) =>
    e.title.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAttach = async () => {
    if (selectedIds.length === 0) return;
    setIsSubmitting(true);
    setError(null);

    try {
      await api.addExpensesToFolder(folderId, selectedIds);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to attach expenses.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-xl font-light text-white tracking-tight">
              Attach Expenses to Folder
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Select standalone expenses to bundle into <span className="text-white font-medium">{folderName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs shrink-0">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="relative shrink-0">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expenses by title..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-accent"
          />
        </div>

        {/* Expense List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
          {isLoading ? (
            <div className="py-12 text-center text-zinc-500 text-xs animate-pulse">
              Loading available expenses...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-2xl p-6">
              <Receipt className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
              <p className="text-sm text-zinc-400 font-medium">No available expenses found</p>
              <p className="text-xs text-zinc-500 mt-1">All your existing expenses may already be assigned to this folder.</p>
            </div>
          ) : (
            filtered.map((expense) => {
              const isSelected = selectedIds.includes(expense.id);
              return (
                <div
                  key={expense.id}
                  onClick={() => toggleSelect(expense.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                    isSelected
                      ? 'bg-accent/10 border-accent/40 shadow-sm'
                      : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-950'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                        isSelected
                          ? 'bg-accent border-accent text-accent-text'
                          : 'border-zinc-700 bg-zinc-900 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{expense.title}</p>
                      <p className="text-[11px] text-zinc-500">
                        {formatDate(expense.date)} • {expense.categoryName || 'General'}
                        {expense.folderName && (
                          <span className="ml-1 text-zinc-400"> (currently in {expense.folderName})</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-white">
                      RM {Number(expense.totalAmount).toFixed(2)}
                    </p>
                    <span className="text-[10px] text-zinc-500 font-medium">
                      {(expense.participants || []).length} participants
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-800 shrink-0">
          <span className="text-xs text-zinc-400 font-medium">
            {selectedIds.length} expense(s) selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAttach}
              disabled={isSubmitting || selectedIds.length === 0}
              className="bg-accent text-accent-text font-bold text-xs px-5 py-2.5 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2 cursor-pointer shadow-lg shadow-accent/10"
            >
              <Plus className="w-3.5 h-3.5" />
              {isSubmitting ? 'Attaching...' : `Attach (${selectedIds.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
