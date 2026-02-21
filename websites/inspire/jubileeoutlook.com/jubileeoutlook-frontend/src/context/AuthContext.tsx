import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { User } from '../types/common';
import { authService } from '../services/auth/authService';
import { tokenStore } from '../services/apiClient';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  register: (fullName: string, email: string, password: string, newsletter?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Check if user completed email sync (has userId but no Codex auth token)
const isSyncOnlyUser = (): boolean => {
  return !tokenStore.getAccessToken() && !!tokenStore.getUserId() && !!localStorage.getItem('jubilee_sync_email');
};

const getSyncUser = (): User | null => {
  const email = localStorage.getItem('jubilee_sync_email');
  const userId = tokenStore.getUserId();
  if (!email || !userId) return null;
  return { id: userId, email, displayName: email.split('@')[0] };
};

// Resolve the real Codex userId for a sync-only user by email lookup
async function resolveSyncUserId(): Promise<void> {
  const email = localStorage.getItem('jubilee_sync_email');
  if (!email) return;
  try {
    const codexBaseUrl = (process.env.REACT_APP_CODEX_API_URL || 'http://localhost:4001/api/v1').replace(/\/api\/v1$/, '');
    const res = await axios.get(`${codexBaseUrl}/api/users/email/${encodeURIComponent(email)}`);
    const userData = res.data?.data || res.data;
    if (userData?.id) {
      const currentId = tokenStore.getUserId();
      if (currentId !== userData.id) {
        tokenStore.setUserId(userData.id);
      }
    }
  } catch {
    // User not found in Codex — keep existing userId
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const syncOnly = isSyncOnlyUser();
  const [state, setState] = useState<AuthState>({
    user: syncOnly ? getSyncUser() : null,
    isAuthenticated: syncOnly || authService.isAuthenticated(),
    isLoading: !syncOnly && authService.isAuthenticated(),
  });

  // For sync-only users, resolve their real Codex userId on mount
  useEffect(() => {
    if (!isSyncOnlyUser()) return;
    resolveSyncUserId().then(() => {
      // Refresh user object with the resolved userId
      const resolved = getSyncUser();
      if (resolved) {
        setState(prev => ({ ...prev, user: resolved }));
      }
    });
  }, []);

  useEffect(() => {
    // Skip Codex auth check for sync-only users
    if (isSyncOnlyUser()) return;

    if (state.isAuthenticated && !state.user) {
      authService.getCurrentUser().then((user) => {
        setState((prev) => ({
          ...prev,
          user,
          isAuthenticated: !!user,
          isLoading: false,
        }));
      });
    }
  }, [state.isAuthenticated, state.user]);

  const login = useCallback(async (email: string, password: string, rememberMe: boolean = true) => {
    try {
      const response = await authService.login(email, password);
      if (response.success && response.user) {
        // Store remember me preference
        if (rememberMe) {
          localStorage.setItem('jubilee_remember_email', email);
          localStorage.setItem('jubilee_remember_token', 'true');
        } else {
          localStorage.removeItem('jubilee_remember_email');
          localStorage.removeItem('jubilee_remember_token');
        }
        setState({ user: response.user, isAuthenticated: true, isLoading: false });
        return { success: true };
      }
      return { success: false, error: response.error || 'Login failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    }
  }, []);

  const register = useCallback(async (fullName: string, email: string, password: string, newsletter: boolean = false) => {
    try {
      const response = await authService.register(fullName, email, password, newsletter);
      if (response.success && response.user) {
        // Auto-save credentials after registration
        localStorage.setItem('jubilee_remember_email', email);
        localStorage.setItem('jubilee_remember_token', 'true');
        setState({ user: response.user, isAuthenticated: true, isLoading: false });
        return { success: true };
      }
      return { success: false, error: response.error || 'Registration failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Registration failed' };
    }
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    localStorage.removeItem('jubilee_remember_email');
    localStorage.removeItem('jubilee_remember_token');
    localStorage.removeItem('jubilee_sync_email');
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
