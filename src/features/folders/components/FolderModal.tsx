import React, { useState, useEffect } from 'react';
import { X, Folder, Sparkles, Tag, Palette } from 'lucide-react';
import { api, Folder as FolderType } from '@/lib/api';

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderToEdit?: FolderType | null;
  onSuccess: (folder: FolderType) => void;
}

const CATEGORY_PRESETS = [
  'Trip & Vacation',
  'Household & Groceries',
  'Project & Work',
  'Dining & Outings',
  'Events & Parties',
  'General',
];

const COLOR_PRESETS = [
  { label: 'SplitTrack Lime', hex: '#C9FF55' },
  { label: 'Cyan', hex: '#06b6d4' },
  { label: 'Emerald', hex: '#10b981' },
  { label: 'Indigo', hex: '#6366f1' },
  { label: 'Purple', hex: '#a855f7' },
  { label: 'Amber', hex: '#f59e0b' },
  { label: 'Rose', hex: '#f43f5e' },
];

export function FolderModal({
  isOpen,
  onClose,
  folderToEdit,
  onSuccess,
}: FolderModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Trip & Vacation');
  const [color, setColor] = useState('#C9FF55');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(folderToEdit);

  useEffect(() => {
    if (isOpen) {
      if (folderToEdit) {
        setName(folderToEdit.name || '');
        setDescription(folderToEdit.description || '');
        setCategory(folderToEdit.category || 'Trip & Vacation');
        setColor(folderToEdit.color || '#C9FF55');
      } else {
        setName('');
        setDescription('');
        setCategory('Trip & Vacation');
        setColor('#C9FF55');
      }
      setError(null);
    }
  }, [isOpen, folderToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a folder name.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditing && folderToEdit) {
        const updated = await api.updateFolder(folderToEdit.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          category,
          color,
        });
        onSuccess(updated);
      } else {
        const created = await api.createFolder({
          name: name.trim(),
          description: description.trim() || undefined,
          category,
          color,
        });
        onSuccess(created);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save folder. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center border"
              style={{ backgroundColor: `${color}15`, borderColor: `${color}40`, color }}
            >
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-light text-white tracking-tight">
                {isEditing ? 'Edit Expense Folder' : 'New Expense Folder'}
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Group and track collective expenses and balances
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Folder Name */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Folder Name <span className="text-accent">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Langkawi Trip 2026, House Rent & Utilities"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-accent transition-colors"
              autoFocus
              required
            />
          </div>

          {/* Category Preset */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" /> Category
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_PRESETS.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    category === cat
                      ? 'bg-zinc-800 border-zinc-600 text-white'
                      : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Color Accent Picker */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" /> Accent Color
            </label>
            <div className="flex items-center gap-3">
              {COLOR_PRESETS.map((c) => (
                <button
                  type="button"
                  key={c.hex}
                  onClick={() => setColor(c.hex)}
                  title={c.label}
                  className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                    color === c.hex ? 'scale-125 border-white shadow-lg' : 'border-transparent hover:scale-110'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details, itinerary notes, or participants overview..."
              rows={3}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-accent transition-colors resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="bg-accent text-accent-text font-bold text-xs px-5 py-2.5 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2 cursor-pointer shadow-lg shadow-accent/10"
            >
              <Folder className="w-3.5 h-3.5" />
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
