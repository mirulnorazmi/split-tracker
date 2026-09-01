import React from 'react';
import { AuthProvider } from '@/app/AuthContext';

/**
 * Application-wide context providers.
 * AuthProvider must wrap the entire app for API access.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
