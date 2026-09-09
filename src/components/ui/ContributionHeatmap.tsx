import React, { useState } from 'react';
import { RecurringCycle } from '@/lib/api';
import { cn } from '@/lib/utils/cn';
import { Check, Clock, AlertCircle } from 'lucide-react';

interface ContributionHeatmapProps {
  selectedYear: number;
  availableYears: number[];
  onSelectYear: (year: number) => void;
  cycles: RecurringCycle[];
  selectedMonth: number | null;
  onSelectMonth: (month: number) => void;
  totalCollectedYear: number;
  totalDueYear: number;
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
}: ContributionHeatmapProps) {
  const [hoveredCycle, setHoveredCycle] = useState<RecurringCycle | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const settledCyclesCount = cycles.filter((c) => !c.isFuture && c.totalCount > 0 && c.paidCount === c.totalCount).length;
  const activeCyclesCount = cycles.filter((c) => !c.isFuture && c.totalCount > 0).length;

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 sm:p-7">
      <div className="flex flex-col lg:flex-row gap-6 items-start justify-between">
        {/* Main Heatmap Area */}
        <div className="flex-1 w-full">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg sm:text-xl font-light text-white tracking-tight">
                <span className="font-semibold text-emerald-400">RM {totalCollectedYear.toFixed(2)}</span> collected in {selectedYear}
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                {settledCyclesCount} of {activeCyclesCount} billing cycles fully settled
              </p>
            </div>
            <div className="text-xs text-zinc-500 font-medium">
              Payment Status Grid
            </div>
          </div>

          {/* Heatmap Grid Box (GitHub style) */}
          <div className="relative border border-zinc-800 bg-zinc-950/80 rounded-2xl p-4 sm:p-5 overflow-x-auto">
            {/* Months Header */}
            <div className="grid grid-cols-12 gap-2 min-w-[580px] mb-2 text-center text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              {cycles.map((c) => (
                <div key={c.month}>{c.monthName}</div>
              ))}
            </div>

            {/* Grid Tiles */}
            <div className="grid grid-cols-12 gap-2 min-w-[580px]">
              {cycles.map((c) => {
                const isSelected = selectedMonth === c.month;

                // Color based on level
                // 0: Future
                // 1: Unpaid (Due)
                // 2: Partial Paid
                // 3: Fully Settled
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

                    {/* Mini indicator icon */}
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

            {/* Heatmap Legend */}
            <div className="flex flex-wrap items-center justify-between text-xs text-zinc-500 mt-4 pt-3 border-t border-zinc-800/80 gap-3">
              <div className="flex items-center gap-2">
                <span>Click any month tile to view &amp; manage participant payments</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] mr-1">Less</span>
                <span className="w-3.5 h-3.5 rounded bg-zinc-800/80 border border-zinc-700/50 inline-block" title="No payment / Future" />
                <span className="w-3.5 h-3.5 rounded bg-amber-500/25 border border-amber-500/40 inline-block" title="Unpaid / Due" />
                <span className="w-3.5 h-3.5 rounded bg-emerald-700/60 border border-emerald-600/70 inline-block" title="Partially Paid" />
                <span className="w-3.5 h-3.5 rounded bg-emerald-500 border border-emerald-400 inline-block" title="Fully Settled" />
                <span className="text-[11px] ml-1">More</span>
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

      {/* Floating Hover Tooltip */}
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
