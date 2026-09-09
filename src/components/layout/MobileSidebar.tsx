import React, { useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';

type MobileSidebarProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  isLocked?: boolean;
};

/**
 * Slide-over drawer for mobile/tablet navigation.
 *
 * Renders the sidebar content inside a panel that slides in from the left
 * with a semi-transparent backdrop. Uses body scroll lock while open and
 * closes on Escape key or backdrop click (unless isLocked).
 */
export function MobileSidebar({ open, onClose, children, isLocked }: MobileSidebarProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLocked) onClose();
    },
    [onClose, isLocked]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={isLocked ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] transform transition-transform duration-300 ease-in-out lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="relative h-full">
          {children}
        </div>
      </div>
    </>
  );
}