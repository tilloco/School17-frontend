import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setUnauthorizedHandler } from './api';
import { clearToken, getToken, saveToken } from './storage';
import type { User } from '../types/api';

interface AuthContextValue {
  isLoading: boolean; // birinchi marta tokenni disk'dan o'qiyapmiz
  token: string | null;
  user: User | null;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const loadUser = useCallback(async (t: string) => {
    try {
      const me = await api.getMe(t);
      setUser(me);
      setToken(t);
    } catch {
      // Token yaroqsiz/eskirgan - tozalab, qayta kirishga yuboramiz
      await clearToken();
      setUser(null);
      setToken(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await getToken();
      if (stored) {
        await loadUser(stored);
      }
      setIsLoading(false);
    })();
  }, [loadUser]);

  const signIn = useCallback(
    async (t: string) => {
      await saveToken(t);
      await loadUser(t);
    },
    [loadUser],
  );

  const signOut = useCallback(async () => {
    await clearToken();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => { setUnauthorizedHandler(() => { void signOut(); }); return () => setUnauthorizedHandler(null); }, [signOut]);

  const refreshUser = useCallback(async () => {
    if (token) await loadUser(token);
  }, [token, loadUser]);

  return (
    <AuthContext.Provider value={{ isLoading, token, user, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth AuthProvider ichida ishlatilishi kerak');
  return ctx;
}
