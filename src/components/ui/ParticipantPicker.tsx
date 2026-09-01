import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { AvatarBadge } from '@/components/ui/AvatarBadge';
import { useUsers } from '@/lib/hooks/useData';
import { User } from '@/lib/api';
import { formatCurrencyInput, parseCurrencyString } from '@/lib/utils/currency';
import { CURRENCY_SYMBOL } from '@/lib/constants';

type SplitMethod = 'equal' | 'custom';

type ParticipantPickerProps = {
  users?: User[];
  selectedParticipants: string[];
  onToggleParticipant: (id: string) => void;
  splitMethod: SplitMethod;
  onChangeSplitMethod: (method: SplitMethod) => void;
  customAmounts: Record<string, string>;
  onChangeCustomAmount: (userId: string, value: string) => void;
  equalSplitAmount: number;
  numAmount: number;
};

/**
 * Participant selection + split amount picker.
 */
export function ParticipantPicker({
  users: propUsers,
  selectedParticipants,
  onToggleParticipant,
  splitMethod,
  onChangeSplitMethod,
  customAmounts,
  onChangeCustomAmount,
  equalSplitAmount,
  numAmount,
}: ParticipantPickerProps) {
  const { users: hookUsers } = useUsers();
  const allUsers = propUsers || hookUsers;
  const [search, setSearch] = React.useState('');

  const filteredUsers = allUsers.filter((user) => {
    const q = search.toLowerCase();
    return user.name.toLowerCase().includes(q) || user.id.toLowerCase().includes(q);
  });

  const customTotal = Object.values(customAmounts).reduce(
    (sum, val) => sum + parseCurrencyString(val),
    0
  );
  const isCustomValid = Math.abs(customTotal - numAmount) < 0.01;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <label className="block text-sm font-medium text-zinc-300">Participants &amp; Split</label>
        <div className="flex bg-zinc-950 border border-zinc-800 rounded-lg p-1 w-full sm:w-fit">
          <button
            onClick={() => onChangeSplitMethod('equal')}
            className={cn(
              'px-4 py-1.5 text-xs font-medium rounded-md transition-colors flex-1 sm:flex-none',
              splitMethod === 'equal' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            Equally
          </button>
          <button
            onClick={() => onChangeSplitMethod('custom')}
            className={cn(
              'px-4 py-1.5 text-xs font-medium rounded-md transition-colors flex-1 sm:flex-none',
              splitMethod === 'custom' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            Custom Amounts
          </button>
        </div>
      </div>

      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          placeholder="Search by name or username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600"
        />
      </div>

      <div className="space-y-2 border border-zinc-800 rounded-xl p-2 bg-zinc-950/50 max-h-64 overflow-y-auto">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-6 text-zinc-500 text-sm">No participants found</div>
        ) : (
          filteredUsers.map((user) => {
            const isSelected = selectedParticipants.includes(user.id);
            return (
              <div
                key={user.id}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-zinc-800/50 transition-colors"
              >
                <button
                  onClick={() => onToggleParticipant(user.id)}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <AvatarBadge initials={user.initials} avatar={user.avatar} name={user.name} size="md" />
                  <div className="text-left">
                    <div className="text-sm font-medium text-zinc-200">{user.name}</div>
                    <div className="text-xs text-zinc-600">User ID: {user.id}</div>
                  </div>
                </button>
                <div className="flex items-center gap-4">
                  {isSelected &&
                    (splitMethod === 'equal' ? (
                      <span className="text-zinc-400 text-sm font-medium">
                        {CURRENCY_SYMBOL} {equalSplitAmount.toFixed(2)}
                      </span>
                    ) : (
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">
                          {CURRENCY_SYMBOL}
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0.00"
                          value={customAmounts[user.id] || ''}
                          onChange={(e) =>
                            onChangeCustomAmount(user.id, formatCurrencyInput(e.target.value))
                          }
                          className="w-24 bg-zinc-950 border border-zinc-700 rounded-lg pl-7 pr-2 py-1 text-sm text-white focus:outline-none focus:border-zinc-500 text-right"
                        />
                      </div>
                    ))}
                  <button
                    onClick={() => onToggleParticipant(user.id)}
                    className={cn(
                      'w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0',
                      isSelected ? 'bg-white border-white' : 'border-zinc-700 bg-zinc-900'
                    )}
                  >
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.5 6.5L4.5 8.5L9.5 3.5" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {splitMethod === 'custom' && (
        <div className="mt-3 flex justify-between text-sm px-1">
          <span className={cn('font-medium', isCustomValid ? 'text-emerald-400' : 'text-amber-500')}>
            Allocated: {CURRENCY_SYMBOL} {customTotal.toFixed(2)}
          </span>
          {!isCustomValid && (
            <span className="text-amber-500 font-medium">
              Remaining: {CURRENCY_SYMBOL} {(numAmount - customTotal).toFixed(2)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
