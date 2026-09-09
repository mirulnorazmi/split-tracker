import React, { StrictMode, useState, useEffect, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Providers } from '@/app/providers';
import { useAuth } from '@/app/AuthContext';
import { AppRoutes } from '@/app/router';
import Sidebar from '@/components/layout/Sidebar';
import { MobileSidebar } from '@/components/layout/MobileSidebar';
import LoadingScreen from '@/components/ui/LoadingScreen';
import AuthPage from '@/features/auth/pages/AuthPage';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';
import { APP_NAME } from '@/lib/constants';
import { prefetchAppData } from '@/lib/hooks/useData';
import SpotlightTour from '@/components/ui/SpotlightTour';
import './index.css';

const ResetPassword = lazy(() => import('@/features/auth/pages/ResetPassword'));
const VerifyEmail = lazy(() => import('@/features/settings/pages/VerifyEmail'));

function AppShell() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const location = useLocation();

  const isDesktop = useBreakpoint('lg');

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      prefetchAppData();
      const storageKey = `splittrack_onboarding_seen_${user.id}`;
      const seen = localStorage.getItem(storageKey);
      if (!seen) {
        const timer = setTimeout(() => {
          setOnboardingOpen(true);
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    const handleOpen = () => setOnboardingOpen(true);
    window.addEventListener('splittrack:open-onboarding', handleOpen);
    return () => window.removeEventListener('splittrack:open-onboarding', handleOpen);
  }, []);

  const handleCloseOnboarding = () => {
    setOnboardingOpen(false);
    if (user?.id) {
      localStorage.setItem(`splittrack_onboarding_seen_${user.id}`, 'true');
    }
  };

  // 0. Public routes — accessible without authentication
  if (location.pathname === '/reset-password') {
    return (
      <Suspense fallback={<LoadingScreen fullScreen />}>
        <ResetPassword />
      </Suspense>
    );
  }
  if (location.pathname === '/verify-email') {
    return (
      <Suspense fallback={<LoadingScreen fullScreen />}>
        <VerifyEmail />
      </Suspense>
    );
  }

  // 1. Initial auth restoration spinner
  if (isLoading) {
    return <LoadingScreen fullScreen />;
  }

  // 2. Unauthenticated: show Login/Register
  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-white font-sans overflow-hidden">
      {/* Desktop sidebar — only on lg+ */}
      {isDesktop ? (
        <Sidebar onClose={() => setSidebarOpen(false)} />
      ) : (
        /* Mobile/tablet slide-over drawer — only on mobile */
        <MobileSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isLocked={onboardingOpen}
        >
          <Sidebar onClose={() => setSidebarOpen(false)} isLocked={onboardingOpen} />
        </MobileSidebar>
      )}

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
            <img
              src="/logo.webp"
              alt={APP_NAME}
              className="w-7 h-7 rounded-lg object-cover border border-zinc-800 shrink-0 shadow-sm"
            />
            <span className="font-semibold text-white text-sm tracking-tight">{APP_NAME}</span>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <AppRoutes />
        </main>
      </div>

      <SpotlightTour
        isOpen={onboardingOpen}
        onClose={handleCloseOnboarding}
        setSidebarOpen={setSidebarOpen}
      />
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
