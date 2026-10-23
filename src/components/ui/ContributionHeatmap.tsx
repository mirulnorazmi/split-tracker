import React, { useState, useMemo } from 'react';
import { RecurringCycle, RecurringParticipant } from '@/lib/api';
import { cn } from '@/lib/utils/cn';
import { Check, Clock, AlertCircle, LayoutGrid, Users } from 'lucide-react';
import { AvatarBadge } from '@/components/ui/AvatarBadge';

interface ContributionHeatmapProps {
  selectedYear: number;
  availableYears: number[];
  onSelectYear: (year: number) => void;
  cycles: RecurringCycle[];
  selectedMonth: number | null;
  onSelectMonth: (month: number) => void;
  totalCollectedYear: number;
  totalDueYear: number;
  participants?: RecurringParticipant[];
  creatorId?: string;
}

export function ContributionHeatmap({
  selectedYear,
  availableYears,
  onSelectYear,
  cycles,
  selectedMonth,
  onSelectMonth,
  totalCollectedYear,
  totalDueYear,
  participants,
  creatorId,
}: ContributionHeatmapProps) {
  const [hoveredCycle, setHoveredCycle] = useState<RecurringCycle | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [viewMode, setViewMode] = useState<'matrix' | 'compact'>('matrix');

  const settledCyclesCount = cycles.filter((c) => !c.isFuture && c.totalCount > 0 && c.paidCount === c.totalCount).length;
  const activeCyclesCount = cycles.filter((c) => !c.isFuture && c.totalCount > 0).length;

  // Derive unique participants list (from props or auto-discovered from cycles)
  const displayParticipants = useMemo(() => {
    if (participants && participants.length > 0) {
      return participants;
    }
    const map = new Map<string, { userId: string; name: string; avatar?: string | null; initials: string; isPlaceholder?: boolean }>();
    for (const c of cycles) {
      for (const item of c.items) {
        if (!map.has(item.userId)) {
          map.set(item.userId, {
            userId: item.userId,
            name: item.name,
            avatar: item.avatar,
            initials: item.initials,
            isPlaceholder: item.isPlaceholder,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [participants, cycles]);

  // Compute last paid status for a given participant in this year
  const getParticipantLastPaid = (userId: string) => {
    if (creatorId && userId === creatorId) {
      return {
        label: 'Host (Waived)',
        isUpToDate: true,
        variant: 'host' as const,
      };
    }

    // Active cycles for this user
    const activeCycles = cycles.filter((c) => !c.isFuture && c.items.some((i) => i.userId === userId));

    if (activeCycles.length === 0) {
      return {
        label: 'Not in cycle',
        isUpToDate: false,
        variant: 'neutral' as const,
      };
    }

    const paidCycles = activeCycles.filter((c) => {
      const item = c.items.find((i) => i.userId === userId);
      return item?.status === 'Paid' || item?.status === 'Waived';
    });

    if (paidCycles.length === 0) {
      return {
        label: 'No payments yet',
        isUpToDate: false,
        variant: 'unpaid' as const,
      };
    }

    const latestActive = activeCycles[activeCycles.length - 1];
    const lastPaid = paidCycles[paidCycles.length - 1];
    const isUpToDate = lastPaid.month === latestActive.month;
    const unpaidCount = activeCycles.length - paidCycles.length;

    if (isUpToDate) {
      return {
        label: `Paid through ${lastPaid.monthName}`,
        isUpToDate: true,
        variant: 'paid' as const,
      };
    }

    return {
      label: `Last: ${lastPaid.monthName} (${unpaidCount} due)`,
      isUpToDate: false,
      variant: 'due' as const,
    };
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 sm:p-7">
      <div className="flex flex-col lg:flex-row gap-6 items-start justify-between">
        {/* Main Heatmap Area */}
        <div className="flex-1 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg sm:text-xl font-light text-white tracking-tight">
                <span className="font-semibold text-emerald-400">RM {totalCollectedYear.toFixed(2)}</span> collected in {selectedYear}
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                {settledCyclesCount} of {activeCyclesCount} billing cycles fully settled • Click any month column to inspect details below
              </p>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800/80 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                  viewMode === 'matrix'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                )}
                title="View participant payment matrix row-by-row"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Member Matrix</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('compact')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                  viewMode === 'compact'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                )}
                title="View compact 12-month summary row"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Compact</span>
              </button>
            </div>
          </div>

          {/* Matrix / Heatmap Box */}
          <div className="relative border border-zinc-800 bg-zinc-950/80 rounded-2xl p-4 sm:p-5 overflow-x-auto scrollbar-thin">
            {viewMode === 'matrix' ? (
              <div className="space-y-2 min-w-[760px]">
                {/* Months Header Row */}
                <div className="grid grid-cols-[190px_repeat(12,minmax(42px,1fr))] gap-2 mb-2 items-center text-center text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  <div className="text-left pl-2">Member / Last Paid</div>
                  {cycles.map((c) => {
                    const isSelected = selectedMonth === c.month;
                    return (
                      <button
                        key={c.month}
                        type="button"
                        onClick={() => onSelectMonth(c.month)}
                        className={cn(
                          'py-1.5 px-1 rounded-lg transition-all cursor-pointer flex flex-col items-center justify-center',
                          isSelected
                            ? 'bg-zinc-800 text-white font-bold ring-1 ring-accent/60 shadow-sm'
                            : 'hover:text-zinc-200 hover:bg-zinc-900/60'
                        )}
                        title={`Click to view ${c.monthName} ${selectedYear} payments below`}
                      >
                        <span>{c.monthName}</span>
                        {isSelected && <span className="text-[8px] text-accent font-bold tracking-tight">Active</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Overall Summary Row */}
                <div className="grid grid-cols-[190px_repeat(12,minmax(42px,1fr))] gap-2 py-2 items-center border-b border-zinc-800/80 mb-2">
                  <div className="text-left pl-2">
                    <div className="text-xs font-semibold text-zinc-200">Overall Settled</div>
                    <div className="text-[10px] text-zinc-500">
                      {settledCyclesCount}/{activeCyclesCount} full cycles
                    </div>
                  </div>
                  {cycles.map((c) => {
                    const isSelected = selectedMonth === c.month;
                    let bgClass = 'bg-zinc-800/40 border-zinc-800 text-zinc-600';
                    if (!c.isFuture && c.totalCount > 0) {
                      if (c.level === 3) {
                        bgClass = 'bg-emerald-500 border-emerald-400 text-zinc-950 font-bold shadow-sm shadow-emerald-500/20';
                      } else if (c.level === 2) {
                        bgClass = 'bg-emerald-700/60 border-emerald-600/70 text-emerald-200';
                      } else if (c.level === 1) {
                        bgClass = 'bg-amber-500/20 border-amber-500/40 text-amber-300';
                      }
                    }

                    return (
                      <button
                        key={c.month}
                        type="button"
                        onClick={() => onSelectMonth(c.month)}
                        className={cn(
                          'h-11 rounded-xl border flex flex-col items-center justify-center p-1 transition-all cursor-pointer',
                          bgClass,
                          isSelected && 'ring-2 ring-white scale-105 z-10',
                          !isSelected && 'hover:scale-105'
                        )}
                        title={`Click to view ${c.monthName} ${selectedYear} payments below`}
                      >
                        <span className="text-[11px] font-semibold leading-tight">
                          {c.isFuture ? '-' : `${c.paidCount}/${c.totalCount}`}
                        </span>
                        <span className="text-[9px] opacity-75 truncate max-w-full">
                          {c.isFuture ? 'Future' : `RM ${c.totalCollected.toFixed(0)}`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Individual Participant Rows */}
                <div className="space-y-1.5 pt-1">
                  {displayParticipants.map((p) => {
                    const lastPaid = getParticipantLastPaid(p.userId);
                    const isHost = p.userId === creatorId;

                    return (
                      <div
                        key={p.userId}
                        className="grid grid-cols-[190px_repeat(12,minmax(42px,1fr))] gap-2 py-1.5 items-center hover:bg-zinc-900/50 rounded-xl transition-colors"
                      >
                        {/* Member Info & Last Paid Month */}
                        <div className="flex items-center gap-2 pl-2 overflow-hidden">
                          <AvatarBadge
                            initials={p.initials || p.name?.slice(0, 2).toUpperCase() || '?'}
                            avatar={p.avatar}
                            name={p.name}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-semibold text-white truncate">{p.name}</span>
                              {isHost && (
                                <span className="text-[8px] bg-zinc-800 text-zinc-400 px-1 py-0.2 rounded font-medium">Host</span>
                              )}
                              {p.isPlaceholder && (
                                <span className="text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 py-0.2 rounded font-bold uppercase">Slot</span>
                              )}
                            </div>
                            <div
                              className={cn(
                                'text-[10px] font-medium truncate',
                                lastPaid.variant === 'paid' && 'text-emerald-400',
                                lastPaid.variant === 'host' && 'text-blue-400',
                                lastPaid.variant === 'due' && 'text-amber-400',
                                lastPaid.variant === 'unpaid' && 'text-red-400',
                                lastPaid.variant === 'neutral' && 'text-zinc-500'
                              )}
                              title={lastPaid.label}
                            >
                              {lastPaid.label}
                            </div>
                          </div>
                        </div>

                        {/* 12 Month Cells */}
                        {cycles.map((c) => {
                          const isSelected = selectedMonth === c.month;
                          const item = c.items.find((i) => i.userId === p.userId);
                          const isFuture = c.isFuture;

                          let cellClass = 'bg-zinc-900/60 border-zinc-800/70 text-zinc-600';
                          let cellContent: React.ReactNode = '-';
                          let tooltip = `${p.name}: ${c.monthName} ${selectedYear}`;

                          if (isFuture) {
                            cellContent = '—';
                            cellClass = 'bg-zinc-900/20 border-zinc-800/30 text-zinc-700';
                            tooltip += ' (Future)';
                          } else if (isHost) {
                            cellClass = 'bg-blue-500/10 border-blue-500/30 text-blue-300 font-semibold text-[9px]';
                            cellContent = 'Waived';
                            tooltip += ' (Waived Host)';
                          } else if (item) {
                            if (item.status === 'Paid') {
                              cellClass = 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold';
                              cellContent = <Check className="w-3.5 h-3.5" />;
                              tooltip += ` (Paid RM ${item.amountDue.toFixed(0)})`;
                            } else if (item.status === 'Waived') {
                              cellClass = 'bg-zinc-800 border-zinc-700 text-zinc-300 text-[9px]';
                              cellContent = 'Waived';
                              tooltip += ' (Waived)';
                            } else if (item.status === 'Pending') {
                              cellClass = 'bg-amber-500/20 border-amber-500/40 text-amber-300 text-[10px] font-semibold';
                              cellContent = '⏳';
                              tooltip += ` (Pending RM ${item.amountDue.toFixed(0)})`;
                            } else {
                              // Unpaid
                              cellClass = 'bg-red-500/15 border-red-500/40 text-red-300 font-semibold text-[9px]';
                              cellContent = `RM ${item.amountDue.toFixed(0)}`;
                              tooltip += ` (Unpaid RM ${item.amountDue.toFixed(0)})`;
                            }
                          } else {
                            // Excluded / Left plan / Not joined yet
                            cellClass = 'bg-zinc-950/40 border-zinc-900 text-zinc-700';
                            cellContent = '—';
                            tooltip += ' (Not participating)';
                          }

                          return (
                            <button
                              key={c.month}
                              type="button"
                              title={tooltip}
                              onClick={() => onSelectMonth(c.month)}
                              className={cn(
                                'h-9 rounded-lg border flex flex-col items-center justify-center p-0.5 text-xs transition-all cursor-pointer',
                                cellClass,
                                isSelected && 'ring-2 ring-accent scale-105 z-10 shadow-sm shadow-accent/20',
                                !isSelected && 'hover:scale-105 hover:border-zinc-500'
                              )}
                            >
                              {cellContent}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Compact View (Single 12-Month Row from Image 1) */
              <div className="space-y-2 min-w-[580px]">
                {/* Months Header */}
                <div className="grid grid-cols-12 gap-2 mb-2 text-center text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  {cycles.map((c) => (
                    <div key={c.month}>{c.monthName}</div>
                  ))}
                </div>

                {/* Grid Tiles */}
                <div className="grid grid-cols-12 gap-2">
                  {cycles.map((c) => {
                    const isSelected = selectedMonth === c.month;
                    let bgClass = 'bg-zinc-800/40 border-zinc-800 text-zinc-600';
                    if (!c.isFuture && c.totalCount > 0) {
                      if (c.level === 3) {
                        bgClass = 'bg-emerald-500 border-emerald-400/80 shadow-md shadow-emerald-500/20 text-zinc-950 font-bold';
                      } else if (c.level === 2) {
                        bgClass = 'bg-emerald-700/60 border-emerald-600/70 text-emerald-200';
                      } else if (c.level === 1) {
                        bgClass = 'bg-amber-500/20 border-amber-500/40 text-amber-300';
                      }
                    }

                    return (
                      <button
                        key={c.month}
                        type="button"
                        onClick={() => onSelectMonth(c.month)}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 10 });
                          setHoveredCycle(c);
                        }}
                        onMouseLeave={() => {
                          setHoveredCycle(null);
                          setTooltipPos(null);
                        }}
                        className={cn(
                          'h-14 sm:h-16 rounded-xl border flex flex-col items-center justify-center p-1 transition-all transform duration-150 cursor-pointer relative group',
                          bgClass,
                          isSelected && 'ring-2 ring-white scale-105 z-10',
                          !isSelected && 'hover:scale-105 hover:z-10'
                        )}
                      >
                        <span className="text-xs font-semibold">
                          {c.isFuture ? '-' : `${c.paidCount}/${c.totalCount}`}
                        </span>
                        <span className="text-[10px] opacity-75 mt-0.5 truncate max-w-full">
                          {c.isFuture ? 'Future' : `RM ${c.totalCollected.toFixed(0)}`}
                        </span>

                        {!c.isFuture && c.totalCount > 0 && (
                          <span className="absolute top-1 right-1">
                            {c.level === 3 && <Check className="w-3 h-3 text-zinc-950 stroke-[3]" />}
                            {c.level === 2 && <Clock className="w-2.5 h-2.5 text-emerald-300" />}
                            {c.level === 1 && <AlertCircle className="w-2.5 h-2.5 text-amber-400" />}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Heatmap Legend */}
            <div className="flex flex-wrap items-center justify-between text-xs text-zinc-500 mt-4 pt-3 border-t border-zinc-800/80 gap-3">
              <div className="flex items-center gap-2">
                <span>Click any month column to inspect all members in that cycle below</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] mr-1">Status:</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">✓ Paid</span>
                <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30 text-[10px] font-medium">Waived</span>
                <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/40 text-[10px] font-semibold">Due</span>
                <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-600 border border-zinc-800 text-[10px]">Future/Inactive</span>
              </div>
            </div>
          </div>
        </div>

        {/* Year Selector Stack on the Right (matches GitHub profile sidebar) */}
        <div className="w-full lg:w-32 shrink-0">
          <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Year</div>
          <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
            {availableYears.map((yr) => {
              const isSelected = selectedYear === yr;
              return (
                <button
                  key={yr}
                  type="button"
                  onClick={() => onSelectYear(yr)}
                  className={cn(
                    'w-full text-left px-3.5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap',
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                  )}
                >
                  {yr}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Hover Tooltip (Compact Mode) */}
      {hoveredCycle && tooltipPos && (
        <div
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
          className="fixed pointer-events-none z-50 bg-zinc-900 text-white text-xs border border-zinc-700 rounded-xl px-3 py-2 shadow-2xl space-y-1 min-w-[170px]"
        >
          <div className="font-semibold text-zinc-200">
            {hoveredCycle.monthName} {selectedYear}
          </div>
          {hoveredCycle.isFuture ? (
            <div className="text-zinc-500">Upcoming billing period</div>
          ) : (
            <>
              <div className="text-zinc-400">
                <span className="text-white font-medium">{hoveredCycle.paidCount}</span> of{' '}
                <span className="text-white font-medium">{hoveredCycle.totalCount}</span> paid
              </div>
              <div className="text-emerald-400 font-medium">
                RM {hoveredCycle.totalCollected.toFixed(2)} / RM {hoveredCycle.totalDue.toFixed(2)} collected
              </div>
              <div className="text-[10px] text-zinc-500 pt-0.5 border-t border-zinc-800">
                Status: {hoveredCycle.level === 3 ? 'Fully Settled' : hoveredCycle.level === 2 ? 'In Progress' : 'Pending Payment'}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
