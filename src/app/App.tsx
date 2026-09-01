/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Menu, Loader2 } from 'lucide-react';
import { Providers } from '@/app/providers';
import { useAuth } from '@/app/AuthContext';
import { AppRoutes } from '@/app/router';
import Sidebar from '@/components/layout/Sidebar';
import { MobileSidebar } from '@/components/layout/MobileSidebar';
import AuthPage from '@/features/auth/pages/AuthPage';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';
import { APP_NAME } from '@/lib/constants';

function AppShell() {
  const { isAuthenticated, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isDesktop = useBreakpoint('lg');

  // 1. Initial auth restoration spinner
  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-zinc-950 items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center font-bold text-accent-text text-xl shadow-lg shadow-accent/20 animate-pulse">
            $
          </div>
          <div className="flex items-center gap-2 text-zinc-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-accent" />
            <span>Loading SplitTrack...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: show Login/Register
  if (!isAuthenticated) {
    return <AuthPage />;
  }

  // 3. Authenticated: render main app workspace
  const sidebarContent = <Sidebar onClose={() => setSidebarOpen(false)} />;

  return (
    <div className="flex h-screen bg-zinc-950 text-white font-sans overflow-hidden">
      {/* Desktop sidebar — always visible on lg+ */}
      {isDesktop && sidebarContent}

      {/* Mobile/tablet slide-over drawer */}
      <MobileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
        {sidebarContent}
      </MobileSidebar>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-900 lg:hidden shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 rounded-lg border border-zinc-700 bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors cursor-pointer"
            aria-label="Open navigation"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center font-bold text-accent-text text-xs">
              $
            </div>
            <span className="font-semibold text-white text-sm tracking-tight">{APP_NAME}</span>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <AppRoutes />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Providers>
      <AppShell />
    </Providers>
  );
}
