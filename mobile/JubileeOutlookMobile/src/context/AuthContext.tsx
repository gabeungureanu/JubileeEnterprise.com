/**
 * AuthContext — mirrors web frontend src/context/AuthContext.tsx exactly.
 * Manages user authentication state with token persistence via AsyncStorage.
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import type { User } from '../types';
import { authService } from '../services/auth/authService';
import { tokenStore, setOnAuthFailure } from '../services/apiClient';
import { StorageKeys, API } from '../constants';
import { storage } from '../utils/storage';

// ---------- State & Context Types ----------

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (
    email: string,
    password: string,
    rememberMe?: boolean,
  ) => Promise<{ success: boolean; error?: string }>;
  register: (
    fullName: string,
    email: string,
    password: string,
    newsletter?: boolean,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshAuthState: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ---------- Sync-Only Helpers ----------

/**
 * Sync-only mode: user completed email sync (has userId + sync email)
 * but never created a Codex auth account. We treat them as authenticated
 * so they can use the mail features.
 */
const checkSyncOnly = async (): Promise<boolean> => {
  const accessToken = tokenStore.getAccessToken();
  const userId = tokenStore.getUserId();
  const syncEmail = await storage.get(StorageKeys.SYNC_EMAIL);
  return !accessToken && !!userId && !!syncEmail;
};

const buildSyncUser = async (): Promise<User | null> => {
  const syncEmail = await storage.get(StorageKeys.SYNC_EMAIL);
  const userId = tokenStore.getUserId();
  if (!syncEmail || !userId) return null;
  return {
    id: userId,
    email: syncEmail,
    displayName: syncEmail.split('@')[0],
    isActive: true,
    createdAt: new Date().toISOString(),
  };
};

// Resolve the real Codex userId for a sync-only user by email lookup
async function resolveSyncUserId(): Promise<void> {
  const syncEmail = await storage.get(StorageKeys.SYNC_EMAIL);
  if (!syncEmail) return;
  try {
    const codexBaseUrl = API.CODEX_BASE_URL.replace(/\/api\/v1$/, '');
    const res = await axios.get(`${codexBaseUrl}/api/users/email/${encodeURIComponent(syncEmail)}`);
    const userData = res.data?.data || res.data;
    if (userData?.id) {
      const currentId = tokenStore.getUserId();
      if (currentId !== userData.id) {
        await tokenStore.setUserId(userData.id);
      }
    }
  } catch {
    // User not found in Codex — keep existing userId
  }
}

// ---------- Provider ----------

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Initialise tokens from AsyncStorage and determine initial auth state
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      // Ensure token cache is hydrated from AsyncStorage
      await tokenStore.init();

      // Note: sync-only auto-detection is NOT run on bootstrap.
      // Sync-only sessions are session-scoped — they only activate when
      // refreshAuthState() is called explicitly after a successful IMAP sync.
      // On app restart, the user must go through the auth flow again.

      // Standard auth: if tokens exist, fetch the current user from Codex
      if (authService.isAuthenticated()) {
        try {
          const user = await authService.getCurrentUser();
          if (!cancelled) {
            setState({
              user,
              isAuthenticated: !!user,
              isLoading: false,
            });
          }
        } catch {
          // Token expired or invalid — clear and show login
          await tokenStore.clear();
          if (!cancelled) {
            setState({ user: null, isAuthenticated: false, isLoading: false });
          }
        }
      } else {
        if (!cancelled) {
          setState({ user: null, isAuthenticated: false, isLoading: false });
        }
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  // Wire up auto-logout when token refresh fails (401 cascade)
  const logout = useCallback(async () => {
    await authService.logout();
    await storage.remove(StorageKeys.REMEMBER_EMAIL);
    await storage.remove(StorageKeys.REMEMBER_TOKEN);
    await storage.remove(StorageKeys.SYNC_EMAIL);
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  // Re-evaluate auth state on demand (used after IMAP sync completes)
  const refreshAuthState = useCallback(async () => {
    await tokenStore.init();

    const isSyncOnly = await checkSyncOnly();
    if (isSyncOnly) {
      // Resolve the real Codex userId before building the sync user
      await resolveSyncUserId();
      const syncUser = await buildSyncUser();
      setState({ user: syncUser, isAuthenticated: !!syncUser, isLoading: false });
      return;
    }

    if (authService.isAuthenticated()) {
      try {
        const user = await authService.getCurrentUser();
        setState({ user, isAuthenticated: !!user, isLoading: false });
      } catch {
        await tokenStore.clear();
        setState({ user: null, isAuthenticated: false, isLoading: false });
      }
    } else {
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  useEffect(() => {
    setOnAuthFailure(() => {
      logout();
    });
  }, [logout]);

  // ---------- Actions ----------

  const login = useCallback(
    async (
      email: string,
      password: string,
      rememberMe: boolean = true,
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await authService.login(email, password);
        if (response.user) {
          // Persist remember-me preference
          if (rememberMe) {
            await storage.set(StorageKeys.REMEMBER_EMAIL, email);
            await storage.set(StorageKeys.REMEMBER_TOKEN, 'true');
          } else {
            await storage.remove(StorageKeys.REMEMBER_EMAIL);
            await storage.remove(StorageKeys.REMEMBER_TOKEN);
          }

          setState({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });
          return { success: true };
        }
        return { success: false, error: 'Login failed' };
      } catch (err: any) {
        return {
          success: false,
          error: err?.response?.data?.error || err?.message || 'Login failed',
        };
      }
    },
    [],
  );

  const register = useCallback(
    async (
      fullName: string,
      email: string,
      password: string,
      newsletter: boolean = false,
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await authService.register(fullName, email, password, newsletter);
        if (response.user) {
          setState({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });
          return { success: true };
        }
        return { success: false, error: 'Registration failed' };
      } catch (err: any) {
        return {
          success: false,
          error: err?.response?.data?.error || err?.message || 'Registration failed',
        };
      }
    },
    [],
  );

  // ---------- Render ----------

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshAuthState }}>
      {children}
    </AuthContext.Provider>
  );
};

// ---------- Hook ----------

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
