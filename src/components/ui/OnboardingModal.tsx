import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  FileText,
  Repeat,
  CreditCard,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
  ExternalLink,
  Split,
  CalendarDays,
  Receipt,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/app/AuthContext';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TourStep {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  highlights: {
    icon: React.ElementType;
    title: string;
    description: string;
  }[];
  tip: string;
  route?: string;
  routeLabel?: string;
}

export default function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [currentStep, setCurrentStep] = useState(0);

  const steps: TourStep[] = [
    {
      id: 'welcome',
      badge: 'Welcome to SplitTrack',
      title: 'Effortless Group Splitting & Subscriptions',
      subtitle: 'Manage shared bills, divide restaurant tabs, and track monthly recurring subscriptions without messy spreadsheets.',
      icon: Sparkles,
      iconColor: 'text-[#C9FF55]',
      iconBg: 'bg-[#C9FF55]/10 border-[#C9FF55]/20',
      highlights: [
        {
          icon: Split,
          title: 'Fair & Transparent Splits',
          description: 'Divide any one-off expense equally or customize exact amounts per participant down to the cent.',
        },
        {
          icon: CalendarDays,
          title: 'Automated Recurring Cycles',
          description: 'Keep track of Netflix, Spotify, or utility subscriptions with month-by-month status heatmaps.',
        },
        {
          icon: Receipt,
          title: 'Clean Settlements',
          description: 'Submit payments for multiple bills at once, submit transfer receipts, and get verified confirmation.',
        },
      ],
      tip: 'This quick tour will introduce each key module so you feel right at home.',
    },
    {
      id: 'dashboard',
      badge: 'Module 1 • Overview',
      title: 'Financial Dashboard',
      subtitle: 'Your personal command center for viewing what you owe, what you have paid, and recent group activity.',
      icon: LayoutGrid,
      iconColor: 'text-sky-400',
      iconBg: 'bg-sky-500/10 border-sky-500/20',
      highlights: [
        {
          icon: LayoutGrid,
          title: 'Live Balance Cards',
          description: 'Real-time metrics for Total Owed, Confirmed Payments, Pending Reviews, and your Current Balance Due.',
        },
        {
          icon: Sparkles,
          title: 'Interactive Balance Chart',
          description: 'Visual breakdown of your payments progress with interactive doughnut charts.',
        },
        {
          icon: Receipt,
          title: 'Activity Streams',
          description: 'Instant feed of latest group expenses and payments with quick infinite scrolling.',
        },
      ],
      tip: 'The dashboard automatically calculates your share across both one-off expenses and active recurring cycles.',
      route: '/dashboard',
      routeLabel: 'Open Dashboard',
    },
    {
      id: 'expenses',
      badge: 'Module 2 • Shared Bills',
      title: 'One-Off Expenses',
      subtitle: 'Record group dining, trip expenses, groceries, and household purchases in seconds.',
      icon: FileText,
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/10 border-amber-500/20',
      highlights: [
        {
          icon: Split,
          title: 'Equal or Custom Splits',
          description: 'Split bills evenly with one click or enter custom sums for each member who participated.',
        },
        {
          icon: Users,
          title: 'Participant Picker',
          description: 'Easily select friends or room-mates involved in the expense from your user directory.',
        },
        {
          icon: ShieldCheck,
          title: 'Approval Protection',
          description: 'Expenses submitted by standard users are reviewed by an Admin to keep financial records accurate.',
        },
      ],
      tip: 'Click "+ New Expense" at any time from the Expenses tab or the Dashboard quick action menu.',
      route: '/expenses',
      routeLabel: 'Explore Expenses',
    },
    {
      id: 'subscriptions',
      badge: 'Module 3 • Recurring Bills',
      title: 'Subscriptions & Cycles',
      subtitle: 'Never lose track of monthly and yearly shared accounts like streaming, software, or utilities.',
      icon: Repeat,
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10 border-emerald-500/20',
      highlights: [
        {
          icon: CalendarDays,
          title: 'Month-by-Month Cycles',
          description: 'The app automatically generates recurring billing periods on your specified billing day.',
        },
        {
          icon: Sparkles,
          title: 'Contribution Heatmap',
          description: 'View 12-month payment progress at a glance with color-coded cycle blocks.',
        },
        {
          icon: Users,
          title: 'Dynamic Member Shares',
          description: 'Add or discontinue members at any time; open unpaid cycles automatically recalculate individual shares.',
        },
      ],
      tip: 'You can see your total unpaid subscription months directly from the Subscriptions overview.',
      route: '/subscriptions',
      routeLabel: 'Explore Subscriptions',
    },
    {
      id: 'payments',
      badge: 'Module 4 • Settlements',
      title: 'Payments & Confirmations',
      subtitle: 'Settle balances directly with hosts and verify receipts without awkward reminders.',
      icon: CreditCard,
      iconColor: 'text-purple-400',
      iconBg: 'bg-purple-500/10 border-purple-500/20',
      highlights: [
        {
          icon: CreditCard,
          title: 'Batch & Single Payments',
          description: 'Combine multiple one-off bills and subscription cycles into a single transfer to the host.',
        },
        {
          icon: ShieldCheck,
          title: 'Host Verification',
          description: 'Payments stay in "Pending" status until verified and confirmed by the host or an administrator.',
        },
        {
          icon: CheckCircle2,
          title: 'Instant Balance Updates',
          description: 'Once confirmed, your balances update immediately and subscription cycle items become marked as Paid.',
        },
      ],
      tip: 'You can initiate a payment directly from any expense or subscription details screen with pre-filled amounts.',
      route: '/payments',
      routeLabel: 'Explore Payments',
    },
    {
      id: 'approvals',
      badge: isAdmin ? 'Module 5 • Admin Management' : 'Module 5 • Community & Approvals',
      title: isAdmin ? 'Admin Approvals & Users' : 'Approvals & Account Status',
      subtitle: isAdmin
        ? 'As an Administrator, you have full control over user registrations, expense verifications, and payment approvals.'
        : 'All shared records go through verified administrative checks to ensure total accounting integrity.',
      icon: ShieldCheck,
      iconColor: 'text-[#C9FF55]',
      iconBg: 'bg-[#C9FF55]/10 border-[#C9FF55]/20',
      highlights: isAdmin
        ? [
            {
              icon: CheckCircle2,
              title: 'Approvals Hub',
              description: 'Quickly approve pending one-off expenses and submitted payments from group members.',
            },
            {
              icon: Users,
              title: 'User Management',
              description: 'Activate newly registered members, assign Administrator roles, and issue password reset links.',
            },
            {
              icon: ShieldCheck,
              title: 'Audit & Safety',
              description: 'Admin-created expenses are auto-confirmed and have full editing/deletion privileges.',
            },
          ]
        : [
            {
              icon: CheckCircle2,
              title: 'Safe Financial Records',
              description: 'Pending expenses and submitted payments are verified by group admins before final settlement.',
            },
            {
              icon: Users,
              title: 'Account Settings',
              description: 'Update your display profile, change password, or verify an updated email in Settings.',
            },
            {
              icon: Sparkles,
              title: 'Replay Guide Anytime',
              description: 'Access this guide anytime by clicking "App Guide" in the sidebar or from Settings.',
            },
          ],
      tip: isAdmin
        ? 'Look out for red badge counters on the Sidebar for pending items awaiting your review.'
        : 'You are all set to start tracking shared expenses with your group!',
      route: isAdmin ? '/approvals' : '/dashboard',
      routeLabel: isAdmin ? 'Open Approvals' : 'Go to Dashboard',
    },
  ];

  const totalSteps = steps.length;
  const current = steps[currentStep];

  // Handle keyboard navigation
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
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, totalSteps, onClose]);

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleJumpToRoute = (route?: string) => {
    if (route) {
      onClose();
      navigate(route);
    }
  };

  if (!isOpen) return null;

  const IconComponent = current.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
      {/* Modal Container */}
      <div
        className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-300"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Bar with Progress Dots and Close */}
        <div className="px-5 sm:px-6 pt-5 pb-3 border-b border-zinc-800/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            {steps.map((step, idx) => (
              <button
                key={step.id}
                onClick={() => setCurrentStep(idx)}
                aria-label={`Go to step ${idx + 1}: ${step.title}`}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300 cursor-pointer',
                  idx === currentStep
                    ? 'w-7 sm:w-9 bg-[#C9FF55]'
                    : idx < currentStep
                    ? 'w-3 sm:w-4 bg-zinc-600 hover:bg-zinc-400'
                    : 'w-2 sm:w-3 bg-zinc-800 hover:bg-zinc-700'
                )}
              />
            ))}
          </div>

          <span className="text-xs text-zinc-500 font-medium whitespace-nowrap">
            {currentStep + 1} of {totalSteps}
          </span>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors cursor-pointer"
            title="Close Guide (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Badge & Step Title */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-zinc-800 text-zinc-300 border border-zinc-700/80">
                {current.badge}
              </span>
            </div>

            <div className="flex items-start gap-3 sm:gap-4 pt-1">
              <div
                className={cn(
                  'w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border flex items-center justify-center shrink-0 shadow-lg',
                  current.iconBg
                )}
              >
                <IconComponent className={cn('w-6 h-6 sm:w-7 sm:h-7', current.iconColor)} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-light text-white tracking-tight">{current.title}</h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1 leading-relaxed">{current.subtitle}</p>
              </div>
            </div>
          </div>

          {/* Highlights List */}
          <div className="grid grid-cols-1 gap-3 sm:gap-3.5 pt-1">
            {current.highlights.map((item, idx) => {
              const ItemIcon = item.icon;
              return (
                <div
                  key={idx}
                  className="flex items-start gap-3.5 p-3 sm:p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700/70 transition-colors"
                >
                  <div className="w-8 h-8 rounded-xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center text-[#C9FF55] shrink-0 mt-0.5">
                    <ItemIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-semibold text-white tracking-tight">{item.title}</h3>
                    <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pro Tip Callout */}
          <div className="p-3.5 rounded-2xl bg-zinc-800/40 border border-zinc-800 flex items-start gap-3 text-xs text-zinc-400">
            <span className="text-xs font-bold text-[#C9FF55] uppercase tracking-wider shrink-0 mt-0.5">Tip:</span>
            <span className="leading-relaxed">{current.tip}</span>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 sm:px-7 py-4 border-t border-zinc-800/80 bg-zinc-950/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              Skip Tour
            </button>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            {current.route && (
              <button
                onClick={() => handleJumpToRoute(current.route)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/60 transition-colors cursor-pointer"
              >
                <span>{current.routeLabel}</span>
                <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
              </button>
            )}

            <button
              onClick={handleNext}
              className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-[#C9FF55] text-zinc-950 hover:bg-[#b8f53b] active:scale-[0.98] transition-all flex items-center gap-2 shadow-md shadow-[#C9FF55]/10 cursor-pointer"
            >
              <span>{currentStep === totalSteps - 1 ? 'Get Started' : 'Next'}</span>
              {currentStep === totalSteps - 1 ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
