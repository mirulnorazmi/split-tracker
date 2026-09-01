import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface BackButtonProps {
  /** Optional fallback URL if history stack is empty. Defaults to '/dashboard' */
  fallbackPath?: string;
  /** Custom button label. Defaults to 'Back' */
  label?: string;
  /** Optional manual onClick callback override */
  onClick?: () => void;
  className?: string;
}

/**
 * Standardised back-navigation button used on detail and form pages.
 * Safely navigates backward if history is present, or falls back to fallbackPath.
 */
export function BackButton({
  fallbackPath = '/dashboard',
  label = 'Back',
  onClick,
  className,
}: BackButtonProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onClick) {
      onClick();
      return;
    }

    // React Router tracks history position in window.history.state.idx (0 is initial entry)
    const hasHistory = window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0;

    if (hasHistory) {
      navigate(-1);
    } else {
      navigate(fallbackPath, { replace: true });
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={cn(
        'inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer',
        className
      )}
    >
      <ArrowLeft className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}
