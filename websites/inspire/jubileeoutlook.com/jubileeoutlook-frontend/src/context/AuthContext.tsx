import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User } from '../types/common';
import { authService } from '../services/auth/authService';
import { tokenStore } from '../services/apiClient';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: authService.isAuthenticated(),
    isLoading: authService.isAuthenticated(),
  });

  useEffect(() => {
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

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await authService.login(email, password);
      if (response.success && response.user) {
        setState({ user: response.user, isAuthenticated: true, isLoading: false });
        return { success: true };
      }
      return { success: false, error: response.error || 'Login failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    }
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
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
