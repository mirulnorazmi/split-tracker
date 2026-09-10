import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowDown, Loader2, CheckCircle2 } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
}

type RefreshState = 'idle' | 'pulling' | 'ready' | 'refreshing' | 'success';

const THRESHOLD = 65; // pixels needed to trigger refresh
const MAX_PULL = 85;

export default function PullToRefresh({
  onRefresh,
  children,
  className = '',
}: PullToRefreshProps) {
  const [refreshState, setRefreshState] = useState<RefreshState>('idle');
  const [pullDistance, setPullDistance] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const isTouching = useRef(false);
  const wheelAccumulator = useRef(0);
  const wheelTimer = useRef<any>(null);

  // ── Touch Gesture Handlers ──────────────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    if (refreshState === 'refreshing' || refreshState === 'success') return;
    const container = containerRef.current;
    if (!container) return;

    // Only allow pull-down if we are at the very top of the scroll container
    if (container.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      isTouching.current = true;
    } else {
      isTouching.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isTouching.current || refreshState === 'refreshing' || refreshState === 'success') return;
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) {
      isTouching.current = false;
      setPullDistance(0);
      setRefreshState('idle');
      return;
    }

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;

    if (deltaY > 0) {
      // Sub-linear resistance curve for natural tactile feel
      const damped = Math.min(MAX_PULL, Math.pow(deltaY, 0.82));
      setPullDistance(damped);

      if (damped >= THRESHOLD) {
        if (refreshState !== 'ready') {
          setRefreshState('ready');
          try {
            if ('vibrate' in navigator) navigator.vibrate(10);
          } catch {
            // ignore
          }
        }
      } else {
        setRefreshState('pulling');
      }
    } else {
      setPullDistance(0);
      setRefreshState('idle');
    }
  };

  const executeRefresh = useCallback(async () => {
    setRefreshState('refreshing');
    setPullDistance(52); // Lock at comfortable spinner height
    try {
      await onRefresh();
      setRefreshState('success');
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshState('idle');
      setPullDistance(0);
    }
  }, [onRefresh]);

  const handleTouchEnd = () => {
    if (!isTouching.current) return;
    isTouching.current = false;

    if (refreshState === 'ready') {
      executeRefresh();
    } else if (refreshState !== 'refreshing' && refreshState !== 'success') {
      setPullDistance(0);
      setRefreshState('idle');
    }
  };

  // ── Desktop Wheel / Trackpad Overscroll Handlers ────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Only react if at top of page and user scrolls upwards
      if (container.scrollTop <= 0 && e.deltaY < 0) {
        if (refreshState === 'refreshing' || refreshState === 'success') return;

        wheelAccumulator.current += Math.abs(e.deltaY);
        const damped = Math.min(MAX_PULL, wheelAccumulator.current * 0.45);
        setPullDistance(damped);

        if (damped >= THRESHOLD) {
          setRefreshState('ready');
        } else {
          setRefreshState('pulling');
        }

        clearTimeout(wheelTimer.current);
        wheelTimer.current = setTimeout(() => {
          if (wheelAccumulator.current * 0.45 >= THRESHOLD) {
            wheelAccumulator.current = 0;
            executeRefresh();
          } else {
            wheelAccumulator.current = 0;
            setPullDistance(0);
            setRefreshState('idle');
          }
        }, 180);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      clearTimeout(wheelTimer.current);
    };
  }, [refreshState, executeRefresh]);

  // Rotation calculation for the pull arrow (0deg to 180deg)
  const progress = Math.min(1, pullDistance / THRESHOLD);
  const arrowRotation = refreshState === 'ready' ? 180 : progress * 180;

  return (
    <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Centered Floating Refresh Indicator Pill */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 z-40 transition-all duration-200 pointer-events-none ${
          pullDistance > 0 || refreshState === 'refreshing' || refreshState === 'success'
            ? 'opacity-100'
            : 'opacity-0 -translate-y-6'
        }`}
        style={{
          top: `${Math.max(12, pullDistance * 0.4)}px`,
        }}
      >
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-zinc-900/95 backdrop-blur-md border border-zinc-700/80 shadow-2xl shadow-black/80 text-xs font-medium text-zinc-200">
          {refreshState === 'refreshing' ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
              <span className="text-zinc-300 font-medium">Refreshing latest data...</span>
            </>
          ) : refreshState === 'success' ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
              <span className="text-accent font-semibold">Up to date</span>
            </>
          ) : refreshState === 'ready' ? (
            <>
              <div
                className="w-3.5 h-3.5 flex items-center justify-center transition-transform duration-200"
                style={{ transform: `rotate(${arrowRotation}deg)` }}
              >
                <ArrowDown className="w-3.5 h-3.5 text-accent" />
              </div>
              <span className="text-white font-medium">Release to refresh</span>
            </>
          ) : (
            <>
              <div
                className="w-3.5 h-3.5 flex items-center justify-center transition-transform duration-100"
                style={{ transform: `rotate(${arrowRotation}deg)` }}
              >
                <ArrowDown className="w-3.5 h-3.5 text-zinc-400" />
              </div>
              <span className="text-zinc-400">Scroll up to refresh</span>
            </>
          )}
        </div>
      </div>

      {/* Primary Scrollable Content Area */}
      <main
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`flex-1 overflow-y-auto ${className}`}
        style={
          pullDistance > 0 && refreshState !== 'idle'
            ? {
                transform: `translateY(${pullDistance * 0.28}px)`,
                transition: isTouching.current
                  ? 'none'
                  : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
              }
            : undefined
        }
      >
        {children}
      </main>
    </div>
  );
}
