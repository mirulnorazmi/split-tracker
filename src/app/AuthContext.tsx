import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, User, LoginResponse, RegisterResponse, setToken, clearToken, ApiError } from '@/lib/api';
import { clearMemoryCache } from '@/lib/hooks/useData';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  register: (name: string, email: string, password: string) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const u = await api.getMe();
      setUser(u);
    } catch {
      clearToken();
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((userData: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...userData } : null));
  }, []);

  // Attempt to restore session on mount
  useEffect(() => {
    const token = localStorage.getItem('splittrack_token');
    if (token) {
      refreshUser().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResponse> => {
    const res = await api.login({ email, password });
    clearMemoryCache();
    setToken(res.token);
    setUser(res.user);
    return res;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string): Promise<RegisterResponse> => {
    const res = await api.register({ name, email, password });
    if (res.token && res.user) {
      clearMemoryCache();
      setToken(res.token);
      setUser(res.user);
    }
    return res;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    } finally {
      clearMemoryCache();
      clearToken();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export { ApiError };