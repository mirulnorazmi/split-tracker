import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid,
  FileText,
  Repeat,
  CreditCard,
  User,
  Settings,
  HelpCircle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface SpotlightTourProps {
  isOpen: boolean;
  onClose: () => void;
  setSidebarOpen?: (open: boolean) => void;
}

interface TourStep {
  id: string;
  targetSelector: string;
  targetType: 'sidebar' | 'content';
  title: string;
  badge: string;
  description: string;
  tip?: string;
  icon: React.ElementType;
  iconColor: string;
}

function getTargetElement(selector: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  const el = document.querySelector<HTMLElement>(selector);
  if (el) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const isHidden =
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseFloat(style.opacity || '1') === 0 ||
      rect.width === 0 ||
      rect.height === 0 ||
      rect.right <= 10 ||
      rect.left >= window.innerWidth - 10;

    if (!isHidden) {
      return el;
    }
  }

  return null;
}

export default function SpotlightTour({ isOpen, onClose, setSidebarOpen }: SpotlightTourProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  // Flow: explain all sidebar modules first (Workspace & Account/Settings),
  // then close the drawer and explain the main dashboard content!
  const steps: TourStep[] = useMemo(
    () => [
      {
        id: 'dashboard',
        targetSelector: '[data-tour="sidebar-dashboard"]',
        targetType: 'sidebar',
        badge: 'Step 1 • Navigation',
        title: 'Dashboard Overview',
        description: 'Your central hub for group finances. View your total balance due, see confirmed vs pending payment totals, and track recent activity.',
        tip: 'Tap here anytime to return to your main dashboard summary.',
        icon: LayoutGrid,
        iconColor: 'text-[#C9FF55]',
      },
      {
        id: 'expenses',
        targetSelector: '[data-tour="sidebar-expenses"]',
        targetType: 'sidebar',
        badge: 'Step 2 • Navigation',
        title: 'One-Off Expenses',
        description: 'Record meals, groceries, travel, and group bills. Split equally among participants or set custom exact amounts for each member.',
        tip: 'Member expenses submit for host verification before updating overall balances.',
        icon: FileText,
        iconColor: 'text-sky-400',
      },
      {
        id: 'subscriptions',
        targetSelector: '[data-tour="sidebar-subscriptions"]',
        targetType: 'sidebar',
        badge: 'Step 3 • Navigation',
        title: 'Subscriptions & Cycles',
        description: 'Automate shared monthly or yearly subscriptions like Netflix, Spotify, or cloud tools with interactive payment heatmaps and member shares.',
        tip: 'Adding or discontinuing members dynamically updates future unpaid cycles without altering history.',
        icon: Repeat,
        iconColor: 'text-emerald-400',
      },
      {
        id: 'payments',
        targetSelector: '[data-tour="sidebar-payments"]',
        targetType: 'sidebar',
        badge: 'Step 4 • Navigation',
        title: 'Payments & Settlement',
        description: 'Settle balances directly. Pay multiple expenses and subscription cycles in a single batch payment and submit receipts for confirmation.',
        tip: 'Your balance updates automatically once the recipient confirms receipt.',
        icon: CreditCard,
        iconColor: 'text-purple-400',
      },
      {
        id: 'profile',
        targetSelector: '[data-tour="sidebar-profile"]',
        targetType: 'sidebar',
        badge: 'Step 5 • Account',
        title: 'User Profile & Identity',
        description: 'Manage your profile picture, display name, and email address. Keep your contact details up to date for your group members.',
        tip: 'You can upload a custom avatar photo directly from your device.',
        icon: User,
        iconColor: 'text-pink-400',
      },
      {
        id: 'settings',
        targetSelector: '[data-tour="sidebar-settings"]',
        targetType: 'sidebar',
        badge: 'Step 6 • Preferences',
        title: 'Settings & Security',
        description: 'Change your password, update security settings, and configure your personal account preferences.',
        tip: 'Password resets and credential updates can be securely completed here.',
        icon: Settings,
        iconColor: 'text-teal-400',
      },
      {
        id: 'guide',
        targetSelector: '[data-tour="sidebar-guide"]',
        targetType: 'sidebar',
        badge: 'Step 7 • Support',
        title: 'App Guide & Walkthrough',
        description: 'Need a reminder on how anything works? Click "App Guide" anytime in the sidebar or from Settings to replay this guided tour.',
        tip: 'Next up: let’s close the menu and look at your live Dashboard balance breakdown!',
        icon: HelpCircle,
        iconColor: 'text-[#C9FF55]',
      },
      {
        id: 'balance-card',
        targetSelector: '[data-tour="dashboard-balance"]',
        targetType: 'content',
        badge: 'Step 8 • Live Breakdown',
        title: 'Balance Overview & Chart',
        description: 'Displays your current financial standing in real time. Confirmed payments reduce your balance, while pending payments await verification.',
        tip: 'Hover or tap on the circular chart segments to see your exact category breakdown and percentages.',
        icon: Sparkles,
        iconColor: 'text-amber-400',
      },
    ],
    []
  );

  const totalSteps = steps.length;
  const current = steps[currentStep] || steps[0];

  // If user opens the tour from another page (like /profile or /settings),
  // automatically navigate to /dashboard so the full context is accessible
  useEffect(() => {
    if (isOpen && location.pathname !== '/dashboard') {
      navigate('/dashboard');
    }
  }, [isOpen, location.pathname, navigate]);

  // Ensure we are on /dashboard when reaching content steps
  useEffect(() => {
    if (!isOpen) return;

    const step = steps[currentStep];
    if (step.targetType === 'content' && location.pathname !== '/dashboard') {
      navigate('/dashboard');
    }
  }, [isOpen, currentStep, location.pathname, navigate, steps]);

  const handleClose = useCallback(() => {
    if (setSidebarOpen) {
      setSidebarOpen(false);
    }
    onClose();
  }, [onClose, setSidebarOpen]);

  const updateTargetRect = useCallback(() => {
    const element = getTargetElement(current.targetSelector);

    if (element) {
      const r = element.getBoundingClientRect();
      setTargetRect((prev) => {
        if (
          prev &&
          Math.abs(prev.top - r.top) < 1 &&
          Math.abs(prev.left - r.left) < 1 &&
          Math.abs(prev.width - r.width) < 1 &&
          Math.abs(prev.height - r.height) < 1
        ) {
          return prev;
        }
        return r;
      });
    } else {
      setTargetRect(null);
    }
  }, [current.targetSelector]);

  // Track window resizing for responsive layout
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      updateTargetRect();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, updateTargetRect]);

  // Handle mobile drawer opening for sidebar steps and closing for dashboard content
  useEffect(() => {
    if (!isOpen) return;

    const step = steps[currentStep];
    const isMobile = windowWidth < 1024;

    if (isMobile && setSidebarOpen) {
      if (step.targetType === 'sidebar') {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    }

    // Measure target element initially, during transition, and after drawer slide finishes (350ms)
    updateTargetRect();
    const t1 = setTimeout(updateTargetRect, 120);
    const t2 = setTimeout(updateTargetRect, 360);

    // If switching to dashboard content, smoothly scroll target into view once drawer finishes closing
    let tScroll: NodeJS.Timeout | null = null;
    if (step.targetType === 'content') {
      tScroll = setTimeout(() => {
        const el = document.querySelector<HTMLElement>(step.targetSelector);
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.top < 70 || r.bottom > window.innerHeight - 70) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
        updateTargetRect();
      }, 350);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (tScroll) clearTimeout(tScroll);
    };
  }, [isOpen, currentStep, windowWidth, setSidebarOpen, updateTargetRect, steps]);

  // Listen to scrolling to update positions
  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener('scroll', updateTargetRect, true);
    return () => window.removeEventListener('scroll', updateTargetRect, true);
  }, [isOpen, updateTargetRect]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        e.preventDefault();
        setCurrentStep((prev) => (prev < totalSteps - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentStep((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, totalSteps, handleClose]);

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  if (!isOpen) return null;

  const IconComponent = current.icon;
  const isMobile = windowWidth < 1024;

  // Calculate popover positioning relative to target
  let popoverStyle: React.CSSProperties = {};
  let arrowPlacement: 'left' | 'top' = 'left';

  if (targetRect && !isMobile) {
    const cardWidth = 360;
    const cardHeight = 280;
    const targetRight = targetRect.right;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    if (windowWidth - targetRight >= cardWidth + 24) {
      // Space to the right (ideal for sidebar items on desktop)
      arrowPlacement = 'left';
      let topPos = targetCenterY - cardHeight / 2;
      topPos = Math.max(16, Math.min(window.innerHeight - cardHeight - 16, topPos));

      popoverStyle = {
        position: 'fixed',
        top: `${topPos}px`,
        left: `${targetRight + 16}px`,
        width: `${cardWidth}px`,
      };
    } else {
      // Placed below or to the left (ideal for content cards on desktop)
      arrowPlacement = 'top';
      popoverStyle = {
        position: 'fixed',
        top: `${Math.min(window.innerHeight - cardHeight - 16, targetRect.bottom + 16)}px`,
        left: `${Math.max(16, Math.min(windowWidth - cardWidth - 16, targetRect.left))}px`,
        width: `${cardWidth}px`,
      };
    }
  } else if (isMobile && targetRect) {
    // Mobile positioning:
    // When sidebar drawer is open (steps 1-5), dock popover at bottom so sidebar menu is visible.
    // When drawer is closed (step 6), intelligently dock opposite to target position.
    if (current.targetType === 'sidebar') {
      popoverStyle = {
        position: 'fixed',
        bottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
        left: '16px',
        right: '16px',
        margin: '0 auto',
        maxWidth: '420px',
        width: 'calc(100% - 32px)',
        maxHeight: 'calc(100vh - 100px)',
      };
    } else {
      const targetCenterY = targetRect.top + targetRect.height / 2;
      const isTargetLowerHalf = targetCenterY > window.innerHeight * 0.45;

      if (isTargetLowerHalf) {
        popoverStyle = {
          position: 'fixed',
          top: 'max(70px, env(safe-area-inset-top, 70px))',
          left: '16px',
          right: '16px',
          margin: '0 auto',
          maxWidth: '420px',
          width: 'calc(100% - 32px)',
          maxHeight: 'calc(100vh - 90px)',
        };
      } else {
        popoverStyle = {
          position: 'fixed',
          bottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
          left: '16px',
          right: '16px',
          margin: '0 auto',
          maxWidth: '420px',
          width: 'calc(100% - 32px)',
          maxHeight: 'calc(100vh - 90px)',
        };
      }
    }
  } else {
    // Fallback centered popover
    popoverStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      maxWidth: '420px',
      width: 'calc(100% - 32px)',
      maxHeight: 'calc(100vh - 60px)',
    };
  }

  return (
    <div className="fixed inset-0 z-[90] overflow-hidden select-none">
      {/* Dimmed backdrop with transparent cutout over active target - Outside clicks DO NOT dismiss */}
      <svg
        className="fixed inset-0 z-[91] w-full h-full pointer-events-auto cursor-default"
        style={{ width: '100vw', height: '100vh' }}
        aria-hidden="true"
      >
        <defs>
          <mask id="spotlight-hole-mask">
            {/* White area = dimmed backdrop */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black area = punch-through transparent hole showing the target brightly! */}
            {targetRect && (
              <rect
                x={Math.max(0, targetRect.left - 4)}
                y={Math.max(0, targetRect.top - 4)}
                width={targetRect.width + 8}
                height={targetRect.height + 8}
                rx="14"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.72)"
          mask="url(#spotlight-hole-mask)"
        />
      </svg>

      {/* Target Focus Box with glowing lime outline */}
      {targetRect && (
        <div
          className="fixed pointer-events-none z-[92] rounded-xl border-2 border-[#C9FF55] transition-all duration-300 shadow-[0_0_25px_rgba(201,255,85,0.45)]"
          style={{
            top: `${Math.max(0, targetRect.top - 4)}px`,
            left: `${Math.max(0, targetRect.left - 4)}px`,
            width: `${targetRect.width + 8}px`,
            height: `${targetRect.height + 8}px`,
          }}
        />
      )}

      {/* Floating Tooltip / Popover Card */}
      <div
        style={popoverStyle}
        className="z-[95] bg-zinc-900 border border-zinc-700/90 rounded-2xl shadow-2xl shadow-black/95 overflow-hidden flex flex-col transition-all duration-200 animate-in fade-in duration-200 pointer-events-auto"
        role="dialog"
        aria-modal="true"
      >
        {/* Desktop Pointer Arrow */}
        {!isMobile && targetRect && arrowPlacement === 'left' && (
          <div
            className="absolute -left-2 w-4 h-4 bg-zinc-900 border-l border-b border-zinc-700/90 transform rotate-45"
            style={{
              top: `${Math.max(20, Math.min(220, targetRect.top + targetRect.height / 2 - (parseFloat(String(popoverStyle.top)) || 0) - 8))}px`,
            }}
          />
        )}
        {!isMobile && targetRect && arrowPlacement === 'top' && (
          <div className="absolute -top-2 left-8 w-4 h-4 bg-zinc-900 border-t border-l border-zinc-700/90 transform rotate-45" />
        )}

        {/* Card Header with Step Progress Indicators & Close */}
        <div className="px-4 pt-3.5 pb-2.5 border-b border-zinc-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1 flex-1">
            {steps.map((step, idx) => (
              <button
                key={step.id}
                onClick={() => setCurrentStep(idx)}
                aria-label={`Go to step ${idx + 1}`}
                className={cn(
                  'h-1 rounded-full transition-all duration-200 cursor-pointer',
                  idx === currentStep
                    ? 'w-5 bg-[#C9FF55]'
                    : idx < currentStep
                    ? 'w-2 bg-zinc-500'
                    : 'w-1.5 bg-zinc-800'
                )}
              />
            ))}
          </div>

          <span className="text-[11px] font-semibold text-zinc-400 tabular-nums">
            {currentStep + 1}/{totalSteps}
          </span>

          <button
            onClick={handleClose}
            className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors cursor-pointer"
            title="Close Guide"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card Content */}
        <div className="p-4 space-y-3 flex-1 overflow-y-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
              <IconComponent className={cn('w-4 h-4', current.iconColor)} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                {current.badge}
              </span>
              <h3 className="text-sm font-semibold text-white tracking-tight leading-tight">
                {current.title}
              </h3>
            </div>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed">
            {current.description}
          </p>

          {current.tip && (
            <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/90 text-[11px] text-zinc-400 leading-relaxed flex items-start gap-2">
              <span className="text-[10px] font-bold text-[#C9FF55] uppercase shrink-0 mt-0.5">Tip:</span>
              <span>{current.tip}</span>
            </div>
          )}
        </div>

        {/* Card Footer Actions */}
        <div className="px-4 py-2.5 border-t border-zinc-800/80 bg-zinc-950/70 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={handleClose}
            className="text-xs font-medium text-zinc-400 hover:text-white px-2 py-1 rounded hover:bg-zinc-800/50 transition-colors cursor-pointer"
          >
            Skip Tour
          </button>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back</span>
              </button>
            )}

            <button
              onClick={handleNext}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#C9FF55] text-zinc-950 hover:bg-[#b8f53b] active:scale-[0.98] transition-all flex items-center gap-1.5 shadow-sm shadow-[#C9FF55]/10 cursor-pointer"
            >
              <span>{currentStep === totalSteps - 1 ? 'Done' : 'Next'}</span>
              {currentStep === totalSteps - 1 ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

